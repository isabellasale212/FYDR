import { notFound } from 'next/navigation';
import { GymSessionLogger } from '@/components/GymSessionLogger/GymSessionLogger';
import { fetchLoggedSets, fetchSessionExercises, startOrGetSessionLog } from '@/lib/queries/programmes';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Gym session · Fydr' };

/** screens/gym-logging.md, screen 4 / ATHLETE-APP-SPEC.md §9, cut down
 *  hard — see lib/queries/programmes.ts's header. No unresolved-1RM
 *  banner beyond the honest per-exercise copy, no rest timer, no
 *  previous-performance comparison (needs the same history queries a
 *  fuller pass would add), no per-athlete "adjusted for you" line
 *  (programme_exercises carries no per-athlete override column to show
 *  one from). Full screen, not a sheet, per the spec's own distinction —
 *  this is a place used repeatedly through a session, not a task. */
export default async function GymSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { db, orgId, athleteId } = await requireAthlete();

  const [exercises, sessionRow] = await Promise.all([
    fetchSessionExercises(db, sessionId),
    db.from('programme_sessions').select('name').eq('id', sessionId).maybeSingle(),
  ]);
  if (exercises.length === 0) notFound();

  const { id: gymSessionLogId, status, startedAt, error } = await startOrGetSessionLog(
    db,
    orgId,
    athleteId,
    sessionId,
  );
  if (error || !gymSessionLogId) {
    throw new Error(error ?? 'Could not start this session.');
  }

  const loggedSets = await fetchLoggedSets(db, gymSessionLogId);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);

  return (
    <GymSessionLogger
      orgId={orgId}
      gymSessionLogId={gymSessionLogId}
      sessionName={sessionRow.data?.name ?? 'Gym session'}
      startedAt={startedAt}
      totalSets={totalSets}
      exercises={exercises}
      loggedSets={loggedSets}
      alreadyComplete={status === 'complete'}
    />
  );
}
