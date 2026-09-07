/* The platform view of sign-in attempts against addresses no club owns.
 *
 * WHY THIS SURFACE EXISTS AT ALL. `login_attempts` keys on the email and
 * `login_attempt_record_result` deletes the row on SUCCESS — so an address that
 * matches no account never succeeds and its row is never deleted. The data has
 * been accumulating since August and nothing had ever read it.
 *
 * WHY IT IS PLATFORM-LEVEL AND NOT A TENANT SCREEN. An address belonging to no
 * organisation cannot sensibly appear in one organisation's audit log, and
 * showing it inside a club's own screens would show every club the attempts
 * made against every other club's non-existent addresses. The question the data
 * answers — is one source probing across clubs — is not answerable
 * per-organisation, which is the argument for the platform view rather than an
 * org-less read path in the existing audit viewer.
 *
 * THE GATE IS APPLICATION-LEVEL, DELIBERATELY, and that needs asserting because
 * it is the opposite of how everything else in this product is protected.
 * Fydr's own staff have no database identity: `lib/platformStaff.ts` explains
 * that a fifth role would live in `app_metadata.roles`, which is club-scoped
 * data on a club's user, and would put a Fydr employee inside a customer's RLS
 * boundary. So there is no policy that can express "platform staff", the read
 * runs as the service role, and `isPlatformStaff()` on a VERIFIED session email
 * is the only thing standing in front of it. Get that wrong and this is a
 * cross-tenant leak.
 */
import { readFileSync, existsSync } from 'node:fs';
import { classifyProbe, domainOf, maskLocalPart } from '@/lib/signInProbes';
import { isPlatformStaff } from '@/lib/platformStaff';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

const PAGE = 'src/app/(staff)/platform/sign-in-probes/page.tsx';
const KNOWN = ['ashcomberfc.example', 'marlowvale.example'];

console.log('a typo of a real club domain is not a probe');
{
  /* Production's only unmatched attempt, and the reason this distinction is in
     the product rather than in somebody's head: ashcombeFC vs ashcombeRFC, one
     missing letter, recorded 2026-08-14. A person, not an attacker. */
  assert(classifyProbe('a.selby@ashcombefc.example', KNOWN) === 'typo',
    'a.selby@ashcombefc.example is a typo of ashcomberfc.example — one edit');
  assert(classifyProbe('someone@marlowvale.example', KNOWN) === 'typo',
    'an exact club domain with an unknown local part is a mistyped NAME, not a probe');
  assert(classifyProbe('x@marlowvaie.example', KNOWN) === 'typo', 'l/i transposition is caught');
  assert(classifyProbe('x@ashcomberf.example', KNOWN) === 'typo', 'and a dropped letter');
}

console.log('\nand something unrelated is reported as unrelated, not accused');
{
  assert(classifyProbe('admin@totally-different.test', KNOWN) === 'unknown-domain', 'an unrelated domain');
  assert(classifyProbe('root@localhost', KNOWN) === 'unknown-domain', 'and a nonsense one');
  assert(classifyProbe('not-an-email', KNOWN) === 'unknown-domain', 'and a string that is not an address at all');
  assert(classifyProbe('@nolocal.example', KNOWN) === 'unknown-domain', 'and one with no local part');

  /* THE CONSERVATIVE DIRECTION MATTERS. Two edits is the cap; a domain that
     merely rhymes must not be waved through as a typo, because "mostly typos"
     is how the real one gets missed. */
  assert(classifyProbe('x@ashcomb.example', KNOWN) === 'unknown-domain',
    'three edits away is NOT called a typo — the cap is real');
}

console.log('\nthe domain is kept, the local part is not');
{
  assert(domainOf('a.selby@ashcombefc.example') === 'ashcombefc.example', 'domainOf');
  assert(domainOf('no-at-sign') === null, 'and null when there is no domain');
  assert(domainOf('trailing@') === null, 'or nothing after the @');

  /* The local part is attacker-supplied text. The domain is the signal — is
     somebody walking a club's address space — and a support screen has no
     reason to render arbitrary input in full. Enough is kept to recognise a
     colleague's own mistyped address. */
  const masked = maskLocalPart('a.selby@ashcombefc.example');
  assert(masked.endsWith('@ashcombefc.example'), 'the domain survives masking');
  assert(masked.startsWith('a.'), 'and the first two characters, so a colleague is recognisable');
  assert(!masked.includes('selby'), 'but not the rest of it');
  assert(maskLocalPart('ab@x.test').startsWith('a'), 'a two-character local part still masks');
  assert(!maskLocalPart('<script>alert(1)</script>@x.test').includes('script'),
    'and a hostile local part does not reach the screen intact');
}

console.log('\nthe gate is isPlatformStaff, and unset means nobody');
{
  assert(isPlatformStaff('someone@fydr.test', '') === false, 'an empty allowlist admits nobody');
  assert(isPlatformStaff('someone@fydr.test', undefined) === false, 'and an unset one admits nobody');
  assert(isPlatformStaff('someone@fydr.test', 'someone@fydr.test') === true, 'an allowlisted email is admitted');
  assert(isPlatformStaff('SOMEONE@FYDR.TEST', 'someone@fydr.test') === true, 'case-insensitively');
  assert(isPlatformStaff(null, 'someone@fydr.test') === false, 'and a session with no email is not');
}

console.log('\nthe page is gated, reads as the service role, and shows only org-less rows');
{
  assert(existsSync(PAGE), `${PAGE} exists`);
  if (!existsSync(PAGE)) { console.log(`\n${passed} passed, ${failed + 1} failed`); process.exit(1); }
  const page = strip(read(PAGE));

  assert(/requirePlatformStaff\(/.test(page), 'it calls requirePlatformStaff, not requireStaff');
  assert(!/requireStaff\(/.test(page), 'and NOT requireStaff — a club admin must not reach this');

  /* The read has to bypass RLS: login_attempts_admin_select is
     `org_id = auth_org_id()`, and every row here has a null org_id, so an
     authenticated read returns nothing at all. That makes the application gate
     the only protection, which is why the assertion above matters. */
  assert(/createAdminClient\(/.test(page), 'it reads with the service role, because RLS would return nothing');
  assert(/org_id/.test(page) && /is\(\s*'org_id'\s*,\s*null\s*\)|is\('org_id', null\)/.test(page),
    'and filters to org_id IS NULL — attempts against addresses no club owns');

  /* Attempts against REAL accounts are a club's own business and are already
     recorded as auth.sign_in_failed in their audit_log. Showing them here would
     put one club's failed sign-ins in front of Fydr staff for no reason. */
  assert(!/not\(\s*'org_id'/.test(page), 'and never shows attempts against real accounts');
}

console.log('\nrequirePlatformStaff itself');
{
  const session = strip(read('src/lib/session.ts'));
  assert(/export async function requirePlatformStaff/.test(session), 'it exists in lib/session.ts');
  const fn = session.slice(session.indexOf('export async function requirePlatformStaff'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(/isPlatformStaff\(/.test(body), 'it gates on isPlatformStaff');
  assert(/redirect\(|notFound\(/.test(body), 'and refuses rather than returning null for a caller to forget to check');
}

console.log('\nthe sidebar is untouched — the design is frozen');
{
  /* A platform tool is not a club's navigation. Adding a row would also mean
     deciding what every club's staff see where it would have been, which is a
     design change nobody asked for. URL-reachable is correct for this. */
  const sidebar = read('src/components/Sidebar/Sidebar.tsx');
  assert(!/sign-in-probes|platform\//.test(sidebar), 'no sidebar row was added for it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
