'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/* "Return to the previous page", in the top left of every screen.
 *
 * WHY IT IS SOMETIMES ABSENT. It is a real history control, not a link to a
 * fixed parent, so it can only be offered when there is somewhere to go: a tab
 * opened straight onto a URL — a bookmark, a pasted link, the first screen
 * after sign-in — has no previous page, and a button that does nothing is
 * worse than no button. `history.length` is the only thing the browser exposes
 * about that, so the control renders after mount and only when the length says
 * there is an entry behind this one. That also keeps it out of the server
 * render, where `history` does not exist.
 *
 * The home screen of each shell never shows one: the sidebar's own Dashboard
 * row is already the way back to it, and "back" from the screen you land on is
 * a step out of the app.
 */

/** Screens that start a journey rather than sit inside one.
 *
 *  Every TAB ROOT belongs here, not just the two landing screens. /my-data,
 *  /programme and /me are reached by tapping a tab, so "back" from one of them
 *  means whichever tab you were on before — which is not a parent, and the tab
 *  bar is already the way there. They were showing a Back button above their
 *  own title, which the athlete design does not draw on any tab root. */
const ROOTS = new Set(['/dashboard', '/today', '/my-data', '/programme', '/me']);

/** Screens that already carry their own dismiss control. The check-in forms are
 *  sheets over Today with an × in their own header, so a Back button above that
 *  is a second, differently-worded way out of the same screen — and the design
 *  draws only the ×. Prefixes, because /rpe and /gym take a session id. */
/* /my-data/gym/ since ATH-ADULT-13 (2026-09-12): the session detail carries
   one full-width "Back to gym history" in its footer, and the board draws one
   way back, not two. */
/* /report-problem since 15 Sept 2026 (mobile queue #3, one back control per
   page): its sheet carries a × to Today, so the layout's Back stands down. */
const SELF_DISMISSING = ['/check-in', '/nutrition-check-in', '/rpe/', '/gym/', '/my-data/gym/', '/report-problem'];

/** Screens that render their OWN copy inside their topbar, because their
 *  design places it there rather than above the page header. The layout's
 *  instance stands down on these routes so there is never one of each. Listed
 *  here rather than solved with CSS, so the two facts — who opts out and who
 *  opts in — live in one file and cannot drift apart. */
const PLACES_ITS_OWN = new Set(['/programmes/exercises']);

/** The staff phone bar's own destinations (16 Sept 2026, Isabella's overnight
 *  queue, 2.2: "Flags — remove the back button"). A tab root reached from
 *  the bottom bar has no parent to go back to on a phone; the control is
 *  drawn with data-phone-root and base.css hides it below 768px only —
 *  presentation, the desktop keeps it. The three fixed slots; the fourth
 *  slot varies by role and is not listed (a coach reaching /programmes
 *  through More is inside a journey). */
const PHONE_TAB_ROOTS = new Set(['/squad', '/schedule', '/flags']);

export function BackButton({ inline = false }: { inline?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  if (ROOTS.has(pathname) || !canGoBack) return null;
  if (SELF_DISMISSING.some((p) => pathname === p || pathname.startsWith(p))) return null;
  if (!inline && PLACES_ITS_OWN.has(pathname)) return null;

  return (
    <button
      type="button"
      className="back-btn"
      data-inline={inline ? '' : undefined}
      data-phone-root={PHONE_TAB_ROOTS.has(pathname) ? '' : undefined}
      onClick={() => router.back()}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <path d="M9.5 3.5 5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}
