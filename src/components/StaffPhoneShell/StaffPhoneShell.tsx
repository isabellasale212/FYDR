'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { AppRole } from '@/lib/types/database';
import { staffRoleLabel } from '@/lib/access';
import { SIDEBAR } from '@/components/Sidebar/Sidebar';
import { groupScopeLabel, parseGroupParam } from '@/lib/groupFilter';
import { GROUP_FILTER_COOKIE, writeGroupFilterCookie } from '@/lib/groupFilterCookie';
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
 *
 * TWO CHANGES AT PHONE WIDTH ONLY (Isabella, 15 Sept 2026, mobile queue):
 *
 *   #13 THE TITLE IS SAID ONCE. The bar's title is the page's own h1 — read
 *   from the document after each navigation — and the CSS hides that h1
 *   from sight below 768px (never from the accessibility tree: it stays
 *   the page's heading). The section name from the route table is the
 *   server render and the fallback for a page with no h1.
 *
 *   #14 THE GROUP FILTER IS A DROPDOWN IN THE BAR, where the "Whole squad"
 *   pill stood: a native select of Whole squad plus every live group. It
 *   writes the same cookie the chip rows write (§0ak) and pushes the same
 *   ?groups= the chips push, so the page re-runs its query the same way;
 *   the chip row itself is hidden below 768px by the CSS. A multi-group
 *   selection made on a desktop still shows here, as its own option, so
 *   the bar never says "Whole squad" over a filtered page. Presentation
 *   only: nothing about who may filter what has moved.
 *
 *   ITS VALUE IS READ ON THE CLIENT, the way the page resolves its own
 *   scope (§0ak): ?groups= for this page load, else the cookie. The layout
 *   that renders this shell reads the cookie only — a layout has no search
 *   params — and is not re-rendered on a same-segment navigation, so the
 *   server's groupIds is right on a fresh load with a bare URL and stale
 *   after a chip or dropdown press or on a shared link. The server value is
 *   the first paint; the effect below replaces it once mounted.
 */

type Props = {
  roles: readonly AppRole[];
  fullName: string;
  orgName: string;
  premium: boolean;
  previewingTier?: boolean;
  /** STAFF-SS-01 C3: athletes with an open flag in the active scope — the
   *  Flags slot's badge, the dashboard panel's headline number. */
  flagsBadge?: number;
  /** #14: the live groups, for the bar's dropdown, and the ids the cookie
   *  holds as the layout resolved them — the first paint's value (the
   *  header comment says why the client re-reads it). Before #14 this was
   *  a groupLabel string for a pill, read the same way. */
  groups: readonly { id: string; name: string }[];
  groupIds: readonly string[];
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
  /* Testing (2.7, 16 Sept 2026) wears the Reports glyph it was folded under. */
  const key = route === '/testing' ? '/reports' : route;
  return SIDEBAR.find((r) => r.route === key)?.icon ?? FLAG_ICON;
}

/** The page's own h1, wherever a staff page draws one: every page's sits in
 *  .page-head; the reports' ReportHeader draws .rhead-title. */
const PAGE_H1 = 'main.main .page-head h1, main.main .rhead-title';

export function StaffPhoneShell({ roles, fullName, orgName, premium, previewingTier = false, flagsBadge = 0, groups, groupIds }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const firstRowRef = useRef<HTMLAnchorElement>(null);

  /* #13: the bar's title follows the page's h1. Read after each navigation
     and whenever the page's content changes under the same path (the
     leaderboard and thresholds pages draw a different h1 per state), so the
     bar cannot say one thing while the hidden h1 says another. */
  const [docTitle, setDocTitle] = useState<string | null>(null);
  useEffect(() => {
    const main = document.querySelector('main.main');
    const read = () => setDocTitle(document.querySelector<HTMLElement>(PAGE_H1)?.textContent?.trim() || null);
    read();
    if (!main) return;
    const observer = new MutationObserver(read);
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  /* #14: the dropdown's value — the URL's ?groups= for this page load, else
     the cookie, read after each navigation; the server's groupIds until
     then. While a push is in flight it shows what was just chosen, as the
     chips do. */
  const searchParams = useSearchParams();
  const urlGroups = searchParams.get('groups');
  const [clientValue, setClientValue] = useState<string | null>(null);
  useEffect(() => {
    if (urlGroups !== null) {
      setClientValue(parseGroupParam(urlGroups).join(','));
      return;
    }
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${GROUP_FILTER_COOKIE}=`));
    setClientValue(raw ? parseGroupParam(decodeURIComponent(raw.slice(GROUP_FILTER_COOKIE.length + 1))).join(',') : '');
  }, [pathname, urlGroups]);
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const currentValue = clientValue ?? (groupIds.length === 0 ? '' : groupIds.join(','));
  const selectValue = isPending && optimistic !== null ? optimistic : currentValue;
  /* A selection of more than one group (made with the chips on a desktop)
     is one option of its own, labelled as the pages label it. */
  const multi = selectValue.includes(',') ? selectValue : null;
  function chooseGroup(value: string) {
    const next = value ? value.split(',') : [];
    writeGroupFilterCookie(next);
    const search = new URLSearchParams(window.location.search);
    if (next.length === 0) search.delete('groups');
    else search.set('groups', next.join(','));
    const query = search.toString();
    setOptimistic(value);
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

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
        <h2 className="ph-title">{docTitle ?? pageTitle(pathname)}</h2>
        {/* The native select keeps the phone's own picker; the painted arrow
            is the app's, as ReportSelectNav draws it. */}
        <span className="rsel-wrap ph-group" aria-busy={isPending} style={isPending ? { opacity: 0.6 } : undefined}>
          <select
            className="ph-group-select"
            aria-label="Filter by squad group"
            title="The active group filter"
            value={selectValue}
            onChange={(e) => chooseGroup(e.target.value)}
          >
            <option value="">Whole squad</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            {multi ? <option value={multi}>{groupScopeLabel(groups, multi.split(','))}</option> : null}
          </select>
          <span className="rsel-chev" aria-hidden="true">
            &#9660;
          </span>
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
              /* STAFF-SS-01 C3: the Flags slot carries the count of athletes
                 with an open flag — the dashboard panel's headline number —
                 and says what it is. */
              aria-label={
                row.route === '/flags' && flagsBadge > 0
                  ? `Flags, ${flagsBadge} athlete${flagsBadge === 1 ? '' : 's'} need${flagsBadge === 1 ? 's' : ''} attention`
                  : undefined
              }
            >
              <span className="ph-tab-glyph" aria-hidden="true">
                {glyphFor(row.route)}
                {row.route === '/flags' && flagsBadge > 0 ? <span className="ph-count-mark num">{flagsBadge}</span> : null}
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
        {/* 2.2 (16 Sept 2026): /settings/club is desktop-only, so the preview
            row goes to the settings hub — the one settings screen a phone
            draws — rather than to a notice. Ending the preview is a desktop
            action (the plan page); the row names the state. */}
        {previewingTier ? (
          <Link href="/settings" className="ph-sheet-row ph-sheet-preview">
            Previewing Basic
          </Link>
        ) : null}
        <div className="ph-sheet-who">
          <b>{fullName}</b>
          <span>
            {orgName} · {staffRoleLabel(roles)}
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
