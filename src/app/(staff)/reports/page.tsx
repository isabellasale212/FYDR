import Link from 'next/link';
import { requireStaff } from '@/lib/session';
import { REPORT_VISIBILITY, hasAnyRole } from '@/lib/access';
import type { ReportKey } from '@/lib/access';
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
    tone: 'medic',
    source: 'medic',
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
 *  training report was the last, see reports/training/pdf/route.tsx). The
 *  caption below used to say "all but the training report also export to
 *  PDF" and carried a NOTE here calling itself stale; both were corrected
 *  on 2026-09-01, once all six pdf routes were confirmed present. See each
 *  query file's own header for what it cuts against the full spec.
 *
 *  This index page stays open to every staff role, and each CARD is gated
 *  individually from access.ts's REPORT_VISIBILITY — the same grid
 *  lib/session.ts's requireReport() enforces on the report pages and on
 *  every export/pdf route. One grid, consulted in both places, because the
 *  hub is only a list of links: hiding a card refuses nobody on its own.
 *
 *  WHAT THIS REPLACED, 2026-09-06. A single `hasReportAccess` computed here
 *  as `roles.includes('coach') || roles.includes('medic')`, predating the
 *  five-role model, which disabled all six cards for anybody else and
 *  explained itself with a note about what an "admin" may see. Three things
 *  were wrong with it. The role it named no longer exists — admin became
 *  sport_scientist in 0063, so the note was addressed to nobody. It
 *  disagreed with the pages it linked to, which had been corrected to
 *  REPORT_ACCESS and would happily open for a sport scientist or an S&C
 *  who typed the URL. And it was a rendered refusal that never redirects,
 *  which is why the sweeps that fixed the redirecting gates went straight
 *  past it.
 *
 *  A role that may open NOTHING still sees the shelf, with each card
 *  disabled and saying so. Redirecting away entirely would hide that a
 *  reports feature exists at all, which is worse than naming the reason. */
export default async function ReportsPage() {
  const { orgName, claims, tier } = await requireStaff();
  const canOpen = (key: ReportKey): boolean => hasAnyRole(claims.roles, REPORT_VISIBILITY[key]);
  const openCount = REPORTS.filter((r) => canOpen(r.key)).length;
  const onPremium = isPremium(tier);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Reports</h1>
        </div>
      </div>

      {openCount === 0 ? (
        <div className="note" style={{ marginBottom: 14, borderColor: 'var(--warn)' }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>No reports are open to your role.</b> Every report here reads named-athlete data. Ask the sport
            scientist if you need one of them.
          </p>
        </div>
      ) : openCount < REPORTS.length ? (
        /* Said once, above the grid, rather than repeated on each closed card:
           a nutritionist sees four of these disabled and the reason is the same
           for all four. */
        <div className="note" style={{ marginBottom: 14 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            Some reports below aren&apos;t open to your role. The ones that are, are marked.
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
          const open = canOpen(r.key);
          return r.available && r.href && open ? (
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
                    className="num"
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
                {open ? 'Not built yet.' : 'Not open to your role.'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Design.pdf p11 has no caption here, and the two sentences that stood
          with this one are gone for that reason: "live pages, recomputed each
          time you open them" and "every report exports to CSV and to PDF" both
          restated the cards above, which already print "CSV · PDF" on every
          one. This sentence is not a restatement — it is the only place in the
          app that says these two formats do not exist yet, and a coach looking
          for them would otherwise go hunting. */}
      <p className="cap">XLSX and scheduled email delivery aren&rsquo;t available yet.</p>
    </>
  );
}
