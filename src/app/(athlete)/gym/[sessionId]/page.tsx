import { notFound } from 'next/navigation';
import { GymSessionLogger } from '@/components/GymSessionLogger/GymSessionLogger';
import { fetchLoggedSets, fetchSessionExercises, startOrGetSessionLog } from '@/lib/queries/programmes';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Gym session · Fydr' };

/** screens/gym-logging.md, screen 4 / ATHLETE-APP-SPEC.md §9, cut down
 *  hard — see lib/queries/programmes.ts's header. No rest timer, no
 *  previous-performance comparison (needs the same history queries a
 *  fuller pass would add). The prescription IS adjusted for this athlete
 *  now (migration 0043): fetchSessionExercises is called with athleteId, so
 *  an exempt exercise does not appear, a substitute or volume override
 *  applies, a load_cap binds, and a percent_1rm prescription resolves
 *  against this athlete's own latest 1RM result — or says plainly that it
 *  cannot, never a guess. Full screen, not a sheet, per the spec's own
 *  distinction — this is a place used repeatedly through a session, not a
 *  task. */
export default async function GymSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { db, orgId, athleteId } = await requireAthlete();

  const [exercises, sessionRow] = await Promise.all([
    fetchSessionExercises(db, sessionId, athleteId),
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
