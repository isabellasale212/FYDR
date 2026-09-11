/* ATH-ADULT-02 follow-up — Isabella's decisions of 2026-09-11, built 2026-09-12.
 *
 *   1. THE WEEK STRIP, COMPACT, ABOVE TO DO. The seven-day row with its MD
 *      labels sits between the greeting (and the availability line, when
 *      there is one) and To do, on the ground rather than in a card; the
 *      card below Today keeps "Working towards". To do's first row was at
 *      244px on a 375×812 phone before this; it must still be in view after.
 *   2. NO AVATAR IN THE GREETING. The header is the date line and the
 *      greeting, as the board draws it; the tab bar's Me covers the
 *      navigation. The users query that existed only to fetch it goes too.
 *   3. ATHLETE CARDS TAKE THE 9px TOKEN — `--r-toggle`, which already exists;
 *      the card rule inside .phone-body is repointed (recorded in the to-do
 *      list's decisions log as the second token-value decision of 11 Sept).
 *      Whole athlete route group: .card, .empty, .avail-banner, .gym-ex-card.
 *      Staff cards stay on --r-card, and the token itself is untouched.
 *   4. THE AVAILABILITY LINE READS WARM. It was --wash-warn laid over the
 *      athlete app's blue ground, which composites to grey-beige — the exact
 *      cancellation the availability card's own comment describes. It now
 *      takes the card's tint rule: the tone mixed INTO --surf, so it reads
 *      amber (or red) on any ground. Contrast measured here from tokens.css.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const page = strip(read('src/app/(athlete)/today/page.tsx'));
const css = strip(read('src/styles/base.css'));
const tokens = read('src/styles/tokens.css');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};
const at = (needle: string): number => page.indexOf(needle);

console.log('1. the compact week strip sits above To do; "Working towards" stays in the card below');
{
  const stripAt = at('className="wk-strip wk-compact"'), todo = at('id="todo-title"'), today = at('id="today-title"'), card = at('className="card wk-card"'), towards = at('wk-towards'), line = at('href="#availability"');
  assert(stripAt > 0 && stripAt < todo, 'the strip renders before To do');
  assert(line > 0 && line < stripAt, 'and after the availability line, which stays directly under the greeting');
  assert(card > today && towards > card, 'the week card is still below Today and still carries "Working towards"');
  assert((page.match(/className="wk-day"/g) ?? []).length === 1 && at('className="wk-day"') < todo, 'the seven days are rendered once, in the strip above');
  assert(!/wk-card-label/.test(page), 'the card no longer carries the "This week" label — the strip\'s own heading does');
  assert(/id="week-title"/.test(page) && /aria-labelledby="week-title"/.test(page), 'the strip is a labelled section, "This week", like To do and Today');
  assert(/mdLabel\(/.test(page) && /className="wo num"/.test(page), 'and each day still carries its MD label');
  const compact = rule('.wk-compact');
  assert(compact !== '' && /padding:\s*0/.test(compact), '.wk-compact drops the card padding — it sits on the ground');
  const day = rule('.wk-compact .wk-day');
  assert(/gap:\s*var\(--sp-2\)/.test(day) && /padding:\s*var\(--sp-4\) 0/.test(day), 'each day is tighter: gap --sp-2, padding --sp-4');
  const num = rule('.wk-compact .wk-day .wn');
  assert(/width:\s*var\(--sp-24\)/.test(num) && /height:\s*var\(--sp-24\)/.test(num) && /font-size:\s*var\(--fs-13\)/.test(num), 'the day number is a 24px circle at --fs-13 (was 30px / --fs-14 in the card)');
  const towardsRule = rule('.wk-towards');
  assert(!/border-top/.test(towardsRule), '"Working towards" no longer draws a hairline above itself — nothing sits above it in the card now');
}

console.log('\n2. the greeting is the date line and the greeting');
{
  assert(!/className="av"/.test(page) && !/<img/.test(page), 'no avatar in the header');
  assert(!/avatar_url/.test(page) && !/userRow/.test(page), 'and the users query that only fetched it is gone');
  assert(!/initials\b/.test(page.replace(/import[\s\S]*?from '@\/lib\/format';/, '')), 'initials() is no longer called here');
  assert(/className="eyebrow eyebrow-accent"/.test(page) && /\{greeting\}, \{firstName\}/.test(page), 'the date line and "Morning, {name}" remain');
  assert(rule('.av') === '' && rule('img.av') === '', 'the .av rules are removed rather than orphaned — Today was their only caller');
}

console.log('\n3. athlete cards take the existing 9px token; staff cards do not');
{
  assert(/--r-toggle:\s*9px;/.test(tokens), '--r-toggle is 9px in tokens.css, untouched');
  assert(/--r-card:\s*18px;/.test(tokens), '--r-card is still 18px');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(rule('.phone-body .card')), '.phone-body .card is --r-toggle');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(rule('.phone-body .empty')), '.phone-body .empty (EmptyState on athlete screens) too');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(rule('.avail-banner')), '.avail-banner (athlete-only) too');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(rule('.gym-ex-card')), '.gym-ex-card (athlete-only) too');
  assert(/border-radius:\s*var\(--r-card\)/.test(rule('.card')), 'the global .card stays --r-card for the staff app');
  for (const sel of ['.pp-banner', '.dash-week', '.dash-stat-expand', '.report-card']) {
    assert(/border-radius:\s*var\(--r-card\)/.test(rule(sel)), `${sel} (staff) stays --r-card`);
  }
  const inCard = rule('.card > .subm');
  assert(/border-end-start-radius:\s*inherit/.test(inCard) && /border-end-end-radius:\s*inherit/.test(inCard), 'the report form\'s footer inherits its card\'s corners, so it follows either radius');
  assert(!/border-radius:\s*(9px|18px)/.test(css.slice(css.indexOf('.phone-body {'), css.indexOf('.phone-body {') + 4000)), 'no raw 9px or 18px anywhere near the shell rules — the token, not the number');
}

console.log('\n4. the availability line takes the card\'s tint rule, and the contrast');
{
  const line = rule('.avail-line');
  assert(/background:\s*color-mix\(in srgb, rgb\(var\(--warn-rgb\)\) 12%, var\(--surf\)\)/.test(line), 'warn: 12% of the tone mixed INTO --surf, never laid over the ground');
  assert(/border:\s*1px solid rgb\(var\(--warn-rgb\) \/ 0\.4\)/.test(line), 'with the card\'s own 0.4 border');
  assert(!/--wash-warn|--border-warn/.test(line), 'and no --wash-warn / --border-warn, the pair that went grey-beige on the blue ground');
  const bad = rule(".avail-line[data-tone='bad']");
  assert(/color-mix\(in srgb, rgb\(var\(--bad-rgb\)\) 12%, var\(--surf\)\)/.test(bad) && /rgb\(var\(--bad-rgb\) \/ 0\.4\)/.test(bad), 'bad: the same rule in the bad family');
  assert(/color:\s*var\(--text\)/.test(line), 'the message stays --text (the tone is the fill, the border and the dot)');

  const block = (start: string, end: string): string => tokens.slice(tokens.indexOf(start), tokens.indexOf(end, tokens.indexOf(start)));
  const light = block(":root[data-theme='light'] {", '.dark-tokens,');
  const dark = block(":root[data-theme='dark'] {", '@media (prefers-color-scheme: dark) {');
  const base = tokens.slice(0, tokens.indexOf(':root,'));
  type RGB = [number, number, number];
  const hex = (src: string, name: string): RGB => {
    const m = new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(src) ?? new RegExp(`${name}:\\s*#([0-9a-f]{6})`).exec(base);
    if (!m) throw new Error(`no ${name}`);
    return [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) as RGB;
  };
  const lum = (c: RGB): number => { const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]); };
  const ratio = (a: RGB, b: RGB): number => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const mix = (tone: RGB, surf: RGB, p: number): RGB => [0, 1, 2].map((i) => Math.round((1 - p) * surf[i]! + p * tone[i]!)) as RGB;
  for (const [theme, src] of [['light', light], ['dark', dark]] as const) {
    for (const tone of ['warn', 'bad'] as const) {
      const fill = mix(hex(src, `--${tone}`), hex(src, '--surf'), 0.12);
      const r = ratio(hex(src, '--text'), fill);
      assert(r >= 4.5, `${theme} ${tone}: --text on the 12% mix over --surf = ${r.toFixed(2)}:1`);
    }
    /* The fill is warm, not grey: on the light mix the red channel leads the
       blue — the property the over-the-ground composite lost. */
    if (theme === 'light') {
      const fill = mix(hex(src, '--warn'), hex(src, '--surf'), 0.12);
      assert(fill[0]! > fill[2]!, `light warn fill rgb(${fill.join(', ')}) reads warm (red above blue) — over the ground it composited to rgb(222, 224, 226)`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
