/* STAFF-SS-01 — the staff phone shell below 768px, decided by Isabella
 * 2026-09-12: "bottom bar with a More sheet, as the board proposes. It
 * supersedes the top-bar note in §0af. Below 768px only; desktop unchanged.
 * It must also meet the 44px floor for staff controls below 768px."
 *
 *   1. the bar: Dashboard, Squad, Schedule fixed; the fourth slot follows
 *      the role (Flags for sport scientist, coach and medic; Gym for S&C;
 *      Nutrition for the nutritionist); More. Whatever takes the slot leaves
 *      the sheet and Flags joins it, so every section is reachable in
 *      exactly one place
 *   2. the title bar names the screen, from the same route table the
 *      sidebar draws
 *   3. the sheet is a real disclosure: aria-expanded, aria-controls, Escape,
 *      focus returned; 52px rows; Log out at a real size
 *   4. CSS: below 768 the sidebar is gone and the content starts at the top;
 *      64px title bar, five-column bar, 44px tabs; the scrim and radius are
 *      composed from existing tokens; nothing changes at ≥768; no new token
 *   5. the 44px floor for staff controls below 768, fixed once here
 */
import { readFileSync } from 'node:fs';
import { pageTitle, phoneSlot, sheetRows, barRows } from '@/components/StaffPhoneShell/shell';
import { SIDEBAR_ROWS as SIDEBAR } from '@/components/Sidebar/rows';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = read('src/styles/base.css');
const phoneBlock = (): string => {
  /* Every `@media (max-width: 767px) { ... }` block, concatenated. */
  const out: string[] = [];
  const re = /@media \(max-width: 767px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1, i = m.index + m[0].length;
    for (; i < css.length && depth > 0; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
    out.push(css.slice(m.index + m[0].length, i - 1));
  }
  return strip(out.join('\n'));
};
const pb = phoneBlock();
const rule = (sel: string, src: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(src)?.[1] ?? '';
};

console.log('1. the bar and the sheet, by role');
{
  for (const r of ['sport_scientist', 'coach', 'medic'] as const) {
    assert(phoneSlot([r]).route === '/flags', `${r}: the fourth slot is Flags`);
  }
  assert(phoneSlot(['strength_conditioning']).route === '/programmes' && phoneSlot(['strength_conditioning']).label === 'Gym', 'S&C: Gym');
  assert(phoneSlot(['nutritionist']).route === '/nutrition', 'nutritionist: Nutrition');
  assert(phoneSlot(['strength_conditioning', 'coach']).route === '/flags', 'a coach who is also S&C gets Flags — the three flag roles win');
  const bar = barRows(['sport_scientist'], true);
  assert(bar.map((r) => r.route).join(',') === '/dashboard,/squad,/schedule,/flags', 'sport scientist bar: Dashboard, Squad, Schedule, Flags (More is the fifth control)');
  const sheet = sheetRows(['sport_scientist'], true);
  const all = [...bar, ...sheet].map((r) => r.route);
  const visibleSidebar = SIDEBAR.filter((r) => r.roles.includes('sport_scientist')).map((r) => r.route);
  assert(new Set(all).size === all.length, 'no destination appears twice');
  assert(visibleSidebar.every((r) => all.includes(r)) && all.includes('/flags'), 'every sidebar destination plus Flags is reachable');
  assert(all.length === visibleSidebar.length + 1, 'and nothing else');
  const sncSheet = sheetRows(['strength_conditioning'], true).map((r) => r.route);
  assert(sncSheet.includes('/flags') && !sncSheet.includes('/programmes'), 'for S&C, Gym leaves the sheet and Flags joins it');
  assert(!sheetRows(['coach'], false).map((r) => r.route).includes('/analytics'), 'Analytics is not in the sheet on Basic, as it is not in the sidebar');
  assert(sheet.map((r) => r.route).join(',') === visibleSidebar.filter((r) => !bar.map((b) => b.route).includes(r)).join(','), 'the sheet keeps the sidebar\'s order');
}

console.log('\n2. the title bar names the screen');
{
  assert(pageTitle('/squad/abc') === 'Squad overview', '/squad/[id] → Squad overview');
  assert(pageTitle('/flags') === 'Flags', '/flags → Flags');
  assert(pageTitle('/timetable') === 'Schedule', '/timetable → Schedule (merged into it)');
  assert(pageTitle('/testing/x/y') === 'Reports', '/testing → Reports (its entry point)');
  assert(pageTitle('/settings/users/bulk-invite') === 'Settings', 'a deep settings route → Settings');
  assert(pageTitle('/platform/sign-in-probes') === 'Fydr', 'an unknown route → the brand');
}

console.log('\n3. the sheet is a real disclosure');
{
  const src = strip(read('src/components/StaffPhoneShell/StaffPhoneShell.tsx'));
  assert(/aria-expanded=\{open\}/.test(src) && /aria-controls="ph-sheet"/.test(src), 'the More control declares expanded and controls');
  assert(/role="dialog"/.test(src) && /aria-modal="true"/.test(src), 'the sheet is a dialog');
  assert(/key === 'Escape'/.test(src), 'Escape closes it');
  assert(/moreRef\.current\?\.focus\(\)/.test(src), 'focus returns to the control on close');
  assert(/firstRowRef\.current\?\.focus\(\)/.test(src), 'and moves into the sheet on open');
  assert(/action="\/auth\/sign-out" method="post"/.test(src) && /Log out/.test(src), 'Log out is a real sign-out submit in the sheet');
  assert(/aria-current=\{active \? 'page' : undefined\}/.test(src), 'the active destination stays marked');
  const layout = strip(read('src/app/(staff)/layout.tsx'));
  assert(/<StaffPhoneShell/.test(layout), 'the staff layout renders it');
}

console.log('\n4. the CSS, below 768 only');
{
  assert(/\.sidebar\s*\{[^}]*display:\s*none/.test(pb), 'below 768 the sidebar is gone');
  assert(!/\.sidebar\s*\{[^}]*position:\s*static/.test(pb), 'and no longer stacks above the content');
  const title = rule('.ph-titlebar', pb);
  assert(/position:\s*fixed/.test(title) && /height:\s*64px/.test(title), 'a fixed 64px title bar');
  const bar = rule('.ph-tabbar', pb);
  assert(/position:\s*fixed/.test(bar) && /grid-template-columns:\s*repeat\(5, 1fr\)/.test(bar), 'a fixed five-column bar');
  assert(/color-mix\(in srgb, var\(--elev\) 94%, transparent\)/.test(bar), 'on the athlete bar\'s own fill (no --tabbar-bg)');
  assert(/min-height:\s*44px/.test(rule('.ph-tab', pb)), 'tabs at the floor');
  assert(/min-height:\s*52px/.test(rule('.ph-sheet-row', pb)), 'sheet rows at 52px');
  assert(/rgb\(var\(--ink-rgb\) \/ 0\.35\)/.test(rule('.ph-sheet-scrim', pb)), 'the scrim is --ink-rgb at 0.35 (no --scrim)');
  assert(/var\(--r-card\) var\(--r-card\) 0 0/.test(rule('.ph-sheet', pb)), 'the sheet\'s top radius is --r-card (no --r-sheet)');
  assert(/box-shadow:\s*var\(--shadow\)/.test(rule('.ph-sheet', pb)), 'and --shadow (no --shadow-raised)');
  assert(/\.main\s*\{[^}]*padding:\s*calc\(64px \+ var\(--sp-18\)\)/.test(pb), 'the content starts below the 64px bar');
  const outside = strip(css.replace(/@media \(max-width: 767px\)\s*\{[\s\S]*?\n\}\n/g, ''));
  assert(!/\.ph-titlebar|\.ph-tabbar|\.ph-sheet/.test(outside.replace(/\.ph-shell\s*\{[^}]*\}/g, '')), 'no phone-shell rule outside the 767 block except the ≥768 hide');
  assert(/\.ph-shell\s*\{[^}]*display:\s*none/.test(strip(css)), 'and at ≥768 the shell is hidden — desktop unchanged');
  const tokens = read('src/styles/tokens.css');
  assert(!/--r-sheet|--scrim|--touch-min|--tabbar-bg|--bar-blur|--tabbar-pad|--shadow-raised|--t-pill/.test(tokens), 'none of the board\'s eight names became a token');
}

console.log('\n5. the 44px floor for staff controls below 768');
{
  const floor = /\.ph-floor-marker[\s\S]*?\}/.exec(pb) ? '' : '';
  void floor;
  const block = pb;
  for (const sel of ['.main .back-btn', '.main .btn-ghost', '.main .btn-primary', '.main select', '.main .sg-stepper-btn', '.main .sg-btn-remove', '.main .sg-btn-add', '.main .sg-btn-publish', '.main .sg-btn-discard', '.main .nutr-stepper-btn', '.main .lbw-segmented button', '.main .theme-seg-btn', '.main .reorder-btn']) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`${esc}[^{]*\\{[^}]*min-height:\\s*44px`).test(block) || new RegExp(`(?:^|,)\\s*${esc}\\s*(?:,|\\{)[\\s\\S]{0,900}?min-height:\\s*44px`).test(block), `${sel} is at least 44px on a phone`);
  }
  /* §0au (2026-09-12): the review measured what the class list missed —
     plain <button>s (the schedule's group chips, the mode segment, the flag
     "Acknowledge", the profile's "Edit"), the week arrows at 32×32, `.tiny`
     Links, and the roster names one pixel short. Every button in the content
     column is floored (the grid's session blocks excepted — their height IS
     the session's length), the arrows get a width too, and inline links get
     a 20px line so 12 + 20 + 12 clears 44. */
  assert(/\.main button:not\(\.sg-block\)[^{]*\{[^}]*min-height:\s*44px/.test(block), 'every button in the content column is floored, except the grid\'s session blocks');
  assert(/\.main \.sg-weeknav-btn\s*\{[^}]*min-width:\s*44px/.test(block), 'the week arrows are 44 wide as well as tall');
  for (const sel of ['.main .sg-viewtab', '.main .squad-chip', '.main .sg-segment', '.main .btn-ghost-pill']) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`(?:^|,)\\s*${esc}\\s*(?:,|\\{)[\\s\\S]{0,900}?min-height:\\s*44px`, 'm').test(block), `${sel} is at least 44px on a phone (§0au)`);
  }
  assert(/line-height:\s*20px/.test(/\.main a\.tiny,[\s\S]*?\{([^}]*)\}/.exec(block)?.[1] ?? ''), 'inline links sit on a 20px line, so the padding trick clears 44 (the roster names were 43)');
  for (const sel of ['.main table.tbl .nm', '.main .eyebrow a', '.main .tiny a', '.main a.tiny', '.main .pp-link']) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`(?:^|,)\\s*${esc}\\s*(?:,|\\{)[\\s\\S]{0,600}?padding-block:\\s*var\\(--sp-12\\)`, 'm').test(block), `${sel}: an inline link gets a 44px hit box without moving`);
  }
}

console.log('\n6. the docs');
{
  assert(/More sheet/.test(read('docs/02-information-architecture.md')), '02-information-architecture.md §4.6 describes the built phone shell');
  assert(/ph-tabbar|More sheet/.test(read('docs/06-design-system.md')), '06-design-system.md §10.2 names it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
