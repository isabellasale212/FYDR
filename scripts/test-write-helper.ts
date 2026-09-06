/* G-36. The shared write helper, exercised rather than inspected.
 *
 * This is a unit test with stubbed PostgREST results, which is unusual in this
 * repo and deliberate here: the helper's whole job is to tell three outcomes
 * apart that a real database makes it awkward to produce on demand. A genuine
 * refusal, a genuine error and a genuine success are one line each as stubs and
 * a fixture apiece against Postgres.
 *
 * The behaviour that matters is the middle case. An UPDATE that RLS filters
 * returns error: null and an empty array, which is indistinguishable from
 * success to every caller that checks only `error`.
 */
import { mustAffect, mustAffectOrThrow } from '@/lib/write';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const stub = (data: unknown[] | null, error: { message: string } | null = null) =>
  Promise.resolve({ data, error });

const REFUSAL = 'Not saved: this belongs to the medic.';

console.log('\n-- mustAffect --');
assert((await mustAffect(stub([{ id: 'a' }]), { refusal: REFUSAL })).error === null,
  'a write that changed a row reports success');
assert((await mustAffect(stub([]), { refusal: REFUSAL })).error === REFUSAL,
  'a write that changed NOTHING reports the refusal, which is the whole point');
assert((await mustAffect(stub(null), { refusal: REFUSAL })).error === REFUSAL,
  'and so does a null data payload, which PostgREST returns for some shapes');
assert((await mustAffect(stub(null, { message: 'boom' }), { refusal: REFUSAL })).error === 'boom',
  'a real database error is passed through, not replaced by the refusal');
assert(
  (await mustAffect(stub(null, { message: 'boom' }), { refusal: REFUSAL, onError: (m) => `mapped:${m}` })).error === 'mapped:boom',
  'onError maps a real error, so humanizeDbError still applies where callers used it');
assert((await mustAffect(stub([{ id: 'a' }, { id: 'b' }]), { refusal: REFUSAL })).error === null,
  'more than one affected row is a success, not an anomaly: bulk writes are legitimate');

console.log('\n-- mustAffectOrThrow, for the callers that throw --');
let threw: string | null = null;
try { await mustAffectOrThrow(stub([{ id: 'a' }]), REFUSAL); } catch (e) { threw = (e as Error).message; }
assert(threw === null, 'does not throw when a row changed');
try { await mustAffectOrThrow(stub([]), REFUSAL); } catch (e) { threw = (e as Error).message; }
assert(threw === REFUSAL, 'throws the refusal when nothing changed');
try { await mustAffectOrThrow(stub(null, { message: 'boom' }), REFUSAL); } catch (e) { threw = (e as Error).message; }
assert(threw === 'boom', 'throws the real error when there was one');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
