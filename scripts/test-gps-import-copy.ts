/* §0as — the GPS import page no longer says a re-upload "makes a second batch
 * of the same rows". Since 0064/0072 gps_records is unique per (org, athlete,
 * record_date, session_id) and commitGpsImport upserts on exactly those
 * columns, so a re-upload REPLACES the rows it matches. "No revert" is still
 * true. Copy only; the sentence a club reads before deciding whether to
 * re-upload a corrected file.
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const src = readFileSync('src/app/(staff)/settings/imports/page.tsx', 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const flat = src.replace(/\s+/g, ' ');
assert(!/no duplicate detection yet/.test(flat) && !/makes a second batch of the same rows/.test(flat), 'the false half is gone');
assert(/There is no revert\./.test(flat), '"no revert" stays, as its own sentence');
assert(/Re-uploading a corrected file replaces the rows it matches — the same athlete, date and session — and adds the rest; nothing is doubled\./.test(flat), 'the sentence says what the upsert does');
assert(/onConflict: 'org_id,athlete_id,record_date,session_id'/.test(readFileSync('src/lib/queries/gpsImport.ts', 'utf8')), 'and the upsert it describes is still on those four columns');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
