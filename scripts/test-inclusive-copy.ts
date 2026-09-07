/* The product does not assume every athlete is male.
 *
 * WHAT THIS FOUND, 2026-09-07. Every readiness and comparison string in the
 * staff app called the athlete "he": "vs his own 68", "Above his own band",
 * "Compared with his position", "What he reported", "Called him Wednesday".
 * Thirty-five of them across nine files, and there is NO gender or pronoun
 * column anywhere in the schema — checked — so this was never data defaulting
 * to male. It was hardcoded, in a product whose stated market is
 * "semi-professional squad sport in the UK and Ireland" and whose sport's
 * fastest-growing participation is women's and girls'.
 *
 * A readiness card reading "vs his own 68" in front of a women's squad ends a
 * demo in the first thirty seconds, and it is wrong for those players every day
 * after that.
 *
 * WHY THE FIX IS COPY AND NOT A PRONOUN FIELD. A field buys a data-collection
 * question nobody asked for, a migration, a settings surface, an import path
 * and a default for the athletes already in production, and it is wrong until
 * somebody fills it in. Singular "they" is correct for everybody on day one,
 * costs nothing, and in most of these the possessive was carrying almost no
 * meaning: the card names the athlete directly above the sentence.
 *
 * THE CHECK COVERS COMMENTS TOO, deliberately. Internal prose that says "he"
 * about a hypothetical athlete is where the shipped copy came from in the first
 * place, and a rule with an exception for the place the habit lives is not a
 * rule. An occurrence that is genuinely about a specific real person carries
 * `// inclusive-copy-exempt: <why>`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

/** Gendered third-person singular. `they/them/their` are what replace these. */
const PRONOUN = /\b(his|hers|him|himself|herself|she|he|her)\b/i;
const EXEMPT = /inclusive-copy-exempt:\s*\S/;

console.log('no gendered pronoun in any athlete-facing string, or in the prose behind it');
{
  const offenders: string[] = [];
  for (const file of walk('src')) {
    const src = readFileSync(file, 'utf8');
    if (EXEMPT.test(src)) continue;
    src.split('\n').forEach((line, i) => {
      if (PRONOUN.test(line)) offenders.push(`${file.replace('src/', '')}:${i + 1}  ${line.trim().slice(0, 84)}`);
    });
  }
  assert(offenders.length === 0, `no gendered pronouns in src/ (found ${offenders.length})`);
  for (const o of offenders.slice(0, 40)) console.log(`         ${o}`);
  if (offenders.length > 40) console.log(`         …and ${offenders.length - 40} more`);
}

console.log('\nthe replacements read as English, not as find-and-replace');
{
  const read = (p: string): string => readFileSync(p, 'utf8');
  const status = read('src/lib/status.ts');
  assert(/Above their own band/.test(status), 'status.ts: "Above their own band"');
  assert(/Below their own band/.test(status), '  and below');
  assert(/Inside their own band/.test(status), '  and inside');

  const flags = read('src/components/DashboardFlagsPanel/DashboardFlagsPanel.tsx');
  assert(/vs their own \$\{r\.baseline\}/.test(flags), 'the flags card reads "vs their own 68"');

  const gym = read('src/app/(staff)/squad/[athleteId]/gym/page.tsx');
  assert(/they are doing it as written/.test(gym), 'gym: "they are doing it as written", not "he is"');
  assert(/What they actually did, as they logged it/.test(gym), '  and "What they actually did, as they logged it"');
  assert(/compared with their position/i.test(gym), '  and "compared with their position"');

  const wellness = read('src/app/(staff)/squad/[athleteId]/wellness/page.tsx');
  assert(/What they reported/.test(wellness), 'wellness: "What they reported"');
  assert(/what is normal for them/.test(wellness), '  and "what is normal for them"');

  const triage = read('src/components/ProblemReportsTriage/ProblemReportsTriage.tsx');
  assert(/Called them Wednesday/.test(triage), 'the triage placeholder says "Called them Wednesday"');
}

console.log('\nand the one false positive is gone rather than exempted');
{
  /* TestBests built "This season's" as `${cond ? '…: t' : 'T'}his season's`,
     splitting the word across a template expression — so a word-boundary search
     read a stray "his". Rewritten to hold the word together, which is clearer
     anyway and means the guard needs no exception for it. */
  const bests = readFileSync('src/components/TestBests/TestBests.tsx', 'utf8');
  assert(!/'T'\}his/.test(bests), 'the word "This" is no longer split across a template expression');
  assert(/This season/.test(bests), 'and still reads "This season\'s best…"');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
