import Link from 'next/link';
import { fetchMySarRequests } from '@/lib/queries/sarPack';
import { SAR_HOW_TO_ASK, sarAthleteLine, sarPackContents, type SarStatus } from '@/lib/subjectAccess/words';
import { formatDate } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Privacy and my data · Fydr' };

/** PATTERN-S8 C10 (2026-09-13): the athlete side of subject access, on the
 *  same pattern as the staff queue. Route-map screen 43, "Privacy and my
 *  data". Three things, in plain English: what the club holds about you
 *  (the pack's own manifest, SAR_CATEGORIES, so the list here IS the list
 *  the pack carries), who sees what (docs/athlete/visibility.md, as
 *  sentences), and how to get a copy — with, when a request for your data
 *  exists, where it stands, read from your own sar_requests rows (0114).
 *  Nothing here writes: the athlete asks the club, out of band; the
 *  self-export was removed 2026-09-13 by Isabella's decision. */
export default async function PrivacyPage() {
  const { db, orgId, athleteId, timezone } = await requireAthlete();
  const requests = await fetchMySarRequests(db, orgId, athleteId);
  const fmt = (iso: string) => formatDate(iso, timezone);

  return (
    <>
      <div className="hd">
        <h1 className="d">Privacy and my data</h1>
      </div>
      <p className="tiny">
        <Link href="/me">← Me</Link>
      </p>

      <section className="card" aria-labelledby="pv-request-title">
        <h2 className="card-title" id="pv-request-title">
          A copy of your data
        </h2>
        {requests.length === 0 ? (
          <p className="tiny">No request for a copy of your data is open. You are entitled to one at any time — here is how.</p>
        ) : (
          <ul className="pv-requests">
            {requests.map((r) => (
              <li key={r.id} className="pv-request">
                {sarAthleteLine({ status: r.status as SarStatus, requestedAt: r.requested_at, requestedBy: r.requested_by_name, dueAt: r.due_at, releasedAt: r.released_at, formatDate: fmt })}
              </li>
            ))}
          </ul>
        )}
        <ol className="pv-steps">
          {SAR_HOW_TO_ASK.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="cap">UK GDPR Article 15, the right of access. The club has one month from the day you ask.</p>
      </section>

      <section className="card" aria-labelledby="pv-sees-title">
        <h2 className="card-title" id="pv-sees-title">
          Who sees what
        </h2>
        <ul className="pv-rules">
          <li>Your wellness check-ins, session ratings, gym sets and test results are read by your club&apos;s coaching, S&amp;C, medical and nutrition staff.</li>
          <li>Your body mass and weigh-ins are read by the S&amp;C coach, the nutritionist and the medic — not by the coach.</li>
          <li>Diagnosis, mechanism and clinical notes on an injury are read by the medic alone. Everyone else sees your availability, your restrictions and your expected return.</li>
          <li>Teammates see your name on a leaderboard only where you have opted in, and nothing else about you.</li>
          <li>Every read of a medical record, every export and every release of your data is written to an audit log your club&apos;s sport scientist can inspect.</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-holds-title">
        <h2 className="card-title" id="pv-holds-title">
          What the club holds about you
        </h2>
        <p className="tiny" style={{ marginBottom: 'var(--sp-8)' }}>
          The same list a copy of your data is made from — where each part comes from, and how long it is kept.
        </p>
        <ul className="pv-holds">
          {sarPackContents().map((c) => (
            <li key={c.category}>
              <span className="pv-cat">{c.category}</span>
              <span className="pv-meta">{c.source}</span>
              <span className="pv-meta">Kept: {c.retention}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
