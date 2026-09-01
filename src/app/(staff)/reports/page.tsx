import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Reports · Fydr' };

// SETTINGS-SPEC.md §7.6: gated destinations "gain a Premium badge and 62%
// opacity" in the sidebar. This app's real sidebar has one generic
// "Reports" entry, not six — five of the six reports here are free, so
// badging the sidebar item itself would misrepresent the other five. This
// card grid, where the app actually enumerates reports individually, is
// the honest real equivalent. Still a real link either way: a Basic club
// sees this card and can click through to the real gate at
// /reports/training, never a dead end.
/* Each report is tinted to the DOMAIN IT READS FROM — the design's own caption
 * for this screen. It is not decoration: these six cards otherwise differ only
 * by a title, and a coach looking for "the medical one" reads six titles every
 * time. Colour makes the set scannable, and the same domain colours are
 * already doing this job on the dashboard's KPI strip and the week strip.
 *
 * `neutral` is a real tone, not a missing one: the Athlete report and Squad
 * weekly read EVERY domain, so tinting them to one would be a lie about where
 * their numbers come from. They stay on plain --surf and say "all domains". */
const REPORTS = [
  {
    key: 'compliance',
    tone: 'wellness',
    source: 'wellness',
    exports: 'CSV · PDF',
    title: 'Compliance',
    body: 'Who is submitting, and who is not.',
    href: '/reports/compliance',
    available: true,
    premiumGated: false,
  },
  {
    key: 'injuries',
    tone: 'medical',
    source: 'medical',
    exports: 'CSV · PDF',
    title: 'Injury & availability',
    body: 'Who is out, for how long, and what it is costing.',
    href: '/reports/injuries',
    available: true,
    premiumGated: false,
  },
  {
    key: 'training',
    tone: 'gps',
    source: 'GPS · premium',
    exports: 'CSV',
    title: 'Training report',
    body: 'One session, every athlete, every GPS metric, on one board.',
    href: '/reports/training',
    available: true,
    premiumGated: true,
  },
  {
    key: 'athlete',
    tone: 'neutral',
    source: 'all domains',
    exports: 'CSV · PDF',
    title: 'Athlete report',
    body: 'One athlete, every domain, one period.',
    href: '/reports/athlete',
    available: true,
    premiumGated: false,
  },
  {
    key: 'squad',
    tone: 'neutral',
    source: 'all domains',
    exports: 'CSV · PDF',
    title: 'Squad weekly',
    body: 'The week in one document.',
    href: '/reports/squad',
    available: true,
    premiumGated: false,
  },
  {
    key: 'testing',
    tone: 'gym',
    source: 'testing',
    exports: 'CSV · PDF',
    title: 'Testing',
    body: 'A testing session, or a test over time.',
    href: '/reports/testing',
    available: true,
    premiumGated: false,
  },
] as const;

/** screens/reports.md, all five report types now built: Compliance and
 *  Injury & availability (reports.ts), the separate Training report screen
 *  (screens/training-report.md, trainingReport.ts), the Athlete report
 *  (athleteReport.ts), Squad weekly (squadWeeklyReport.ts) and now the
 *  Testing report (testingReport.ts) — the last three built once GPS
 *  records and testing, the gaps that blocked them, both existed. No
 *  scheduling on any of them — these are live in-app pages, recomputed on
 *  open, each with a CSV export AND a PDF route (all six now have one; the
 *  training report was the last, see reports/training/pdf/route.tsx). NOTE:
 *  the caption this page renders below still says "all but the training
 *  report also export to PDF", which is stale user-facing copy. See each
 *  query file's own header for what it cuts against the full spec.
 *
 *  This index page itself stays open to every staff role — lib/session.ts's
 *  requireReportAccess() is what actually gates each report, and it's
 *  applied on every report page and export/pdf route, not here. An
 *  admin-only staff member sees the same six cards, correctly marked
 *  unavailable to them specifically: the spec gives admin "aggregate
 *  compliance and usage only", and this build has no aggregate-only view
 *  built to show them instead of the named-athlete data every one of these
 *  six reports actually is — see requireReportAccess's own comment for the
 *  quote. Redirecting away from the index entirely would hide that a
 *  reports feature exists at all, which is worse than naming the real
 *  reason it's closed to this role. */
export default async function ReportsPage() {
  const { orgName, claims, tier } = await requireStaff();
  const hasReportAccess = claims.roles.includes('coach') || claims.roles.includes('medical');
  const onPremium = isPremium(tier);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Reports</h1>
        </div>
      </div>

      {!hasReportAccess ? (
        <div className="note" style={{ marginBottom: 14, borderColor: 'var(--warn)' }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>Admin sees aggregate compliance and usage only, per the product&apos;s own access model.</b> Every report
            below is named-athlete data, which isn&apos;t in an admin&apos;s report set — hold a coach or medical role as
            well to open them, the same deliberate friction Users describes for reaching squad data at all.
          </p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {REPORTS.map((r) => {
          const locked = r.premiumGated && !onPremium;
          /* Gated is 0.62 opacity plus a badge, never hidden — light-theme
             handoff §9. This card already did exactly that with a literal
             0.62 before the handoff named the rule; --o-gated is the same
             number, now stated once in tokens.css. */
          const gatedOpacity = locked ? 'var(--o-gated)' : 1;
          return r.available && r.href && hasReportAccess ? (
            <Link
              key={r.key}
              href={r.href}
              className="card rep-card"
              data-tone={r.tone}
              style={{ textDecoration: 'none', color: 'inherit', opacity: gatedOpacity }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="rep-dot" aria-hidden="true" />
                <p className="card-title" style={{ margin: 0 }}>
                  {r.title}
                </p>
                {locked ? (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 9px',
                      borderRadius: 20,
                      background: 'rgb(var(--highlight-rgb) / 0.22)',
                      color: 'var(--highlight-pill-text)',
                    }}
                  >
                    Premium
                  </span>
                ) : null}
              </div>
              <p className="tiny" style={{ marginTop: 6 }}>
                {r.body}
              </p>
              {/* Pushed to the bottom so the six cards' footers line up even
                  when a blurb wraps to two lines and its neighbour does not. */}
              <div className="rep-foot">
                <span className="rep-source">{r.source}</span>
                <span className="rep-exports">{r.exports}</span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </div>
            </Link>
          ) : (
            /* Genuinely unavailable rather than gated, so this is the handoff
               §9 disabled treatment — --o-disabled plus the caption below
               saying why, which this card already carried. */
            <div key={r.key} className="card" style={{ opacity: 'var(--o-disabled)' }}>
              <p className="card-title">{r.title}</p>
              <p className="tiny">{r.body}</p>
              <p className="tiny" style={{ marginTop: 8 }}>
                {hasReportAccess ? 'Not built yet.' : 'Not available to admin.'}
              </p>
            </div>
          );
        })}
      </div>

      <p className="cap">
        Live pages, recomputed each time you open them. Every report exports to CSV, and all but
        the training report also export to PDF. XLSX and scheduled email delivery aren&rsquo;t
        available yet.
      </p>
    </>
  );
}
