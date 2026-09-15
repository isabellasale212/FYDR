'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/* THE DOCKED ACTION'S HEIGHT, measured (Isabella, 15 September 2026: the log
 * and save buttons dock to the bottom navigation as one fixed block). The
 * footer (.subm) is fixed on top of the tab bar, so it is out of flow and
 * the page must pad its foot by the footer's height as well as the bar's
 * and the inset — and the footer's height is not one number: the check-in's
 * carries a count line and a disclosure that opens, the gym logger's a
 * caption, the nutrition check-in's two stacked exits. So it is measured:
 * a ResizeObserver on whichever .subm is on screen writes --subm-h on the
 * shell, base.css reads it into the body's padding, and a MutationObserver
 * on the body re-finds the footer when a page or a state swaps it. No
 * footer, no variable, and the body pads for the bar alone. Renders
 * nothing; the CSS fallback (--subm-h's default) holds until the first
 * measurement.
 *
 * THE BAR IS MEASURED TOO (--athlete-tabbar-total): its height is its type
 * scale plus the bottom inset — 78.4px with no inset, more at a larger text
 * size — and the CSS's 80px constant left a 1.6px seam of page between the
 * docked action and the bar. The measured total (floor, so a fraction is
 * overlap under the bar, which paints on top — never a seam) is what the
 * action sits on and what the body's clearance adds; the constant is the
 * fallback until measured. */
export function AthleteFooterDock() {
  const pathname = usePathname();
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.phone');
    const body = shell?.querySelector<HTMLElement>('.phone-body');
    if (!shell || !body) return;
    const bar = shell.querySelector<HTMLElement>('.athlete-tabbar');
    let barResize: ResizeObserver | null = null;
    const writeBar = () => {
      if (!bar) {
        shell.style.removeProperty('--athlete-tabbar-total');
        return;
      }
      shell.style.setProperty('--athlete-tabbar-total', `${Math.floor(bar.getBoundingClientRect().height)}px`);
    };
    writeBar();
    if (bar && typeof ResizeObserver !== 'undefined') {
      barResize = new ResizeObserver(writeBar);
      barResize.observe(bar);
    }
    let resize: ResizeObserver | null = null;
    let watched: Element | null = null;
    const write = (el: Element | null) => {
      if (!el) {
        shell.style.removeProperty('--subm-h');
        return;
      }
      shell.style.setProperty('--subm-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    const attach = () => {
      const footer = body.querySelector('.subm');
      if (footer === watched) {
        write(footer);
        return;
      }
      resize?.disconnect();
      resize = null;
      watched = footer;
      write(footer);
      if (footer && typeof ResizeObserver !== 'undefined') {
        resize = new ResizeObserver(() => write(footer));
        resize.observe(footer);
      }
    };
    attach();
    const mutation = new MutationObserver(attach);
    mutation.observe(body, { childList: true, subtree: true });
    return () => {
      mutation.disconnect();
      resize?.disconnect();
      barResize?.disconnect();
      shell.style.removeProperty('--subm-h');
      shell.style.removeProperty('--athlete-tabbar-total');
    };
  }, [pathname]);
  return null;
}
