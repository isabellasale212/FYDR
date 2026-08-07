import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Reports · Fydr' };

const REPORTS = [
  {
    key: 'compliance',
    title: 'Compliance',
    body: 'Who is submitting, and who is not.',
    href: '/reports/compliance',
    available: true,
  },
  {
    key: 'injuries',
    title: 'Injury & availability',
    body: 'Who is out, for how long, and what it is costing.',
    href: '/reports/injuries',
    available: true,
  },
  {
    key: 'training',
    title: 'Training report',
    body: 'One session, every athlete, every GPS metric, on one board.',
    href: '/reports/training',
    available: true,
  },
  {
    key: 'athlete',
    title: 'Athlete report',
    body: 'One athlete, every domain, one period.',
    href: '/reports/athlete',
    available: true,
  },
  {
    key: 'squad',
    title: 'Squad weekly',
    body: 'The week in one document.',
    href: '/reports/squad',
    available: true,
  },
  {
    key: 'testing',
    title: 'Testing',
    body: 'A testing session, or a test over time.',
    href: '/reports/testing',
    available: true,
  },
] as const;

/** screens/reports.md, all five report types now built: Compliance and
 *  Injury & availability (reports.ts), the separate Training report screen
 *  (screens/training-report.md, trainingReport.ts), the Athlete report
 *  (athleteReport.ts), Squad weekly (squadWeeklyReport.ts) and now the
 *  Testing report (testingReport.ts) — the last three built once GPS
 *  records and testing, the gaps that blocked them, both existed. No PDF or
 *  scheduling on any of the five — these are live in-app pages, recomputed
 *  on open, each with a CSV export. See each query file's own header for
 *  what it cuts against the full spec.
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
  const { orgName, claims } = await requireStaff();
  const hasReportAccess = claims.roles.includes('coach') || claims.roles.includes('medical');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Reports</h1>
        </div>
        <ThemeToggle />
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
        {REPORTS.map((r) =>
          r.available && r.href && hasReportAccess ? (
            <Link key={r.key} href={r.href} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <p className="card-title">{r.title}</p>
              <p className="tiny">{r.body}</p>
            </Link>
          ) : (
            <div key={r.key} className="card" style={{ opacity: 0.55 }}>
              <p className="card-title">{r.title}</p>
              <p className="tiny">{r.body}</p>
              <p className="tiny" style={{ marginTop: 8 }}>
                {hasReportAccess ? 'Not built yet.' : 'Not available to admin.'}
              </p>
            </div>
          ),
        )}
      </div>

      <p className="cap">
        Live pages, recomputed each time you open them, each with a CSV and a PDF export &mdash;
        see lib/pdf.tsx for why PDF turned out to be buildable after all, once actually checked.
        No XLSX format and no scheduled delivery in this build &mdash; both still real, documented
        gaps, not oversights.
      </p>
    </>
  );
}
