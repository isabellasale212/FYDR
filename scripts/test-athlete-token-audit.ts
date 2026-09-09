/* THE ATHLETE REDESIGN, audited against the radius and font tokens.
 *
 * WHY THIS FILE EXISTS RATHER THAN JUST RUNNING check:control-radius. That
 * guard reads ONE file — `src/styles/base.css`, its own argv default — so three
 * surfaces the redesign actually touched were never guarded at all:
 *
 *   1. INLINE STYLES IN TSX. `style={{ borderRadius: 12 }}` is invisible to a
 *      stylesheet scan, and it is the easiest way to put a raw radius on a new
 *      control without anything complaining.
 *   2. STYLE STRINGS BUILT IN JS. A chip or tab whose radius arrives through a
 *      template literal never appears in the CSS as a literal at all.
 *   3. font-family, in either place. check:control-radius only looks at
 *      border-radius; nothing checked that a new component reads --font-sans.
 *
 * WHAT COUNTS AS LEGITIMATELY ROUND is unchanged and is deliberately narrow:
 * toggle TRACKS and KNOBS, avatars, legend swatches and dots. Isabella
 * confirmed the toggle exemption again on 2026-09-08 — a named exception, not
 * an oversight — so it is asserted here rather than assumed.
 *
 * THE FOUR ATHLETE PILLS are the other exception: sign-out, theme-seg,
 * theme-seg-btn and md-seg read --r-full (999px) by name. They may read that
 * token and nothing else; a raw 999px on the same selector still fails.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ATHLETE_PILL_EXEMPT, SHAPED_ON_PURPOSE, findViolations } from './check-control-radius';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const css = readFileSync('src/styles/base.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

/* The athlete surface: its own routes, plus every component reachable from
   them. Scoped this way rather than to `src/components` wholesale, because a
   raw radius on a staff-only component is not this audit's business and
   flagging it would bury the finding that matters. */
const ATHLETE_COMPONENTS = [
  'AvailabilityBanner', 'InjuryClinical', 'CheckInForm', 'GymSessionLogger', 'ThemeToggle',
  'AvatarUploadForm', 'AthleteProfileEditForm', 'ChangePasswordForm', 'WellnessChart',
  'AthleteTabBar', 'EmptyState', 'FlagNotice', 'PeriodSelector', 'TestSparkline',
  'NotificationPreferencesForm', 'LeaderboardConsentToggle', 'HideLeaderboardsToggle',
  'GlobalOptOutToggle', 'NutritionCheckinForm', 'OutboxFlusher', 'Toast', 'FydrLockup',
];
const files: string[] = [];
const walk = (d: string) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
};
walk('src/app/(athlete)');
for (const c of ATHLETE_COMPONENTS) {
  try { walk(join('src/components', c)); } catch { /* component may not exist */ }
}

console.log(`the athlete surface: ${files.length} files`);

console.log('\n1. no raw radius in an inline style');
{
  /* A raw radius is a number or a px/rem literal. `var(--r-*)` is the point of
     the token. '50%' is a CIRCLE, and the honest test for one is not a nearby
     word — it is the geometry: an element whose width equals its height and
     which asks for 50% is a circle by construction, and no amount of styling
     turns that into a pill-shaped button.

     THE FIRST VERSION OF THIS CHECK looked for a SHAPED_ON_PURPOSE word within
     400 characters and reported AvatarUploadForm's 10x10 colour swatch as a
     violation: it is an anonymous <span> inside a chip, so there was no name to
     find. Measuring the shape instead passes the swatch and the 64px avatar
     preview for the same reason, and still cannot be talked into passing a
     button. */
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/borderRadius:\s*('[^']*'|"[^"]*"|[\d.]+)/g)) {
      const value = (m[1] ?? '').replace(/['"]/g, '');
      if (value.startsWith('var(--r-')) continue;
      const line = src.slice(0, m.index).split('\n').length;
      if (value === '50%') {
        /* The enclosing style object, read outwards from the match. */
        const start = src.lastIndexOf('{', m.index ?? 0);
        const obj = src.slice(Math.max(0, start - 60), (m.index ?? 0) + 220);
        /* UNIT-AWARE SINCE 2026-09-09, and it had to be. This read bare
           numbers only, so when AvatarUploadForm's circle moved from
           `width: 64` to `width: '4rem'` — a square either way — the regex
           stopped matching and a real circle was reported as a raw radius.
           The premise is "equal width and height is a circle", and that holds
           in any unit. Comparing the captured strings also keeps the check
           honest about MIXED units: `width: 64` with `height: '4rem'` is not a
           square you can reason about, and is exactly the mismatch that made
           the monogram clip at a raised text size. */
        const dim = (prop: string): string | undefined =>
          new RegExp(`${prop}:\\s*'?([\\d.]+(?:rem|px|em)?)'?`).exec(obj)?.[1];
        const w = dim('width'), h = dim('height');
        if (w !== undefined && h !== undefined && w === h) continue;
      }
      offenders.push(`${f}:${line}  borderRadius: ${value}`);
    }
  }
  for (const o of offenders) console.log(`         ${o}`);
  assert(offenders.length === 0, 'every inline radius on the athlete surface is a token, or a circle by geometry');
}

console.log('\n2. no raw font-family, inline or in the stylesheet');
{
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/fontFamily[=:]\s*[{"']*([^,"'}\n]+)/g)) {
      const v = (m[1] ?? '').trim();
      if (v.startsWith('var(--font-')) continue;
      if (v === 'inherit') continue;
      offenders.push(`${f}  fontFamily: ${v}`);
    }
  }
  for (const o of offenders) console.log(`         ${o}`);
  assert(offenders.length === 0, 'every inline fontFamily reads --font-sans or --font-brand');
  /* And the stylesheet, which check:control-radius never looks at for fonts. */
  const cssFonts = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => (m[1] ?? '').trim());
  const rawCss = cssFonts.filter((v) => !v.startsWith('var(--font-') && v !== 'inherit');
  for (const v of rawCss) console.log(`         base.css  font-family: ${v}`);
  assert(rawCss.length === 0, `and all ${cssFonts.length} font-family rules in base.css do too`);
}

console.log('\n3. no radius or font arriving through a JS-built style string');
{
  /* The shape this is looking for is a chip/tab/pill whose style is assembled
     rather than declared: style={`...`}, or a template literal containing a
     radius or font declaration. Invisible to every CSS-side check. */
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (/style=\{`/.test(src)) offenders.push(`${f}  style={\`...\`}`);
    for (const m of src.matchAll(/`[^`]*(border-radius|font-family)[^`]*`/g)) {
      offenders.push(`${f}  template literal: ${(m[0] ?? '').slice(0, 60)}`);
    }
  }
  for (const o of offenders) console.log(`         ${o}`);
  assert(offenders.length === 0, 'no style string is built in JS on the athlete surface');
}

console.log('\n4. the stylesheet itself still holds');
{
  assert(findViolations(css).length === 0, 'every interactive rule reads --r-control or a named exemption');
  assert(/--r-control:\s*6px/.test(tokens), '--r-control is still 6px');
  /* The four athlete pills, and the rule that they may read ONE token. */
  for (const name of ['sign-out', 'theme-seg', 'theme-seg-btn', 'md-seg']) {
    assert(ATHLETE_PILL_EXEMPT.includes(name), `${name} is exempt by name`);
  }
  assert(findViolations('.md-seg { border-radius: 999px; }').length === 1,
    'and a raw 999px on an exempt name still fails');
  assert(ATHLETE_PILL_EXEMPT.length === 4,
    'four exemptions, no more — a long list means the rule was abandoned rather than excepted');
}

console.log('\n5. the athlete controls the guard\'s NET misses are exactly the known three');
{
  /* THE GUARD UNDER-MATCHES BY DESIGN, and its own header says so: INTERACTIVE
     is "a net, not a proof", and it cannot know that a selector is a control
     when the selector's words do not say so. Three athlete controls slip it:
     none of `gym-set-key`, `dots .opt` or `prog-item` contains any word in the
     net, so all three have carried a raw radius the whole time without the
     build noticing.
     
     ALL THREE ARE PRE-EXISTING AND UNCHANGED — verified against base.css at
     3a6a22d, the commit before the redesign started — and all three are drawn
     ROUNDED in the reference Isabella approved, so pointing them at
     --r-control (6px) would contradict the design rather than serve it. They
     are reported, not fixed.

     What this assertion is for is the NEXT one. Pinning the set means a fourth
     athlete control with a raw radius fails the build, instead of joining a
     list nobody is counting. */
  const KNOWN: readonly { sel: string; value: string; why: string }[] = [
    { sel: '.gym-set-key', value: '12px', why: 'gym logger set keys, rounded in screens 09/10' },
    { sel: '.dots .opt > span', value: '14px', why: "the wellness sheet's 1-5 scale, rounded in screens 13/14" },
    { sel: '.prog-item', value: '14px', why: 'Programme list rows, a screen the changelog leaves unchanged' },
  ];
  for (const { sel, value, why } of KNOWN) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const raw = /border-radius:\s*([^;]+);/.exec(rule)?.[1]?.trim();
    assert(raw === value, `${sel} is still ${value} — ${why}`);
  }
  /* AND NO FOURTH — established from the JSX, not from the selector's words.
     
     A FIRST VERSION OF THIS GUESSED FROM NAMES and was wrong in both
     directions: it flagged .gym-correct and .prog-day (panels and cards, which
     the rule was never about — "nothing you can CLICK may carry its own
     radius"), .wk-day .wn (a 50% circle), and .tr-board-row, a staff selector
     matched only because `rd-` happens to appear inside "boa-rd-row".
     
     So interactivity is read off the markup instead: a class earns scrutiny
     when the athlete surface renders it on a button, an anchor, a Link, a
     select or an input. That is evidence rather than a guess, and it is exactly
     the fact the stylesheet cannot know — which is why the main guard's header
     calls its own name list a net and not a proof. */
  const jsx = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const interactiveClasses = new Set<string>();
  for (const m of jsx.matchAll(/<(?:button|a|Link|select|input|textarea)\b[^>]*className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const cls of ((m[1] ?? m[2]) ?? '').split(/[\s${}]+/)) {
      if (cls) interactiveClasses.add(cls);
    }
  }
  const found: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
    const decl = /border-radius:\s*([^;]+);/.exec(m[2] ?? '');
    if (!decl) continue;
    const v = (decl[1] ?? '').trim();
    if (v.startsWith('var(--r-')) continue;
    if (KNOWN.some((k) => sel === k.sel)) continue;
    /* A CIRCLE BY CONSTRUCTION, same test as check 1 rather than a fourth name
       on a list. `.sheet-x` is the sheet dismiss — 44x44 at 50%, pre-existing,
       and drawn as a circle in screens 13/14. The rule bans PILL-shaped
       buttons; a square element at 50% is a circle, which is a different shape
       and the standard treatment for a dismiss. Measuring it means the next
       circular icon button needs no exemption either, while a 200x44 at 50%
       still fails. */
    if (v === '50%') {
      const w = /width:\s*([\d.]+)px/.exec(m[2] ?? '')?.[1];
      const h = /height:\s*([\d.]+)px/.exec(m[2] ?? '')?.[1];
      if (w !== undefined && w === h) continue;
    }
    /* Every class token the selector mentions; a hit on any of them means this
       rule can land on something an athlete taps. */
    const mentioned = [...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((c) => c[1] ?? '');
    if (!mentioned.some((c) => interactiveClasses.has(c))) continue;
    found.push(`${sel} -> ${v}`);
  }
  for (const f of found) console.log(`         ${f}`);
  assert(found.length === 0,
    `and no fourth athlete CONTROL carries a raw radius (checked ${interactiveClasses.size} classes the markup puts on a tappable element)`);
}

console.log('\n6. toggle switches stay exempt, by name');
{
  /* Confirmed again by Isabella on 2026-09-08: deliberate, not an oversight.
     A 6px track around a 50% knob is not a crisper control, it is a broken
     switch. Asserted so the exemption cannot be quietly withdrawn either. */
  for (const word of ['track', 'knob', 'avatar', 'swatch', 'dot']) {
    assert(SHAPED_ON_PURPOSE.test(word), `'${word}' is still shaped on purpose`);
  }
  assert(findViolations('.tr-heat-toggle-track { border-radius: 999px; }').length === 0,
    'a switch track keeps its pill');
}

console.log('\n7. the wordmark is Sora, and only the wordmark is');
{
  const rule = (sel: string): string => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  };
  /* .lockup-word is FydrLockup's mark — the one wordmark an athlete ever
     reaches, on the sign-in screens. */
  const lockup = rule('.lockup-word');
  assert(/font-family:\s*var\(--font-brand\)/.test(lockup), 'the lockup wordmark is --font-brand (Sora)');
  assert(/font-weight:\s*800/.test(lockup), 'at 800');
  assert(/letter-spacing:\s*-0\.035em/.test(lockup), 'and -0.035em tracking');
  /* THE FOURTEEN REDESIGNED SCREENS CARRY NO WORDMARK AT ALL. The athlete
     shell is a tab bar, not a brand bar — the mark lives in the staff Sidebar
     and on the sign-in screens. Asserted as an absence so that if one is ever
     added to the athlete shell, this audit is what notices. */
  const shell = readFileSync('src/app/(athlete)/layout.tsx', 'utf8');
  assert(!/font-brand|lockup|wm\b|brand/.test(shell),
    'and the athlete shell carries no wordmark, so none of the fourteen screens can wear the wrong face');
  /* Sora must not have leaked into body copy. */
  const brandRules = [...css.matchAll(/([^{}]+)\{([^{}]*--font-brand[^{}]*)\}/g)]
    .map((m) => (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim());
  console.log(`         brand-face rules: ${brandRules.join(', ')}`);
  assert(brandRules.length <= 3, 'the brand face is confined to the wordmark rules');
  assert(brandRules.every((s) => /lockup|wm|brand|launch-claim/.test(s)),
    'and every one of them is a mark or a brand headline, never body copy');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
