import Link from 'next/link';
import { ExerciseForm } from '@/components/ExerciseForm/ExerciseForm';
import { ExerciseLibraryList } from '@/components/ExerciseLibraryList/ExerciseLibraryList';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchExercises, fetchStrengthTestDefinitions } from '@/lib/queries/programmes';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Exercise library · Fydr' };

/** screens/programme-builder.md, screen 22's exercise library. Shared read for
 *  every staff role, shared write for coach and medical alike — an exercise
 *  belongs to nobody's lane, only programmes do. Search/filter added for
 *  audit finding 33; edit and a detail view are still a real, documented gap
 *  (see ExerciseLibraryList's own comment). */
export default async function ExerciseLibraryPage() {
  const { db, orgId, orgName } = await requireStaff();
  const [exercises, strengthTests] = await Promise.all([
    fetchExercises(db, orgId),
    fetchStrengthTestDefinitions(db, orgId),
  ]);

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
        <ExerciseLibraryList exercises={exercises} />
        <div className="card">
          <p className="label">Add an exercise</p>
          <div style={{ marginTop: 10 }}>
            <ExerciseForm orgId={orgId} strengthTests={strengthTests} />
          </div>
          {strengthTests.length === 0 ? (
            <p className="cap" style={{ marginTop: 10 }}>
              No strength-category tests exist yet, so nothing can be linked as a 1RM source.
              Add one from Testing first if you want “% of 1RM” prescriptions to resolve to a
              real weight.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
