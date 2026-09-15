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
 * once. */

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
 *  the moment the boundary renders, the picture follows if the wait lasts. */
export function SkPage({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="visually-hidden" role="status" aria-busy="true" aria-live="polite">
        Loading {label}
      </span>
      <div className="sk-page" aria-hidden="true">
        {children}
      </div>
    </>
  );
}
