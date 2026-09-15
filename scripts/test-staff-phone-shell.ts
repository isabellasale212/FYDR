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
  /* #18 (15 Sept 2026, mobile queue): Reports are desktop-only — the one
     sidebar destination the phone shell deliberately does not carry. The
     route still answers (with its notice); the sidebar row is untouched. */
  /* 16 Sept 2026 (the overnight queue, 2.3, 2.4, 2.7): Nutrition is the
     nutritionist's on a phone and Gym programme the S&C's — hidden by role
     for the sport scientist here, never "not permitted" (enforcement after
     Friday); and Testing has a row of its own. */
  const phoneSidebar = visibleSidebar.filter((r) => r !== '/reports' && r !== '/nutrition' && r !== '/programmes');
  assert(phoneSidebar.every((r) => all.includes(r)) && all.includes('/flags') && all.includes('/testing'), 'every sidebar destination but Reports, Nutrition and Gym programme, plus Flags and Testing, is reachable');
  assert(!all.includes('/reports'), 'Reports has no row on a phone (#18, desktop-only; presentation, not permission)');
  assert(!all.includes('/nutrition') && !all.includes('/programmes'), 'nor Nutrition or Gym programme for the sport scientist (2.3, 2.4: hidden by role at phone width; enforcement after Friday)');
  assert(sheetRows(['nutritionist'], true).some((r) => r.route === '/nutrition') || barRows(['nutritionist'], true).some((r) => r.route === '/nutrition'), 'the nutritionist reaches Nutrition (the bar\'s fourth slot)');
  assert(barRows(['strength_conditioning'], true).some((r) => r.route === '/programmes'), 'and the S&C reaches Gym programme (the bar\'s fourth slot)');
  assert(!sheetRows(['coach'], true).some((r) => r.route === '/nutrition' || r.route === '/programmes'), 'a coach reaches neither on a phone');
  assert(all.length === phoneSidebar.length + 2, 'and nothing else');
  const sncSheet = sheetRows(['strength_conditioning'], true).map((r) => r.route);
  assert(sncSheet.includes('/flags') && !sncSheet.includes('/programmes'), 'for S&C, Gym leaves the sheet and Flags joins it');
  assert(!sheetRows(['coach'], false).map((r) => r.route).includes('/analytics'), 'Analytics is not in the sheet on Basic, as it is not in the sidebar');
  assert(sheet.map((r) => r.route).join(',') === [...phoneSidebar.filter((r) => !bar.map((b) => b.route).includes(r)), '/testing'].join(','), 'the sheet keeps the sidebar\'s order, Testing last');
}

console.log('\n2. the title bar names the screen');
{
  assert(pageTitle('/squad/abc') === 'Squad overview', '/squad/[id] → Squad overview');
  assert(pageTitle('/flags') === 'Flags', '/flags → Flags');
  assert(pageTitle('/timetable') === 'Schedule', '/timetable → Schedule (merged into it)');
  assert(pageTitle('/testing/x/y') === 'Testing', '/testing → Testing (its own sheet row since 16 Sept 2026)');
  assert(pageTitle('/settings/users/bulk-invite') === 'Settings', 'a deep settings route → Settings');
  assert(pageTitle('/injuries/abc') === 'Injuries', '/injuries/[id] → Injuries (its own screen family, not the dashboard row it hangs off)');
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
  /* 64px of bar below the status bar since 15 Sept 2026 (Isabella's P5,
     viewport-fit=cover): the height carries the top inset and the content
     pads below it. */
  assert(/position:\s*fixed/.test(title) && /height:\s*calc\(64px \+ env\(safe-area-inset-top, 0px\)\)/.test(title) && /padding:\s*env\(safe-area-inset-top, 0px\)/.test(title), 'a fixed title bar, 64px below the top inset, its content padded under the notch');
  const bar = rule('.ph-tabbar', pb);
  assert(/position:\s*fixed/.test(bar) && /grid-template-columns:\s*repeat\(5, 1fr\)/.test(bar), 'a fixed five-column bar');
  assert(/color-mix\(in srgb, var\(--elev\) 94%, transparent\)/.test(bar), 'on the athlete bar\'s own fill (no --tabbar-bg)');
  assert(/min-height:\s*(?:44px|var\(--tap-min\))/.test(rule('.ph-tab', pb)), 'tabs at the floor');
  assert(/min-height:\s*52px/.test(rule('.ph-sheet-row', pb)), 'sheet rows at 52px');
  assert(/rgb\(var\(--ink-rgb\) \/ 0\.35\)/.test(rule('.ph-sheet-scrim', pb)), 'the scrim is --ink-rgb at 0.35 (no --scrim)');
  assert(/border-radius:\s*var\(--r-sheet\)/.test(rule('.ph-sheet', pb)), 'the sheet\'s top radius is --r-sheet (System A, 15 Sept 2026)');
  assert(/box-shadow:\s*var\(--shadow\)/.test(rule('.ph-sheet', pb)), 'and --shadow (no --shadow-raised)');
  assert(/\.main\s*\{[^}]*padding:\s*calc\(64px \+ var\(--sp-18\) \+ env\(safe-area-inset-top, 0px\)\)/.test(pb), 'the content starts below the 64px bar and the top inset');
  /* P5, 15 Sept 2026: the bars' backgrounds run to the display's edges and
     their CONTENT sits clear of the home indicator and the notch's side —
     the insets are padding on the bar itself, never on a wrapper. */
  assert(/padding:\s*9px calc\(var\(--s-3\) \+ env\(safe-area-inset-right, 0px\)\) calc\(var\(--s-5\) \+ env\(safe-area-inset-bottom, 0px\)\) calc\(var\(--s-3\) \+ env\(safe-area-inset-left, 0px\)\)/.test(bar), 'the tab bar pads its content with the bottom and side insets, on the bar itself');
  assert(!/border-radius/.test(bar) && !/border-radius/.test(title), 'and neither bar rounds its own corners — the device mask does that');
  const outside = strip(css.replace(/@media \(max-width: 767px\)\s*\{[\s\S]*?\n\}\n/g, ''));
  assert(!/\.ph-titlebar|\.ph-tabbar|\.ph-sheet/.test(outside.replace(/\.ph-shell\s*\{[^}]*\}/g, '')), 'no phone-shell rule outside the 767 block except the ≥768 hide');
  assert(/\.ph-shell\s*\{[^}]*display:\s*none/.test(strip(css)), 'and at ≥768 the shell is hidden — desktop unchanged');
  const tokens = read('src/styles/tokens.css');
  /* The day-one rule that nothing from the Claude Design kit enters the code
     was WITHDRAWN on 14 Sept 2026 (docs/decisions/design-system-adoption.md):
     the product adopts System A. Its colour and shape names arrived in
     layers one and two, its type, spacing and motion names in layer three
     (15 Sept). What this still pins is that the shell keeps reading the
     tokens it was built on (the assertions above) and that --bar-blur — the
     one shape.css name the shell's own rules were written not to need — is
     still not read by the shell. */
  assert(/--touch-min:|--tabbar-pad:|--t-pill:/.test(tokens), 'the layer-three names (--touch-min, --tabbar-pad, --t-pill) are tokens now');
  assert(!/var\(--bar-blur\)/.test(pb), 'and the shell reads no --bar-blur — its bar is a solid mix, as built');
}

console.log('\n5. the 44px floor for staff controls below 768');
{
  const floor = /\.ph-floor-marker[\s\S]*?\}/.exec(pb) ? '' : '';
  void floor;
  const block = pb;
  for (const sel of ['.main .back-btn', '.main .btn-ghost', '.main .btn-primary', '.main select', '.main .sg-stepper-btn', '.main .sg-btn-remove', '.main .sg-btn-add', '.main .sg-btn-publish', '.main .sg-btn-discard', '.main .nutr-stepper-btn', '.main .lbw-segmented button', '.main .theme-seg-btn', '.main .reorder-btn']) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`${esc}[^{]*\\{[^}]*min-height:\\s*(?:44px|var\\(--tap-min\\))`).test(block) || new RegExp(`(?:^|,)\\s*${esc}\\s*(?:,|\\{)[\\s\\S]{0,900}?min-height:\\s*(?:44px|var\\(--tap-min\\))`).test(block), `${sel} is at least 44px on a phone`);
  }
  /* §0au (2026-09-12): the review measured what the class list missed —
     plain <button>s (the schedule's group chips, the mode segment, the flag
     "Acknowledge", the profile's "Edit"), the week arrows at 32×32, `.tiny`
     Links, and the roster names one pixel short. Every button in the content
     column is floored (the grid's session blocks excepted — their height IS
     the session's length), the arrows get a width too, and inline links get
     a 20px line so 12 + 20 + 12 clears 44. */
  assert(/\.main button:not\(\.sg-block\)[^{]*\{[^}]*min-height:\s*(?:44px|var\(--tap-min\))/.test(block), 'every button in the content column is floored, except the grid\'s session blocks');
  assert(/\.main \.sg-weeknav-btn\s*\{[^}]*min-width:\s*(?:44px|var\(--tap-min\))/.test(block), 'the week arrows are 44 wide as well as tall');
  for (const sel of ['.main .sg-viewtab', '.main .squad-chip', '.main .sg-segment', '.main .btn-ghost-pill']) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`(?:^|,)\\s*${esc}\\s*(?:,|\\{)[\\s\\S]{0,900}?min-height:\\s*(?:44px|var\\(--tap-min\\))`, 'm').test(block), `${sel} is at least 44px on a phone (§0au)`);
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
