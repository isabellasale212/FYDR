/* Folds scripts/a11y-sweep.mjs's per-role JSON into the defect list the
 * accessibility sweep's step 1 asks for (docs/queue-pending.md): every
 * defect with file, line, class, measured value, theme, surface, role and a
 * proposed fix, grouped by class then page. Nothing here changes the app.
 *
 * What it adds to the raw measurements:
 *   - names: every measured colour is matched to the token that produced it
 *     (tokens.css, light and dark blocks), and a composited ground that is
 *     not itself a token is explained as "<wash> over <surface>" when one
 *     wash over one surface reproduces it within 2/255 per channel;
 *   - location: the base.css rule that sets `color` (contrast) or the box
 *     (tap targets) on the element's own classes, with its line, or the tsx
 *     file that carries the class when base.css does not;
 *   - the proposed swap: for each failing text colour, every text-role
 *     token's ratio on that element's composited ground in BOTH themes, so
 *     the fix can be one token for another that passes in both, or the
 *     report can say that none does.
 *
 * Run: node scripts/a11y-sweep-report.mjs <dir with a11y-*.json> > report.md
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = process.argv[2];
if (!DIR) { console.error('usage: a11y-sweep-report.mjs <dir>'); process.exit(1); }

/* ---- tokens ------------------------------------------------------------- */
/* The token blocks are found by their selectors, not by line ranges: the
   adoption layers (14–15 Sept) moved every block. A top-level rule whose
   selector names dark ([data-theme='dark'], .dark-tokens, or the
   prefers-color-scheme media block's :root:not([data-theme])) is dark;
   every other top-level :root block is light. Comments are blanked first so
   a selector-looking line inside one cannot open a block. */
const tokRaw = readFileSync('src/styles/tokens.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const tokLines = tokRaw.split('\n');
const tokens = { light: {}, dark: {} };
{
  let depth = 0, theme = null, inDarkMedia = false, selector = '';
  for (const raw of tokLines) {
    const line = raw.trim();
    if (depth === 0 && /^@media/.test(line)) { inDarkMedia = /prefers-color-scheme:\s*dark/.test(line); depth += (line.match(/\{/g) ?? []).length; continue; }
    if (line.endsWith('{') || (line.includes('{') && !line.includes(';'))) {
      selector += ' ' + line.replace(/\{.*$/, '');
      if (/data-theme='dark'|\.dark-tokens/.test(selector) || (inDarkMedia && /:root/.test(selector))) theme = 'dark';
      else if (/:root/.test(selector)) theme = 'light';
      depth += (line.match(/\{/g) ?? []).length;
      continue;
    }
    const m = line.match(/^(--[a-z0-9-]+):\s*([^;]+);/);
    if (m && theme) tokens[theme][m[1]] = m[2].trim();
    const closes = (line.match(/\}/g) ?? []).length;
    if (closes) { depth -= closes; if (depth <= 0) { depth = 0; theme = null; inDarkMedia = false; } selector = depth === 0 ? '' : selector; if (depth === 1 && inDarkMedia) theme = null; }
  }
}
for (const k of Object.keys(tokens.light)) if (!(k in tokens.dark)) tokens.dark[k] = tokens.light[k];
const hex = (s) => { const m = s.match(/^#([0-9a-f]{6})$/i); return m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 } : null; };
const parseRgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const resolve = (theme, v, depth = 0) => {
  if (depth > 6) return null;
  const h = hex(v); if (h) return h;
  const m = v.match(/^rgb\(var\((--[a-z0-9-]+)\)\s*\/\s*([0-9.]+)\)$/);
  if (m) { const trip = tokens[theme][m[1]]; if (!trip) return null; const p = trip.split(/[\s,]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: Number(m[2]) }; }
  const r = parseRgb(v); if (r) return r;
  const vr = v.match(/^var\((--[a-z0-9-]+)\)$/); if (vr && tokens[theme][vr[1]]) return resolve(theme, tokens[theme][vr[1]], depth + 1);
  return null;
};
const colours = { light: [], dark: [] };
for (const theme of ['light', 'dark']) for (const [k, v] of Object.entries(tokens[theme])) { const c = resolve(theme, v); if (c && !/-rgb$/.test(k)) colours[theme].push({ name: k, c }); }
const over = (fg, bg) => { const a = fg.a + bg.a * (1 - fg.a); return { r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a, g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a, b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a, a }; };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const near = (a, b, tol = 2.5) => Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;
const SURFACES = ['--bg', '--surf', '--surf2', '--surf-sunken', '--field', '--phone-bg', '--elev', '--gym-tint', '--skeleton', '--avatar-bg', '--toast-bg', '--accent', '--accent2', '--good', '--warn', '--bad', '--highlight'];
const WASHES = Object.keys(tokens.light).filter((k) => /^--(wash|band|wk-fill|lb-row|hair|track|tick|barfill|border)/.test(k));
const nameColour = (theme, rgbStr, opacity = 1) => {
  const c = parseRgb(rgbStr); if (!c) return rgbStr;
  const opaque = colours[theme].filter((t) => t.c.a === 1 && near(t.c, c, 1.5)).map((t) => t.name);
  if (opaque.length) return opaque.filter((n) => !/-rgb$/.test(n)).slice(0, 3).join(' = ');
  return null;
};
const nameGround = (theme, rgbStr) => {
  const direct = nameColour(theme, rgbStr); if (direct) return direct;
  const c = parseRgb(rgbStr);
  for (const s of SURFACES) { const sc = resolve(theme, tokens[theme][s]); if (!sc) continue; for (const w of WASHES) { const wc = resolve(theme, tokens[theme][w]); if (!wc || wc.a === 1) continue; if (near(over(wc, sc), c)) return `${w} over ${s}`; } }
  for (const s of SURFACES) { const sc = resolve(theme, tokens[theme][s]); if (!sc) continue; for (const s2 of SURFACES) { const s2c = resolve(theme, tokens[theme][s2]); if (!s2c || s2 === s) continue; for (const w of WASHES) { const wc = resolve(theme, tokens[theme][w]); if (!wc || wc.a === 1) continue; if (near(over(wc, over(wc, sc)), c)) return `${w} twice over ${s}`; } } }
  return `${rgbStr} (composited; no single wash over a surface reproduces it)`;
};
/* A ground named by nameGround, re-resolved in the other theme, so a swap
   can be judged where the sweep recorded no failure (a pair that fails in
   one theme only still has to keep passing in the other). */
const groundInTheme = (theme, name) => {
  const m = name.match(/^(--[a-z0-9-]+) (?:twice )?over (--[a-z0-9-]+)$/);
  if (m) { const w = resolve(theme, tokens[theme][m[1]]); const sc = resolve(theme, tokens[theme][m[2]]); if (!w || !sc) return null; let o = over(w, sc); if (/twice/.test(name)) o = over(w, o); return o; }
  const t = name.split(' = ')[0]; if (/^--/.test(t) && tokens[theme][t]) return resolve(theme, tokens[theme][t]);
  return null;
};
const TEXT_TOKENS = ['--text', '--muted', '--faint', '--accent-text', '--accent-on-tint', '--accent-on-wash', '--accent-pill-text', '--accent2-text', '--accent2-pill-text', '--good-text', '--good-pill-text', '--warn-text', '--warn-pill-text', '--bad-text', '--bad-on-tint', '--bad-pill-text', '--highlight-fg', '--highlight-pill-text', '--highlight-text', '--gym-on-tint', '--lb-rank1', '--lb-rank-neutral', '--lb-standard-met', '--lb-warn-tint-text', '--lb-bad-tint-text', '--tab-inactive', '--tab-active', '--on-accent', '--on-group', '--domain-recovery', '--avatar-text', '--avatar-text-fg', '--toast-text', '--toast-link', '--accent', '--accent-border'];

/* ---- base.css rule index ----------------------------------------------- */
/* Block comments are blanked (newlines kept, so line numbers hold), then the
   file is scanned character by character with a stack of open blocks; a
   declaration is attributed to the nearest enclosing selector that is not an
   at-rule, with any enclosing plain selector prefixed (CSS nesting). */
const cssRaw = readFileSync('src/styles/base.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const decls = []; // { selector, line, prop, value }
{
  const stack = []; let buf = ''; let line = 1;
  for (let i = 0; i < cssRaw.length; i++) {
    const ch = cssRaw[i];
    if (ch === '\n') line += 1;
    if (ch === '{') { stack.push(buf.trim().replace(/\s+/g, ' ')); buf = ''; continue; }
    if (ch === '}') { stack.pop(); buf = ''; continue; }
    if (ch === ';') {
      const m = buf.match(/^\s*([a-z-]+)\s*:\s*([\s\S]+)$/);
      if (m && stack.length) {
        const plain = stack.filter((s) => !/^@/.test(s));
        const selector = plain.map((s) => s.trim()).join(' ');
        decls.push({ selector, line: line - (buf.match(/\n/g) || []).length + (buf.match(/^\s*\n*/)[0].match(/\n/g) || []).length, prop: m[1], value: m[2].trim().replace(/\s+/g, ' ') });
      }
      buf = ''; continue;
    }
    buf += ch;
  }
}
const classRe = (c) => new RegExp(`\\.${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`);
const findDecl = (classes, props) => {
  for (const c of classes) { const hits = decls.filter((d) => props.includes(d.prop) && classRe(c).test(d.selector)); if (hits.length) return hits; }
  return [];
};
const tsxIndex = new Map();
const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx$/.test(e.name)) tsxIndex.set(p, readFileSync(p, 'utf8').split('\n')); } };
walk('src');
const findTsx = (cls) => { const out = []; for (const [file, lines] of tsxIndex) lines.forEach((l, i) => { if (l.includes(cls)) out.push(`${file}:${i + 1}`); }); return out; };

/* ---- load ---------------------------------------------------------------- */
const runs = [];
for (const f of readdirSync(DIR)) if (/^a11y-[a-z0-9_-]+\.json$/.test(f)) runs.push(...JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const short = (u) => u.replace(/^https?:\/\/[^/]+/, '');
const reached = new Map(); // role -> Map(route -> landed)
for (const r of runs) { if (!reached.has(r.role)) reached.set(r.role, new Map()); reached.get(r.role).set(r.route, short(r.url || '')); }

/* ---- grouping -------------------------------------------------------------
   One defect is one rule: the same element class with the same text token on
   the same kind of ground fails the same way on every page that renders it.
   So the unit here is the element's signature — tag plus its first
   non-generic class, plus role/type and the aria-disabled state — and the
   text/ground pair, with every page, role, width and size it was seen at
   folded in. An element at opacity 0 is not rendered and is dropped. */
const GENERIC = new Set(['num', 'tiny', 'card', 'stack', 'r', 'l', 'v', 'k', 'nm', 'mono', 'nutr-mono', 'flush', 'label', 'field', 'accent', 'selected', 'small']);
const sigOf = (tag, cls, extra = '', path = '') => { const list = cls.split(/\s+/).filter(Boolean).filter((c) => !/^(is-|has-)/.test(c)); const main = list.find((c) => !GENERIC.has(c)) ?? list[0] ?? ''; const second = list.find((c) => c !== main && !GENERIC.has(c)); /* A bare element is known by its parent: `p.flag-who > a`, not `a`. */ const parent = !main && path ? (path.split(' > ').slice(-2, -1)[0] ?? '').replace(/\[[^\]]*\]/g, '') + ' > ' : ''; return parent + tag + (main ? '.' + main : '') + (second ? '.' + second : '') + extra; };
const pageOf = (u) => u.replace(/\?.*$/, '').replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/g, '/[id]');

const cgroups = new Map();
for (const r of runs) for (const c of r.contrast) {
  if (c.opacity === 0) continue;
  const sig = sigOf(c.tag, c.cls, (c.ariaDisabled ? '[aria-disabled]' : '') + (c.nativeDisabled ? '[disabled]' : ''), c.path);
  const key = [sig, c.kind, c.fg, r.theme, c.opacity].join('|');
  const g = cgroups.get(key) || { sig, kind: c.kind, fg: c.fg, theme: r.theme, opacity: c.opacity, cls: c.cls, tag: c.tag, path: c.path, floor: c.floor, large: c.large, grounds: new Map(), sizes: new Set(), weights: new Set(), pages: new Map(), roles: new Set(), widths: new Set(), texts: new Set(), nativeDisabled: c.nativeDisabled, ariaDisabled: c.ariaDisabled, n: 0, ratio: 99 };
  const gr = g.grounds.get(c.ground) || { ground: c.ground, ratio: 99, n: 0, fgEff: c.fgEff, gradient: c.gradient };
  gr.ratio = Math.min(gr.ratio, c.ratio); gr.n += 1; g.grounds.set(c.ground, gr);
  g.ratio = Math.min(g.ratio, c.ratio); g.sizes.add(c.size); g.weights.add(c.weight); g.roles.add(r.role); g.widths.add(r.width); g.texts.add(c.text); g.n += 1;
  const landed = pageOf(short(r.url || r.route)); g.pages.set(landed, (g.pages.get(landed) || 0) + 1);
  cgroups.set(key, g);
}
/* Light and dark for the same signature + kind + opacity, so a swap is judged in both. */
const pairs = new Map();
for (const g of cgroups.values()) { const k = [g.sig, g.kind, g.opacity].join('|'); const p = pairs.get(k) || { sig: g.sig, kind: g.kind, opacity: g.opacity, light: null, dark: null }; p[g.theme] = g; pairs.set(k, p); }
/* The other theme's ground for the same signature, even where it passes,
   from every measurement the sweep took. */
const groundsBySig = new Map();
for (const r of runs) for (const c of r.contrast) { const sig = sigOf(c.tag, c.cls, (c.ariaDisabled ? '[aria-disabled]' : '') + (c.nativeDisabled ? '[disabled]' : ''), c.path); const k = sig + '|' + c.kind + '|' + c.opacity; const m = groundsBySig.get(k) || { light: new Set(), dark: new Set() }; m[r.theme].add(c.ground); groundsBySig.set(k, m); }

const floorOf = (p) => (p.light || p.dark).floor;
const candidates = (p) => {
  const out = [];
  const floor = (p.light || p.dark).floor;
  for (const t of TEXT_TOKENS) {
    const row = { token: t, light: null, dark: null, ok: true };
    for (const theme of ['light', 'dark']) {
      let grounds = p[theme] ? [...p[theme].grounds.keys()].map(parseRgb) : [...(groundsBySig.get(p.sig + '|' + p.kind + '|' + p.opacity)?.[theme] ?? [])].map(parseRgb);
      if (!grounds.length) { const other = theme === 'light' ? 'dark' : 'light'; if (p[other]) grounds = [...p[other].grounds.keys()].map((gs) => groundInTheme(theme, nameGround(other, gs))).filter(Boolean); }
      if (!grounds.length) continue;
      const tc = resolve(theme, tokens[theme][t]); if (!tc) { row.ok = false; continue; }
      let worst = 99;
      for (const gr of grounds) { const fg = { ...tc, a: tc.a * p.opacity }; worst = Math.min(worst, ratio(over(fg, gr), gr)); }
      row[theme] = Math.round(worst * 100) / 100;
      if (worst < floor) row.ok = false;
    }
    out.push(row);
  }
  return out;
};

/* ---- tap-target groups --------------------------------------------------- */
const tgroups = new Map();
for (const r of runs) for (const t of r.targets) {
  const sig = sigOf(t.tag, t.cls, (t.role ? '[role=' + t.role + ']' : '') + (t.type && t.tag === 'input' ? '[type=' + t.type + ']' : '') + (t.ariaDisabled ? '[aria-disabled]' : ''), t.path);
  const key = [sig, t.inlineInText].join('|');
  const g = tgroups.get(key) || { sig, path: t.path, tag: t.tag, cls: t.cls, type: t.type, role: t.role, ariaDisabled: t.ariaDisabled, nativeDisabled: t.nativeDisabled, inlineInText: t.inlineInText, sizes: new Map(), minW: 999, minH: 999, via: new Set(), pages: new Map(), pagesByWidth: { 1440: new Set(), 390: new Set() }, roles: new Set(), widths: new Set(), texts: new Set(), n: 0 };
  g.roles.add(r.role); g.widths.add(r.width); g.texts.add(t.text); g.n += 1; g.via.add(t.via);
  g.minW = Math.min(g.minW, t.w); g.minH = Math.min(g.minH, t.h);
  const sz = t.w + '×' + t.h; g.sizes.set(sz, (g.sizes.get(sz) || 0) + 1);
  const landed = pageOf(short(r.url || r.route)); g.pages.set(landed, (g.pages.get(landed) || 0) + 1); g.pagesByWidth[r.width].add(landed);
  tgroups.set(key, g);
}

/* ---- swatches ------------------------------------------------------------ */
const sgroups = new Map();
for (const r of runs) for (const s of r.swatches) { const g = sgroups.get(s.key) || { key: s.key, pages: new Set(), roles: new Set(), parentText: s.parentText, n: 0 }; g.pages.add(pageOf(short(r.url || r.route))); g.roles.add(r.role); g.n += s.count; sgroups.set(s.key, g); }

/* ---- emit ---------------------------------------------------------------- */
const out = [];
const L = (s = '') => out.push(s);
/* A tsx fallback prefers the page's own folder, then a component, over the
   first file that happens to mention the class. */
const rankTsx = (files, pages) => {
  const dirs = pages.flatMap((pg) => { const clean = pg.replace(/\/\[id\]/g, '/[').replace(/\?.*$/, ''); return [`src/app/(staff)${clean}`, `src/app/(athlete)${clean}`, `src/app${clean}`]; });
  const score = (f) => (dirs.some((d) => f.replace(/\[[^\]]+\]/g, '[').startsWith(d)) ? 0 : /^src\/components\//.test(f) ? 1 : 2);
  return files.slice().sort((a, b) => score(a) - score(b));
};
const locate = (cls, props, path = '', pages = []) => {
  const parentCls = path ? (path.split(' > ').slice(-2, -1)[0] ?? '').replace(/\[[^\]]*\]/g, '').split('.').slice(1) : [];
  const classes = cls.split(/\s+/).filter(Boolean).filter((c) => !GENERIC.has(c)).concat(cls.split(/\s+/).filter((c) => GENERIC.has(c))).concat(cls.trim() ? [] : parentCls);
  const hits = findDecl(classes, props);
  if (hits.length) return hits.slice(0, 3).map((h) => `src/styles/base.css:${h.line} \`${h.selector} { ${h.prop}: ${h.value} }\``).join('; ');
  for (const c of classes) { const t = rankTsx(findTsx(c), pages); if (t.length) return `${t[0]} (class \`${c}\`; no base.css rule sets ${props.join('/')} on it)`; }
  return '(no rule located by class; inherited from an ancestor outside the recorded path)';
};
const sortedPages = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([pg, n]) => `${pg} (${n})`).join(', ');

L('## Roles and the screens each reached');
L();
for (const [role, m] of reached) {
  const landedElsewhere = [...m].filter(([route, landed]) => pageOf(landed) !== pageOf(route) && landed);
  L(`- **${role}** — ${m.size} routes requested; ${m.size - landedElsewhere.length} rendered as asked` + (landedElsewhere.length ? `; ${landedElsewhere.length} redirected: ` + landedElsewhere.map(([route, landed]) => `\`${pageOf(route)}\` → \`${landed}\``).join(', ') : '') + '.');
}
L();

L('## Class 1 — contrast');
L();
const cpairs = [...pairs.values()].filter((p) => !(p.light || p.dark).nativeDisabled).sort((a, b) => Math.min(a.light?.ratio ?? 9, a.dark?.ratio ?? 9) - Math.min(b.light?.ratio ?? 9, b.dark?.ratio ?? 9));
const exemptPairs = [...pairs.values()].filter((p) => (p.light || p.dark).nativeDisabled);
let ci = 0;
for (const p of cpairs) {
  ci += 1;
  const g = p.light || p.dark; const themes = ['light', 'dark'].filter((t) => p[t]);
  L(`### C${ci}. \`${p.sig}\`${p.kind !== 'text' ? ` (${p.kind})` : ''}${g.ariaDisabled ? ' — aria-disabled, in scope' : ''}`);
  L();
  for (const t of themes) {
    const x = p[t];
    const grounds = [...x.grounds.values()].sort((a, b) => a.ratio - b.ratio);
    L(`- ${t}: **${x.ratio}:1** (floor ${x.floor}${x.large ? ', large text' : ''}) — text ${nameColour(t, x.fg) ?? x.fg}${x.opacity < 1 ? ` at opacity ${x.opacity}` : ''} on ${grounds.slice(0, 4).map((gr) => `${nameGround(t, gr.ground)} (${gr.ratio}:1${gr.gradient ? ', gradient in the chain' : ''})`).join('; ')}${grounds.length > 4 ? `; +${grounds.length - 4} more grounds` : ''}. Size ${[...x.sizes].sort((a, b) => a - b).join('/')}px, weight ${[...x.weights].sort().join('/')}. Sample: "${[...x.texts].slice(0, 2).join('", "')}".`);
  }
  const pagesAll = new Map(); for (const t of themes) for (const [pg, n] of p[t].pages) pagesAll.set(pg, (pagesAll.get(pg) || 0) + n);
  L(`- surfaces: ${sortedPages(pagesAll)}; roles: ${[...new Set(themes.flatMap((t) => [...p[t].roles]))].join(', ')}; widths: ${[...new Set(themes.flatMap((t) => [...p[t].widths]))].sort((a, b) => b - a).join('/')}.`);
  /* When the rule found sets a different token from the one measured, the
     colour is coming from an inline style: name the tsx files that carry
     both the class and that token. */
  const fgNames = (nameColour(themes[0], p[themes[0]].fg) || '').split(' = ').filter(Boolean);
  const where = locate(g.cls, ['color'], g.path, [...pagesAll.keys()]);
  const inlineHint = fgNames.length && !fgNames.some((n) => where.includes(`var(${n})`)) ? (() => { const files = new Set(); const parentCls = (g.path.split(' > ').slice(-2, -1)[0] ?? '').replace(/\[[^\]]*\]/g, '').split('.').slice(1); const all = g.cls.split(/\s+/).filter(Boolean).length ? g.cls.split(/\s+/).filter(Boolean) : parentCls; const cls = all.filter((c) => !GENERIC.has(c)).length ? all.filter((c) => !GENERIC.has(c)) : all; for (const [file, lines] of tsxIndex) { const text = lines.join('\n'); if (cls.some((c) => text.includes(c)) && fgNames.some((n) => text.includes(`var(${n})`))) files.add(file); } return files.size ? `; the measured token is set inline — see ${[...files].slice(0, 3).join(', ')}` : ''; })() : '';
  L(`- where: ${where}${inlineHint}${p.opacity < 1 ? `; the opacity: ${locate(g.cls, ['opacity'], g.path)}` : ''}`);
  const cands = candidates(p); const passing = cands.filter((c) => c.ok);
  const cur = nameColour(themes[0], p[themes[0]].fg);
  const current = cur ? cur.split(' = ')[0] : null;
  /* Nearest first: a token of the same family (the accent's own ink for an
     accent fill, the warn family's pill ink for --warn-text), then the
     neutral scale, then everything else, each by its margin over the floor. */
  const family = (t) => (t || '').replace(/-(text|pill-text|on-tint|on-wash|border|fg)$/, '');
  const margin = (c) => Math.min(c.light ?? 99, c.dark ?? 99) - floorOf(p);
  const rank = (c) => (family(c.token) === family(current) ? 0 : /^--(text|muted|faint)$/.test(c.token) ? 1 : 2);
  const ranked = passing.filter((c) => c.token !== current).sort((a, b) => rank(a) - rank(b) || margin(b) - margin(a));
  const close = ranked.filter((c) => rank(c) < 2);
  const same = close.length ? close : ranked;
  L(`- proposed fix: ${p.opacity < 1 && !same.length ? `the text token is not the failing factor — the element is faded to ${p.opacity} by an opacity rule, and no text token clears the floor through it (best: ${cands.slice().sort((a, b) => Math.min(b.light ?? 0, b.dark ?? 0) - Math.min(a.light ?? 0, a.dark ?? 0))[0]?.token} at light ${cands.slice().sort((a, b) => Math.min(b.light ?? 0, b.dark ?? 0) - Math.min(a.light ?? 0, a.dark ?? 0))[0]?.light}, dark ${cands.slice().sort((a, b) => Math.min(b.light ?? 0, b.dark ?? 0) - Math.min(a.light ?? 0, a.dark ?? 0))[0]?.dark}); report and stop — a ruling on the fade is needed` : same.length ? `swap to ${same.slice(0, 4).map((c) => `\`${c.token}\` (light ${c.light ?? '—'}, dark ${c.dark ?? '—'})`).join(' or ')}${p.opacity < 1 ? ` — measured through the ${p.opacity} fade the element carries` : ''}` : 'no text-role token passes on this ground in both themes — report and stop on this instance'}${current ? ` (currently \`${current}\`)` : ' (currently not a token)'}.`);
  L();
}
L(`Distinct contrast defects: ${ci}.`);
L();
if (exemptPairs.length) {
  L('### Natively disabled controls, listed and not counted (WCAG 1.4.3 exempts an inactive component)');
  L();
  for (const p of exemptPairs) { const themes = ['light', 'dark'].filter((t) => p[t]); L(`- \`${p.sig}\` — ${themes.map((t) => `${t} ${p[t].ratio}:1`).join(', ')}; ${sortedPages(new Map(themes.flatMap((t) => [...p[t].pages])))}.`); }
  L();
}

L('## Class 2 — tap targets under 44px');
L();
const tlist = [...tgroups.values()].filter((g) => !g.inlineInText).sort((a, b) => Math.min(a.minW, a.minH) - Math.min(b.minW, b.minH));
let ti = 0;
for (const g of tlist) {
  ti += 1;
  const short = Math.min(g.minW, g.minH);
  L(`### T${ti}. \`${g.sig}\` — short side ${short}px${g.ariaDisabled ? ' — **aria-disabled, in scope**' : ''}${g.nativeDisabled ? ' (natively disabled)' : ''}`);
  L();
  L(`- measured: ${[...g.sizes].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sz, n]) => `${sz}px (${n})`).join(', ')}${g.sizes.size > 5 ? `, +${g.sizes.size - 5} more sizes` : ''}${[...g.via].some((v) => v !== 'box') ? `; hit box read via ${[...g.via].join('/')}` : ''}. Text: "${[...g.texts].slice(0, 3).join('", "')}".`);
  const p390 = [...g.pagesByWidth[390]], p1440 = [...g.pagesByWidth[1440]];
  const same = p390.length && p1440.length && p390.every((pg) => g.pagesByWidth[1440].has(pg)) && p1440.every((pg) => g.pagesByWidth[390].has(pg));
  L(`- ${same ? `at both widths: ${p390.join(', ')}` : `at 390: ${p390.length ? p390.join(', ') : 'clears 44px or absent'}; at 1440: ${p1440.length ? p1440.join(', ') : 'clears 44px or absent'}`}; roles: ${[...g.roles].join(', ')}.`);
  L(`- where: ${locate(g.cls, ['height', 'min-height', 'padding', 'padding-block', 'padding-top', 'width', 'min-width', 'font-size'], g.path, [...g.pages.keys()])}`);
  const textLink = g.tag === 'a' && g.minH < 24;
  L(`- proposed fix: ${textLink ? 'a text link: the padding-and-negative-margin extension §0au already uses (`display: inline-block; padding-block: var(--sp-12); margin-block: calc(-1 * var(--sp-12)); line-height: 20px`, base.css "THE 44px FLOOR"), added to that rule\'s selector list so nothing on the line moves' : g.minH < 44 && g.minW >= 44 ? '`min-height: var(--tap-min)` on the control' : g.minW < 44 && g.minH >= 44 ? '`min-width: var(--tap-min)` on the control' : '`min-width: var(--tap-min); min-height: var(--tap-min)` on the control'}${g.tag === 'a' && !textLink ? ' (an `<a>` is inline — `display: inline-flex` first, or `min-height` has no effect)' : ''}; never into a neighbour, never overlapping another target.`);
  L();
}
L(`Distinct tap-target defects: ${ti}.`);
L();
const inline = [...tgroups.values()].filter((g) => g.inlineInText);
if (inline.length) {
  L('### Links inside running text, listed and not counted (WCAG 2.5.5 and 2.5.8 exempt an inline link)');
  L();
  for (const g of inline) L(`- \`${g.sig}\` — ${g.n} measurements, ${g.minW}–…×${g.minH}px; ${sortedPages(g.pages)}.`);
  L();
}

L('## Class 3 — colour-only candidates (the machine list; the hand review is in the report body)');
L();
for (const g of [...sgroups.values()].sort((a, b) => b.n - a.n)) L(`- \`${g.key}\` × ${g.n} — ${[...g.pages].slice(0, 6).join(', ')}${g.pages.size > 6 ? ` +${g.pages.size - 6}` : ''}; roles ${[...g.roles].join(', ')}; beside "${g.parentText}".`);
process.stdout.write(out.join('\n') + '\n');
