/* Every guard asserts its own coverage — decision-batch-2026-09-15-pm.md item
 * 5 (Isabella): a guard that walks a list of files, roles, routes or screens
 * asserts the number it expected to find and fails loudly on a mismatch.
 * "Eleven roles means eleven, or the run fails."
 *
 * This is the guard on the guards. Any script under scripts/ that enumerates
 * the filesystem (readdirSync, or the recursive walks built on it) must
 * import expectCount from scripts/lib/coverage.mjs and call it — otherwise a
 * new sweep can be written tomorrow with the same hole the a11y reporter had,
 * and the pass done on 15 Sept 2026 would drift back to zero one guard at a
 * time. The number of enumerating scripts is itself counted, so a guard that
 * silently stops enumerating (or a new one) is noticed too.
 *
 * Not covered, on purpose: `>= N` counts of a regex inside ONE file (a shape
 * pin, not a list of things), and the lib/ helpers themselves. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectCount } from './lib/coverage.mjs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const scripts = readdirSync('scripts').filter((f) => /\.(ts|mjs)$/.test(f)).map((f) => join('scripts', f));
const enumerating = scripts.filter((f) => /\breaddirSync\(/.test(strip(readFileSync(f, 'utf8'))));

console.log('every script that enumerates the filesystem counts what it found');
expectCount('scripts under scripts/ that call readdirSync', enumerating, 34);
for (const f of enumerating) {
  const src = strip(readFileSync(f, 'utf8'));
  const imports = /import \{[^}]*\bexpectCount\b[^}]*\} from '\.\/lib\/coverage\.mjs'/.test(src);
  const calls = (src.match(/\bexpectCount\(/g) ?? []).length;
  assert(imports && calls > 0, `${f.replace('scripts/', '')} imports expectCount and calls it (${calls} call${calls === 1 ? '' : 's'})`);
}

console.log('\nthe helper fails loudly and nothing swallows it');
{
  const helper = readFileSync('scripts/lib/coverage.mjs', 'utf8');
  assert(/throw new CoverageError\(msg\)/.test(helper), 'a mismatch throws, so a guard without a failure counter still exits non-zero');
  assert(/COVERAGE_BOOTSTRAP/.test(helper), 'and COVERAGE_BOOTSTRAP=1 prints found counts instead, for writing a new guard against what is there');
  const swallowers = enumerating.filter((f) => /catch\s*\{\s*(\/\*[^*]*\*\/)?\s*\}/.test(readFileSync(f, 'utf8')) && /catch \{ \/\* (component may not exist|not a directory) \*\/ \}/.test(readFileSync(f, 'utf8')));
  assert(swallowers.length === 0, `no enumerating guard swallows a missing directory (${swallowers.join(', ') || 'none'})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
