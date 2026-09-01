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

/** Screens that start a journey rather than sit inside one. */
const ROOTS = new Set(['/dashboard', '/today']);

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, [pathname]);

  if (ROOTS.has(pathname) || !canGoBack) return null;

  return (
    <button type="button" className="back-btn" onClick={() => router.back()}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <path d="M9.5 3.5 5 8l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}
