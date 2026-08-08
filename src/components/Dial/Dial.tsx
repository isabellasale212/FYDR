/* PLAYER-PROFILE-SPEC.md §5: the shared dial geometry used by every arc
 * dial on the player profile (Athleticism, ACWR, Wellness rating). One
 * component, not three copies of the same SVG, so the geometry can only
 * be right or wrong in one place.
 *
 * viewBox is always 0 0 100 100 — only the rendered width/height differ
 * per dial. r=40, stroke-width=9, stroke-linecap=round. rotate(-90deg)
 * on the SVG starts the arc at 12 o'clock. stroke-dasharray=251 is the
 * circumference, 2π×40 = 251.3. offset = round(251 × (1 − pct/100)),
 * spec's own formula, verbatim — a pct of 100 fully closes the ring
 * (offset 0), a pct of 0 leaves it entirely open (offset 251).
 *
 * pct is null, not a number, when there is nothing to show — the em-dash
 * rule (§11.1: "a missing value is an em dash, never a zero"). A null pct
 * renders the track only, no arc, no animation: rendering an arc at pct=0
 * would draw a real, if invisible, "0%" ring, which is a different claim
 * than "no data exists" and this app's own established convention
 * (wellness charts elsewhere draw a missing day as a gap, never a zero)
 * already refuses to make that substitution anywhere else in this build.
 *
 * Used by the three real arc dials on the player profile: Athleticism
 * (88px), and ACWR + Wellness rating (116px each). The header's small 62px
 * wellness indicator (§4) is NOT one of these — its own spec is "1px
 * border, no arc", a plain bordered circle, not this component's 9px track
 * ring — so it is a plain div in the page, not a fourth Dial instance. */

type Props = {
  size: number;
  pct: number | null;
  tone: string; // a CSS color value — a var(--token) reference, not a literal hex, at every call site
  children: React.ReactNode; // the centre overlay content
};

const CIRCUMFERENCE = 251;

export function Dial({ size, pct, tone, children }: Props) {
  const offset = pct === null ? CIRCUMFERENCE : Math.round(CIRCUMFERENCE * (1 - pct / 100));

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ display: 'block', transform: 'rotate(-90deg)' }}
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--track)" strokeWidth="9" />
        {pct !== null ? (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={tone}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            className="dial-arc"
            style={{ strokeDashoffset: offset }}
          />
        ) : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}
