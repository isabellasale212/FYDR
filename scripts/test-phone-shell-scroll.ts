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
  assert(/min-height:\s*100dvh/.test(phone) && /flex-direction:\s*column/.test(phone), '.phone keeps min-height 100dvh as a flex column');
  assert(!/(^|[;\s])height:\s*100dvh/.test(phone), 'and is NOT height-constrained: that would revive the pane');
}

/* PINNED, 15 Sept 2026 — Isabella's P5 of the overnight queue reverses the
   2026-09-08 "in flow" decision for the installed app: the athlete bar stays
   visible the way the staff phone shell's does. Fixed to the viewport's
   bottom, held to the 480px frame on a wide viewport, its background running
   to the display's edges with the bottom and side insets as padding on the
   bar ITSELF (no wrapper, no corner radius). The body pads its foot by the
   bar's height plus the inset so the last card clears it, and a pinned
   footer (.subm) sits on top of the bar — both only when the bar is there,
   because the consent screens render none. */
console.log('\nthe tab bar is pinned (P5, 15 Sept 2026), and the body and a pinned footer clear it');
{
  const tab = rule('.athlete-tabbar');
  assert(/position:\s*fixed/.test(tab) && /bottom:\s*0/.test(tab) && /left:\s*0/.test(tab) && /right:\s*0/.test(tab), '.athlete-tabbar is fixed to the bottom edge, left 0 right 0');
  assert(/max-width:\s*480px/.test(tab) && /margin-inline:\s*auto/.test(tab), 'held to the 480px frame on a wide viewport');
  assert(/padding:\s*9px calc\(var\(--s-3\) \+ env\(safe-area-inset-right, 0px\)\) calc\(var\(--s-5\) \+ env\(safe-area-inset-bottom, 0px\)\) calc\(var\(--s-3\) \+ env\(safe-area-inset-left, 0px\)\)/.test(tab), 'its content is padded by the bottom and side insets, on the bar itself');
  assert(!/border-radius/.test(tab), 'no corner radius — the device mask rounds it');
  assert(/--athlete-tabbar-h:\s*80px/.test(rule('.phone')), '.phone names the bar\'s height without the inset');
  const body = rule('.phone:has(> .athlete-tabbar) > .phone-body');
  assert(/padding-bottom:\s*calc\(var\(--sp-8\) \+ var\(--athlete-tabbar-h\) \+ env\(safe-area-inset-bottom, 0px\)\)/.test(body), 'with the bar present the body pads its foot by the bar and the inset');
  assert(!/safe-area/.test(rule('.phone-body')), 'and without it (the consent screens) the body still ends at the document, no inset of its own');
  const subm = rule('.phone:has(> .athlete-tabbar) .subm');
  assert(/bottom:\s*calc\(var\(--athlete-tabbar-h\) \+ env\(safe-area-inset-bottom, 0px\)\)/.test(subm), 'a pinned footer sits on top of the bar');
  assert(/padding-bottom:\s*var\(--sp-8\)/.test(subm), 'and drops its own inset there — the bar carries it');
  assert(/viewportFit:\s*'cover'/.test(readFileSync('src/app/layout.tsx', 'utf8')), 'the viewport meta carries viewport-fit=cover, or every inset reports zero');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
