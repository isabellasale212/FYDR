/* Design system conformance — the inventory (docs/queue-pending.md, "FIRST OF
 * THE TWO CLOSING PASSES"; Isabella, 13–15 September 2026).
 *
 * "Report before building, and stop. Every literal value, by file and line,
 * with the token it maps to, the current value, the token's value, and
 * whether the difference is visible. Group by page. Flag anything with no
 * token rather than inventing one."
 *
 * This script is the report's generator, kept in the repository so the fix
 * pass can re-run it to prove the count reached zero, and so the numbers in
 * the report are reproducible rather than remembered. It changes nothing.
 *
 * WHAT COUNTS AS A LITERAL. In src/styles/base.css: every declaration value
 * carrying a px, rem, hex, rgb()/rgba() or hsl() literal for a property a
 * token family covers — radius, spacing (margin/padding/gap/inset/size
 * floors), type size, weight, colour, borders and shadows. In every .tsx:
 * the same inside style={{ }} objects (a bare number is px) and SVG
 * fill/stroke colour attributes. tokens.css itself is the source and is not
 * scanned; @media print blocks are physical output and not scanned
 * (check-font-scaling.ts's own rule); src/lib/pdf.tsx resolves no custom
 * properties (check-scale-tokens.ts's rule) and is not scanned.
 *
 * HOW A TOKEN IS CHOSEN. By family first, then by value: a radius literal is
 * matched against --r-*, a spacing literal against --sp-*, --gap-*, --pad-*
 * and the tap floors, a size against --fs-*, a colour against every colour
 * token in the theme block the rule sits in. "Exact" when the values are
 * equal; otherwise the nearest, with the difference measured — px apart for
 * lengths, CIE76 ΔE for colours — and a verdict: imperceptible (≤ 1px, or
 * ΔE ≤ 2.3, the just-noticeable difference) or visible. A literal with no
 * token family at all is flagged, never given one.
 *
 * Run: node --experimental-strip-types --import ./scripts/lib/register-ts-aliases.mjs scripts/conformance-inventory.ts [--md out.md]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Token = { name: string; value: string; theme: 'light' | 'dark' | 'scale' };
type Family = 'radius' | 'spacing' | 'dimension' | 'size' | 'weight' | 'colour' | 'border' | 'shadow';

const TOKENS_PATH = 'src/styles/tokens.css';
const BASE_PATH = 'src/styles/base.css';

/* ------------------------------------------------------------------ tokens */
function readTokens(): { scale: Map<string, string>; light: Map<string, string>; dark: Map<string, string> } {
  const src = readFileSync(TOKENS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = src.split('\n');
  const scale = new Map<string, string>();
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  let block: 'scale' | 'light' | 'dark' | 'print' | null = null;
  let depth = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^@media print/.test(line)) { block = 'print'; }
    else if (/^@media \(prefers-color-scheme: dark\)/.test(line)) { block = 'dark'; }
    else if (/^:root\[data-theme='dark'\]/.test(line)) { block = 'dark'; }
    else if (/^:root(\[data-theme='light'\])?\s*[,{]?/.test(line) && block !== 'dark' && block !== 'print') { block = block ?? 'scale'; if (scale.size > 0 && block === 'scale' && line.startsWith(':root,')) block = 'light'; }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (depth <= 0 && line.includes('}')) { if (block === 'dark' || block === 'print') block = null; }
    const m = line.match(/^(--[a-z0-9-]+):\s*([^;]+);/i);
    if (!m || !block || block === 'print') continue;
    const [, name, value] = m;
    if (block === 'dark') dark.set(name!, value!.trim());
    else if (block === 'light') light.set(name!, value!.trim());
    else scale.set(name!, value!.trim());
  }
  /* The first :root block carries the scale AND the light colour palette's
     structural tokens; the second (:root, :root[data-theme='light']) carries
     the light theme. Anything in the first block that is a colour is light. */
  for (const [k, v] of scale) if (isColourValue(v) && !light.has(k)) light.set(k, v);
  /* Resolve one level of var() so a token that aliases another compares by value. */
  const resolve = (map: Map<string, string>, fallback: Map<string, string>) => {
    for (const [k, v] of map) {
      const m = v.match(/^var\((--[a-z0-9-]+)\)$/);
      if (m) map.set(k, map.get(m[1]!) ?? fallback.get(m[1]!) ?? scale.get(m[1]!) ?? v);
    }
  };
  resolve(light, scale); resolve(dark, light); resolve(scale, light);
  return { scale, light, dark };
}

/* ------------------------------------------------------------------ colour maths */
function isColourValue(v: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/.test(v) || /^hsla?\(/.test(v) || /^rgb\(var\(/.test(v);
}
type RGBA = { r: number; g: number; b: number; a: number };
function parseColour(v: string, ctx?: Map<string, string>): RGBA | null {
  let s = v.trim();
  const mvar = s.match(/^rgba?\(\s*var\((--[a-z0-9-]+)\)\s*\/\s*([0-9.]+)\s*\)$/i);
  if (mvar) {
    const trip = ctx?.get(mvar[1]!);
    if (!trip) return null;
    const [r, g, b] = trip.split(/[\s,]+/).map(Number);
    return { r: r!, g: g!, b: b!, a: Number(mvar[2]) };
  }
  const mh = s.match(/^#([0-9a-f]{3,8})$/i);
  if (mh) {
    let h = mh[1]!;
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const mr = s.match(/^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)(?:[\s,/]+([0-9.%]+))?\s*\)$/i);
  if (mr) {
    const a = mr[4] === undefined ? 1 : mr[4]!.endsWith('%') ? Number(mr[4]!.slice(0, -1)) / 100 : Number(mr[4]);
    return { r: Number(mr[1]), g: Number(mr[2]), b: Number(mr[3]), a };
  }
  return null;
}
function toLab(c: RGBA): [number, number, number] {
  const f = (x: number) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const r = f(c.r), g = f(c.g), b = f(c.b);
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * g2(Y) - 16, 500 * (g2(X) - g2(Y)), 200 * (g2(Y) - g2(Z))];
}
function deltaE(a: RGBA, b: RGBA): number {
  const [l1, a1, b1] = toLab(a), [l2, a2, b2] = toLab(b);
  const alphaPenalty = Math.abs(a.a - b.a) * 100;
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) + alphaPenalty;
}

/* ------------------------------------------------------------------ classification */
const RADIUS_PROPS = /^border(-[a-z-]+)?-radius$/;
const SIZE_PROPS = /^font-size$/;
const WEIGHT_PROPS = /^font-weight$/;
const SPACING_PROPS = /^(margin|padding|gap|row-gap|column-gap|top|right|bottom|left|inset|inset-[a-z-]+|outline-offset|scroll-padding[a-z-]*|margin-[a-z-]+|padding-[a-z-]+|scroll-margin[a-z-]*)$/;
/** Box sizes: a hit target or a fixed dimension. Only an exact token counts —
 *  a 110px column is layout, out of scope, and no spacing step "maps" to it. */
const DIMENSION_PROPS = /^(width|height|min-width|min-height|max-width|max-height|flex-basis|block-size|inline-size|min-block-size|min-inline-size|max-block-size|max-inline-size)$/;
/** Layout and geometry the tokens do not cover, by the prompt's own scope: not inventoried. */
const LAYOUT_PROPS = /^(grid-template-[a-z]+|grid-auto-[a-z]+|transform|translate|background-position|background-size|stroke-width|stroke-dasharray|stroke-dashoffset|border-spacing|text-indent|word-spacing|columns|column-width|line-height|flex|perspective|object-position|mask-[a-z]+|clip-path|offset-[a-z]+|r|cx|cy|x|y|font|letter-spacing)$/;
const COLOUR_PROPS = /^(color|background|background-color|border|border-[a-z-]*color|border-top|border-bottom|border-left|border-right|outline|outline-color|fill|stroke|box-shadow|text-decoration-color|caret-color|accent-color|-webkit-text-fill-color|column-rule|text-shadow|--[a-z0-9-]+)$/;
const BORDER_PROPS = /^(border|border-top|border-bottom|border-left|border-right|border-width|border-[a-z]+-width|outline|outline-width|border-inline-start|border-inline-end|border-block-[a-z]+)$/;
const SHADOW_PROPS = /^(box-shadow|text-shadow|filter|backdrop-filter)$/;

type Finding = {
  file: string;
  line: number;
  selector: string;
  property: string;
  literal: string;
  family: Family | 'none';
  token: string | null;
  tokenValue: string | null;
  exact: boolean;
  difference: string;
  visible: 'no' | 'imperceptible' | 'visible' | 'n/a';
  theme: 'light' | 'dark' | 'both';
  group: string;
};

const CONSTITUTION_EXEMPT = /rank|heat|deviation|--dev-|band|tint/i;

function nearestLength(px: number, candidates: Map<string, string>, allowed: RegExp): { token: string; value: string; diff: number } | null {
  let best: { token: string; value: string; diff: number } | null = null;
  for (const [name, value] of candidates) {
    if (!allowed.test(name)) continue;
    const m = value.match(/^([0-9.]+)(px|rem)$/);
    if (!m) continue;
    const v = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
    const diff = Math.abs(v - px);
    if (!best || diff < best.diff || (diff === best.diff && name.length < best.token.length)) best = { token: name, value, diff };
  }
  return best;
}
function nearestColour(c: RGBA, candidates: Map<string, string>, triplets: Map<string, string>): { token: string; value: string; diff: number } | null {
  let best: { token: string; value: string; diff: number } | null = null;
  for (const [name, value] of candidates) {
    if (!isColourValue(value)) continue;
    const tc = parseColour(value, triplets);
    if (!tc) continue;
    const diff = deltaE(c, tc);
    if (!best || diff < best.diff) best = { token: name, value, diff };
  }
  return best;
}

/* ------------------------------------------------------------------ scanners */
function scanCss(tokens: ReturnType<typeof readTokens>): Finding[] {
  const src = readFileSync(BASE_PATH, 'utf8');
  const lines = src.split('\n');
  const out: Finding[] = [];
  let selector = '';
  let theme: 'light' | 'dark' | 'both' = 'both';
  let inPrint = false;
  let depth = 0;
  let inComment = false;
  const triplets = new Map<string, string>([...tokens.scale, ...tokens.light].filter(([k]) => k.endsWith('-rgb')));
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i]!;
    if (inComment) { if (line.includes('*/')) { line = line.slice(line.indexOf('*/') + 2); inComment = false; } else continue; }
    line = line.replace(/\/\*[\s\S]*?\*\//g, '');
    if (line.includes('/*')) { line = line.slice(0, line.indexOf('/*')); inComment = true; }
    const t = line.trim();
    if (!t) continue;
    if (/^@media print/.test(t)) inPrint = true;
    if (/^@media \(prefers-color-scheme: dark\)/.test(t) || /^:root\[data-theme='dark'\]/.test(t) || /\[data-theme='dark'\]/.test(t)) theme = 'dark';
    if (/\[data-theme='light'\]/.test(t)) theme = 'light';
    const opens = (t.match(/\{/g) ?? []).length, closes = (t.match(/\}/g) ?? []).length;
    if (opens > 0 && !t.startsWith('@')) selector = t.replace(/\s*\{.*$/, '').trim();
    depth += opens - closes;
    if (depth <= 0) { inPrint = false; theme = 'both'; }
    if (inPrint) continue;
    const decl = t.match(/^([a-z-]+)\s*:\s*([^;{}]+);?$/i);
    if (!decl) continue;
    const [, prop, value] = decl;
    for (const f of classify(prop!, value!, tokens, triplets, theme)) out.push({ ...f, file: BASE_PATH, line: i + 1, selector, group: groupFor(selector) });
  }
  return out;
}

function classify(prop: string, value: string, tokens: ReturnType<typeof readTokens>, triplets: Map<string, string>, theme: 'light' | 'dark' | 'both'): Omit<Finding, 'file' | 'line' | 'selector' | 'group'>[] {
  const out: Omit<Finding, 'file' | 'line' | 'selector' | 'group'>[] = [];
  if (value.includes('var(--') && !/[0-9]px|#[0-9a-f]{3,8}\b|rgba?\(\s*[0-9]|rem\b/i.test(value)) return out;
  const colourPal = theme === 'dark' ? tokens.dark : tokens.light;
  const colourTheme = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'both';
  const colours = value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) ?? [];
  const isColourProp = COLOUR_PROPS.test(prop) || SHADOW_PROPS.test(prop) || BORDER_PROPS.test(prop);
  for (const lit of colours) {
    if (/var\(/.test(lit)) continue;
    const c = parseColour(lit);
    if (!c) continue;
    if (c.a === 0) { out.push({ property: prop, literal: lit, family: 'colour', token: 'transparent', tokenValue: 'transparent', exact: true, difference: 'fully transparent', visible: 'no', theme: colourTheme }); continue; }
    const family: Family = SHADOW_PROPS.test(prop) ? 'shadow' : 'colour';
    const near = nearestColour(c, colourPal, triplets);
    const exact = !!near && near.diff < 0.01;
    const far = !near || near.diff > 6;
    out.push({
      property: prop, literal: lit, family,
      token: far ? null : near!.token, tokenValue: far ? null : near!.value, exact,
      difference: !near ? 'no colour token' : far ? `no token near this colour (nearest ${near.token}, ΔE ${near.diff.toFixed(1)})` : `ΔE ${near.diff.toFixed(1)}`,
      visible: far ? 'n/a' : exact ? 'no' : near!.diff <= 2.3 ? 'imperceptible' : 'visible',
      theme: colourTheme,
    });
    void isColourProp;
  }
  const lengths = value.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|var\([^)]*\)|calc\([^)]*\)|url\([^)]*\)/gi, ' ').match(/(?<![a-z0-9.-])-?[0-9]*\.?[0-9]+(px|rem)\b/gi) ?? [];
  const seen = new Set<string>();
  for (const lit of lengths) {
    if (seen.has(lit)) continue;
    seen.add(lit);
    const num = Number(lit.replace(/px|rem/i, ''));
    const px = /rem$/i.test(lit) ? num * 16 : num;
    if (px === 0) continue;
    let family: Family | 'none' = 'none';
    let allowed = /^$/;
    let window = 2; // how far a nearest token may sit before the mapping is meaningless
    if (LAYOUT_PROPS.test(prop)) continue;
    if (RADIUS_PROPS.test(prop)) { family = 'radius'; allowed = /^--r-/; window = 2; }
    else if (SIZE_PROPS.test(prop)) { family = 'size'; allowed = /^--fs-/; window = 1.5; }
    else if (BORDER_PROPS.test(prop) && Math.abs(px) <= 4) { family = 'border'; }
    else if (SHADOW_PROPS.test(prop)) { family = 'shadow'; }
    else if (SPACING_PROPS.test(prop)) { family = 'spacing'; allowed = /^--(sp|gap|pad)-/; window = 2; }
    else if (DIMENSION_PROPS.test(prop)) { family = 'dimension'; allowed = /^--(sp|tap|hit)-/; window = 0; }
    if (family === 'border') {
      out.push({ property: prop, literal: lit, family: 'border', token: null, tokenValue: null, exact: false, difference: 'no border-width token exists', visible: 'n/a', theme: colourTheme });
      continue;
    }
    if (family === 'shadow') {
      const exactShadow = tokens.light.get('--shadow') === value.trim() || tokens.scale.get('--shadow') === value.trim();
      out.push({ property: prop, literal: lit, family: 'shadow', token: exactShadow ? '--shadow' : null, tokenValue: exactShadow ? (tokens.light.get('--shadow') ?? null) : null, exact: exactShadow, difference: exactShadow ? 'the whole shadow is the token' : 'no shadow token matches this shadow', visible: exactShadow ? 'no' : 'n/a', theme: colourTheme });
      continue;
    }
    if (family === 'none') {
      out.push({ property: prop, literal: lit, family: 'none', token: null, tokenValue: null, exact: false, difference: `no token family covers ${prop}`, visible: 'n/a', theme: colourTheme });
      continue;
    }
    let near = nearestLength(Math.abs(px), tokens.scale, allowed);
    /* The 9px corner Isabella chose (11 September): a radius within a pixel of
       it reads as the corner, so 8px and 10px map to --r-toggle rather than to
       a neighbour that happens to tie. */
    if (family === 'radius' && Math.abs(Math.abs(px) - 9) <= 1 && tokens.scale.get('--r-toggle') === '9px') near = { token: '--r-toggle', value: '9px', diff: Math.abs(Math.abs(px) - 9) };
    const exact = !!near && near.diff === 0;
    if (!near || near.diff > window) {
      out.push({ property: prop, literal: lit, family, token: null, tokenValue: null, exact: false, difference: family === 'dimension' ? 'a fixed dimension with no token at this value (layout, out of scope)' : near ? `no ${family} step within ${window}px (nearest ${near.token} ${near.value}, ${near.diff}px away)` : 'no token in the family', visible: 'n/a', theme: colourTheme });
      continue;
    }
    out.push({
      property: prop, literal: lit, family,
      token: near.token, tokenValue: near.value, exact,
      difference: `${near.diff}px`,
      visible: exact ? 'no' : near.diff <= 1 ? 'imperceptible' : 'visible',
      theme: colourTheme,
    });
  }
  if (WEIGHT_PROPS.test(prop)) {
    const w = value.trim();
    if (/^[0-9]{3}$/.test(w)) out.push({ property: prop, literal: w, family: 'weight', token: null, tokenValue: null, exact: false, difference: 'no weight token', visible: 'n/a', theme: colourTheme });
  }
  return out;
}

function groupFor(selector: string): string {
  const m = selector.match(/\.([a-z][a-z0-9-]*)/i);
  if (!m) return selector.split(/[\s,>:]/)[0] || '(element)';
  const cls = m[1]!;
  const prefix = cls.split('-')[0]!;
  return prefix;
}

function scanTsx(tokens: ReturnType<typeof readTokens>): Finding[] {
  const files: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.tsx')) files.push(p); } };
  walk('src');
  const triplets = new Map<string, string>([...tokens.scale, ...tokens.light].filter(([k]) => k.endsWith('-rgb')));
  const out: Finding[] = [];
  for (const file of files) {
    if (/\/lib\/pdf\.tsx$/.test(file)) continue;
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    /* style={{ ... }} objects, possibly multi-line: find each and split into
       key: value pairs; a bare number is px. */
    const re = /style=\{\{([\s\S]*?)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const body = m[1]!;
      const startLine = src.slice(0, m.index).split('\n').length;
      const pairs = body.split(/,(?![^(]*\))/);
      let offset = 0;
      for (const pair of pairs) {
        const pm = pair.match(/^\s*([a-zA-Z]+)\s*:\s*([\s\S]+?)\s*$/);
        const lineNo = startLine + body.slice(0, offset).split('\n').length - 1;
        offset += pair.length + 1;
        if (!pm) continue;
        const key = pm[1]!.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
        const raw = pm[2]!.trim();
        if (/^[a-zA-Z_$][\w$]*(\.[\w$]+)*$/.test(raw) && !/^(transparent|inherit)$/.test(raw)) continue; // an identifier: a variable, not a literal
        let value = raw;
        const bare = raw.match(/^-?[0-9]*\.?[0-9]+$/);
        if (bare) {
          if (/^(opacity|z-index|flex|flex-grow|flex-shrink|line-height|order|font-weight|stroke-width|column-count|grid-column|grid-row|aspect-ratio|zoom|tab-size)$/.test(key)) {
            if (key === 'font-weight') out.push({ file, line: lineNo, selector: 'style={{}}', property: key, literal: raw, family: 'weight', token: null, tokenValue: null, exact: false, difference: 'no weight token', visible: 'n/a', theme: 'both', group: file });
            continue;
          }
          value = `${raw}px`;
        } else {
          value = raw.replace(/^['"`]|['"`]$/g, '');
          if (/\$\{/.test(value) && !/[0-9]px|#[0-9a-f]{3,8}\b|rgba?\(\s*[0-9]/i.test(value)) continue;
        }
        for (const f of classify(key, value, tokens, triplets, 'both')) out.push({ ...f, file, line: lineNo, selector: 'style={{}}', group: file });
      }
    }
    /* SVG colour attributes and width/height attributes on svg elements. */
    lines.forEach((line, i) => {
      const attrs = line.match(/\b(fill|stroke)="(#[0-9a-f]{3,8}|rgba?\([^)]*\))"/gi) ?? [];
      for (const a of attrs) {
        const lit = a.replace(/^(fill|stroke)="/i, '').replace(/"$/, '');
        const c = parseColour(lit);
        if (!c) continue;
        const near = nearestColour(c, tokens.light, triplets);
        const exact = !!near && near.diff < 0.01;
        const far = !near || near.diff > 6;
        out.push({ file, line: i + 1, selector: 'svg attribute', property: a.split('=')[0]!, literal: lit, family: 'colour', token: far ? null : near!.token, tokenValue: far ? null : near!.value, exact, difference: !near ? 'no colour token' : far ? `no token near this colour (nearest ${near.token}, ΔE ${near.diff.toFixed(1)})` : `ΔE ${near.diff.toFixed(1)}`, visible: far ? 'n/a' : exact ? 'no' : near!.diff <= 2.3 ? 'imperceptible' : 'visible', theme: 'light', group: file });
      }
    });
  }
  return out;
}

/* ------------------------------------------------------------------ report */
/** Where a base.css class family is used: the .tsx files whose markup names a
 *  class with that prefix, so a stylesheet family can be read as pages. */
function usedOn(prefix: string, tsxFiles: string[]): string[] {
  const re = new RegExp(`[\"'\\s\`]${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:-[a-z0-9-]+)?[\"'\\s\`]`);
  return tsxFiles.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.replace(/^src\//, ''));
}

function main() {
  const tokens = readTokens();
  const css = scanCss(tokens);
  const tsx = scanTsx(tokens);
  const all = [...css, ...tsx];
  const byFamily = new Map<string, number>();
  for (const f of all) byFamily.set(f.family, (byFamily.get(f.family) ?? 0) + 1);
  const exact = all.filter((f) => f.exact).length;
  const imperceptible = all.filter((f) => f.visible === 'imperceptible').length;
  const visible = all.filter((f) => f.visible === 'visible').length;
  const noToken = all.filter((f) => f.visible === 'n/a').length;

  const mdIdx = process.argv.indexOf('--md');
  const summary = [
    `literals: ${all.length} (base.css ${css.length}, tsx ${tsx.length})`,
    `exact match to a token: ${exact}`,
    `nearest token within an imperceptible difference: ${imperceptible}`,
    `visible difference (stop on that instance): ${visible}`,
    `no token covers it (flagged, not invented): ${noToken}`,
    `by family: ${[...byFamily.entries()].map(([k, v]) => `${k} ${v}`).join(', ')}`,
  ];
  console.log(summary.join('\n'));

  if (mdIdx > -1) {
    const outPath = process.argv[mdIdx + 1]!;
    const lines: string[] = [];
    lines.push('## Totals', '', ...summary.map((s) => `- ${s}`), '');
    const groups = new Map<string, Finding[]>();
    for (const f of all) { const g = f.file === BASE_PATH ? `base.css · .${f.group}` : f.file; groups.set(g, [...(groups.get(g) ?? []), f]); }
    const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    const tsxFiles: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.tsx')) tsxFiles.push(p); } };
    walk('src');
    lines.push('## By page or class family', '', 'A `base.css` family is the classes sharing a prefix; "used on" lists the files whose markup names one of them, so the family reads as pages.', '', '| Page / family | Literals | Exact | Imperceptible | Visible | No token | Used on |', '|---|---|---|---|---|---|---|');
    for (const [g, fs] of sortedGroups) {
      const used = g.startsWith('base.css · .') ? usedOn(g.slice('base.css · .'.length), tsxFiles) : [];
      lines.push(`| ${g} | ${fs.length} | ${fs.filter((f) => f.exact).length} | ${fs.filter((f) => f.visible === 'imperceptible').length} | ${fs.filter((f) => f.visible === 'visible').length} | ${fs.filter((f) => f.visible === 'n/a').length} | ${used.length ? used.slice(0, 6).join(', ') + (used.length > 6 ? ` +${used.length - 6}` : '') : g.startsWith('base.css') ? '(no .tsx names this family — element or global rule)' : ''} |`);
    }
    lines.push('', '## Every literal', '');
    for (const [g, fs] of sortedGroups) {
      lines.push(`### ${g}`, '', '| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |', '|---|---|---|---|---|---|---|---|---|');
      for (const f of fs.sort((a, b) => a.line - b.line)) lines.push(`| ${f.line} | \`${f.selector.replace(/\|/g, '\\|').slice(0, 60)}\` | ${f.property} | \`${f.literal}\` | ${f.token ? `\`${f.token}\`` : '—'} | ${f.tokenValue ? `\`${f.tokenValue}\`` : '—'} | ${f.difference} | ${f.visible === 'n/a' ? 'no token' : f.visible} | ${f.theme} |`);
      lines.push('');
    }
    writeFileSync(outPath, lines.join('\n'));
    console.log(`written ${outPath}`);
  }
}

main();
