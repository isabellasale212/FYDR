import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GymSessionSetsList } from '@/components/GymSessionSetsList/GymSessionSetsList';
import { fetchGymSessionLog, fetchGymSessionSetDetails } from '@/lib/queries/programmes';
import { fetchGymSetRevisionChains } from '@/lib/queries/entryRevisions';
import { formatDate, formatNumber } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Gym session · Fydr' };

/** An em dash for a missing number, never a 0 — the same rule the rest of My data
 *  follows, because a zero is a reading and a blank is the absence of one. */
const dash = (v: number | null): string => (v === null ? '—' : String(v));

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
                {c.priorRevisions
                  .map((rev) => `${dash(rev.reps_completed)} reps at ${dash(rev.load_kg)} kg`)
                  .join(' → ')}
                {` → now ${dash(c.current.reps_completed)} reps at ${dash(c.current.load_kg)} kg`}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="tiny">
        <Link href="/my-data?tab=gym">Back to gym history</Link>
      </p>
    </>
  );
}
