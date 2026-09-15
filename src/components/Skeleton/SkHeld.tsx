'use client';

import { useLayoutEffect, useRef } from 'react';
import { markShown, resetClock, shownAt, subscribeArrival } from './skeletonClock';

/* The held element of a skeleton — `.sk-page`, whose 200ms hold is CSS in
 * base.css — plus the two things the floor needs from it on a soft
 * navigation (docs/decisions/skeleton-gate.md, the same-day amendment):
 *
 * 1. Record the instant the skeleton became visible. `animationstart` on
 *    the hold's own keyframe (`sk-appear`) fires when its 200ms delay ends —
 *    the CSS is the source of truth, no second timer. If the effect is late
 *    (a heavy commit can delay it past the 200ms), the running animation's
 *    currentTime says how long ago that was.
 *
 * 2. Keep the skeleton down when the content beat the hold. React throttles
 *    a retry-only render to 300ms after the fallback appeared, and on a soft
 *    navigation the fallback appears at 0ms, invisible: content ready at
 *    150ms is revealed at 300ms, through the hold ending at 200ms — a 100ms
 *    skeleton, the flash the hold exists to remove. So when SkFloor renders
 *    before the skeleton has shown, it says so, and this adds `sk-cancelled`
 *    to the element: the hold's animation is dropped and the skeleton stays
 *    at opacity 0 until React swaps it out. A class on the node and not a
 *    state update, deliberately: a state update here starts a new render,
 *    and a new render cancels the throttled commit that was about to reveal
 *    the content, so the content waits for the next retry, which notifies
 *    again — measured as a loop that held content ready at 100ms until
 *    528ms. The wait where the content beat the hold shows nothing at all,
 *    which is what the hold promised.
 *
 * On a hard load none of this runs: the fallback is dehydrated HTML that
 * React never hydrates, and SkPage's inline script is the recorder. */
export function SkHeld({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    resetClock();
    const onStart = (e: AnimationEvent) => {
      if (e.target === el && e.animationName === 'sk-appear') markShown(performance.now());
    };
    el.addEventListener('animationstart', onStart);
    // Already past the delay? Then it showed (currentTime - delay) ms ago.
    for (const a of el.getAnimations()) {
      if (!(a instanceof CSSAnimation) || a.animationName !== 'sk-appear' || a.currentTime === null) continue;
      const delay = a.effect?.getTiming().delay ?? 0;
      const t = Number(a.currentTime);
      if (t >= delay) markShown(performance.now() - (t - delay));
    }
    const unsubscribe = subscribeArrival(() => {
      // Only while still held: a skeleton that has shown is never pulled
      // (it would leave a blank frame before the content paints).
      if (shownAt() === undefined) el.classList.add('sk-cancelled');
    });
    return () => {
      el.removeEventListener('animationstart', onStart);
      unsubscribe();
    };
  }, []);

  return (
    <div className="sk-page" aria-hidden="true" ref={ref}>
      {children}
    </div>
  );
}
