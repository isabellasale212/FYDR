import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GymSessionSetsList } from '@/components/GymSessionSetsList/GymSessionSetsList';
import { fetchGymSessionLog, fetchGymSessionSetDetails } from '@/lib/queries/programmes';
import { formatDate, formatNumber } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Gym session · Fydr' };

/** My Data, gym tab, session detail — the minimal gym history view my-data/page.tsx's own
 *  header comment named as missing. fetchGymSessionLog reads gym_session_logs_current
 *  (RLS: self only), so a wrong or another athlete's id notFounds here exactly the same
 *  way a missing row would, rather than leaking a 403. */
export default async function GymSessionHistoryPage({
  params,
}: {
  params: Promise<{ gymSessionLogId: string }>;
}) {
  const { db, timezone } = await requireAthlete();
  const { gymSessionLogId } = await params;

  const session = await fetchGymSessionLog(db, gymSessionLogId);
  if (!session) notFound();

  const sets = await fetchGymSessionSetDetails(db, gymSessionLogId);
  const totalVolume = sets.reduce((sum, s) => sum + (s.reps_completed ?? 0) * (s.load_kg ?? 0), 0);

  return (
    <>
      <div className="hd">
        <h1 className="d">{formatDate(session.entry_date, timezone)}</h1>
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

      <p className="tiny">
        <Link href="/my-data?tab=gym">Back to gym history</Link>
      </p>
    </>
  );
}
