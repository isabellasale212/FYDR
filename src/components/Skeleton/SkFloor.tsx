'use client';

import { use, useEffect } from 'react';
import { floorPromise, floorRemaining, notifyArrival, resetClock, shownAt } from './skeletonClock';

/* The floor, content side — docs/decisions/skeleton-gate.md (Isabella,
 * 15 Sept 2026, the same-day amendment): once a skeleton is shown it stays
 * for at least 300ms. Every page that has a loading.tsx skeleton returns
 * its content inside this, and the guard (scripts/test-skeleton-hold.ts)
 * counts that every one does.
 *
 * Why the content side: the skeleton is a Suspense fallback, removed by
 * React the moment the content is ready, and nothing in the fallback can
 * extend its own life. The content can wait, though. If the clock says the
 * skeleton became visible less than 300ms ago, this suspends on the promise
 * that resolves when the floor has been paid; the boundary stays on its
 * fallback — the same skeleton, not a second one — and the content follows
 * when the promise does. A page ready at 210ms is therefore shown at 500ms,
 * the slowdown the amendment accepts, in a narrow band, for a placeholder
 * that never reads as a glitch. Nothing here ever holds content on a wait
 * where no skeleton showed; on a soft navigation where the content beat
 * the hold it does the opposite, and tells the skeleton to stay down while
 * React pays its own 300ms retry throttle (SkHeld explains why that
 * matters and why it is a class, not a state update).
 *
 * On a soft navigation that is the whole mechanism. On a hard load the
 * swap is done by React's streaming runtime before hydration, and it is the
 * inline script in SkPage that pays the floor there (see it); by the time
 * this hydrates the floor has passed and it renders straight through. If it
 * had not, suspending during hydration leaves the revealed HTML in place —
 * content, never a skeleton.
 *
 * Reduced motion changes nothing: the floor is not motion either, it is a
 * placeholder staying put. */
export function SkFloor({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    if (shownAt() === undefined) {
      // The content beat the hold. Say so, so the held skeleton stays down
      // while React finishes its own throttle (SkHeld explains).
      notifyArrival();
    } else if (floorRemaining() > 0) {
      use(floorPromise());
    }
  }
  // Content has shown: this wait's clock is done with. Every commit, so a
  // page that re-rendered in place (search params) clears it too.
  useEffect(() => {
    resetClock();
  });
  return children;
}
