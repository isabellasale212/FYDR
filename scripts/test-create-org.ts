/* Tests for create-org.ts.
 *
 * THE ROLLBACK IS THE POINT. Everything else here is argument validation, which
 * fails loudly the first time you run it wrong. The rollback path only ever
 * executes when something has already gone wrong — on production, on the day a
 * real club signed up — and it is the one thing a successful dry run and a
 * successful real run both leave completely unexercised. So every step gets a
 * planted failure and the exact compensating deletes are asserted, in order.
 *
 * Why that matters more than usual here: a half-created organisation is not a
 * mess somebody finds. Every RLS policy opens with `org_id = auth_org_id()`, so
 * an org nobody is a member of is invisible to every account in the system,
 * including yours. It would sit there, unreachable, until somebody read the
 * table directly.
 *
 * The ops are injected, so none of this touches a database. The real client
 * wiring is exercised separately, by creating a throwaway org on scratch end to
 * end and following the invite link.
 */
import {
  DuplicateOrgError,
  FIRST_STAFF_ROLE,
  SPORTS,
  createOrganisation,
  defaultSeason,
  parseArgs,
  type Ops,
  type OrgSpec,
} from './create-org';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const ARGS = [
  '--name', 'Test Club', '--sport', 'rugby_union',
  '--admin-email', 'Person@Club.com', '--admin-name', 'A Person',
];
const spec = (): OrgSpec => {
  const { spec: s, errors } = parseArgs(ARGS, '2026-09-07');
  if (!s) throw new Error(`fixture args rejected: ${errors.join('; ')}`);
  return s;
};

/** Ops that record what was called, and can be told to fail at one step. */
function recordingOps(failAt?: keyof Ops): { ops: Ops; calls: string[] } {
  const calls: string[] = [];
  const step = <T>(name: keyof Ops, value: T) => async (): Promise<T> => {
    calls.push(name);
    if (name === failAt) throw new Error(`planted failure in ${String(name)}`);
    return value;
  };
  const ops: Ops = {
    findOrgByName: async () => { calls.push('findOrgByName'); return null; },
    createOrg: step('createOrg', 'org-1'),
    createSeason: step('createSeason', 'season-1'),
    invite: step('invite', { userId: 'user-1', inviteUrl: 'https://x/invite' }),
    createUserRow: step('createUserRow', undefined),
    grantRole: step('grantRole', undefined),
    deleteSeason: step('deleteSeason', undefined),
    deleteOrg: step('deleteOrg', undefined),
    deleteUserRow: step('deleteUserRow', undefined),
    deleteAuthUser: step('deleteAuthUser', undefined),
  };
  return { ops, calls };
}

console.log('arguments');
{
  const { spec: s, errors } = parseArgs(ARGS, '2026-09-07');
  assert(errors.length === 0 && s !== null, 'a minimal valid invocation parses');
  assert(s?.admin.email === 'person@club.com', 'the email is lowercased — it is the login identity');
  assert(s?.tier === 'core', 'tier defaults to core rather than being guessed from the club');
  assert(s?.timezone === 'Europe/London' && s?.countryCode === 'GB', 'timezone and country have defaults');
  assert(s?.commit === false, 'and NOTHING is committed without --commit');
  assert(parseArgs([...ARGS, '--commit'], '2026-09-07').spec?.commit === true, '--commit is what arms it');

  const bad = (extra: string[]): string[] => parseArgs([...ARGS, ...extra], '2026-09-07').errors;
  assert(parseArgs(['--sport', 'rugby_union'], '2026-09-07').errors.some((e) => /--name/.test(e)), 'a missing name is rejected');
  assert(bad(['--sport', 'quidditch']).some((e) => /--sport must be one of/.test(e)), 'an invented sport is rejected, with the list');
  assert(bad(['--tier', 'enterprise']).some((e) => /--tier/.test(e)), 'an invented tier is rejected');
  assert(bad(['--timezone', 'Europe/Ashcombe']).some((e) => /timezone/.test(e)), 'a timezone Intl cannot resolve is rejected');
  assert(bad(['--country', 'GBR']).some((e) => /--country/.test(e)), 'a three-letter country code is rejected');
  assert(bad(['--admin-email', 'not-an-email']).some((e) => /--admin-email/.test(e)), 'a malformed email is rejected');
  assert(bad(['--season-start', '2027-07-01', '--season-end', '2026-06-30']).some((e) => /before/.test(e)), 'a season ending before it starts is rejected');
  assert(bad(['--season-start', '01/07/2026']).some((e) => /YYYY-MM-DD/.test(e)), 'and a non-ISO date is rejected');
  assert(SPORTS.includes('rugby_union'), 'the sport list matches the org_sport enum this app actually has');
}

console.log('\nthe default season is the one a club signing up today is in');
{
  assert(defaultSeason('2026-09-07').name === '2026/27', 'September falls in the season that started that July');
  assert(defaultSeason('2026-09-07').startsOn === '2026-07-01', 'starting 1 July');
  assert(defaultSeason('2026-09-07').endsOn === '2027-06-30', 'ending 30 June');
  assert(defaultSeason('2026-03-01').name === '2025/26', 'March falls in the season that started the PREVIOUS July');
  assert(defaultSeason('2026-07-01').name === '2026/27', 'and 1 July is the first day of the new one, not the last of the old');
}

console.log('\nthe happy path writes five things, in an order the schema requires');
{
  const { ops, calls } = recordingOps();
  const result = await createOrganisation(ops, spec());
  assert(
    calls.join(' ') === 'findOrgByName createOrg createSeason invite createUserRow grantRole',
    `five writes in order, after the duplicate check (${calls.join(' ')})`,
  );
  assert(calls.indexOf('createOrg') < calls.indexOf('createSeason'), 'the season needs its org');
  assert(calls.indexOf('invite') < calls.indexOf('createUserRow'), 'and the users row needs the id generateLink assigns');
  assert(!calls.some((c) => c.startsWith('delete')), 'nothing is rolled back when nothing failed');
  assert(result.inviteUrl === 'https://x/invite', 'and the invite link comes back to be handed over');
}

console.log('\na duplicate name is refused before anything is written');
{
  const { ops, calls } = recordingOps();
  ops.findOrgByName = async () => { calls.push('findOrgByName'); return { id: 'existing-org' }; };
  let err: unknown = null;
  await createOrganisation(ops, spec()).catch((e) => { err = e; });
  assert(err instanceof DuplicateOrgError, 'it throws DuplicateOrgError');
  assert(/already exists/.test(String(err)) && /existing-org/.test(String(err)), 'naming the org that is in the way');
  assert(calls.join(' ') === 'findOrgByName', 'and writes nothing at all — re-running is safe');
}

console.log('\nevery failure undoes exactly what came before it, in reverse');
{
  const cases: { failAt: keyof Ops; expect: string[] }[] = [
    { failAt: 'createOrg', expect: [] },
    { failAt: 'createSeason', expect: ['deleteOrg'] },
    { failAt: 'invite', expect: ['deleteSeason', 'deleteOrg'] },
    { failAt: 'createUserRow', expect: ['deleteAuthUser', 'deleteSeason', 'deleteOrg'] },
    { failAt: 'grantRole', expect: ['deleteUserRow', 'deleteAuthUser', 'deleteSeason', 'deleteOrg'] },
  ];
  for (const { failAt, expect } of cases) {
    const { ops, calls } = recordingOps(failAt);
    let threw = false;
    await createOrganisation(ops, spec()).catch(() => { threw = true; });
    const undone = calls.filter((c) => c.startsWith('delete'));
    assert(threw, `a failure in ${failAt} is rethrown, not swallowed`);
    assert(
      undone.join(' ') === expect.join(' '),
      `and undoes [${expect.join(', ') || 'nothing'}] (saw [${undone.join(', ') || 'nothing'}])`,
    );
  }
}

console.log('\na rollback that itself fails still reports the original problem');
{
  const { ops } = recordingOps('grantRole');
  ops.deleteAuthUser = async () => { throw new Error('auth delete exploded'); };
  const lines: string[] = [];
  let err: unknown = null;
  await createOrganisation(ops, spec(), (l) => lines.push(l)).catch((e) => { err = e; });
  assert(/planted failure in grantRole/.test(String(err)), 'the error surfaced is the real one, not the cleanup error');
  assert(lines.some((l) => /COULD NOT ROLL BACK auth user/.test(l)), 'and the cleanup failure is reported rather than swallowed');
  assert(lines.some((l) => /rolled back: organisation/.test(l)), 'while the rest of the rollback still runs');
}

console.log('\nthe first account can onboard the rest of the club');
{
  assert(FIRST_STAFF_ROLE === 'sport_scientist', 'the role granted is sport_scientist');
  /* Not cosmetic: organisations_admin_update names this role, and it is the
     gate on settings/users/create. Any lesser role and the club's first person
     cannot invite their own coaches. */
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
