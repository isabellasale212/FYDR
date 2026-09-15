/* The app icon set, built from the product's own lockup — the wordmark and
 * the mark exactly as the expanded sidebar draws them (Isabella, 15 Sept 2026,
 * P4 of the overnight queue: "the app icon becomes the full logo").
 *
 * Writes:
 *   public/fydr-logo.svg        the master: the lockup alone, tight viewBox
 *   src/app/apple-icon.png      180×180, iOS home screen (the logo at 88% of the side —
 *                               iOS applies its own corner mask; the lockup's extremities
 *                               sit clear of the curves)
 *   public/icon-192.png         192×192 } the manifest's Android icons, purpose "any
 *   public/icon-512.png         512×512 } maskable": the whole logo inside the central 80%
 *   src/app/opengraph-image.png 1200×630, the link preview (the logo at half the width)
 *
 * src/app/icon.svg — the browser tab at 16–32px — is NOT written here and does
 * not change: a wordmark is illegible there, and the trace-and-dot mark exists
 * for exactly that reason.
 *
 * THE WORDMARK IS OUTLINED PATHS, NOT TEXT. The glyphs below are Sora ExtraBold
 * (the weight-800 face src/app/layout.tsx loads through next/font/google — the
 * same file the build ships), laid out as Chrome lays out the sidebar's
 * <span class="wm-full">Fydr</span>: 48px, letter-spacing -0.035em (-1.68px),
 * kerned by the font's own GPOS, converted with fontkit and fixed here so the
 * build depends on no font at all. Units are the sidebar's .wm pixels at that
 * setting: the text starts at x=0; the baseline is at y=39.56 (the inline box
 * measured live at (0,-7) 101.53×61 inside .wm's 132×60, and Sora's ascent is
 * 970/1000). The glyph run's width, 101.52, matches the live measurement.
 *
 * THE MARK IS THE SIDEBAR'S 242×66 DRAWING at the sidebar's own placement:
 * .wm-trace is 132×36 at left -2% and bottom -5.7% of .wm, which puts the
 * viewBox at (-2.62, 27.41) scaled by 132/242. Same path, same ring (r 17,
 * stroke 3), same dot (r 7), same 5-unit trace with round caps and joins.
 * Two adjustments to the TRACE and none to the letterforms, both made after
 * looking at the 180px render at actual size (the rule for the icon):
 *   - the dip's left shoulder moves from x=44 to x=38 (a 45° slant): the
 *     sidebar's slant passes 1.4 units under the corner of the y's descender,
 *     which at 180px is a hairline and reads as a touch; at 38 the trace
 *     clears the corner by 2.7 units (≈3px at 180, 8px at 512);
 *   - the trace ends at (201.3, 29.4) instead of (206, 27): the sidebar's end
 *     point is inside the ring (15.2 from its centre against r=17), where the
 *     round cap sits as a blob on the ring's inner edge — invisible through two
 *     translucent strokes at 132px, a smudge at 180px opaque. The new end is
 *     on the same line, where the cap meets the ring's outer edge.
 *
 * COLOURS: the wordmark in --text (#121722); the trace, the ring and the dot
 * in the SOLID accent (#17489b) — the product's dark-theme "one flat ink"
 * treatment of the mark, not the sidebar's translucent 0.45 / 0.34. Isabella's
 * call, 15 Sept 2026, after seeing the first build at 60pt: at that tone the
 * trace was a faint grey line and the ringed dot — the distinctive part of the
 * mark — had effectively disappeared at the size the icon is actually seen
 * at. Rendered at 0.45, 0.7, 0.85 and 1 and read at 60, 120, 180 and 512:
 * full strength is the first tone at which the ring reads as a ring at 60pt,
 * and at 512 the trace (a third of a letter stem's weight, beneath the word)
 * still sits behind the wordmark rather than competing with it, so no
 * intermediate tone was needed. An icon is opaque, so everything is
 * flattened onto white.
 *
 * Run: node scripts/build-brand-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const GLYPHS = [
  { name: 'F', d: 'M3.552 39.56L3.552 4.52L12.48 4.52L12.48 39.56ZM11.52 25.976L11.52 18.68L24.528 18.68L24.528 25.976ZM11.52 11.816L11.52 4.52L25.056 4.52L25.056 11.816Z' },
  { name: 'y', d: 'M28.56 50.12L28.56 42.824L34.656 42.824Q35.76 42.824 36.528 42.536Q37.296 42.248 37.776 41.6Q38.256 40.952 38.496 39.8L44.448 13.064L52.704 13.064L45.744 41.48Q44.976 44.744 43.608 46.64Q42.24 48.536 39.864 49.328Q37.488 50.12 33.696 50.12ZM36.96 38.984L36.96 32.264L42.528 32.264L42.528 38.984ZM32.928 38.984L25.2 13.064L33.936 13.064L41.184 38.984Z' },
  { name: 'd', d: 'M64.608 40.424Q61.824 40.424 59.544 39.416Q57.264 38.408 55.608 36.608Q53.952 34.808 53.064 32.36Q52.176 29.912 52.176 27.032L52.176 25.88Q52.176 23 53.016 20.528Q53.856 18.056 55.44 16.208Q57.024 14.36 59.28 13.328Q61.536 12.296 64.32 12.296Q67.536 12.296 69.816 13.712Q72.096 15.128 73.32 17.816Q74.544 20.504 74.64 24.344L72.624 22.856L72.624 4.52L81.36 4.52L81.36 39.56L74.448 39.56L74.448 28.808L75.408 28.808Q75.312 32.36 73.968 34.976Q72.624 37.592 70.248 39.008Q67.872 40.424 64.608 40.424ZM66.96 33.224Q68.544 33.224 69.864 32.504Q71.184 31.784 72 30.392Q72.816 29 72.816 27.032L72.816 25.4Q72.816 23.48 71.976 22.184Q71.136 20.888 69.816 20.192Q68.496 19.496 66.96 19.496Q65.232 19.496 63.864 20.384Q62.496 21.272 61.704 22.832Q60.912 24.392 60.912 26.456Q60.912 28.52 61.704 30.032Q62.496 31.544 63.864 32.384Q65.232 33.224 66.96 33.224Z' },
  { name: 'r', d: 'M86.016 39.56L86.016 13.064L92.928 13.064L92.928 24.584L92.832 24.584Q92.832 19.016 95.16 15.848Q97.488 12.68 101.856 12.68L102.912 12.68L102.912 20.168L100.896 20.168Q97.968 20.168 96.36 21.752Q94.752 23.336 94.752 26.312L94.752 39.56Z' },
];

const TS = 132 / 242, TX = -2.62, TY = 27.41;
const t = (x, y) => [TX + x * TS, TY + y * TS];
const f = (n) => Math.round(n * 1000) / 1000;
const TRACE_242 = [[3, 36], [38, 36], [56, 54], [92, 54], [104, 36], [188, 36], [201.3, 29.4]];
const tracePts = TRACE_242.map(([x, y]) => t(x, y));
const [rx, ry] = t(220, 21);
const ringR = 17 * TS, dotR = 7 * TS, traceW = 5 * TS, ringW = 3 * TS;

/* The lockup's bounds: glyph ink, the trace with half its stroke, the ring with half its stroke. */
const glyphBounds = [
  { x0: 3.552, x1: 25.056, y0: 4.52, y1: 39.56 },
  { x0: 25.2, x1: 52.704, y0: 13.064, y1: 50.12 },
  { x0: 52.176, x1: 81.36, y0: 4.52, y1: 40.424 },
  { x0: 86.016, x1: 102.912, y0: 12.68, y1: 39.56 },
];
const xs = [], ys = [];
for (const b of glyphBounds) { xs.push(b.x0, b.x1); ys.push(b.y0, b.y1); }
for (const [x, y] of tracePts) { xs.push(x - traceW / 2, x + traceW / 2); ys.push(y - traceW / 2, y + traceW / 2); }
xs.push(rx - ringR - ringW / 2, rx + ringR + ringW / 2); ys.push(ry - ringR - ringW / 2, ry + ringR + ringW / 2);
const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
const W = x1 - x0, H = y1 - y0;

const over = (hex, a) => '#' + [0, 2, 4].map((i) => Math.round(255 + (parseInt(hex.slice(1 + i, 3 + i), 16) - 255) * a).toString(16).padStart(2, '0')).join('');
/* TONE: the trace and ring's strength over white — 1 is the solid accent. Overridable for a scratch comparison
   (TONE=0.7 OUT=/tmp/x node scripts/build-brand-icons.mjs); the committed icons are built at the default. */
const TONE = Number(process.env.TONE ?? 1);
const ACCENT = '#17489b', INK = '#121722', TRACE = over(ACCENT, TONE), RING = over(ACCENT, TONE);

const lockup = () =>
  `<g id="wordmark" fill="${INK}">${GLYPHS.map((g) => `<path d="${g.d}"/>`).join('')}</g>` +
  `<g id="mark" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="${tracePts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')}" stroke="${TRACE}" stroke-width="${f(traceW)}"/>` +
  `<circle cx="${f(rx)}" cy="${f(ry)}" r="${f(ringR)}" stroke="${RING}" stroke-width="${f(ringW)}"/>` +
  `<circle cx="${f(rx)}" cy="${f(ry)}" r="${f(dotR)}" fill="${ACCENT}" stroke="none"/></g>`;

const HEADER = '<!-- The Fydr logo: the sidebar lockup, outlined. Built by scripts/build-brand-icons.mjs; edit that, not this. Sora ExtraBold outlines at 48px / -0.035em; the mark is the 242×66 sidebar drawing at its sidebar placement, with two trace adjustments the script explains. -->';
const master = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(W)} ${f(H)}">${HEADER}${lockup()}</svg>`;

/* A square: white, full-bleed, NO rounded corners (iOS and Android apply their own mask); the lockup at `frac` of the side, centred. */
const framed = (w, h, frac) => {
  const s = (w * frac) / W; const ox = (w - W * s) / 2 - x0 * s, oy = (h - H * s) / 2 - y0 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff"/><g transform="translate(${f(ox)} ${f(oy)}) scale(${f(s)})">${lockup()}</g></svg>`;
};

const OUT = process.env.OUT ?? '';
const at = (file) => (OUT ? `${OUT}/${file.split('/').pop()}` : file);
mkdirSync(OUT || 'public', { recursive: true });
writeFileSync(at('public/fydr-logo.svg'), master);
const jobs = [
  [at('src/app/apple-icon.png'), framed(180, 180, 0.88)],
  [at('public/icon-192.png'), framed(192, 192, 0.8)],
  [at('public/icon-512.png'), framed(512, 512, 0.8)],
  [at('src/app/opengraph-image.png'), framed(1200, 630, 0.5)],
  /* The 60pt preview — the size a home-screen icon is actually seen at on a 1× display; the apple icon's composition. */
  ...(OUT ? [[at('preview-60pt.png'), framed(60, 60, 0.88)], [at('preview-120.png'), framed(120, 120, 0.88)]] : []),
];
for (const [file, svg] of jobs) {
  const m = /width="(\d+)" height="(\d+)"/.exec(svg); const w = Number(m[1]), h = Number(m[2]);
  /* Rendered at 4× and reduced: librsvg's own anti-aliasing at 180px is coarser than a Lanczos reduction from 720. Flattened: an icon is opaque. */
  await sharp(Buffer.from(svg), { density: 72 * 4 }).resize(w, h, { kernel: 'lanczos3' }).flatten({ background: '#ffffff' }).removeAlpha().png({ compressionLevel: 9 }).toFile(file);
  console.log(`wrote ${file} ${w}×${h}`);
}
console.log(`wrote ${at('public/fydr-logo.svg')} (viewBox ${f(x0)} ${f(y0)} ${f(W)} ${f(H)}) at tone ${TONE}`);
