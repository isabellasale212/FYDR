/* ATH-ADULT-13 C2 — one correction component (2026-09-13). The session
 * detail's set rows open the LOGGER's correction (the chip-and-footer shape
 * of 09 C1 / 11 C1) for that set — /gym/[sessionId]?log=<logId>&correct=<setId>
 * — and the detail's own inline correction form goes. The logger can open a
 * past log by id (never creating one), so a set from any day is corrected
 * in the one place. */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the logger opens a past log by id, and never creates one for it');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/opts: \{ logId\?: string \} = \{\}/.test(q), 'startOrGetSessionLog takes the log id');
  assert(/if \(opts\.logId\) \{[\s\S]{0,600}\.eq\('id', opts\.logId\)[\s\S]{0,300}\.eq\('programme_session_id', programmeSessionId\)/.test(q), 'a named log is read by id, for this programme session, own rows only (RLS)');
  const byId = q.slice(q.indexOf('if (opts.logId) {'), q.indexOf('if (opts.logId) {') + 900);
  assert(!/\.insert\(/.test(byId) && /return \{ id: null, status: null, startedAt: null, completedAt: null, entryDate: null, error: 'That session is not on your record\.' \}/.test(byId), 'a log that is not there is an error, never a new row');
  assert(/entryDate: string \| null;/.test(q), 'and the read says which day the log is for');
}

console.log('\n2. the logger page reads ?log= and ?correct=');
{
  const page = strip(read('src/app/(athlete)/gym/[sessionId]/page.tsx'));
  assert(/searchParams: Promise<Record<string, string \| string\[\] \| undefined>>/.test(page), 'the page takes search params');
  assert(/const logParam = typeof sp\.log === 'string' && isUuid\(sp\.log\) \? sp\.log : undefined;/.test(page), '?log= only as a real uuid');
  assert(/const correctParam = typeof sp\.correct === 'string' && isUuid\(sp\.correct\) \? sp\.correct : null;/.test(page), '?correct= only as a real uuid');
  assert(/startOrGetSessionLog\(\s*db,\s*orgId,\s*athleteId,\s*sessionId,\s*timezone,\s*\{ logId: logParam \},?\s*\)/.test(page), 'the log id reaches the read');
  assert(/openCorrectionId=\{correctParam\}/.test(page), 'and the set to correct reaches the logger');
  assert(/fetchPersonalBestsBefore\(db, orgId, athleteId, exercises\.map\(\(ex\) => ex\.exercise_id\), entryDate \?\? todayIso\(timezone\)\)/.test(page), 'a past log\'s "best before" is before ITS day, not today');
}

console.log('\n3. the logger opens on that set');
{
  const lg = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/openCorrectionId\?: string \| null;/.test(lg), 'the prop');
  assert(/const openRow = openCorrectionId \? \(loggedSets\.find\(\(r\) => r\.id === openCorrectionId\) \?\? null\) : null;/.test(lg), 'resolved against the logged sets — a stale id opens nothing');
  assert(/useState<string \| null>\(openRow\?\.id \?\? null\)/.test(lg) && /useState<\{ weight: number \| null; reps: number \| null \}>\(\s*openRow \? \{ weight: openRow\.load_kg, reps: openRow\.reps_completed \} : \{ weight: null, reps: null \},?\s*\)/.test(lg), 'the correction is open with the set\'s own numbers');
  assert(/useState\(openRow !== null\)/.test(lg), 'and on a finished session the sets are revealed beneath the summary');
}

console.log('\n4. the detail page links each row to it; its own form is gone');
{
  const list = strip(read('src/components/GymSessionSetsList/GymSessionSetsList.tsx'));
  assert(!/reviseGymSetLog/.test(list) && !/useMutation/.test(list) && !/validateCorrection/.test(list), 'no second correction path — the logger\'s is the one');
  assert(/correctHref: \(setId: string\) => string \| null;/.test(list), 'the list takes a link builder');
  assert(/href=\{href\}/.test(list) && /Correct ›|Correct &rsaquo;/.test(list), 'each row links to the logger\'s correction');
  assert(/A correction keeps the original\. Corrections stay open on a finished\s*session\./.test(list.replace(/\s+/g, ' ')), 'the board\'s two sentences stay');
  const page = strip(read('src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx'));
  assert(/correctHref=\{\(setId\) =>\s*session\.programme_session_id \? `\/gym\/\$\{session\.programme_session_id\}\?log=\$\{gymSessionLogId\}&correct=\$\{setId\}` : null\s*\}/.test(page), 'the detail builds the link from its own log and programme session');
}

console.log('\n5. the spec');
{
  assert(/correct=/.test(read('docs/athlete/screens/06-my-data.md')) || /one correction/.test(read('docs/athlete/screens/06-my-data.md')), '06-my-data.md describes the one correction component');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
