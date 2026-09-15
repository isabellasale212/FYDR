/* The skeleton clock: when the skeleton became visible, and the floor that
 * follows from it — docs/decisions/skeleton-gate.md (Isabella, 15 Sept 2026,
 * the same-day amendment). Once a skeleton is shown it stays for at least
 * FLOOR_MS; the HOLD_MS before it is shown lives in base.css (`.sk-page`).
 *
 * Why a clock at all: the hold is pure CSS, because the skeleton is in the
 * DOM from the first frame and only its paint waits. The floor cannot be,
 * because the skeleton is a Suspense fallback and it is React (a soft
 * navigation) or React's streaming runtime (a hard load) that removes it the
 * moment the content lands. So the content side has to know when the
 * skeleton appeared, and ask for the remaining floor before it shows itself.
 * That is SkFloor, and this module is what the two sides share.
 *
 * Two writers, one record. On a hard load the fallback is streamed as HTML
 * and never hydrated (React leaves a dehydrated fallback alone until its
 * content arrives), so no effect in it ever runs; the inline script SkPage
 * renders after the held element is the only code that can see the skeleton
 * appear. On a soft navigation the fallback is mounted by React, inline
 * scripts inserted by React never execute, and SkHeld's effect is the
 * writer. Both write the same window record, `__fydrSkeleton`, because the
 * inline script has no module to import.
 *
 * The record is per wait, not per page: SkHeld resets it when a new skeleton
 * mounts and SkFloor clears it once content has shown, so a stale reading
 * from an earlier wait can never hold a later page. */

export const HOLD_MS = 200;
export const FLOOR_MS = 300;

type SkeletonClock = {
  /** performance.now() at the skeleton's `animationstart` — the instant it
   *  became visible. Undefined while it is held, or when there is no wait. */
  shownAt?: number;
  /** The floor promise, cached per shownAt so `use()` sees one thenable. */
  floor?: Promise<void>;
  floorFor?: number;
  listeners?: Set<() => void>;
};

declare global {
  interface Window {
    __fydrSkeleton?: SkeletonClock;
    /** React's streaming reveal clock (react-dom's Fizz runtime, 19.2). */
    $RT?: number;
  }
}

function clock(): SkeletonClock {
  if (typeof window === 'undefined') return {};
  return (window.__fydrSkeleton ??= {});
}

/** The skeleton just became visible. Written by SkHeld's animationstart
 *  listener (soft navigation) and, in the same shape, by SkPage's inline
 *  script (hard load — see that script for the `$RT` half). */
export function markShown(t: number): void {
  const c = clock();
  c.shownAt = t;
  c.floor = undefined;
  c.floorFor = undefined;
}

export function shownAt(): number | undefined {
  return clock().shownAt;
}

/** A new wait: nothing has been shown yet. */
export function resetClock(): void {
  const c = clock();
  c.shownAt = undefined;
  c.floor = undefined;
  c.floorFor = undefined;
}

/** How much of the floor is still owed, in ms. Zero when no skeleton showed. */
export function floorRemaining(now: number = performance.now()): number {
  const t = clock().shownAt;
  if (t === undefined) return 0;
  return Math.max(0, t + FLOOR_MS - now);
}

/** The promise that resolves when the floor has been paid. One per shownAt,
 *  so React's `use()` is handed the same thenable on every render. */
export function floorPromise(): Promise<void> {
  const c = clock();
  const t = c.shownAt ?? 0;
  if (!c.floor || c.floorFor !== t) {
    c.floorFor = t;
    c.floor = new Promise<void>((resolve) => {
      setTimeout(resolve, floorRemaining());
    });
  }
  return c.floor;
}

/** SkHeld listens; SkFloor tells it the content arrived before the hold
 *  ended (see SkHeld for what it does with that). Notification is deferred
 *  to a microtask so nothing touches the DOM from inside a render. */
export function subscribeArrival(fn: () => void): () => void {
  const c = clock();
  (c.listeners ??= new Set()).add(fn);
  return () => {
    c.listeners?.delete(fn);
  };
}

export function notifyArrival(): void {
  const c = clock();
  if (!c.listeners?.size) return;
  queueMicrotask(() => {
    c.listeners?.forEach((fn) => fn());
  });
}
