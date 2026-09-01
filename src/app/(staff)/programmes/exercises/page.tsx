import { ExerciseForm } from '@/components/ExerciseForm/ExerciseForm';
import { ExerciseLibraryList } from '@/components/ExerciseLibraryList/ExerciseLibraryList';
import { fetchExercises, fetchStrengthTestDefinitions } from '@/lib/queries/programmes';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Exercise library · Fydr' };

/** screens/programme-builder.md, screen 22's exercise library. Shared read for
 *  every staff role, shared write for coach and medical alike — an exercise
 *  belongs to nobody's lane, only programmes do. Search/filter added for
 *  audit finding 33; edit and a detail view are still a real, documented gap
 *  (see ExerciseLibraryList's own comment).
 *
 *  The page fetches and composes; every pixel of the screen's chrome lives in
 *  the two components. The search field, the category picker, the per-category
 *  counts and the "n of m shown" footer are one piece of client state, so the
 *  header they sit in belongs to ExerciseLibraryList — this file cannot hold
 *  state, it awaits. The add-an-exercise card is passed in as `aside` so the
 *  org id and the strength-test list stay on the server side of the boundary.
 *  `(staff)/layout.tsx` renders the shared `<BackButton />` above this. */
export default async function ExerciseLibraryPage() {
  const { db, orgId, orgName } = await requireStaff();
  const [exercises, strengthTests] = await Promise.all([
    fetchExercises(db, orgId),
    fetchStrengthTestDefinitions(db, orgId),
  ]);

  return (
    <ExerciseLibraryList
      exercises={exercises}
      orgName={orgName}
      aside={<ExerciseForm orgId={orgId} strengthTests={strengthTests} />}
    />
  );
}
