/* G-43. The two athlete-link sites that reported plain success for a record they
 * never linked.
 *
 * WHY THIS ONE IS BEHAVIOURAL rather than source-level like test-silent-saves.
 * The bug is not that the code fails to check a row count — after the fix it
 * does, and a source scan would confirm that and stop. The bug is that ZERO ROWS
 * HAS TWO MEANINGS here, because `.is('user_id', null)` matches only an unlinked
 * record: nothing changing means either the record was already linked, or the
 * policy refused. Only running it against real policies with a real signed-in
 * role separates those, so that is what this does.
 *
 * Every outcome below is produced by the database, not by a stub. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import { linkAthleteToUser } from '@/lib/queries/userManagement';

const url = process.env.SCRATCH_SUPABASE_URL!;
const anon = process.env.SCRATCH_SUPABASE_ANON_KEY!;
const ORG = 'a0000000-0000-4000-8000-000000000001';
const PASSWORD = 'TestPass123!';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string, got?: unknown): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}${got !== undefined ? `\n         got: ${JSON.stringify(got)}` : ''}`); }
}

async function signIn(email: string): Promise<{ db: SupabaseClient; userId: string }> {
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { db, userId: data.user!.id };
}

const admin = new pg.Client({ connectionString: process.env.SCRATCH_DB_URL!, ssl: { rejectUnauthorized: false } });
await admin.connect();

/* A probe athlete, because Ashcombe has no unlinked record to borrow and
   unlinking a seeded one would edit data to suit the test. dob is required by
   athletes_dob_required_when_linked the moment a link succeeds. */
const { rows: [probe] } = await admin.query(
  `insert into athletes (org_id, first_name, last_name, date_of_birth)
   values ($1,'Probe','Linktest','1999-05-05') returning id`, [ORG]);

/* Two user ids not already spoken for: athletes.user_id is UNIQUE, so a linked
   one would fail the constraint rather than the policy and prove nothing. */
const { rows: free } = await admin.query(
  `select u.id from auth.users u
    where not exists (select 1 from athletes a where a.user_id = u.id)
    limit 2`);
const [userA, userB] = free.map(r => r.id as string);
if (!userA || !userB) {
  /* Loud rather than skipped. Two free ids is a precondition of the test, not a
     detail: without them the assertions below would still run and still pass,
     against a null user id, and prove nothing at all. */
  throw new Error(`needs two auth users not already linked to an athlete, found ${free.length}`);
}

try {
  const ss = await signIn('j.pemberton@ashcomberfc.example');       // sport scientist: may link
  const nut = await signIn('k.doyle@ashcomberfc.example');          // nutritionist: may not

  console.log('\nfirst link, by the role that owns it');
  const r1 = await linkAthleteToUser(ss.db, ORG, ss.userId, 'sport_scientist', userA, probe.id);
  assert(r1.error === null && r1.primaryOk === true, 'sport scientist links an unlinked record', r1);

  console.log('\nsame person again — the outcome that used to read as success');
  const r2 = await linkAthleteToUser(ss.db, ORG, ss.userId, 'sport_scientist', userA, probe.id);
  assert(r2.primaryOk === false, 'is not reported as a successful link', r2);
  assert(/already linked to this person/i.test(r2.error ?? ''), 'says it was already linked to this person', r2.error);

  console.log('\na different account — distinct from both success and refusal');
  const r3 = await linkAthleteToUser(ss.db, ORG, ss.userId, 'sport_scientist', userB, probe.id);
  assert(r3.primaryOk === false, 'is not reported as a successful link', r3);
  assert(/already linked to a different account/i.test(r3.error ?? ''), 'names the different account', r3.error);

  console.log('\nan actual refusal, so the three do not collapse into one message');
  await admin.query(`update athletes set user_id = null where id = $1`, [probe.id]);
  const r4 = await linkAthleteToUser(nut.db, ORG, nut.userId, 'nutritionist', userA, probe.id);
  assert(r4.primaryOk === false, 'the nutritionist does not link', r4);
  assert(/belongs to the sport scientist/i.test(r4.error ?? ''), 'says who it belongs to instead of claiming already-linked', r4.error);

  console.log('\nand the refusal really was a refusal, not a no-op');
  const { rows: [after] } = await admin.query(`select user_id from athletes where id = $1`, [probe.id]);
  assert(after.user_id === null, 'the record is still unlinked after the refusal', after);

  const messages = [r2.error, r3.error, r4.error];
  assert(new Set(messages).size === 3, 'all three non-success outcomes read differently', messages);
} finally {
  await admin.query(`delete from athletes where id = $1`, [probe.id]);
  await admin.end();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
