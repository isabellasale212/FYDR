import { notFound } from 'next/navigation';
import { GymSessionLogger } from '@/components/GymSessionLogger/GymSessionLogger';
import {
  fetchLoggedSets,
  fetchMyProgrammeSessions,
  fetchPersonalBestsBefore,
  fetchSessionExercises,
  startOrGetSessionLog,
} from '@/lib/queries/programmes';
import { todayIso } from '@/lib/format';
import { fetchGymSetRevisionChains } from '@/lib/queries/entryRevisions';
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
  const { db, orgId, athleteId, timezone } = await requireAthlete();

  /* The name comes from resolve_my_programme_sessions, the same RPC the
     programme list uses, NOT from a direct read of programme_sessions. That
     table's only SELECT policy is programme_sessions_staff_select, so an
     athlete reading their own session got null back and this screen showed
     the "Gym session" fallback while the list one tap earlier said "Lower A".
     Verified against the row: it has always had a name. The RPC is the
     sanctioned athlete path, so this needs no new policy. */
  const [exercises, myProgramme] = await Promise.all([
    fetchSessionExercises(db, sessionId, athleteId),
    fetchMyProgrammeSessions(db, athleteId),
  ]);
  const mine = myProgramme.find((r) => r.session_id === sessionId) ?? null;
  if (exercises.length === 0) notFound();

  const { id: gymSessionLogId, status, startedAt, completedAt, error } = await startOrGetSessionLog(
    db,
    orgId,
    athleteId,
    sessionId,
    timezone,
  );
  if (error || !gymSessionLogId) {
    throw new Error(error ?? 'Could not start this session.');
  }

  const loggedSets = await fetchLoggedSets(db, gymSessionLogId);
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  /* ATH-ADULT-11 C2: the session's revision chains, so a corrected set can
     say what it was ("Set 1 corrected · was 100 kg × 8"). The base table,
     as My data reads it since §0v — the superseded row is the point. Each
     live set that is itself a revision, with the values it replaced. */
  const chains = await fetchGymSetRevisionChains(db, orgId, gymSessionLogId);
  const corrections = chains
    .filter((c) => c.priorRevisions.length > 0)
    .map((c) => {
      const was = c.priorRevisions[c.priorRevisions.length - 1] ?? null;
      return { id: c.current.id, was: { reps_completed: was?.reps_completed ?? null, load_kg: was?.load_kg ?? null } };
    });
  /* ATH-ADULT-09 C6: the summary's "Best before today" (MET-040) — read only
     once the session is complete, over the sessions before today's date. */
  const priors =
    status === 'complete'
      ? await fetchPersonalBestsBefore(db, orgId, athleteId, exercises.map((ex) => ex.exercise_id), todayIso(timezone))
      : new Map();
  const priorBests = [...priors.entries()].map(([exercise_id, b]) => ({ exercise_id, ...b }));

  return (
    <GymSessionLogger
      orgId={orgId}
      athleteId={athleteId}
      timezone={timezone}
      gymSessionLogId={gymSessionLogId}
      sessionName={mine?.session_name ?? 'Gym session'}
      /* The design's eyebrow above the session name. Built from what the RPC
         already returns, and each part dropped when absent rather than printed
         as a gap. */
      sessionMeta={
        [
          mine?.programme_name,
          mine?.block_name,
          mine?.week_number != null ? `Week ${mine.week_number}` : null,
          mine?.day_number != null ? `Day ${mine.day_number}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || null
      }
      startedAt={startedAt}
      completedAt={completedAt}
      priorBests={priorBests}
      corrections={corrections}
      totalSets={totalSets}
      exercises={exercises}
      loggedSets={loggedSets}
      alreadyComplete={status === 'complete'}
    />
  );
}
