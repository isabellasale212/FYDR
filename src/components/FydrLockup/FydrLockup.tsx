/** The Fydr lockup, at the geometry `Fydr App Launch.dc.html` draws it.
 *
 *  Everything here is lifted from app-launch-scene.jsx rather than eyeballed:
 *  a 1001×437 box, the word set at 386px/800 with -0.063em of tracking sitting
 *  on a 343.8px baseline, the trace path verbatim, and the mark — a 71.25r ring
 *  at 12.5 wide, rotated 155°, around a 29.5r dot — at (922, 287).
 *
 *  WHY THE WORD IS HTML AND THE REST IS SVG, which is also what the design
 *  does: each letter animates in on its own delay, and four <span>s take a
 *  stagger far more cheaply than four <text> elements would. The trace and the
 *  mark are one SVG over the top because they are drawn, not typed.
 *
 *  SIZED BY --lk-w, in pixels. The inner box stays 1001 wide at every size and
 *  is scaled to fit, so the trace never has to be re-authored for a new width
 *  and the letters never reflow — a lockup that reflows is a different lockup.
 *
 *  No client JS. The whole sequence is CSS, which is what lets it hold still
 *  under prefers-reduced-motion (spec §5) without a hydration boundary and
 *  without the sign-in form waiting on a bundle to become typeable.
 */
export function FydrLockup({
  animate = false,
  className,
  title,
}: {
  animate?: boolean;
  className?: string;
  /** Given only where the lockup is the page's own name for itself. Elsewhere
   *  it is decoration beside a heading that already says "Fydr", and a second
   *  announcement of the same word is noise to a screen reader. */
  title?: string;
}) {
  return (
    <div
      className={`lockup${className ? ` ${className}` : ''}`}
      data-animate={animate ? '' : undefined}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <div className="lockup-inner">
        <div className="lockup-word">
          <span>F</span>
          <span>y</span>
          <span>d</span>
          <span>r</span>
        </div>
        <svg viewBox="0 0 1001 437" width="1001" height="437" aria-hidden="true">
          {/* The load trace: down into a trough, along, and up to the live
              point. It is the shape every chart in this product draws. */}
          <path
            className="lk-trace"
            d="M 0 349.5 H 183 L 238 425 H 385 L 438 349.5 H 785 L 853 315.5"
            pathLength="1"
            fill="none"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="lk-mark" transform="translate(922 287)">
            <circle
              className="lk-ring"
              r="71.25"
              pathLength="1"
              fill="none"
              strokeWidth="12.5"
              strokeLinecap="round"
              transform="rotate(155)"
            />
            <circle className="lk-dot" r="29.5" />
          </g>
        </svg>
      </div>
    </div>
  );
}
