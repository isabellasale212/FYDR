import { notFound } from 'next/navigation';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import Link from 'next/link';
import { InjuryMedicalForm } from '@/components/InjuryMedicalForm/InjuryMedicalForm';
import { SetAvailabilityForm } from '@/components/SetAvailabilityForm/SetAvailabilityForm';
import { fetchInjuryDetail, fetchInjuryClinical } from '@/lib/queries/injuries';
import { fetchInjuryProposals, fetchInjuryTimeline } from '@/lib/queries/injuryTimeline';
import { InjuryTimeline } from '@/components/InjuryTimeline/InjuryTimeline';
import { enumLabel, formatDate } from '@/lib/format';
import { requireInjuryAccess } from '@/lib/session';

export const metadata = { title: 'Injury · Fydr' };

const AVAIL_PILL: Record<string, string> = {
  available: 'pill-good',
  modified: 'pill-warn',
  unavailable: 'pill-bad',
};

/** screens/injury-record.md, screen 13, "the highest risk screen in the product",
 *  simplified — see lib/queries/injuries.ts's header for exactly what and why. The
 *  clinical fetch below is the one line in this whole build that matters most: it
 *  only runs at all when the viewer holds the medical role, so a coach's render pass
 *  never calls fetchInjuryClinical in the first place. RLS would return nothing to a
 *  coach regardless (clinical_medical_only in migration 0012), but not calling the
 *  function is the second, independent layer the spec asks for — the same "more than
 *  one layer, because any one alone is one refactor away from failing" reasoning the
 *  spec states explicitly for this exact boundary. */
export default async function InjuryDetailPage({
  params,
}: {
  params: Promise<{ injuryId: string }>;
}) {
  const { injuryId } = await params;
  const { db, orgId, claims, timezone } = await requireInjuryAccess();
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);

  const injury = await fetchInjuryDetail(db, orgId, injuryId);
  if (!injury) notFound();

  const clinical = isMedical ? await fetchInjuryClinical(db, orgId, injuryId) : null;

  /* Same rule as the clinical fetch above, and for the same reason: the timeline
     is medic-only (injury_timeline_medic_select, migration 0080) and a non-medic
     calling it gets zero rows rather than an error, so the guard has to be here
     as well as in the database. The proposals are NOT gated — an S&C reads
     programme_assignments already, and seeing that their own draft is still
     awaiting sign-off is the whole point of the status. */
  const timeline = isMedical ? await fetchInjuryTimeline(db, orgId, injuryId) : [];
  const proposals = await fetchInjuryProposals(db, orgId, injuryId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/injuries">Injuries</Link> · {injury.first_name} {injury.last_name}
          </p>
          <h1>
            {injury.first_name} {injury.last_name}
          </h1>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', flexWrap: 'wrap' }}>
          <span className="pill pill-neutral">{enumLabel(injury.status)}</span>
          <span className="pill pill-neutral">
            {enumLabel(injury.body_area)}
            {injury.side ? ` · ${enumLabel(injury.side)}` : ''}
          </span>
          {injury.availability_status ? (
            <span className={`pill ${AVAIL_PILL[injury.availability_status] ?? 'pill-neutral'}`}>
              {enumLabel(injury.availability_status)}
            </span>
          ) : null}
        </div>
        <p style={{ marginTop: 'var(--sp-10)' }}>
          Since {formatDate(injury.onset_date, timezone)}
          {injury.expected_return ? ` · expected back ${formatDate(injury.expected_return, timezone)}` : ''}
          {injury.actual_return ? ` · returned ${formatDate(injury.actual_return, timezone)}` : ''}
        </p>
        {injury.restrictions && injury.restrictions.length > 0 ? (
          <div className="chiprow" style={{ marginTop: 'var(--sp-10)' }}>
            {injury.restrictions.map((r) => (
              <span key={r} className="chip-static">
                {r}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {isMedical ? (
        <>
          <div style={{ marginTop: 'var(--sp-14)' }}>
            <SetAvailabilityForm
              orgId={orgId}
              userId={claims.userId}
              athleteId={injury.athlete_id}
              injuryId={injury.id}
            />
          </div>

          <div style={{ marginTop: 'var(--sp-14)' }}>
            <p className="sect" style={{ marginBottom: 'var(--sp-8)' }}>
              Edit this record
            </p>
            <InjuryMedicalForm orgId={orgId} userId={claims.userId} injury={injury} clinical={clinical} />
          </div>

          <div style={{ marginTop: 'var(--sp-14)' }}>
            <InjuryTimeline
              orgId={orgId}
              userId={claims.userId}
              injuryId={injury.id}
              events={timeline}
              proposals={proposals}
              timezone={timezone}
            />
          </div>
        </>
      ) : (
        <>
          <div className="note" style={{ marginTop: 'var(--sp-14)' }}>
            <div className="note-glyph">i</div>
            <p className="note-text">
              <b>This is what coaching staff see.</b> Diagnosis, clinical notes and
              treatment plan are medical only and are not shown here, by design &mdash;
              no screen ever puts them in front of a coach.
            </p>
          </div>

          {/* The S&C's own side of the conversation. Not the timeline — that is
              medic-only — just the standing of the block they drafted, which
              they can already read from programme_assignments. Without this
              they would propose a block and have nowhere to see whether it had
              been signed off. */}
          {proposals.length > 0 ? (
            <div className="card" style={{ marginTop: 'var(--sp-14)' }}>
              <h2 className="card-title">Gym work proposed for this injury</h2>
              <div className="stack" style={{ gap: 'var(--sp-6)', marginTop: 'var(--sp-10)' }}>
                {proposals.map((p) => (
                  <div key={p.assignment_id} style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span className="nm">{p.programme_name}</span>
                    <span className={`pill ${p.status === 'active' ? 'pill-good' : 'pill-warn'}`}>
                      {p.status === 'active' ? 'Signed off' : 'Awaiting medical sign-off'}
                    </span>
                    <span className="tiny">
                      From {formatDate(p.starts_on, timezone)}
                      {p.status === 'active' ? '' : ' · not visible to the athlete yet'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
