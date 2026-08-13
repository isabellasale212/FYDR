import Link from 'next/link';
import { TestDefinitionForm } from '@/components/TestDefinitionForm/TestDefinitionForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchNextTestingSession, fetchTestDefinitions } from '@/lib/queries/testing';
import { enumLabel, formatDateTime, mdLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Testing · Fydr' };

/** screens/testing.md, screen 25, cut down hard — see
 *  lib/queries/testing.ts's header for exactly what and why (no batteries, no
 *  session scheduling, no CSV import). Coach and medical are symmetric here,
 *  the one table in this whole stretch with no owns-gym/owns-rehab split:
 *  "Medical / Physio: Full, identically. Return-to-play testing is a medical
 *  workflow and the same battery is used." */
export default async function TestingPage() {
  const { db, orgId, orgName } = await requireStaff();
  const [definitions, nextSession] = await Promise.all([
    fetchTestDefinitions(db, orgId),
    fetchNextTestingSession(db, orgId, new Date().toISOString()),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Testing</h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Audit finding 36: nothing here connected Testing to the Schedule's
       * own `session_type = 'testing'` sessions — a coach could have a
       * testing session booked for tomorrow and have no way to see that
       * from this screen. Deliberately small, per the gameplan: a pointer
       * into the existing session-detail page, not a new sessions list or
       * tab. Renders nothing when there's no upcoming testing session
       * booked, rather than an empty-state card for what is a secondary
       * surface here. */}
      {nextSession ? (
        <Link
          href={`/schedule/${nextSession.id}`}
          className="card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, textDecoration: 'none', color: 'inherit' }}
        >
          <div>
            <p className="tiny" style={{ color: 'var(--muted)' }}>
              Next scheduled testing session
            </p>
            <p className="nm">
              {nextSession.title} — {formatDateTime(nextSession.starts_at)}
              {mdLabel(nextSession.md_offset) ? ` · ${mdLabel(nextSession.md_offset)}` : ''}
            </p>
          </div>
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </Link>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div className="card flush">
          {definitions.length === 0 ? (
            <p className="tiny" style={{ padding: 16 }}>
              No tests defined yet. Add the first one.
            </p>
          ) : (
            definitions.map((d, index) => (
              <div key={d.id}>
                {index > 0 ? <div className="hair" /> : null}
                <Link
                  href={`/testing/${d.id}`}
                  className="load-row"
                  style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
                >
                  <div>
                    <span className="nm">{d.name}</span>
                    <div className="tiny">
                      {enumLabel(d.test_category)} · {d.unit} · {d.higher_is_better ? 'higher is better' : 'lower is better'}
                      {d.side_mode === 'per_side' ? ' · left/right' : ''}
                      {/* Audit finding 40: "Attempts: N" appeared nowhere,
                       * so there was no way to tell whether N attempts get
                       * averaged or the best one kept. It's the latter —
                       * mark_best_attempt (migration 0024/0025) always
                       * keeps a single best row per athlete/date/side, never
                       * a mean — so the label says that outright rather
                       * than leaving "Attempts: N" to be guessed at. */}
                      {' · '}
                      {d.default_attempts} attempt{d.default_attempts === 1 ? '' : 's'}, best kept
                    </div>
                    {d.protocol ? <div className="tiny" style={{ color: 'var(--muted)', marginTop: 2 }}>{d.protocol}</div> : null}
                  </div>
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <p className="label">Add a test</p>
          <div style={{ marginTop: 10 }}>
            <TestDefinitionForm orgId={orgId} />
          </div>
        </div>
      </div>
    </>
  );
}
