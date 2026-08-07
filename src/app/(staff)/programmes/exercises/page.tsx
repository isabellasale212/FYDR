import Link from 'next/link';
import { ExerciseForm } from '@/components/ExerciseForm/ExerciseForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchExercises } from '@/lib/queries/programmes';
import { enumLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Exercise library · Fydr' };

/** screens/programme-builder.md, screen 22's exercise library. Shared read for
 *  every staff role, shared write for coach and medical alike — an exercise
 *  belongs to nobody's lane, only programmes do. */
export default async function ExerciseLibraryPage() {
  const { db, orgId, orgName } = await requireStaff();
  const exercises = await fetchExercises(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/programmes">Gym programme</Link> · Exercise library
          </p>
          <h1>Exercise library</h1>
        </div>
        <ThemeToggle />
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div className="card flush">
          {exercises.length === 0 ? (
            <p className="tiny" style={{ padding: 16 }}>
              No exercises yet. Add the first one.
            </p>
          ) : (
            exercises.map((ex, index) => (
              <div key={ex.id}>
                {index > 0 ? <div className="hair" /> : null}
                <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <span className="nm">{ex.name}</span>
                    <div className="tiny">
                      {enumLabel(ex.category)}
                      {ex.primary_muscle ? ` · ${ex.primary_muscle}` : ''}
                    </div>
                  </div>
                  <span />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <p className="label">Add an exercise</p>
          <div style={{ marginTop: 10 }}>
            <ExerciseForm orgId={orgId} />
          </div>
        </div>
      </div>
    </>
  );
}
