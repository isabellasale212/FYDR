/* Every token used as a text colour clears 4.5:1 against the grounds it lands on.
 *
 * WHY THIS EXISTS. On 2026-09-09 an audit measured `--faint` at 2.38:1 on --bg
 * and 2.79:1 on --surf in the light theme, across 162 `color:` rules in base.css
 * and 63 more inline — every caption, denominator, field label and em-dash empty
 * marker in the product, at roughly half the contrast WCAG AA requires.
 *
 * It was not undiscovered. tokens.css said so IN TWO PLACES and disagreed with
 * itself about what had been done: the block above the token claimed
 * "AA-CORRECTED, and it forced --muted to move with it" and described a 4.57 /
 * 7.01 / 15.14 scale; §3.7 further down said the same token "remains failing --
 * 2.38:1 ... Still open." The value was the failing one. The corrected values
 * existed, applied to @media print and nowhere else, under a comment reading
 * "Print takes the same corrected light scale" -- referring to a screen
 * correction that had never landed.
 *
 * That is the failure this guard is shaped against, and it is not "somebody
 * picked a bad grey". A comment cannot be measured, so a comment claiming a
 * correction outlived the correction itself. This reads the VALUES.
 *
 * WHAT IT CHECKS, and why the token list is derived rather than written down.
 * The tokens it tests are the ones base.css actually paints text with -- read
 * from the stylesheet at runtime, so a new token used as a text colour is
 * covered the day it is used rather than the day somebody remembers to add it
 * here. The same reasoning as check-control-radius.ts's selector net, applied to
 * a list that can be derived exactly instead of guessed.
 *
 * Takes an optional tokens path so its own test can run it against a planted
 * violation rather than trusting that it would catch one.
 */
import { readFileSync } from 'node:fs';

const AA = 4.5;

/** The two page grounds. A token is only checked against these when it has no
 *  surface of its own.
 *
 *  THE FIRST VERSION CHECKED EVERY TEXT TOKEN AGAINST THESE TWO and reported
 *  eleven failures, nine of which were the guard's fault: --toast-text is white
 *  on `.toast { background: var(--toast-bg) }`, --avatar-text sits on
 *  --avatar-bg, --highlight-fg on a gym tint, --gym paints a tab glyph. A guard
 *  that cries wolf nine times out of eleven is worse than no guard, because the
 *  answer to it is an exemption list that eventually swallows the real one. So a
 *  token that names its own surface is checked against that surface, and a token
 *  whose surface is a computed tint is reported as unresolved rather than
 *  failed -- an honest "not measured" beats a confident wrong number. */
const GROUNDS = ['bg', 'surf'] as const;

/** `--toast-text` -> `--toast-bg`. Returns the ground(s) a token really lands on,
 *  or null when its surface is a tint this guard cannot composite. */
function groundsFor(token: string, vars: Record<string, string>): readonly string[] | null {
  if (COMPOSITED.has(token)) return null;
  const family = token.replace(/-(text|fg|link|ink)$/, '');
  /* ONLY an explicit `--<family>-bg` counts as owning a surface. A second pass
     also treated `--<family>-rgb` as ownership and excluded --accent-text,
     --bad-text, --good-text and --warn-text -- the four tokens §3.7 re-derived
     against --bg BY NAME ("4.55 on bg, 5.45 on surf"). The companion -rgb token
     exists so a tint can be mixed from the hue; it says nothing about where the
     text lands. */
  if (family !== token && vars[`${family}-bg`]) return [`${family}-bg`];
  if (vars[`${token}-bg`]) return [`${token}-bg`];
  return GROUNDS;
}

/* Painted on a tint mixed at use time -- `rgb(var(--gym-rgb) / 0.22)` and
   friends -- so there is no flat value to measure against. Named individually
   because each was checked: --highlight-fg is the .gl domain chip's ink and
   --gym paints .athlete-tab-glyph on the tab's own tint. tokens.css already
   carries --gym-on-tint and --highlight-pill-text for the on-tint cases, which
   is where a real check would start. */
const COMPOSITED = new Set(['gym', 'highlight-fg']);

/* KNOWN, DATED, AND STILL FAILING. Each line is a token that does not clear AA
   today, with the reason it is exempt rather than fixed. This list is the
   difference between a guard and a wish: without it the guard could not be
   wired into prebuild at all, and an unwired guard checks nothing -- the exact
   failure found in this repo on the same day (41 of 77 guard scripts were not
   in prebuild, and one had been red for weeks).

   ADDING A LINE HERE IS A DECISION, not a way past the build. Each needs the
   measured ratio and the reason. */
export const KNOWN_BELOW_AA: ReadonlyArray<{ token: string; theme: string; why: string }> = [
  {
    token: 'warn-text', theme: 'light', why:
      'P2, audit 2026-09-09: 3.57:1 on --surf. Clears the 3:1 large-text floor and ' +
      'is used at heading sizes on flag callouts, but not at 11px. Re-derivation is ' +
      'the same design decision --faint was, and has not been taken.',
  },
  {
    token: 'accent', theme: 'both', why:
      'P2, audit 2026-09-09: 3.88:1 light, 2.98:1 dark on --bg. --accent is a FILL ' +
      'token (25 background uses against 5 text uses); the 5 text uses want ' +
      '--accent-text, which clears AA in both themes. Fixing the call sites is the ' +
      'right change, not moving a fill colour.',
  },
  {
    token: 'bad-text', theme: 'dark', why:
      'P2, audit 2026-09-09: 4.47:1 on --surf, short of 4.5 by 0.03. Real but ' +
      'hairline; moving it costs the dark error ramp its relationship to --bad.',
  },
];

const hexOf = (v: string): [number, number, number] | null => {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return null;                       // rgba() tokens composite; not our business
  const raw = m[1]!;
  const h = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const luminance = (c: [number, number, number]): number => {
  const s = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * s[0]! + 0.7152 * s[1]! + 0.0722 * s[2]!;
};
export const contrast = (a: string, b: string): number | null => {
  const ca = hexOf(a), cb = hexOf(b);
  if (!ca || !cb) return null;
  const l1 = luminance(ca), l2 = luminance(cb);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/** tokens.css is ordered, and later declarations in the same cascade level win.
 *  Light is `:root` + `:root,:root[data-theme='light']` + any later bare `:root`;
 *  dark is all of that plus `:root[data-theme='dark']`. Parsed by walking the
 *  file in order rather than slicing on the first @media -- a first attempt did
 *  the latter and reported light and dark as identical, which was the parser. */
export function readThemes(rawCss: string): { light: Record<string, string>; dark: Record<string, string> } {
  /* COMMENTS GO FIRST, and this is not tidiness. The first version parsed the
     raw text, and the very comment written to explain this correction contains
     the words "@media print" -- so the parser believed it had entered the print
     block and silently skipped every token after it, --warn-text included. The
     guard did not fail; it stopped looking, which is worse. Newlines are kept so
     line-based scanning below still lines up with the file. */
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const light: Record<string, string> = {};
  const darkOnly: Record<string, string> = {};
  let depth = 0, selector = '', inPrint = false;
  for (const line of css.split('\n')) {
    if (/@media\s+print/.test(line)) inPrint = true;
    const open = (line.match(/\{/g) ?? []).length, close = (line.match(/\}/g) ?? []).length;
    const decl = /^\s*--([a-z0-9-]+):\s*([^;]+);/.exec(line);
    if (decl && !inPrint && depth > 0) {
      const [, name, value] = decl as unknown as [string, string, string];
      if (/data-theme=['"]dark['"]/.test(selector) || /prefers-color-scheme:\s*dark/.test(selector)) {
        darkOnly[name] = value.trim();
      } else if (!/data-theme=['"]dark['"]/.test(selector)) {
        light[name] = value.trim();
      }
    }
    if (open > close) selector = (selector + ' ' + line).slice(-400);
    depth += open - close;
    if (depth === 0) { selector = ''; inPrint = false; }
  }
  return { light, dark: { ...light, ...darkOnly } };
}

/** Derived, not written down: the tokens base.css actually paints text with. */
export function textTokens(baseCss: string): string[] {
  const found = new Set<string>();
  for (const m of baseCss.matchAll(/(?:^|[^-a-z])color:\s*var\(--([a-z0-9-]+)\)/g)) found.add(m[1]!);
  return [...found].sort();
}

export type Finding = { token: string; theme: string; ground: string; value: string; ratio: number };

export function findViolations(
  tokensCss: string, baseCss: string,
): { real: Finding[]; known: Finding[]; unresolved: string[] } {
  const { light, dark } = readThemes(tokensCss);
  const real: Finding[] = [], known: Finding[] = [];
  const unresolved = new Set<string>();
  for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
    for (const token of textTokens(baseCss)) {
      const fg = vars[token];
      if (!fg) continue;
      /* Paired by name with their own fill, not with the page. */
      if (/-pill-text$|-on-tint$|-on-wash$|^on-/.test(token)) continue;
      const grounds = groundsFor(token, vars);
      if (grounds === null) { unresolved.add(token); continue; }
      for (const ground of grounds) {
        const bg = vars[ground];
        if (!bg) continue;
        const r = contrast(fg, bg);
        if (r === null || r >= AA) continue;
        const f = { token, theme, ground, value: fg, ratio: r };
        const exempt = KNOWN_BELOW_AA.some((k) => k.token === token && (k.theme === theme || k.theme === 'both'));
        (exempt ? known : real).push(f);
      }
    }
  }
  return { real, known, unresolved: [...unresolved].sort() };
}

const tokensPath = process.argv[2] ?? 'src/styles/tokens.css';
const basePath = process.argv[3] ?? 'src/styles/base.css';
const { real, known, unresolved } = findViolations(readFileSync(tokensPath, 'utf8'), readFileSync(basePath, 'utf8'));

for (const f of known) {
  console.log(`  known  ${f.token} on --${f.ground} (${f.theme}) ${f.ratio.toFixed(2)}:1 — exempt, see KNOWN_BELOW_AA`);
}
if (unresolved.length > 0) {
  console.log(`  not measured: ${unresolved.join(', ')} — each sits on a composited tint rather than a flat ground`);
}
if (real.length > 0) {
  console.error(`\nText contrast: ${real.length} token/ground pair(s) below ${AA}:1.\n`);
  for (const f of real) {
    console.error(`  ${f.token.padEnd(18)} ${f.value.padEnd(9)} on --${f.ground.padEnd(5)} (${f.theme.padEnd(5)}) ${f.ratio.toFixed(2)}:1`);
  }
  console.error(`
WCAG 1.4.3 wants 4.5:1 for body text. These tokens are painted as text by
base.css, so every rule using them inherits the failure.

Re-derive with hue and saturation held, stopping at the first value that clears
4.5:1 on BOTH --bg and --surf — the method tokens.css §3.7 already documents and
used for --accent-text, --accent2-text and the pill-text family.

If a value is genuinely large-text-only or is a fill token being misused as
text, add it to KNOWN_BELOW_AA in scripts/check-contrast.ts with its measured
ratio and the reason. That list is short on purpose: a long one means the rule
has been abandoned rather than excepted.
`);
  process.exit(1);
}
console.log(`Text contrast: ${textTokens(readFileSync(basePath, 'utf8')).length} text tokens, both themes, all at or above ${AA}:1 (${known.length} known exemption${known.length === 1 ? '' : 's'}).`);
