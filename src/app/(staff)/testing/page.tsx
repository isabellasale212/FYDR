import Link from 'next/link';
import { TestDefinitionForm } from '@/components/TestDefinitionForm/TestDefinitionForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchTestDefinitions } from '@/lib/queries/testing';
import { enumLabel } from '@/lib/format';
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
  const definitions = await fetchTestDefinitions(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Testing</h1>
        </div>
        <ThemeToggle />
      </div>

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
                    </div>
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
