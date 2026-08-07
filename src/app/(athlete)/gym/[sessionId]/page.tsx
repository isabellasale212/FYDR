import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GymSessionLogger } from '@/components/GymSessionLogger/GymSessionLogger';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchLoggedSets, fetchSessionExercises, startOrGetSessionLog } from '@/lib/queries/programmes';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Gym session · Fydr' };

/** screens/gym-logging.md, screen 4, cut down hard — see
 *  lib/queries/programmes.ts's header. No unresolved-1RM banner beyond the
 *  honest per-exercise copy, no rest timer, no previous-performance
 *  comparison (needs the same history queries a fuller pass would add). */
export default async function GymSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { db, orgId, athleteId } = await requireAthlete();

  const exercises = await fetchSessionExercises(db, sessionId);
  if (exercises.length === 0) notFound();

  const { id: gymSessionLogId, status, error } = await startOrGetSessionLog(db, orgId, athleteId, sessionId);
  if (error || !gymSessionLogId) {
    throw new Error(error ?? 'Could not start this session.');
  }

  const loggedSets = await fetchLoggedSets(db, gymSessionLogId);

  return (
    <>
      <div className="hd">
        <p className="eyebrow">
          <Link href="/programme">My programme</Link>
        </p>
        <h1 className="d">Gym session</h1>
        <ThemeToggle />
      </div>

      <GymSessionLogger
        orgId={orgId}
        gymSessionLogId={gymSessionLogId}
        exercises={exercises}
        loggedSets={loggedSets}
        alreadyComplete={status === 'complete'}
      />
    </>
  );
}
