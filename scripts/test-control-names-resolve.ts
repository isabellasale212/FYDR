/* If the copy names a control, that control must exist under that exact name.
 *
 * TWO REAL BUGS OF THIS SHAPE WERE FOUND BY HAND, which is why it is a test:
 *
 *   NutritionCheckinForm pointed an athlete with a medical concern at
 *   "Something not right?" on Today. That row was REMOVED by the athlete
 *   redesign — test-today-redesign.ts asserts its absence — so the one athlete
 *   most likely to follow that pointer found nothing. Nothing errored; the
 *   sentence was simply false.
 *
 *   Today's RPE to-do reads "How hard was it" and the screen it opens is titled
 *   "How hard was it?". One character, and the kind of drift nobody reads twice.
 *
 * HOW IT WORKS. Every name the copy uses to refer to a control is checked against
 * the set of labels the athlete app actually renders — headings, buttons, links,
 * and Me's row keys. A reference that matches no label is a promise the app does
 * not keep.
 *
 * IT IS DELIBERATELY EXACT, punctuation included, because that is the whole
 * point: "How hard was it" and "How hard was it?" are different strings, and a
 * fuzzy match would have let the bug through. If a legitimate reference fails,
 * the fix is to make the two agree, not to loosen the comparison.
 */
import { readFileSync, readdirSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const blank = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

/** The athlete surface: its routes, plus the components those routes render. */
const files: string[] = [];
for (const f of readdirSync('src/app/(athlete)', { recursive: true, encoding: 'utf8' })) {
  if (f.endsWith('.tsx')) files.push(`src/app/(athlete)/${f}`);
}
const seen = new Set<string>();
const queue = [...files];
while (queue.length) {
  const f = queue.pop()!;
  if (seen.has(f)) continue;
  seen.add(f);
  let src: string;
  try { src = readFileSync(f, 'utf8'); } catch { continue }
  for (const m of src.matchAll(/from '@\/components\/([A-Za-z0-9_]+)\//g)) {
    const dir = `src/components/${m[1]}`;
    try {
      for (const g of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
        if (g.endsWith('.tsx')) queue.push(`${dir}/${g}`);
      }
    } catch { /* not a directory */ }
  }
}
const athleteFiles = [...seen];
const corpus = athleteFiles.map((f) => { try { return blank(readFileSync(f, 'utf8')) } catch { return '' } }).join('\n');

const tidy = (t: string): string =>
  t.replace(/&mdash;/g, '—').replace(/&rsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '')
   .replace(/&apos;/g, "'").replace(/\{'\s*'\}/g, ' ').replace(/<[^>]+>/g, '')
   .replace(/\s+/g, ' ').trim();

/** Labels the athlete app really renders: headings, buttons, links, Me row keys. */
const labels = new Set<string>();
for (const re of [
  /<(h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/g,
  /<button\b[^>]*>([\s\S]*?)<\/button>/g,
  /<Link\b[^>]*>([\s\S]*?)<\/Link>/g,
  /<span className="k">([\s\S]*?)<\/span>/g,
  /title:\s*'([^']+)'/g,
]) {
  for (const m of corpus.matchAll(re)) {
    const raw = m[2] ?? m[1] ?? '';
    const t = tidy(raw);
    if (t && !t.includes('{') && t.length < 60) labels.add(t);
    /* "How hard was it? · Fydr" -> also register the bare screen name. */
    if (t.includes(' · Fydr')) labels.add(t.replace(' · Fydr', '').trim());
  }
}
assert(labels.size > 12, `collected the athlete app's real labels (${labels.size} found)`);
assert(labels.has('Report a problem'), 'sanity: a known real label is in the set');

/** Names the copy uses to point at a control. */
const refs: { name: string; where: string }[] = [];
for (const f of athleteFiles) {
  let src: string;
  try { src = blank(readFileSync(f, 'utf8')); } catch { continue }
  /* A control named inside typographic quotes, the house convention. */
  for (const m of src.matchAll(/&ldquo;([^&]{2,50})&rdquo;|“([^”]{2,50})”/g)) {
    const name = tidy(m[1] ?? m[2] ?? '');
    /* An interpolation in quotes is a value, not a control name — FlagNotice
       quotes `{line}`, which names nothing. The label set skips these for the
       same reason; the reference set has to as well or the guard cries wolf. */
    if (!name || name.includes('{')) continue;
    refs.push({ name, where: f });
  }
}
/* The to-do rows are references too: each names the screen it opens. */
for (const m of blank(readFileSync('src/lib/queries/compliance.ts', 'utf8')).matchAll(/label:\s*'([^']+)'/g)) {
  refs.push({ name: m[1]!, where: 'src/lib/queries/compliance.ts (to-do label)' });
}

const unresolved = refs.filter((r) => r.name && !labels.has(r.name));
assert(refs.length > 0, `found control references in copy (${refs.length})`);
for (const r of unresolved) {
  assert(false, `"${r.name}" is referenced in ${r.where} but is not a real label in the athlete app`);
}
if (unresolved.length === 0) assert(true, 'every control name the copy uses resolves to a real label');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
