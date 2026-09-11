import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GymSessionSetsList } from '@/components/GymSessionSetsList/GymSessionSetsList';
import { fetchGymSessionLog, fetchGymSessionSetDetails } from '@/lib/queries/programmes';
import { fetchGymSetRevisionChains } from '@/lib/queries/entryRevisions';
import { formatDate, formatNumber } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Gym session · Fydr' };

/** A set as the athlete reported it, in words when a number is absent — never a
 *  0, because a zero is a reading and a blank is the absence of one, and never a
 *  dash, which reads as a low value at a glance (ATH-ADULT-12/13, the same rule
 *  the rest of My data follows since 2026-09-12). */
function describeSet(v: { reps_completed: number | null; load_kg: number | null }): string {
  if (v.reps_completed === null && v.load_kg === null) return 'nothing logged';
  if (v.load_kg === null) return `${v.reps_completed} reps, load not logged`;
  if (v.reps_completed === null) return `reps not logged at ${v.load_kg} kg`;
  return `${v.reps_completed} reps at ${v.load_kg} kg`;
}

/** My Data, gym tab, session detail — the minimal gym history view my-data/page.tsx's own
 *  header comment named as missing. fetchGymSessionLog reads gym_session_logs_current
 *  (RLS: self only), so a wrong or another athlete's id notFounds here exactly the same
 *  way a missing row would, rather than leaking a 403. */
export default async function GymSessionHistoryPage({
  params,
}: {
  params: Promise<{ gymSessionLogId: string }>;
}) {
  const { db, orgId, timezone } = await requireAthlete();
  const { gymSessionLogId } = await params;

  const session = await fetchGymSessionLog(db, gymSessionLogId);
  if (!session) notFound();

  const sets = await fetchGymSessionSetDetails(db, gymSessionLogId);
  const totalVolume = sets.reduce((sum, s) => sum + (s.reps_completed ?? 0) * (s.load_kg ?? 0), 0);
  /* "Not logged" rather than "0 kg" when no set carries a load: a bodyweight
     session has tonnage nobody recorded, not a tonnage of nothing. */
  const hasLoad = sets.some((s) => s.load_kg !== null);
  const exerciseCount = new Set(sets.map((s) => s.exercise_name)).size;

  /* §0v: the correction panel in the live logger promises "My data marks the day
     corrected and shows what you first reported", and until 2026-09-10 My data did
     neither for gym sets — the original was kept in the table and shown nowhere. This
     is the display half of that promise, reusing the chain read wellness and RPE
     already use rather than a gym-only invention. */
  const chains = await fetchGymSetRevisionChains(db, orgId, gymSessionLogId);
  const corrected = chains.filter((c) => c.priorRevisions.length > 0);

  return (
    <>
      <div className="hd">
        <h1 className="d">{formatDate(session.entry_date, timezone)}</h1>
        {corrected.length > 0 ? (
          /* Same pill, same words, same place as the wellness and RPE history rows in
             my-data/page.tsx — this is the marker an athlete is told to look for. */
          <span className="pill pill-neutral" style={{ marginInlineStart: 8 }}>
            Corrected
          </span>
        ) : null}
      </div>
      {/* ATH-ADULT-13 (2026-09-12): the summary line is the hero. The two
          figures My data's own list leads with — tonnage and session RPE — at
          the size the Wellness, Gym and Tests heroes use (.rd-value, settled
          by ATH-ADULT-12), each over the fact that derives it. The one-line
          summary the page always had is kept beneath, as the board keeps it. */}
      <section className="card sd-hero" aria-label="Session summary">
        <div>
          <p className="eyebrow">Total volume</p>
          {hasLoad ? (
            <p className="rd-value num">
              {formatNumber(totalVolume, 0)}
              <span className="rd-unit">kg</span>
            </p>
          ) : (
            <p className="rd-value num" data-missing="">
              Not logged
            </p>
          )}
          <p className="rd-mean">
            {corrected.length > 0
              ? `${sets.length} sets · recomputed after a correction`
              : `${sets.length} ${sets.length === 1 ? 'set' : 'sets'} across ${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`}
          </p>
        </div>
        <div>
          <p className="eyebrow">Session RPE</p>
          <p className="rd-value num" data-missing={session.session_rpe === null ? '' : undefined}>
            {session.session_rpe !== null ? formatNumber(session.session_rpe, 1) : 'Not rated'}
          </p>
          <p className="rd-mean">as you rated it</p>
        </div>
      </section>
      <p className="import-sub">
        {sets.length} set{sets.length === 1 ? '' : 's'} logged
        {session.session_rpe !== null ? ` · session RPE ${formatNumber(session.session_rpe, 1)}` : ''}
        {totalVolume > 0 ? ` · ${formatNumber(totalVolume, 0)} kg total` : ''}
      </p>
      {session.comment ? <p className="cap">{session.comment}</p> : null}

      <div className="stack">
        <section className="card flush">
          <h2 className="card-title" style={{ padding: '16px 16px 0' }}>
            Sets
          </h2>
          <div style={{ padding: 'var(--sp-16)' }}>
            <GymSessionSetsList sets={sets} />
          </div>
        </section>
      </div>

      {corrected.length > 0 ? (
        /* Shown open rather than behind a disclosure, for the reason the wellness
           version gives: this is one person's own record, a correction is rare, and
           the fact a number changed is not something to make them go looking for.

           NO "Corrected by …" LINE, unlike wellness and RPE, and that is deliberate.
           Those two can only be corrected by staff (ENTRY_CORRECTION), so their
           "a member of staff" fallback is true by construction. A gym set is corrected
           by the ATHLETE THEMSELVES in the common case — ATH-ADULT-11 is an athlete
           flow — and gym_set_logs carries no created_by to tell the two apart. Saying
           "by a member of staff" here would be a false statement about who changed the
           number, so this says only what it knows. */
        <section className="card" aria-labelledby="gym-corrected-title">
          <h2 className="card-title" id="gym-corrected-title">
            What you reported
          </h2>
          <p className="cap" style={{ marginTop: 0 }}>
            {corrected.length === 1 ? 'One set was' : `${corrected.length} sets were`}{' '}
            corrected after being logged. The original is kept and is shown here.
          </p>
          <ol className="cap" style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
            {corrected.map((c) => (
              <li key={c.current.id} className="num">
                {`Set ${c.current.set_number}: `}
                {c.priorRevisions.map(describeSet).join(' → ')}
                {` → now ${describeSet(c.current)}`}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ONE WAY BACK, full width, named for its destination (ATH-ADULT-13;
          §0w's third item). A .btn-ghost, not the primary: the board reserves
          the primary halo for Save correction. The shell's own Back button
          stands down on this route (BackButton's SELF_DISMISSING), so this is
          the one control rather than the second of two. */}
      <div className="subm">
        <Link
          href="/my-data?tab=gym"
          className="btn-ghost"
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          Back to gym history
        </Link>
      </div>
    </>
  );
}
