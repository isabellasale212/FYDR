'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

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
 * ring — so it is a plain div in the page, not a fourth Dial instance.
 *
 * TRAINING-REPORT-SPEC.md §4 needs a real variant of this same geometry: a
 * ring scaled to 130% of typical rather than a flat 0–100%, plus a tick
 * mark at the 100% position so 108% and 128% read as visibly different
 * arcs rather than two rings that both look "nearly full". scaleMax and
 * tick are both optional and both default to the player-profile behaviour
 * (scaleMax 100, no tick) — extending the one shared component rather than
 * forking a second copy of this same SVG, per this file's own opening
 * line. Every existing caller is unaffected: scaleMax=100 makes
 * pct/scaleMax identical to the original pct/100. */

/* ONCE PER SCREEN, PER SESSION — the ring-in gate, added 2026-09-09.
 *
 * This rule used to be ungated: `.dial-arc { animation: ring-in 0.9s }` fired on
 * every mount, and this component renders three times on the player profile and
 * four on the training report. A coach working through a squad watched every ring
 * redraw on every visit. Isabella's decision was to keep the entrance and gate
 * it, not to delete it.
 *
 * KEYED BY PATHNAME, not by dial. "Once per screen" is the useful unit: arriving
 * at the training report should animate even if a profile already has, because it
 * is a different screen being seen for the first time. A module-scope Set is the
 * whole mechanism — it lives as long as the JS context, so client-side navigation
 * back to a profile finds the path already marked and stays still, while a hard
 * reload legitimately starts over.
 *
 * THE MARK IS WRITTEN IN AN EFFECT, AND THAT IS THE LOAD-BEARING DETAIL. Effects
 * run after the whole commit, so all the dials on a screen read the same
 * pre-visit value and animate together. Writing it during render instead — in the
 * useState initialiser, which is the obvious place — makes the first dial mark the
 * path and the remaining two or three read it as already played: one ring draws,
 * the others sit still, which reads as a rendering fault rather than a decision.
 * scripts/test-dial-ring-in.ts asserts the mark is NOT in the initialiser for
 * exactly that reason.
 */
type Props = {
  size: number;
  pct: number | null;
  tone: string; // a CSS color value — a var(--token) reference, not a literal hex, at every call site
  children: React.ReactNode; // the centre overlay content
  scaleMax?: number; // ring closes fully at this pct value, not always 100
  tick?: number; // draws a proud tick mark at this pct value along the same scale, e.g. the 100% reference point on a 130-scaled ring
};

const CIRCUMFERENCE = 251;

/** Screens whose dials have already drawn themselves in this JS session. */
const played = new Set<string>();

export function Dial({ size, pct, tone, children, scaleMax = 100, tick }: Props) {
  const pathname = usePathname();
  /* Read once, on this instance's first render, and never recomputed: the value
     has to survive the re-render the effect below causes, or every dial would
     re-evaluate to false and lose its animation mid-draw. */
  const [animate] = useState(() => pct !== null && !played.has(pathname));
  useEffect(() => {
    played.add(pathname);
  }, [pathname]);

  const clamped = pct === null ? null : Math.min(Math.max(pct / scaleMax, 0), 1);
  const offset = clamped === null ? CIRCUMFERENCE : Math.round(CIRCUMFERENCE * (1 - clamped));
  const tickOffset = tick !== undefined ? -Math.round(CIRCUMFERENCE * (tick / scaleMax)) : null;

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
            data-animate={animate ? '' : undefined}
            style={{ strokeDashoffset: offset }}
          />
        ) : null}
        {tickOffset !== null ? (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="rgba(16,18,23,0.4)"
            strokeWidth="11"
            strokeDasharray="2 249"
            style={{ strokeDashoffset: tickOffset }}
          />
        ) : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}
