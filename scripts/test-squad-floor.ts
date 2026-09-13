/* PATTERN-S7 C8 — suppression below five athletes with data, one shared rule
 * on every report and panel (2026-09-13). The rule is pure; every site that
 * aggregates a squad is read from source and must import it. */
import { readFileSync } from 'node:fs';
import { MIN_ATHLETES_WITH_DATA, belowSquadFloor, squadFloorNote } from '@/lib/smallSample';
import { POSITIONAL_MIN_N } from '@/lib/queries/positionalContext';
import { BAND_SHADING_MIN_N } from '@/lib/queries/playerProfile';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the rule');
{
  assert(MIN_ATHLETES_WITH_DATA === 5, 'five');
  assert(belowSquadFloor(4) && !belowSquadFloor(5) && belowSquadFloor(0), 'four is below, five is not');
  assert(squadFloorNote('Shading', 3) === 'Shading is off — 3 athletes have data, fewer than 5. The individual numbers are unchanged.', 'the notice, in words');
  assert(squadFloorNote('The squad median', 1) === 'The squad median is off — 1 athlete has data, fewer than 5. The individual numbers are unchanged.', 'one athlete');
  assert(/no athletes have data/.test(squadFloorNote('The squad mean', 0)), 'none');
}

console.log('\n2. the two floors that existed are the one floor now');
{
  assert(POSITIONAL_MIN_N === MIN_ATHLETES_WITH_DATA && BAND_SHADING_MIN_N === MIN_ATHLETES_WITH_DATA, 'the positional band and the profile shading read the shared constant');
  assert(/POSITIONAL_MIN_N = MIN_ATHLETES_WITH_DATA/.test(read('src/lib/queries/positionalContext.ts')), 'by import, not by coincidence');
  assert(/BAND_SHADING_MIN_N = MIN_ATHLETES_WITH_DATA/.test(read('src/lib/queries/playerProfile.ts')), 'both of them');
}

console.log('\n3. the sweep: every squad aggregate asks the rule');
{
  const training = strip(read('src/app/(staff)/reports/training/page.tsx'));
  assert(/const heatFloored = belowSquadFloor\(athletesWithData\)/.test(training) && /const heatOn = heatPref && !heatFloored/.test(training), 'the training report\'s heat shading is off below the floor');
  // Repointed 2026-09-13 (PATTERN-S7 C1): the floor is said inside the figure card's exclusions (boardFigure's `floored`).
  assert(/floored: heatFloored/.test(training) && /Fewer than five have data, so shading is off; the numbers are unchanged\./.test(read('src/lib/reportFigureCards.ts')), 'and says so');
  const testing = strip(read('src/lib/queries/testingReport.ts'));
  assert(/const floored = belowSquadFloor\(values\.length\);/.test(testing) && /const median = floored \? null : quartile\(values, 0\.5\);/.test(testing), 'the testing report\'s median and quartiles are null below the floor');
  // Repointed 2026-09-13 (PATTERN-S7 C1): the floor rides in the figure card's `floored`.
  assert(/floored: byTest\.rows\.length > 0 && belowSquadFloor\(byTest\.rows\.length\),/.test(strip(read('src/app/(staff)/reports/testing/page.tsx'))), 'and the page says so (through the coverage sentence since S7 C2)');
  const compliance = strip(read('src/app/(staff)/reports/compliance/page.tsx'));
  assert(/const squadMean = measured\.length > 0 && !belowSquadFloor\(measured\.length\)/.test(compliance) && /squadFloorNote\('The squad mean', measured\.length\)/.test(compliance), 'the compliance squad mean is off below the floor, with the note');
  const builder = strip(read('src/lib/queries/analytics.ts'));
  assert(/value: belowSquadFloor\(values\.length\) \? null : values\.reduce/.test(builder), 'the analytics builder\'s population mean is null on a day fewer than five have a value');
}

console.log('\n4. the spec');
{
  assert(/five athletes with data/.test(read('docs/screens/17-reports-hub.md')) && /lib\/smallSample\.ts/.test(read('docs/screens/17-reports-hub.md')), '17-reports-hub.md states the one rule');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
