'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AppRole } from '@/lib/types/database';
import { SIDEBAR } from '@/components/Sidebar/Sidebar';
import { barRows, pageTitle, sheetRows } from './shell';

/* STAFF-SS-01 — the staff shell on a phone (below 768px only; the CSS hides
 * this at every other width and hides the sidebar below it). Decided by
 * Isabella 2026-09-12: a bottom bar of four plus More, as the board proposes,
 * superseding §0af's compact-top-bar note. Three parts:
 *
 *   - a 64px TITLE BAR: the screen's name and the active group, so "where am
 *     I" is answered at the top of the screen instead of 640px of stacked
 *     sidebar down (§0af measured the dashboard's first content at y=2209);
 *   - a BOTTOM BAR: Dashboard, Squad, Schedule, a fourth slot by role, More
 *     — the athlete tab bar one column wider, on its own fill and floor;
 *   - a MORE SHEET: the remaining sections in the sidebar's order, the
 *     identity block and Log out at a real size (52px rows; the sidebar's
 *     Log out measured 17px). A real disclosure: aria-expanded /
 *     aria-controls on the control, a dialog with Escape, focus moved in on
 *     open and returned on close — the three things three earlier
 *     disclosures in this app got wrong (§0t, §0af).
 *
 * TOKENS. The board named eight that do not exist here (--tabbar-bg,
 * --bar-blur, --tabbar-pad, --t-pill, --r-sheet, --shadow-raised, --scrim,
 * --touch-min). Each maps to what the athlete shell already uses: the bar's
 * color-mix fill and padding, --fs-12 labels, --r-card for the sheet's top
 * corners, --shadow, rgb(--ink-rgb / 0.35) for the scrim (the check-in
 * spec's own backdrop figure), and the raw 44px floor. No blur: the athlete
 * bar's was removed 2026-09-08 because nothing ever passed behind it.
 */

type Props = {
  roles: readonly AppRole[];
  fullName: string;
  orgName: string;
  premium: boolean;
  previewingTier?: boolean;
  /** The active group filter, as the page's own chip row names it — "Whole
   *  squad" or the group names. Read by the layout from the same cookie the
   *  chips write (§0ak), so the bar and the chips cannot disagree. */
  groupLabel: string;
};

/* The bar's glyphs: the sidebar's own for the rows it carries; a flag for
   Flags (no sidebar row); a "more" ellipsis. Same 14-unit grid, filled. */
const FLAG_ICON = (
  <svg className="ic" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <path d="M2.3 0.8a0.9 0.9 0 0 1 0.9 0.9v0.2h7.6c0.7 0 1.1 0.8 0.7 1.4L9.8 5.6l1.7 2.3c0.4 0.6 0 1.4-0.7 1.4H3.2v3.1a0.9 0.9 0 1 1-1.8 0V1.7a0.9 0.9 0 0 1 0.9-0.9z" />
  </svg>
);
const MORE_ICON = (
  <svg className="ic" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <circle cx="2.6" cy="7" r="1.6" />
    <circle cx="7" cy="7" r="1.6" />
    <circle cx="11.4" cy="7" r="1.6" />
  </svg>
);

function glyphFor(route: string): React.ReactNode {
  if (route === '/flags') return FLAG_ICON;
  return SIDEBAR.find((r) => r.route === route)?.icon ?? FLAG_ICON;
}

export function StaffPhoneShell({ roles, fullName, orgName, premium, previewingTier = false, groupLabel }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const firstRowRef = useRef<HTMLAnchorElement>(null);

  const bar = barRows(roles, premium);
  const sheet = sheetRows(roles, premium);
  const isActive = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  const sheetActive = sheet.some((r) => isActive(r.route));

  /* Closes on navigation: a tapped row is a Link, and the sheet must not
     still be open on the next screen. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    firstRowRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        moreRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    moreRef.current?.focus();
  }

  return (
    <div className="ph-shell">
      <header className="ph-titlebar">
        <h2 className="ph-title">{pageTitle(pathname)}</h2>
        <span className="pill pill-neutral ph-group" title="The active group filter">
          {groupLabel}
        </span>
      </header>

      <nav className="ph-tabbar" aria-label="Main">
        {bar.map((row) => {
          const active = isActive(row.route);
          return (
            <Link
              key={row.id}
              href={row.route}
              className="ph-tab"
              aria-current={active ? 'page' : undefined}
              data-active={active ? '' : undefined}
            >
              <span className="ph-tab-glyph" aria-hidden="true">
                {glyphFor(row.route)}
              </span>
              {row.label}
            </Link>
          );
        })}
        <button
          ref={moreRef}
          type="button"
          className="ph-tab ph-more"
          aria-expanded={open}
          aria-controls="ph-sheet"
          data-active={sheetActive ? '' : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ph-tab-glyph" aria-hidden="true">
            {MORE_ICON}
          </span>
          More
        </button>
      </nav>

      {/* Both stay in the DOM (hidden) so aria-controls always resolves. */}
      <div className="ph-sheet-scrim" hidden={!open} onClick={close} aria-hidden="true" />
      <div
        id="ph-sheet"
        className="ph-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-sheet-title"
        hidden={!open}
      >
        <p className="ph-sheet-title" id="ph-sheet-title">
          More
        </p>
        {sheet.map((row, i) => {
          const active = isActive(row.route);
          return (
            <Link
              key={row.id}
              href={row.route}
              className="ph-sheet-row"
              ref={i === 0 ? firstRowRef : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <span className="ph-sheet-glyph" aria-hidden="true">
                {glyphFor(row.route)}
              </span>
              {row.label}
            </Link>
          );
        })}
        <div className="hair" />
        {previewingTier ? (
          <Link href="/settings#plan" className="ph-sheet-row ph-sheet-preview">
            Previewing Basic
          </Link>
        ) : null}
        <div className="ph-sheet-who">
          <b>{fullName}</b>
          <span>
            {orgName} · {roles.join(', ')}
          </span>
        </div>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="ph-sheet-row ph-sheet-signout">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
