/* §0ap (third bullet) — Exports no longer tells the sport scientist (or the
 * S&C, or the nutritionist) they have "Coach access". The entry's second
 * option: drop the role word — "every domain below" is true for whoever is
 * reading, and the domains listed beneath are already the role's own.
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const src = readFileSync('src/app/(staff)/settings/exports/page.tsx', 'utf8');
assert(!/'Medical' : 'Coach'/.test(src), 'the medic/coach ternary is gone');
assert(!/Coach access/.test(src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')), 'no "Coach access" rendered (the comment may name the old string)');
assert(/Every domain below, squad-wide\./.test(src), '"Every domain below, squad-wide." for whoever is reading');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
