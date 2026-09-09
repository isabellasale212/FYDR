/* The profile dials draw themselves once per screen, per session — not on every visit.
 *
 * WHAT WAS WRONG. `.dial-arc` carried `animation: ring-in 0.9s` with no gate at
 * all: no attribute, no prop, no condition. Every mount replayed it, and `<Dial>`
 * renders three times on the player profile and four on the training report. A
 * coach working through a squad watched a 900ms ring draw on every visit to every
 * profile — three times the 300ms this app allows any UI animation, on the
 * frequency band where the rule is "remove or drastically reduce". Isabella's
 * decision (2026-09-09) was to keep the entrance but gate it and shorten it.
 *
 * THE ONE SUBTLE THING THIS FILE EXISTS TO PIN. The "already played" mark must be
 * written in an EFFECT, not during render. Effects run after the whole commit, so
 * every dial on a screen reads the same pre-visit value and they all animate
 * together. Write the mark during render instead — in the useState initialiser,
 * say — and the first dial poisons the rest: one ring draws and the other two or
 * three sit still, which looks like a bug rather than a decision. That failure is
 * invisible in a single-dial test, so it is asserted here directly.
 *
 * KEYED BY PATHNAME, so the gate means "this screen, once" rather than "one dial,
 * ever". Arriving at the training report still animates even if a profile already
 * did, because it is a different screen seen for the first time.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
/* Comments blanked, not deleted, so a rule that exists only inside a comment
   cannot satisfy an assertion. */
const blank = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

const tokens = blank(readFileSync('src/styles/tokens.css', 'utf8'));
const css = blank(readFileSync('src/styles/base.css', 'utf8'));
const dial = blank(readFileSync('src/components/Dial/Dial.tsx', 'utf8'));

/* 1. A real token, not another hand-typed curve. The value is the audit
      playbook's strong ease-out and must be copied exactly. */
const easeDefs = [...tokens.matchAll(/--ease-out:\s*([^;]+);/g)];
assert(easeDefs.length === 1, `--ease-out is defined exactly once in tokens.css (saw ${easeDefs.length})`);
assert(easeDefs[0]?.[1]?.trim() === 'cubic-bezier(0.23, 1, 0.32, 1)',
  `--ease-out is the playbook curve cubic-bezier(0.23, 1, 0.32, 1) (saw ${easeDefs[0]?.[1]?.trim() ?? 'nothing'})`);

/* 2. The animation is GATED. A bare `.dial-arc { animation: ... }` is the bug. */
const bare = /\.dial-arc\s*\{([^}]*)\}/.exec(css);
assert(!(bare && /animation/.test(bare[1] ?? '')),
  'no ungated `.dial-arc { animation: ... }` rule remains');

/* 3. The gated rule, at the decided duration, through the token. */
const gated = /\.dial-arc\[data-animate\]\s*\{([^}]*)\}/.exec(css);
assert(gated !== null, '.dial-arc[data-animate] carries the animation');
const decl = gated?.[1] ?? '';
assert(/animation:\s*ring-in\b/.test(decl), 'it still uses the ring-in keyframe');
assert(/var\(--ease-out\)/.test(decl), 'it reads var(--ease-out) rather than an inline curve');
assert(!/cubic-bezier/.test(decl), 'and carries no hand-typed cubic-bezier of its own');
const dur = /animation:[^;]*?([\d.]+)s/.exec(decl)?.[1];
assert(dur === '0.28', `the duration is 0.28s, the decided value (saw ${dur ?? 'none'}s)`);
assert(Number(dur) * 1000 <= 300, 'which is inside the 300ms ceiling for UI animation');

/* 4. The component gates it per screen, per session. */
assert(/^'use client'/m.test(dial), 'Dial is a client component (the gate needs client state)');
assert(/usePathname/.test(dial), 'it keys the gate on the pathname, so each screen animates on its own first visit');
assert(/new Set</.test(dial), 'it holds the already-played screens in a module-scope Set');

/* 5. THE POISONING GUARD. The mark must be written in an effect, never during
      render, or the first dial on a multi-dial screen silences the others. */
const useStateInit = /useState\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/.exec(dial)?.[1]
  ?? /useState\(([^)]*)\)/.exec(dial)?.[1] ?? '';
assert(!/\.add\(/.test(useStateInit),
  'the played-mark is NOT written inside the useState initialiser (that would silence dials 2..n)');
const effect = /useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\}/.exec(dial)?.[1] ?? '';
assert(/\.add\(/.test(effect), 'the played-mark is written in a useEffect, which runs after the whole commit');

/* 6. The attribute is conditional, and the class stays as a stable hook. */
assert(/data-animate=\{/.test(dial), 'data-animate is applied conditionally, not always');
assert(/className="dial-arc"/.test(dial), 'className="dial-arc" is still unconditional, so the hook is stable');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
