/* The brand accent is #17489b — Isabella's decision, 11 Sept 2026 — and the
 * dark theme has its own fill.
 *
 * WHAT WAS DECIDED, and what this pins (CLAUDE.md §0.01: a token's value
 * changes only on explicit instruction, recorded next to the value and in the
 * decisions log — docs/decisions/adr-009-brand-accent.md — as its own commit
 * with a full contrast sweep in both themes):
 *
 *   LIGHT   --accent #1f6fea -> #17489b. The four accent inks (--accent-text,
 *           --accent-pill-text, --accent-on-tint, --accent-on-wash) collapse to
 *           the accent itself, because the navy clears AA as ink on every light
 *           ground (8.46 surf / 7.20 bg / 6.91 athlete ground) — keeping the
 *           tuned brighter blues would put a 213° blue beside a navy button.
 *           --accent-border, --focus and --wk-match-border follow; --lk-trace
 *           (the lockup's trace, base.css) is the accent at 25% over white;
 *           PDF_COLOR.accent (lib/pdf.tsx) is the same value on paper.
 *   DARK    #17489b measures 1.73:1 against dark --surf — a button that
 *           vanishes into its card — so dark gets --accent #2a6ddf: the new
 *           brand's own hue and saturation at the lightness that keeps white
 *           text at 4.83:1 and the fill 3.08:1 off the card. --accent-rgb moves
 *           with it in BOTH dark blocks, so every wash, ring and border alpha
 *           follows. The dark inks stay, except --accent-pill-text, which was
 *           4.34:1 on its own pill fill before this change and is now #8fb4ff.
 *   ALSO    dark --bad-text #f15a4a -> #ff7460: it measured 4.47:1 on --surf
 *           (found in ATH-ADULT-03) and now clears cards, the page and the
 *           bad wash. Its check-contrast exemption goes; the accent exemption
 *           narrows to dark, where the fill is still not an ink.
 *   NOT     --accent2, --chart-load, --group-blue, --tab-active / --avatar-text /
 *           --toast-link (#6f9bff) and the icon tiles are unchanged.
 *
 * The sweep below is measured from tokens.css itself, in both themes, on the
 * grounds each token actually lands on — so a later edit that breaks a pairing
 * fails the build rather than a screenshot.
 */
import { readFileSync } from 'node:fs';
import { KNOWN_BELOW_AA } from './check-contrast';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const tokens = read('src/styles/tokens.css');
const base = read('src/styles/base.css');
const uncommented = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

/* The four cascade blocks, sliced by their headers. Light is the shared base
   plus the light block; dark arrives twice (an explicit choice and the OS
   default) and the two must not differ. */
const at = (s: string): number => { const i = tokens.indexOf(s); if (i < 0) throw new Error(`no "${s}" in tokens.css`); return i; };
const shared = tokens.slice(0, at(':root,'));
const light = tokens.slice(at(":root[data-theme='light'] {"), at('.dark-tokens,'));
const darkExplicit = tokens.slice(at(":root[data-theme='dark'] {"), at('@media (prefers-color-scheme: dark)'));
const darkMedia = tokens.slice(at('@media (prefers-color-scheme: dark)'), at('\n@media print {'));
const print = tokens.slice(at('\n@media print {'));
const value = (block: string, name: string): string | null =>
  new RegExp(`^\\s*${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`, 'm').exec(uncommented(block))?.[1]?.trim() ?? null;
const resolve = (block: string, name: string): string | null => value(block, name) ?? value(shared, name);

type RGB = [number, number, number];
const hex = (v: string): RGB => {
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) throw new Error(`not a hex: ${v}`);
  return [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) as RGB;
};
const lum = (c: RGB): number => {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
};
const ratio = (a: RGB, b: RGB): number => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
const over = (tone: RGB, ground: RGB, a: number): RGB => [0, 1, 2].map((i) => Math.round((1 - a) * ground[i]! + a * tone[i]!)) as RGB;
const hue = (c: RGB): number => {
  const [r, g, b] = c.map((v) => v / 255) as RGB;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60) % 360;
};
/** `rgb(var(--x-rgb) / 0.12)` -> the alpha; the triplet is read from the theme. */
const alphaOf = (v: string | null): number => { const m = /\/\s*([0-9.]+)\)/.exec(v ?? ''); if (!m) throw new Error(`no alpha in ${v}`); return Number(m[1]); };
const triplet = (v: string | null): RGB => { const m = /^(\d+) (\d+) (\d+)$/.exec(v ?? ''); if (!m) throw new Error(`not a triplet: ${v}`); return [Number(m[1]), Number(m[2]), Number(m[3])]; };

console.log('the values, light');
{
  assert(value(shared, '--accent') === '#17489b', '--accent is #17489b (shared base; dark overrides below)');
  assert(value(shared, '--accent-rgb') === '23 72 155', '--accent-rgb is 23 72 155');
  assert(value(shared, '--accent-border') === '#1c59bf', '--accent-border is #1c59bf — the same hue and saturation, one lightness step up');
  for (const t of ['--accent-text', '--accent-pill-text', '--accent-on-tint', '--accent-on-wash']) {
    assert(value(light, t) === '#17489b', `${t} collapses to the accent in light`);
  }
  assert(value(light, '--focus') === '#17489b', '--focus (light) is the accent');
  assert(value(light, '--wk-match-border') === '#17489b', '--wk-match-border (light) is the accent');
  assert(value(shared, '--on-accent') === '#ffffff', '--on-accent stays white');
  for (const t of ['--accent-text', '--accent-pill-text', '--accent-on-tint', '--wk-match-border']) {
    assert(value(print, t) === '#17489b', `${t} in the print block takes the same value as light`);
  }
}

console.log('\nthe values, dark — in BOTH dark blocks');
{
  for (const [name, block] of [['explicit', darkExplicit], ['media', darkMedia]] as const) {
    assert(value(block, '--accent') === '#2a6ddf', `${name}: --accent is #2a6ddf`);
    assert(value(block, '--accent-rgb') === '42 109 223', `${name}: --accent-rgb is 42 109 223, so the washes, ring and borders follow`);
    assert(value(block, '--accent-border') === '#4d86e5', `${name}: --accent-border is #4d86e5`);
    assert(value(block, '--accent-pill-text') === '#8fb4ff', `${name}: --accent-pill-text is #8fb4ff (was #699bff at 4.34:1 on its own fill)`);
    assert(value(block, '--bad-text') === '#ff7460', `${name}: --bad-text is #ff7460 (was #f15a4a at 4.47:1 on --surf)`);
    for (const t of ['--accent-text', '--accent-on-tint', '--accent-on-wash', '--focus']) {
      assert(value(block, t) !== null && value(block, t) === value(darkExplicit, t), `${name}: ${t} unchanged and identical across the two dark blocks (${value(block, t)})`);
    }
  }
  assert(value(darkExplicit, '--accent-text') === '#8fb4ff' && value(darkExplicit, '--accent-on-tint') === '#8fb4ff' && value(darkExplicit, '--accent-on-wash') === '#9dbcff', 'the other dark inks keep their values');
  /* THE TWO DARK BLOCKS DEFINE THE SAME SET. Until 11 Sept 2026 the media
     block was missing --phone-bg and --accent-on-wash, so an OS-dark athlete
     with no stored choice got the light shell ground under dark text. */
  const names = (block: string): string[] => [...uncommented(block).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]!).sort();
  const onlyExplicit = names(darkExplicit).filter((n) => !names(darkMedia).includes(n));
  const onlyMedia = names(darkMedia).filter((n) => !names(darkExplicit).includes(n));
  assert(onlyExplicit.length === 0 && onlyMedia.length === 0, `the explicit and the OS-default dark blocks define the same tokens (${onlyExplicit.concat(onlyMedia).join(', ') || 'no difference'})`);
  const differing = names(darkExplicit).filter((n) => value(darkExplicit, n) !== value(darkMedia, n));
  assert(differing.length === 0, `and with the same values (${differing.join(', ') || 'none differ'})`);
}

console.log('\nwhat does not move');
{
  assert(value(shared, '--accent2') === '#33b6ff', '--accent2 unchanged');
  assert(value(shared, '--chart-load') === '#5b9bf0', '--chart-load unchanged (decoupled from the accent on purpose)');
  assert(value(light, '--group-blue') === '#2563eb', '--group-blue unchanged');
  assert(value(shared, '--tab-active') === '#6f9bff' && value(shared, '--avatar-text') === '#6f9bff' && value(shared, '--toast-link') === '#6f9bff', '--tab-active / --avatar-text / --toast-link unchanged');
  assert(/fill="#202b4e"/.test(read('src/app/icon.svg')) && /theme_color: '#202b4e'/.test(read('src/app/manifest.ts')), 'the icon tile and manifest keep their navy ground — they never carried the accent');
}

console.log('\nthe old value is gone everywhere it was');
{
  /* Declarations only: comments may cite the old value as history. */
  for (const [file, src] of [['tokens.css', uncommented(tokens)], ['base.css', uncommented(base)], ['lib/pdf.tsx', uncommented(read('src/lib/pdf.tsx'))]] as const) {
    assert(!/1f6fea|31 111 234|3c85f7|c7dbfa/i.test(src), `${file} declares no #1f6fea, 31 111 234, #3c85f7 or #c7dbfa`);
  }
  assert(/accent: '#17489b'/.test(read('src/lib/pdf.tsx')), 'PDF_COLOR.accent is #17489b');
  const traces = [...uncommented(base).matchAll(/--lk-trace:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase());
  assert(traces.filter((t) => t === '#c5d1e6').length >= 2 && !traces.includes('#c7dbfa'), `--lk-trace is #c5d1e6 in the light declarations, #c7dbfa nowhere (${traces.join(', ')})`);
  const expected = over(hex('#17489b'), [255, 255, 255], 0.25);
  assert(hex('#c5d1e6').every((v, i) => Math.abs(v - expected[i]!) <= 1), 'and #c5d1e6 is the accent at 25% over white, as #c7dbfa was of #1f6fea');
  /* The live places in docs: the token tables and the mermaid fills. The
     measurement tables in 06-design-system.md keep their dated history. */
  assert(/`--accent`\s*\|\s*`#17489b`/.test(read('docs/Fydr_-_Design_System_Reference.md')), 'Fydr_-_Design_System_Reference.md shows #17489b for --accent');
  for (const d of ['docs/02-information-architecture.md', 'docs/03-flows.md', 'docs/13-legal-and-trademark.md']) {
    assert(!/fill:#1f6fea/i.test(read(d)) && /fill:#17489b/i.test(read(d)), `${d}'s diagram fill is the accent`);
  }
}

/* A missing token is a failure to report, not a crash to read a stack for. */
const guarded = (label: string, fn: () => void): void => { try { fn(); } catch (e) { assert(false, `${label}: ${(e as Error).message}`); } };

console.log('\nthe derivations');
guarded('derivations', () => {
  const accentL = hex('#17489b'), borderL = hex('#1c59bf'), accentD = hex('#2a6ddf'), borderD = hex('#4d86e5');
  assert(Math.abs(hue(accentL) - hue(accentD)) < 1.5, `light and dark accents share a hue (${hue(accentL).toFixed(1)}° / ${hue(accentD).toFixed(1)}°)`);
  assert(Math.abs(hue(borderL) - hue(accentL)) < 1.5 && lum(borderL) > lum(accentL), 'light --accent-border: same hue, lighter');
  assert(Math.abs(hue(borderD) - hue(accentD)) < 1.5 && lum(borderD) > lum(accentD), 'dark --accent-border: same hue, lighter');
  assert(triplet(value(shared, '--accent-rgb')).join(',') === accentL.join(','), '--accent-rgb (light) is the light accent\'s channels');
  assert(triplet(value(darkExplicit, '--accent-rgb')).join(',') === accentD.join(','), '--accent-rgb (dark) is the dark accent\'s channels');
});

console.log('\nthe sweep, both themes, on the grounds the text lands on');
guarded('sweep', () => {
  const AA = 4.5, UI = 3;
  for (const [theme, block] of [['light', light], ['dark', darkExplicit]] as const) {
    const g = (name: string): RGB => hex(resolve(block, name)!);
    const accent = g('--accent'), rgb = triplet(resolve(block, '--accent-rgb'));
    const surf = g('--surf'), bg = g('--bg'), phone = g('--phone-bg'), surf2 = g('--surf2');
    const r = (a: RGB, b: RGB): string => ratio(a, b).toFixed(2);
    const onAccent = ratio(g('--on-accent'), accent);
    assert(onAccent >= AA, `${theme}: --on-accent on --accent = ${onAccent.toFixed(2)}:1`);
    const onPressed = ratio(g('--on-accent'), g('--accent-border'));
    assert(onPressed >= UI, `${theme}: --on-accent on --accent-border (the :active fill, momentary) = ${onPressed.toFixed(2)}:1 — held to the 3:1 floor, as before this change`);
    for (const [ground, name] of [[surf, '--surf'], [phone, '--phone-bg']] as const) {
      assert(ratio(accent, ground) >= UI, `${theme}: the fill against ${name} = ${r(accent, ground)}:1 (non-text 3:1 floor)`);
    }
    console.log(`         ${theme}: the fill against --bg = ${r(accent, bg)}:1 (a labelled solid button; recorded, not held to 3:1 — it was ${theme === 'light' ? '3.88' : '2.98'} before)`);
    for (const ink of ['--accent-text', '--accent-pill-text', '--accent-on-tint', '--accent-on-wash']) {
      for (const [ground, name] of [[surf, '--surf'], [bg, '--bg'], [phone, '--phone-bg']] as const) {
        assert(ratio(g(ink), ground) >= AA, `${theme}: ${ink} on ${name} = ${r(g(ink), ground)}:1`);
      }
    }
    const pillFill = over(rgb, surf, Number(resolve(block, '--pill-fill-alpha')));
    assert(ratio(g('--accent-pill-text'), pillFill) >= AA, `${theme}: --accent-pill-text on its own pill fill (accent at --pill-fill-alpha over --surf) = ${r(g('--accent-pill-text'), pillFill)}:1`);
    const strong = over(rgb, surf, alphaOf(resolve(block, '--wash-accent-strong')));
    assert(ratio(g('--accent-on-tint'), strong) >= AA, `${theme}: --accent-on-tint on --wash-accent-strong over --surf = ${r(g('--accent-on-tint'), strong)}:1`);
    const wash = over(rgb, phone, alphaOf(resolve(block, '--wash-accent')));
    assert(ratio(g('--accent-on-wash'), wash) >= AA, `${theme}: --accent-on-wash on --wash-accent over --phone-bg = ${r(g('--accent-on-wash'), wash)}:1`);
    if (theme === 'light') {
      for (const [ground, name] of [[surf, '--surf'], [bg, '--bg'], [phone, '--phone-bg']] as const) {
        assert(ratio(accent, ground) >= AA, `light: --accent itself as ink on ${name} = ${r(accent, ground)}:1 — which is why the light inks can be the accent`);
      }
      assert(ratio(g('--focus'), surf) >= UI && ratio(g('--focus'), bg) >= UI, `light: --focus against --surf / --bg = ${r(g('--focus'), surf)} / ${r(g('--focus'), bg)}:1`);
    }
    const badText = g('--bad-text');
    for (const [ground, name] of [[surf, '--surf'], [bg, '--bg'], [phone, '--phone-bg']] as const) {
      assert(ratio(badText, ground) >= AA, `${theme}: --bad-text on ${name} = ${r(badText, ground)}:1`);
    }
    const badWash = over(triplet(resolve(block, '--bad-rgb')), surf, alphaOf(resolve(block, '--wash-bad')));
    assert(ratio(badText, badWash) >= AA, `${theme}: --bad-text on --wash-bad over --surf = ${r(badText, badWash)}:1`);
    if (theme === 'dark') assert(ratio(badText, surf2) >= AA, `dark: --bad-text on --surf2 = ${r(badText, surf2)}:1`);
  }
});

console.log('\ncheck-contrast\'s exemptions say what is true now');
{
  const accent = KNOWN_BELOW_AA.find((k) => k.token === 'accent');
  assert(accent !== undefined && accent.theme === 'dark', 'the --accent-as-ink exemption is narrowed to dark (in light the navy clears AA as ink)');
  assert(!KNOWN_BELOW_AA.some((k) => k.token === 'bad-text'), 'the dark --bad-text exemption is gone — it passes now');
}

console.log('\nrecorded as the rule requires');
guarded('records', () => {
  const notes = (tokens.match(/11 Sept 2026, Isabella's decision/g) ?? []).length;
  assert(notes >= 6, `tokens.css carries "11 Sept 2026, Isabella's decision" beside the changed values (${notes} places)`);
  assert(/11 Sept 2026, Isabella's decision[\s\S]{0,700}--accent: #17489b;/.test(tokens), 'the note sits next to --accent itself');
  const adr = read('docs/decisions/adr-009-brand-accent.md');
  assert(/#17489b/.test(adr) && /#2a6ddf/.test(adr) && /#ff7460/.test(adr) && /11 Sept(ember)? 2026/.test(adr), 'docs/decisions/adr-009-brand-accent.md records the decision, the dark fill and the dark --bad-text');
  const ds = read('docs/06-design-system.md');
  assert(/`--accent`\s*\|\s*`#17489b`/.test(ds), '06-design-system.md\'s token table shows #17489b');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
