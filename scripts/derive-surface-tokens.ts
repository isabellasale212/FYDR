/* The light theme's surfaces, derived from one ground colour.
 *
 * WHY A SCRIPT AND NOT SEVEN HAND-PICKED HEXES. This ground has now moved three
 * times — #eaedf1 (Aug 6 handoff), #e4ebf9 (the designer's Visual Lift, 1 Sept),
 * back to #eaedf1 (4 Sept, on the client's instruction), and now to blue. Each
 * move used to mean re-picking every surface by eye and re-measuring, and the
 * thing that actually has to survive a move is not any single value but the
 * SEPARATIONS between them: how far a card sits above the page, how far a
 * border sits below it. Those are the design. Encoding them once and computing
 * the rest means the fourth move is one argument.
 *
 * THE RATIOS ARE DERIVED, NOT TRANSCRIBED. LEGACY_GREY below is the palette as
 * it stood before this change, and every ratio is measured from it at runtime.
 * A transcribed table would let a typo become the new spec silently.
 *
 * DIRECTION MATTERS AND IS EASY TO LOSE. --surf, --surf2 and --field sit ABOVE
 * the ground; --surf-sunken and --border sit BELOW it. A first attempt at this
 * anchored everything to the card and preserved only the magnitudes, which
 * produced a border LIGHTER than the page it divides — a contrast ratio can be
 * right while the design is inverted.
 *
 * THE CEILING, which is the interesting constraint. The card must sit 1.1743:1
 * above the ground, and white is as light as a card can be, so the ground's
 * luminance cannot exceed (1.05 / 1.1743) - 0.05 = 0.8441. That is EXACTLY the
 * luminance of the old #eaedf1 — unsurprising once seen, because its card was
 * pure white, so the old grey was already sitting on the ceiling. The practical
 * consequence: preserving the current separations, this ground can only ever get
 * DARKER. A lighter blue cannot keep them, and the script refuses rather than
 * quietly clipping to white and reporting success.
 *
 * Usage:
 *   node --experimental-strip-types scripts/derive-surface-tokens.ts '#e4ebf9'
 *   node --experimental-strip-types scripts/derive-surface-tokens.ts --check
 */
import { readFileSync } from 'node:fs';

type RGB = readonly [number, number, number];

const parse = (h: string): RGB => {
  const s = h.trim().replace(/^#/, '');
  const full = s.length === 3 ? [...s].map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${h}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as RGB;
};
const hex = (c: RGB): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const chan = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (c: RGB): number => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
const contrast = (a: RGB, b: RGB): number => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** The palette as it stood before 2026-09-07. The source of every ratio below;
 *  not otherwise used, and not to be "tidied up" — deleting it deletes the spec. */
const LEGACY_GREY = {
  '--bg': '#eaedf1',
  '--surf': '#ffffff',
  '--elev': '#ffffff',
  '--surf2': '#f3f5f8',
  '--surf-sunken': '#dfe3e9',
  '--field': '#f0f2f5',
  '--border': '#dce1e8',
} as const;

export type Token = keyof typeof LEGACY_GREY;
export const SURFACES = Object.keys(LEGACY_GREY).filter((t) => t !== '--bg') as Token[];

const legacyBgLum = lum(parse(LEGACY_GREY['--bg']));
/** Each surface's separation from the ground, and which side of it it sits on. */
export const SPEC = Object.fromEntries(
  SURFACES.map((t) => {
    const c = parse(LEGACY_GREY[t]);
    return [t, { ratio: contrast(c, parse(LEGACY_GREY['--bg'])), lighter: lum(c) > legacyBgLum }];
  }),
) as Record<Token, { ratio: number; lighter: boolean }>;

export const GROUND_LUMINANCE_CEILING = 1.05 / SPEC['--surf'].ratio - 0.05;

/* Every derived colour is a point on the line from white to one deep blue, so
   the whole set shares a hue and only luminance varies. Picking each one
   independently is what makes a palette look assembled rather than designed. */
const WHITE: RGB = [255, 255, 255];
const DEEP: RGB = parse('#9db6e8');
const mix = (t: number): RGB => WHITE.map((w, i) => w + ((DEEP[i] ?? 0) - w) * t) as unknown as RGB;

/** The colour on that line whose luminance is `target`. Monotonic, so bisection
 *  is exact to well below one 8-bit step. */
function atLuminance(target: number): RGB {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i += 1) {
    const m = (lo + hi) / 2;
    if (lum(mix(m)) > target) lo = m;
    else hi = m;
  }
  return mix((lo + hi) / 2);
}

export function derive(groundHex: string): Record<Token, string> {
  const ground = parse(groundHex);
  const g = lum(ground);
  if (g > GROUND_LUMINANCE_CEILING) {
    throw new Error(
      `${groundHex} is too light to be this app's page ground.\n` +
        `  its luminance          ${g.toFixed(4)}\n` +
        `  the most that is usable ${GROUND_LUMINANCE_CEILING.toFixed(4)}\n\n` +
        `A card has to sit ${SPEC['--surf'].ratio.toFixed(4)}:1 above the ground and cannot be lighter\n` +
        `than white, so a ground above that luminance cannot keep the separation\n` +
        `the design has today. The old grey #eaedf1 was already exactly on this\n` +
        `line. Pick a deeper blue, or say which separation may shrink.`,
    );
  }
  const out: Record<string, string> = { '--bg': hex(ground) };
  for (const t of SURFACES) {
    const { ratio, lighter } = SPEC[t];
    out[t] = hex(atLuminance(lighter ? (g + 0.05) * ratio - 0.05 : (g + 0.05) / ratio - 0.05));
  }
  return out as Record<Token, string>;
}

/* --------------------------------------------------------------------------
   CLI
   -------------------------------------------------------------------------- */

const TOKENS_CSS = 'src/styles/tokens.css';

/** The light block only. The dark theme and the print block define the same
 *  token names and must not be read here. */
function readLightBlock(): string {
  const css = readFileSync(TOKENS_CSS, 'utf8');
  const start = css.indexOf(":root[data-theme='light']");
  if (start === -1) throw new Error(`could not find the light theme block in ${TOKENS_CSS}`);
  const open = css.indexOf('{', start);
  const end = css.indexOf('\n}', open);
  return css.slice(open, end);
}

function committed(): Record<Token, string> {
  const block = readLightBlock();
  const out: Record<string, string> = {};
  for (const t of ['--bg', ...SURFACES]) {
    const m = new RegExp(`${t}\\s*:\\s*(#[0-9a-fA-F]{3,6})\\s*;`).exec(block);
    if (!m?.[1]) throw new Error(`${t} is not set to a hex literal in the light block`);
    out[t] = m[1].toLowerCase();
  }
  return out as Record<Token, string>;
}

const arg = process.argv[2];

if (arg === '--check') {
  const have = committed();
  const want = derive(have['--bg']);
  let bad = 0;
  console.log(`Light-theme surfaces, derived from --bg ${have['--bg']}:\n`);
  for (const t of SURFACES) {
    const ok = have[t] === want[t];
    if (!ok) bad += 1;
    const r = contrast(parse(have[t]), parse(have['--bg']));
    const side = lum(parse(have[t])) > lum(parse(have['--bg'])) ? 'above' : 'below';
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${t.padEnd(15)}${have[t]}  ${r.toFixed(4)}:1 ${side}` +
        (ok ? '' : `   expected ${want[t]} (${SPEC[t].ratio.toFixed(4)}:1)`),
    );
  }
  if (bad > 0) {
    console.error(
      `\n${bad} surface(s) have drifted from the ratios the grey palette set.\n` +
        `Re-derive them:  node --experimental-strip-types ${process.argv[1]} '${have['--bg']}'`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${SURFACES.length} surfaces hold their separation from the ground.`);
} else if (arg && !arg.startsWith('-')) {
  const out = derive(arg);
  console.log(`  --bg: ${out['--bg']};`);
  for (const t of SURFACES) console.log(`  ${t}: ${out[t]};`);
} else {
  console.error(
    `usage:\n  derive-surface-tokens.ts '#rrggbb'   print the block for a ground\n` +
      `  derive-surface-tokens.ts --check      verify ${TOKENS_CSS} still holds the ratios`,
  );
  process.exit(2);
}
