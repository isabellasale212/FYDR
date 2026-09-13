/* PATTERN-S8 C11 (2026-09-13): an import holds what it cannot match, named on
 * screen; matching once teaches the vendor's spelling. */
import { readFileSync } from 'node:fs';
import { GPS_IMPORT_HEADERS, normaliseName, parseGpsImportCsv } from '@/lib/queries/gpsImport';
import { heldRowLine, heldSummary, matchedLine } from '@/lib/importHeld';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const roster = [
  { id: 'a1', first_name: 'James', last_name: 'Barnes', preferred_name: null },
  { id: 'a2', first_name: 'Max', last_name: 'Chapman', preferred_name: null },
  { id: 'a3', first_name: 'Max', last_name: 'Chapman', preferred_name: 'Maxi' },
];
const csv = (rows: string[]) => [GPS_IMPORT_HEADERS.join(','), ...rows].join('\n');

console.log('1. the parser holds, rejects and matches');
{
  const r = parseGpsImportCsv(csv(['James Barnes,2026-09-02,5320,,,,,,,', 'J Barnes,2026-09-02,4100,,,,,,,', 'Max Chapman,2026-09-02,3000,,,,,,,', 'J Barnes,2026-09-03,abc,,,,,,,']), roster);
  assert(r.accepted.length === 1 && r.accepted[0]!.athlete_id === 'a1', 'a roster name is accepted');
  assert(r.held.length === 2, 'two rows are held, not rejected');
  assert(r.held[0]!.player_name === 'J Barnes' && r.held[0]!.record_date === '2026-09-02' && r.held[0]!.values.total_distance_m === 4100 && /No athlete on the roster matches "J Barnes"/.test(r.held[0]!.reason), 'an unknown name is held with its date and its values');
  assert(r.held[1]!.player_name === 'Max Chapman' && /matches more than one athlete/.test(r.held[1]!.reason), 'an ambiguous name is held with that reason');
  assert(r.rejected.length === 1 && r.rejected[0]!.row === 5 && /must be a positive number/.test(r.rejected[0]!.reason), 'a bad number is still rejected — the vendor must fix it, no matching would help');
  const again = parseGpsImportCsv(csv(['J Barnes,2026-09-02,4100,,,,,,,']), roster, [{ alias: 'j barnes', athlete_id: 'a1' }]);
  assert(again.accepted.length === 1 && again.accepted[0]!.athlete_id === 'a1' && again.held.length === 0, 'the remembered spelling matches without a question');
  const rosterWins = parseGpsImportCsv(csv(['James Barnes,2026-09-02,4100,,,,,,,']), roster, [{ alias: 'james barnes', athlete_id: 'a2' }]);
  assert(rosterWins.accepted[0]!.athlete_id === 'a1', 'an alias never overrides a roster name');
  assert(normaliseName('  J   Barnes ') === 'j barnes', 'the key is trimmed, lower-cased, single-spaced — the same key 0115 constrains');
  const dup = parseGpsImportCsv(csv(['James Barnes,2026-09-02,5320,,,,,,,', 'J Barnes,2026-09-02,4100,,,,,,,']), roster, [{ alias: 'j barnes', athlete_id: 'a1' }]);
  assert(dup.accepted.length === 1 && dup.rejected.length === 1 && /Row 2 \("James Barnes"\) already carries James Barnes for 2026-09-02 — one row per athlete per date/.test(dup.rejected[0]!.reason), 'two spellings of one athlete on one date: the second is rejected naming the first, never a failed upsert');
}

console.log('\n2. the words');
{
  assert(heldSummary(1) === '1 row held for a name to match' && heldSummary(2) === '2 rows held for a name to match' && heldSummary(0) === 'Nothing held', 'the card title');
  assert(heldRowLine({ row_number: 14, filename: 'session.csv', record_date: '2026-09-02', reason: 'No athlete on the roster matches "J Barnes"', values: { total_distance_m: 5320 } }) === 'Row 14 of session.csv · 2026-09-02 · 5,320 m · No athlete on the roster matches "J Barnes"', 'the row line');
  assert(/^Matched "J Barnes" to James Barnes: one GPS record written\. "J Barnes" is remembered as James Barnes — the next file with that spelling matches without asking\.$/.test(matchedLine({ playerName: 'J Barnes', athleteName: 'James Barnes', aliasRemembered: true })), 'after Match: the record and the remembered spelling');
  assert(/already remembered for another athlete/.test(matchedLine({ playerName: 'J Barnes', athleteName: 'James Barnes', aliasRemembered: false })), 'a collision is said, never silently re-pointed');
}

console.log('\n3. the schema, the routes, the screen');
{
  const mig = read('supabase/migrations/0115_import_held_rows_and_aliases.sql');
  assert(/create table public\.import_held_rows/.test(mig) && /status in \('held', 'matched', 'discarded'\)/.test(mig) && /create table public\.athlete_import_aliases/.test(mig) && /unique \(org_id, alias\)/.test(mig), 'two tables: held rows resolved by status; one alias per org per spelling');
  assert(/alias = lower\(btrim\(alias\)\)/.test(mig), 'the alias key is normalised at the table');
  assert(!/for delete/.test(mig), 'no delete policy: nothing is removed');
  const t = read('supabase/tests/710_import_held_rows_and_aliases_test.sql');
  assert(/the same spelling cannot point at a second athlete/.test(t) && /the coach holds nothing/.test(t) && /an alias is never deleted/.test(t), 'the pgTAP test covers the collision, the coach, no delete');
  const q = strip(read('src/lib/queries/gpsImport.ts'));
  assert(/export async function matchHeldRow/.test(q) && /onConflict: 'org_id,athlete_id,record_date,session_id'/.test(q) && /from\('athlete_import_aliases'\)\.insert/.test(q) && /status: 'matched'/.test(q), 'Match writes the GPS row with the import\'s own upsert, remembers the alias, resolves by status');
  assert(/from\('import_held_rows'\)\.insert\(/.test(q), 'the commit writes the held rows against the batch');
  const up = strip(read('src/app/(staff)/settings/imports/upload/route.ts'));
  assert(/fetchImportAliases\(db, orgId\)/.test(up) && /parseGpsImportCsv\(text, roster, aliases\)/.test(up) && /heldCount: result\.held\.length/.test(up), 'the upload reads the aliases and reports held rows');
  const held = strip(read('src/app/(staff)/settings/imports/held/route.ts'));
  assert(/hasAnyRole\(claims\.roles, GPS_IMPORT\)/.test(held) && /isPremium\(tier\)/.test(held) && /matchHeldRow\(/.test(held) && /discardHeldRow\(/.test(held), 'the resolve route holds the upload\'s two gates');
  const panel = strip(read('src/components/HeldRowsPanel/HeldRowsPanel.tsx'));
  assert(/heldRowLine\(row\)/.test(panel) && /Match/.test(panel) && /Discard/.test(panel) && /matchedLine\(/.test(panel), 'the panel names each row, offers Match and Discard, and says what a match did');
  const page = strip(read('src/app/(staff)/settings/imports/page.tsx'));
  assert(/<HeldRowsPanel rows=\{held\} roster=\{roster\} \/>/.test(page), 'the imports page shows the held rows above the history');
  const form = strip(read('src/components/GpsImportForm/GpsImportForm.tsx'));
  assert(/held for a name to match/.test(form), 'the result line says held separately from rejected');
  assert(/held/i.test(read('docs/screens/62-import-gps.md')) && /spelling/i.test(read('docs/screens/62-import-gps.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
