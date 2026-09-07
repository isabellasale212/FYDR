/* One mark, everywhere it appears — including the places that are not text.
 *
 * WHAT THE AUDIT ON 2026-09-07 FOUND, and what this file exists to stop coming
 * back. Every text wordmark measured Sora 800 at -0.035em and was reported
 * correct, because the check measured the WORD. The mark beside it was a
 * different thing on three pages, and there was no mark at all in the browser
 * tab:
 *
 *   1. `.signin-mark` on /login/reset, /login/reset/confirm and /login/mfa was
 *      a 26x26 div with border-radius 8px filled with the accent — a generic
 *      rounded blue square that appears nowhere else in the brand. The real
 *      mark is a GPS trace ending in a ringed dot.
 *   2. The collapsed 64px sidebar rail rendered `.wm-trace` at its full 132px,
 *      overflowing a 63px container by 68px. Sidebar.tsx said the trace was
 *      "Hidden on the 64px collapsed rail" and no CSS did that.
 *   3. There was no favicon, apple icon, Open Graph image or manifest at all.
 *      Eight icon paths returned 404 on production.
 *
 * SO THE ASSERTIONS HERE ARE ABOUT THE MARK, NOT THE TYPE. test-brand-face.ts
 * still owns the face, the weight and the tracking. This file owns "is it the
 * same drawing", which is the half that was not being checked.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');
const css = read('src/styles/base.css');
const flat = (p: string): string => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ');

/** Scoped rule lookup — an absent selector returns '', never a slice of the
 *  whole file. Optionally searched from a marker, for rules that exist twice. */
const ruleFrom = (haystack: string, name: string): string => {
  const i = haystack.indexOf(`${name} {`);
  if (i === -1) return '';
  const end = haystack.indexOf('}', i);
  return end === -1 ? '' : haystack.slice(i, end);
};
const rule = (name: string): string => ruleFrom(css, name);

const AUTH_SCREENS = [
  'src/app/login/reset/page.tsx',
  'src/app/login/reset/confirm/page.tsx',
  'src/app/login/mfa/page.tsx',
];

console.log('1. the three auth screens draw the real mark, not a blue square');
{
  for (const p of AUTH_SCREENS) {
    const src = flat(p);
    const name = p.replace('src/app/', '');
    assert(/FydrLockup/.test(src), `${name} renders FydrLockup`);
    assert(!/signin-mark/.test(src), `${name} no longer draws .signin-mark`);
    assert(!/signin-word/.test(src), `${name} no longer draws its own wordmark`);
  }

  /* The square itself must go, not merely stop being referenced — a rule left
     behind is the next person's "this looks unused, I'll wire it back up". */
  assert(rule('.signin-mark') === '', '.signin-mark is deleted from the stylesheet, not orphaned');
  assert(rule('.signin-word') === '', 'and so is .signin-word, now that nothing sets a second wordmark');
  assert(
    !/border-radius: 8px;\s*background: var\(--accent\);\s*box-shadow/.test(css),
    'the rounded-square-with-a-glow shape is gone from the stylesheet entirely',
  );
}

console.log('\n   ...and it is the SAME component the splash and sidebar use');
{
  const lockup = read('src/components/FydrLockup/FydrLockup.tsx');
  assert(/lk-trace/.test(lockup) && /lk-ring/.test(lockup) && /lk-dot/.test(lockup),
    'FydrLockup draws trace, ring and dot — the three parts of the mark');
  assert(/--lk-scale/.test(css), 'and it is sized by --lk-scale rather than redrawn per surface');
  const signinLogo = rule('.signin-logo');
  assert(/--lk-scale/.test(signinLogo), '.signin-logo sets a scale rather than a second geometry');

  /* AND THE SAME INKS. `.lk-trace` falls back to --accent-border when nothing
     declares --lk-trace, so a lockup dropped onto a new surface silently draws
     its trace at full-strength blue instead of the pale tint — the same class
     of bug as the blue square: right component, wrong drawing. */
  const launch = rule('.launch');
  for (const ink of ['--lk-ink', '--lk-trace', '--lk-dot']) {
    const want = (new RegExp(`${ink}: ([^;]+);`).exec(launch) ?? [])[1];
    const got = (new RegExp(`${ink}: ([^;]+);`).exec(signinLogo) ?? [])[1];
    assert(Boolean(want) && want === got, `${ink} matches the splash (splash ${want}, auth ${got})`);
  }

  /* THE COUNT IS THE POINT. Three text wordmarks became two, because the auth
     screens now use the splash's. A fourth implementation appearing is the
     regression this asserts against. */
  const wordmarkRules = ['.lockup-word', '.brand .wm', '.signin-word'].filter((s) => rule(s) !== '');
  assert(
    wordmarkRules.length === 2,
    `exactly two wordmark implementations remain, not three (saw ${wordmarkRules.join(', ') || 'none'})`,
  );
}

console.log('\n2. the collapsed 64px rail shows a CROPPED mark, not a shrunken one');
{
  /* TWO BUGS, ONE AFTER THE OTHER. First: .brand .wm and .wm-trace are both
     132px, sized for the 235px sidebar, and nothing narrowed them for the 64px
     rail — so the trace ran 68px past the sidebar, clipped, while Sidebar.tsx
     claimed it was hidden there.

     Then the obvious fix made a second problem. Scaling the whole 242x66
     drawing down to 40px does fit, but the ringed dot it ends in came out
     5.6px across — present, correct, and too faint to read as the mark.

     So the rail gets a CROP rather than a reduction: a second SVG over the
     tail of the trace and the ringed dot, at a size where the ring is legible.
     That is the same swap the wordmark beside it already does — .wm-full and
     .wm-mono both sit in the DOM and the media query picks one — rather than a
     third mechanism. */
  const railAt = css.indexOf('@media (min-width: 768px) and (max-width: 1023px)', css.indexOf('.wm-mono {'));
  assert(railAt !== -1, 'the collapsed-rail block exists');
  const rail = css.slice(railAt, css.indexOf('\n}\n', railAt));
  const sidebar = read('src/components/Sidebar/Sidebar.tsx');

  assert(/wm-trace-full/.test(sidebar) && /wm-trace-mono/.test(sidebar),
    'the sidebar renders both a full and a cropped trace, the way it already renders both wordmarks');
  assert(/display: none/.test(ruleFrom(rail, '.wm-trace-full')),
    'the full trace is hidden on the rail');
  assert(/display: block/.test(ruleFrom(rail, '.wm-trace-mono')),
    'and the cropped one is shown');

  const px = (r: string, prop = 'width'): number =>
    Number((new RegExp(`${prop}: (\\d+(?:\\.\\d+)?)px`).exec(r) ?? [])[1] ?? NaN);
  const RAIL = 64;
  assert(px(ruleFrom(rail, '.brand .wm')) <= RAIL, `.brand .wm fits the ${RAIL}px rail`);
  const monoW = px(ruleFrom(rail, '.wm-trace-mono'));
  assert(monoW > 0 && monoW <= RAIL, `the cropped mark fits it too (saw ${monoW}px)`);

  /* THE POINT OF THE CROP, asserted as a number rather than trusted. The mark
     is a ring of r=17 with a 3-wide stroke, so it occupies 37 units of
     whatever viewBox it is drawn in. Scaled from the full 242-wide box into
     40px it renders at 6.1px; cropped, it should be several times that. */
  const monoBox = (/viewBox="([^"]+)"[^>]*className="[^"]*wm-trace-mono|wm-trace-mono[^>]*viewBox="([^"]+)"/.exec(sidebar) ?? []);
  const box = (monoBox[1] ?? monoBox[2] ?? '').split(/\s+/).map(Number);
  assert(box.length === 4, `the cropped SVG declares a viewBox (saw ${JSON.stringify(monoBox[1] ?? monoBox[2] ?? null)})`);
  assert(box[2] !== undefined && box[2] < 242,
    `and it is a CROP of the 242-wide drawing, not the whole thing (saw width ${box[2]})`);

  const RING_UNITS = 17 * 2 + 3;
  const renderedRing = box[2] ? (RING_UNITS * monoW) / box[2] : 0;
  assert(renderedRing >= 14,
    `the ring renders at ${renderedRing.toFixed(1)}px — legible, against 6.1px for the shrunken whole drawing`);

  assert(
    !/Hidden on the 64px collapsed rail/.test(sidebar),
    'and Sidebar.tsx no longer claims the trace is hidden there, which was never true',
  );
}

console.log('\n3. the app has an icon, in every place a browser looks for one');
{
  const ICONS: { path: string; what: string; minBytes: number }[] = [
    { path: 'src/app/icon.svg', what: 'the favicon', minBytes: 200 },
    { path: 'src/app/apple-icon.png', what: 'the iOS home-screen icon', minBytes: 1000 },
    { path: 'src/app/opengraph-image.png', what: 'the link preview', minBytes: 5000 },
    { path: 'src/app/manifest.ts', what: 'the web manifest', minBytes: 200 },
  ];
  for (const { path, what, minBytes } of ICONS) {
    const there = existsSync(path);
    assert(there, `${path} exists — ${what}`);
    if (there) {
      assert(statSync(path).size >= minBytes,
        `  and is a real file, not a placeholder (${statSync(path).size} bytes, want >= ${minBytes})`);
    }
  }

  if (existsSync('src/app/icon.svg')) {
    const icon = read('src/app/icon.svg');
    /* It must be the MARK, not a letter in a box or a stock glyph: a ring with
       a dot inside it, which is what the trace ends in. */
    assert(/<circle/.test(icon), 'the favicon is drawn from circles — the ringed dot, not a lettermark');
    assert((icon.match(/<circle/g) ?? []).length >= 2, 'both of them: the ring and the dot inside it');
    assert(/<path/.test(icon), 'and carries the trace it terminates, so it is the mark rather than a bullseye');
    assert(!/<text|font-family/.test(icon), 'no text — a favicon that needs a webfont renders as a fallback face at 16px');
  }

  if (existsSync('src/app/manifest.ts')) {
    const m = read('src/app/manifest.ts');
    assert(/icons:/.test(m), 'the manifest declares icons');
    assert(/Fydr/.test(m), 'and names the app');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
