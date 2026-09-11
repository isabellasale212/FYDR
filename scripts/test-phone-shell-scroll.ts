/* The athlete shell scrolls as a document, and says so — §0s, C-g, 2026-09-11.
 *
 * WHAT WAS THERE. `.phone-body` declared `overflow-y: auto` — a scroll pane —
 * inside a `.phone` whose `min-height: 100dvh` lets it grow to its content.
 * So the pane was never bounded by the viewport and never scrolled: measured
 * on all fifteen athlete routes at 375×812, `scrollHeight === clientHeight`
 * on every one, and the DOCUMENT scrolled instead. Harmless to look at,
 * except that `position: sticky` resolves against the nearest scroll
 * container, and that container was this pane — which is why `.subm`'s
 * `bottom: 0` never pinned anything and every athlete write form's primary
 * action sat below the fold (§0s). Removing the dead declaration is a
 * byte-identical render (measured before and after) and lets a
 * bottom-pinned footer resolve against the viewport, which is the one
 * context where it can.
 *
 * THE INSET. The bottom safe-area inset already sits where the document
 * actually ends: `.athlete-tabbar`'s padding adds `env(safe-area-inset-bottom)`
 * to a real base. Adding it to `.phone-body` too would be visible extra space
 * above the tab bar on every screen, so it is not added here; a footer that
 * pins to the viewport carries its own (ATH-ADULT-03, commit 2).
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const css = readFileSync('src/styles/base.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('the shell is one document, not a pane inside a page');
{
  const body = rule('.phone-body');
  assert(body !== '', '.phone-body exists');
  assert(!/overflow/.test(body), '.phone-body declares no overflow — the document is the only thing that scrolls');
  assert(/flex:\s*1/.test(body), 'it still grows to push the tab bar to the bottom of a short screen');
  assert(/padding:\s*0 var\(--sp-20\) var\(--sp-8\)/.test(body), 'and its inset is unchanged (0 / 20 / 8)');
  const phone = rule('.phone');
  assert(/min-height:\s*100dvh/.test(phone) && /flex-direction:\s*column/.test(phone), '.phone keeps min-height 100dvh as a flex column — the tab bar stays in flow at the end');
  assert(!/(^|[;\s])height:\s*100dvh/.test(phone), 'and is NOT height-constrained: that would revive the pane and float the tab bar, which the 2026-09-08 decision refused');
}

console.log('\nthe safe-area inset is where the document ends, once');
{
  const tab = rule('.athlete-tabbar');
  assert(/env\(safe-area-inset-bottom/.test(tab), '.athlete-tabbar adds env(safe-area-inset-bottom) to its bottom padding');
  assert(!/safe-area/.test(rule('.phone-body')), '.phone-body does not add a second one above it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
