import { AnalyticsPreview, type PreviewSample } from '@/components/AnalyticsPreview/AnalyticsPreview';
import { DesktopOnlyNotice } from '@/components/DesktopOnlyNotice/DesktopOnlyNotice';
import { ANALYTICS, hasAnyRole } from '@/lib/access';
import { refuse, requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Analytics · Fydr' };

/* ANALYTICS — A DESIGN PREVIEW (17 September 2026). The page draws four
 * charts from the SAMPLE arrays below while the analytics queries are
 * built: session load over the weeks, the acute to chronic ratio across the
 * squad, wellness readiness with its band, total distance by session type.
 * A visible notice says so. Nothing on the page reads the database beyond
 * the two gates every version of this page has carried:
 *
 *   - D-02: Analytics is the sport scientist's alone (ANALYTICS);
 *   - D-20 / 0125: a wholly premium destination — absent from a basic club's
 *     sidebar (PREMIUM_ONLY) and refused at the URL, logged like any other
 *     refusal; and analytics_daily_rows returns nothing to a club that is
 *     not premium whatever the page does. Neither gate changed here.
 *
 * The three dropdowns — group, date range, measure — are client state in
 * AnalyticsPreview and swap which of the sample series is drawn; no URL, no
 * cookie, no read. The group filter's chips are not on this page while it
 * shows sample data: there is no scope to apply them to (CLAUDE.md §3 is
 * about athlete data, and none is here). Desktop-only, the reports' rule:
 * below 768px the notice stands in for the page and the More sheet carries
 * no Analytics row (shell.ts).
 *
 * What this replaced, and where it went: PATTERN-S7 C6's four data panels
 * (lib/analyticsPanels, components/AnalyticsPanel, fetchPerAthleteDaily
 * through analytics_daily_rows) are untouched in the tree and are what the
 * real page will draw from when the queries are ready; the tier gate test
 * (800_analytics_tier_gate_test.sql) still holds them to the premium rule.
 * docs/screens/42-analytics.md records both states.
 *
 * NO EXPORT. A question worth keeping leaves as a report — the thing with a
 * definition, a row count, a print layout and an audit row.
 */

/* ---------------------------------------------------------------------------
 * SAMPLE DATA. Every number the charts draw. Deterministic, plausible for a
 * Super Series club, and named so nobody mistakes it for a read:
 *   session load in arbitrary units (CR-10 rating × minutes, MET-007), summed
 *   per athlete over the week and averaged across the group — a 7 × 75-minute
 *   session is 525 AU, so four or five a week land around 2,000–3,400;
 *   total distance in metres (MET-017), the same collapse — 3–6 km a session;
 *   the ratio (MET-010) 0.6–1.6; readiness (MET-002) 40–95.
 * The twelve weeks are the demo club's own window: 29 June to 14 September.
 * ------------------------------------------------------------------------- */
const SAMPLE_WEEKS = ['29 Jun', '6 Jul', '13 Jul', '20 Jul', '27 Jul', '3 Aug', '10 Aug', '17 Aug', '24 Aug', '31 Aug', '7 Sept', '14 Sept'] as const;

/** Week 4 is the deload; weeks 6, 8, 10 and 11 carry a match. */
const SAMPLE_SESSION_LOAD_AU = {
  forwards: [2470, 2810, 3120, 2190, 3120, 3190, 2860, 3380, 3010, 3420, 3290, 2790],
  backs: [2230, 2660, 2890, 2020, 2840, 3090, 2630, 3250, 2900, 2990, 3030, 2740],
} as const;

const SAMPLE_TOTAL_DISTANCE_M = {
  forwards: [14600, 15500, 18100, 11900, 17600, 19200, 17000, 19100, 17000, 18900, 17700, 16400],
  backs: [17100, 19000, 20600, 13700, 21700, 21700, 20900, 22500, 20500, 22900, 21700, 20700],
} as const;

/** Sixteen athletes, the trailing ratio as it stands today. */
const SAMPLE_ACWR = [
  { name: 'Okonkwo', group: 'forwards', ratio: 1.02 },
  { name: 'Aholelei', group: 'forwards', ratio: 0.94 },
  { name: 'Tameifuna', group: 'forwards', ratio: 1.11 },
  { name: 'Koloofai', group: 'forwards', ratio: 0.87 },
  { name: 'Hastings', group: 'forwards', ratio: 1.21 },
  { name: 'Ross', group: 'forwards', ratio: 0.76 },
  { name: 'Nadolo', group: 'forwards', ratio: 1.05 },
  { name: 'Sullivan', group: 'forwards', ratio: 0.98 },
  { name: 'Chapman', group: 'backs', ratio: 1.58 },
  { name: 'Wren', group: 'backs', ratio: 0.91 },
  { name: 'Moroney', group: 'backs', ratio: 1.14 },
  { name: 'Selby', group: 'backs', ratio: 0.68 },
  { name: 'Ferris', group: 'backs', ratio: 1.31 },
  { name: 'Fox', group: 'backs', ratio: 1.03 },
  { name: 'Grant', group: 'backs', ratio: 0.83 },
  { name: 'Reid', group: 'backs', ratio: 1.19 },
] as const;

/** 84 days, oldest first: the group's mean readiness each morning. Dips in
 *  the match weeks and after the hard days, a lift in the deload week. */
const SAMPLE_READINESS = {
  forwards: [
    74, 74, 75, 74, 71, 73, 71, 73, 74, 74, 70, 68, 67, 74, 76, 71, 74, 77, 74, 75, 72, 71, 74, 69, 70, 69, 69, 73, 74, 76, 73, 74, 71, 74, 74, 70, 72, 72, 72, 69, 67, 66, 69, 67,
    70, 71, 73, 72, 77, 76, 67, 63, 68, 65, 70, 69, 68, 72, 73, 71, 67, 68, 75, 74, 68, 63, 62, 59, 65, 65, 70, 71, 68, 72, 68, 71, 70, 72, 70, 68, 74, 74, 72, 77,
  ],
  backs: [
    76, 77, 75, 72, 68, 70, 72, 77, 77, 75, 75, 75, 72, 74, 73, 77, 71, 75, 70, 74, 74, 76, 80, 73, 72, 76, 77, 75, 80, 81, 73, 73, 69, 71, 75, 70, 71, 64, 64, 67, 67, 68, 74, 74,
    72, 70, 72, 77, 81, 77, 72, 67, 70, 69, 66, 66, 71, 73, 74, 75, 69, 75, 75, 73, 69, 66, 67, 68, 65, 69, 70, 74, 69, 70, 69, 73, 72, 74, 72, 70, 72, 75, 75, 80,
  ],
} as const;

/** Metres per athlete per week, by the session's type on the schedule. The
 *  three sum to SAMPLE_TOTAL_DISTANCE_M. */
const SAMPLE_DISTANCE_BY_TYPE_M = {
  forwards: {
    training: [12200, 15500, 18100, 11900, 15100, 13000, 17000, 12500, 14400, 12000, 9900, 16400],
    match: [0, 0, 0, 0, 0, 6200, 0, 6600, 0, 6900, 6400, 0],
    testing: [2400, 0, 0, 0, 2500, 0, 0, 0, 2600, 0, 1400, 0],
  },
  backs: {
    training: [14700, 19000, 20600, 13700, 19200, 14900, 20900, 15200, 17900, 15300, 13300, 20700],
    match: [0, 0, 0, 0, 0, 6800, 0, 7300, 0, 7600, 7000, 0],
    testing: [2400, 0, 0, 0, 2500, 0, 0, 0, 2600, 0, 1400, 0],
  },
} as const;

const SAMPLE: PreviewSample = {
  weeks: SAMPLE_WEEKS,
  weekly: {
    session_load: SAMPLE_SESSION_LOAD_AU,
    total_distance: SAMPLE_TOTAL_DISTANCE_M,
  },
  acwr: SAMPLE_ACWR,
  readiness: SAMPLE_READINESS,
  distanceByType: SAMPLE_DISTANCE_BY_TYPE_M,
};

export default async function AnalyticsPage() {
  const { db, orgName, tier, claims } = await requireStaff();
  /* D-02: Analytics is the sport scientist's alone. Confirmed 2026-09-05. */
  if (!hasAnyRole(claims.roles, ANALYTICS)) await refuse(db, 'analytics', '/analytics');
  /* D-20, confirmed 14 September 2026: a wholly premium destination is gone
   * for a basic club — absent from the sidebar (PREMIUM_ONLY) and refused at
   * the URL, logged like any other refusal. No upsell page: a basic club
   * learns what premium holds on the Settings plan page, one place.
   * requireStaff() has already resolved the preview through effectiveTier(),
   * downward only. The database refuses too (0125). */
  if (!isPremium(tier)) await refuse(db, 'analytics_premium', '/analytics');

  return (
    <>
      {/* The reports' rule (#18): desktop-only. Below 768px this notice is the
          page — base.css's `.main:has(> .desk-note)` hides the rest — and the
          More sheet carries no Analytics row. Presentation, not permission. */}
      <DesktopOnlyNotice
        title="Analytics is desktop-only"
        body="Open Fydr on a desktop or laptop for the charts. Everything else is here on your phone."
        action={{ href: '/dashboard', label: 'Back to Dashboard' }}
      />
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">SAMPLE DATA · {orgName.toUpperCase()}</p>
          <h1>Analytics</h1>
        </div>
      </div>

      <p className="apv-notice" data-preview-notice role="status">
        <b>Design preview.</b> The charts show sample data while the analytics queries are built.
      </p>

      <AnalyticsPreview sample={SAMPLE} />

      <p className="cap" data-no-export>
        Analytics has no export. A question worth keeping leaves as a report — the athlete report, the squad weekly or the training load report carry a definition, a row count, a
        print layout and an audit row.
      </p>
    </>
  );
}
