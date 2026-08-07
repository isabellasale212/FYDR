import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchProgrammes } from '@/lib/queries/programmes';
import { enumLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Gym programme · Fydr' };

const TYPE_PILL: Record<string, string> = {
  gym: 'pill-neutral',
  rehab: 'pill-warn',
  conditioning: 'pill-neutral',
  nutrition: 'pill-neutral',
};

/** screens/gym-programmes.md, screen 23, cut down hard — see
 *  lib/queries/programmes.ts's header for exactly what and why. Coach and
 *  medical both see every programme; only the create button's default type
 *  differs, since the database refuses the type each role can't author anyway
 *  (migration 0022). */
export default async function ProgrammesPage() {
  const { db, orgId, orgName, claims } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  const programmes = await fetchProgrammes(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Gym programme</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/programmes/exercises" className="btn-ghost">
            Exercise library
          </Link>
          {isCoach || isMedical ? (
            <Link href="/programmes/new" className="btn-primary">
              + New programme
            </Link>
          ) : null}
          <ThemeToggle />
        </div>
      </div>

      {programmes.length === 0 ? (
        <div className="card">
          <p className="tiny">No programmes yet.</p>
        </div>
      ) : (
        <div className="card flush">
          {programmes.map((p, index) => (
            <div key={p.id}>
              {index > 0 ? <div className="hair" /> : null}
              <Link
                href={`/programmes/${p.id}`}
                className="load-row"
                style={{ gridTemplateColumns: '1fr auto auto', textDecoration: 'none', color: 'inherit' }}
              >
                <div>
                  <span className="nm">{p.name}</span>
                  <div className="tiny">
                    {p.goal ?? 'No goal set'}
                    {p.duration_weeks ? ` · ${p.duration_weeks} weeks` : ''} · {p.assignment_count} assigned
                  </div>
                </div>
                <span className={`pill ${TYPE_PILL[p.programme_type] ?? 'pill-neutral'}`}>
                  {enumLabel(p.programme_type)}
                </span>
                <span className="pill pill-neutral">{enumLabel(p.status)}</span>
              </Link>
            </div>
          ))}
        </div>
      )}

      <p className="cap">
        Coach authors gym, conditioning and nutrition programmes. Medical authors rehab
        programmes only, and reads every gym programme for context.
      </p>
    </>
  );
}
