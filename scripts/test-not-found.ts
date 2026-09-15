/* The not-found screens — decision-batch-2026-09-15.md #3 (Isabella, 15
 * Sept 2026), docs/screens/64-not-found.md.
 *
 * Next's default not-found does not read the app's theme: black text on the
 * athlete app's dark ground, 1.23:1, invisible. Three files replace it — one
 * per shell and the root — and they must keep saying the one honest, vague
 * thing: removed, or the link is out of date. notFound() catches a deleted
 * row and a row that belongs to someone else, and the wording must not tell
 * them apart, because a self-only read returns the same nothing for both and
 * a screen that says "you cannot see this" confirms the row exists. */
import { existsSync, readFileSync } from 'node:fs';
import { expectCount } from './lib/coverage.mjs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const FILES = {
  athlete: 'src/app/(athlete)/not-found.tsx',
  staff: 'src/app/(staff)/not-found.tsx',
  root: 'src/app/not-found.tsx',
} as const;
const HOME = { athlete: '/today', staff: '/dashboard', root: '/' } as const;
const copy = read('src/lib/notFoundCopy.ts');

console.log('one set of words, and they say nothing they should not');
{
  assert(/title: 'There is nothing here'/.test(copy), 'the title is "There is nothing here"');
  assert(/body: 'It may have been removed, or the link may be out of date\./.test(copy), 'the body says removed-or-out-of-date');
  assert(!/cannot see|not allowed|permission|403|belongs to|another athlete|someone else/i.test(strip(copy).replace(/\/\*[\s\S]*?\*\//g, '')), 'and never a permission, a status code, or whose it is');
  assert(/athlete: \{ href: '\/today'/.test(copy) && /staff: \{ href: '\/dashboard'/.test(copy) && /root: \{ href: '\/'/.test(copy), 'each shell goes home to its own home');
}

console.log('\nthree files, each reading the shared words');
for (const [shell, file] of Object.entries(expectCount('not-found files (two shells and the root)', Object.values(FILES), 3).reduce((acc, f, i) => ({ ...acc, [Object.keys(FILES)[i]!]: f }), {} as Record<string, string>))) {
  assert(existsSync(file), `${file} exists`);
  const src = strip(read(file));
  assert(/from '@\/lib\/notFoundCopy'/.test(src) && /NOT_FOUND\.title/.test(src) && /NOT_FOUND\.body/.test(src), `${shell}: renders NOT_FOUND.title and .body from the copy module`);
  assert(new RegExp(`NOT_FOUND_HOME\\.${shell}\\.href`).test(src), `${shell}: links to NOT_FOUND_HOME.${shell} (${HOME[shell as keyof typeof HOME]})`);
  assert(!/#[0-9a-f]{3,6}\b/i.test(src) && !/color:/.test(src), `${shell}: no raw colour — the tokens carry both themes`);
  assert(!/'use client'/.test(src) && !/await |fetch|createClient/.test(src), `${shell}: reads nothing (a not-found that reads could leak by timing what it reads)`);
  assert(/<h1[^>]*>/.test(src), `${shell}: has an h1`);
}

console.log('\nthe spec exists and the athlete rule points at it');
{
  assert(existsSync('docs/screens/64-not-found.md'), 'docs/screens/64-not-found.md');
  assert(/64-not-found\.md/.test(read('docs/athlete/screens/09-one-gym-session-logged.md')), 'the gym session\'s not-found rule names the screen');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
