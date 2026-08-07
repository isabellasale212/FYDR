import { notFound } from 'next/navigation';
import Link from 'next/link';
import { InjuryMedicalForm } from '@/components/InjuryMedicalForm/InjuryMedicalForm';
import { SetAvailabilityForm } from '@/components/SetAvailabilityForm/SetAvailabilityForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchInjuryDetail, fetchInjuryClinical } from '@/lib/queries/injuries';
import { enumLabel, formatDate } from '@/lib/format';
import { requireStaff } from '@/lib/session';

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
  const { db, orgId, claims } = await requireStaff();
  const isMedical = claims.roles.includes('medical');

  const injury = await fetchInjuryDetail(db, orgId, injuryId);
  if (!injury) notFound();

  const clinical = isMedical ? await fetchInjuryClinical(db, orgId, injuryId) : null;

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
        <ThemeToggle />
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
        <p style={{ marginTop: 10 }}>
          Since {formatDate(injury.onset_date)}
          {injury.expected_return ? ` · expected back ${formatDate(injury.expected_return)}` : ''}
          {injury.actual_return ? ` · returned ${formatDate(injury.actual_return)}` : ''}
        </p>
        {injury.restrictions && injury.restrictions.length > 0 ? (
          <div className="chiprow" style={{ marginTop: 10 }}>
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
          <div style={{ marginTop: 14 }}>
            <SetAvailabilityForm
              orgId={orgId}
              userId={claims.userId}
              athleteId={injury.athlete_id}
              injuryId={injury.id}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <p className="sect" style={{ marginBottom: 8 }}>
              Edit this record
            </p>
            <InjuryMedicalForm orgId={orgId} userId={claims.userId} injury={injury} clinical={clinical} />
          </div>
        </>
      ) : (
        <div className="note" style={{ marginTop: 14 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>This is what coaching staff see.</b> Diagnosis, clinical notes and
            treatment plan are medical only and are not shown here, by design &mdash;
            not because they were left out of this page, but because this build has no
            path that would ever put them in front of a coach.
          </p>
        </div>
      )}
    </>
  );
}
