/* Loading skeletons: shown by a loading.tsx while the route segment streams,
 * so the shell — the sidebar, the tab bar — is usable while the slow part
 * arrives. Each page's skeleton is shaped like that page's real content
 * (its header, its cards, its table) at the same widths, so nothing jumps
 * when the data lands.
 *
 * Built from the system's own tokens and nothing else: blocks are --surf2
 * on --r with the spacing scale between them, text lines take the height of
 * the size they stand in for (--fs-*, or the role name pointed at it), and
 * the shimmer is one keyframe over --dur-ring. The shimmer is the one
 * deliberate reversal of "almost nothing moves" (docs/decisions/
 * design-system-adoption.md, the dated reversal): a static grey block
 * reads as broken, a moving one reads as loading. prefers-reduced-motion
 * stops it — base.css collapses every animation under it.
 *
 * THE RULE IS THE HOLD, NOT THE MEASUREMENT — docs/decisions/skeleton-gate.md
 * (Isabella, 15 Sept 2026). This header used to say a route gets a skeleton
 * only where the measurement says a wait survives the optimisation; the
 * production measurement in that decision put three of the five on both
 * sides of the threshold from run to run, and the threshold became a
 * property of the page instead: .sk-page is invisible for the first 200ms
 * of the wait and appears only if the wait outlasts it (base.css, the
 * `sk-appear` hold). A render that finishes in 180ms shows nothing at all,
 * so the flash cannot happen on any route, and the measurement no longer
 * gates which routes carry one. What a screen reader hears is not held:
 * SkPage's live region is a sibling of the held element, announced at
 * once.
 *
 * AND THE 300ms FLOOR — the same decision's same-day amendment. Once shown,
 * a skeleton stays for at least 300ms, so a render finishing at 210ms shows
 * 300ms of skeleton rather than 10ms of it. The floor is not CSS, because
 * the skeleton is a Suspense fallback and it is React that removes it: the
 * held element (SkHeld) and the inline script below record the instant the
 * skeleton became visible, and the page's content waits for the remainder
 * inside SkFloor — every page with a skeleton returns through it. The
 * clock they share is skeletonClock.ts; each file says its part. */

import { SkHeld } from './SkHeld';

type LineProps = { w?: string; size?: 'h1' | 'body' | 'label' | 'num' };

/** One line of text, at the height of the size it stands in for. */
export function SkLine({ w = '100%', size = 'body' }: LineProps) {
  return <span className={`sk sk-line sk-line-${size}`} style={{ width: w }} aria-hidden="true" />;
}

/** A card-shaped block — the real .card's border, radius and padding, with
 *  lines inside so its height is the height the content will take. */
export function SkCard({ lines = 3, h, children, className = '' }: { lines?: number; h?: number; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`card sk-card ${className}`} style={h ? { minHeight: h } : undefined} aria-hidden="true">
      {children ?? (
        <>
          <SkLine w="38%" size="label" />
          {Array.from({ length: lines }, (_, i) => (
            <SkLine key={i} w={i === lines - 1 ? '62%' : '100%'} />
          ))}
        </>
      )}
    </div>
  );
}

/** The page head: an eyebrow and a title, the real classes so the heights
 *  are the real heights. */
export function SkPageHead({ title = '40%' }: { title?: string }) {
  return (
    <div className="topbar" aria-hidden="true">
      <div className="page-head">
        <p className="eyebrow"><SkLine w="34%" size="label" /></p>
        <SkLine w={title} size="h1" />
      </div>
    </div>
  );
}

/** A row of chips — the group filter's shape. */
export function SkChips({ n = 5 }: { n?: number }) {
  return (
    <div className="sk-chips" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="sk sk-chip" style={{ width: i === 0 ? 118 : 72 + (i % 3) * 14 }} />
      ))}
    </div>
  );
}

/** The wrapper: announces the wait once and hides the blocks from the tree.
 *  Two elements, deliberately: the live region (role="status", aria-busy,
 *  the visually-hidden "Loading {label}") is a SIBLING of the held .sk-page,
 *  not its parent or child, so the 200ms opacity hold on .sk-page can never
 *  delay or dim what assistive technology is told — the wait is announced
 *  the moment the boundary renders, the picture follows if the wait lasts.
 *
 *  The script after the held element is the floor's hard-load half. A hard
 *  load streams this fallback as HTML and React never hydrates a dehydrated
 *  fallback, so no effect in SkHeld runs; the swap to content is done by
 *  react-dom's streaming runtime ($RC → $RV, react-dom 19.2) before
 *  hydration, and only a parser-run script can see the skeleton appear. It
 *  does two things at the hold's own `animationstart`: writes shownAt to the
 *  shared clock, and sets the runtime's reveal clock `$RT` to the same
 *  instant. That runtime already batches reveals to 300ms after the last
 *  one (`$RT + 300`); telling it the skeleton's appearance was the last
 *  reveal makes its own batching pay the floor, with no second copy of the
 *  swap. It is a runtime internal, so scripts/test-skeleton-hold.ts pins the
 *  installed runtime's shape and fails the build if a React upgrade moves
 *  it. On a soft navigation the browser inserts this script without
 *  running it (innerHTML never executes scripts), and SkHeld's effect is
 *  the recorder instead. */
const SHOWN_SCRIPT =
  "<script>(function(){var s=document.currentScript,e=s&&s.parentNode&&s.parentNode.previousElementSibling;" +
  "if(!e||!e.classList.contains('sk-page'))return;" +
  "e.addEventListener('animationstart',function(ev){" +
  "if(ev.target!==e||ev.animationName!=='sk-appear')return;" +
  "var t=performance.now();(window.__fydrSkeleton=window.__fydrSkeleton||{}).shownAt=t;" +
  "if(typeof window.$RT!=='number'||window.$RT<t)window.$RT=t;});})();</script>";

export function SkPage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="visually-hidden" role="status" aria-busy="true" aria-live="polite">
        Loading {label}
      </span>
      <SkHeld>{children}</SkHeld>
      {/* The script is the innerHTML of a hidden span rather than a <script>
          element of its own: the parser runs it either way on a hard load,
          and on a soft navigation React sets innerHTML without warning that
          a script it created will not run (it would not, and need not). */}
      <span hidden dangerouslySetInnerHTML={{ __html: SHOWN_SCRIPT }} />
    </>
  );
}
