import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProgrammeBuilder } from '@/components/ProgrammeBuilder/ProgrammeBuilder';
import { ProgrammeStatusControl } from '@/components/ProgrammeStatusControl/ProgrammeStatusControl';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchAssignedAthletes, fetchAssignments, fetchExercises, fetchProgrammeDetail } from '@/lib/queries/programmes';
import { fetchSquadList } from '@/lib/queries/squad';
import { enumLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';

export const metadata = { title: 'Programme · Fydr' };

/** screens/programme-builder.md, screen 22, cut down hard — see
 *  lib/queries/programmes.ts's header for exactly what and why. Edit
 *  affordances are hidden for medical on a gym programme and for coach on a
 *  rehab one — a client-side courtesy; migration 0022's RLS is what actually
 *  refuses the write either way. */
export default async function ProgrammeBuilderPage({
  params,
}: {
  params: Promise<{ programmeId: string }>;
}) {
  const { programmeId } = await params;
  const { db, orgId, orgName, claims } = await requireStaff();
  /* Shape-check the route param before it reaches a query. Authenticated
     first, so this never becomes a probe; then 404 rather than 500, because a
     malformed id is a URL that does not name anything, not a server fault. */
  if (!isUuid(programmeId)) notFound();

  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');

  const detail = await fetchProgrammeDetail(db, orgId, programmeId);
  if (!detail) notFound();

  const canEdit =
    (isCoach && detail.programme.programme_type !== 'rehab') ||
    (isMedical && detail.programme.programme_type === 'rehab');

  const [exercises, assignees, assignedAthletes, athletes, groups] = await Promise.all([
    fetchExercises(db, orgId),
    fetchAssignments(db, orgId, programmeId),
    fetchAssignedAthletes(db, orgId, programmeId),
    fetchSquadList(db, orgId, []),
    fetchGroups(db, orgId),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/programmes">Gym programme</Link> · {detail.programme.name}
          </p>
          <h1>{detail.programme.name}</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="pill pill-neutral">{enumLabel(detail.programme.programme_type)}</span>
        <ProgrammeStatusControl orgId={orgId} programmeId={programmeId} status={detail.programme.status} canEdit={canEdit} />
        {detail.programme.goal ? <span className="tiny">{detail.programme.goal}</span> : null}
      </div>

      {!canEdit ? (
        <div className="note" style={{ marginBottom: 14 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            {isMedical
              ? 'Read only. This is a gym programme, coach-owned — medical reads it for context but cannot edit a coach-owned gym programme.'
              : 'Read only. This is a rehab programme, medical-owned — return-to-play authoring is a medical decision.'}
          </p>
        </div>
      ) : null}

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName}
      </p>

      {assignedAthletes.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 className="card-title">View as an athlete</h2>
          
          <div className="chiprow">
            {assignedAthletes.map((a) => (
              <Link key={a.id} href={`/programmes/${programmeId}/athlete/${a.id}`} className="squad-chip">
                {a.first_name} {a.last_name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <ProgrammeBuilder
        orgId={orgId}
        userId={claims.userId}
        programmeId={programmeId}
        programmeType={detail.programme.programme_type}
        canEdit={canEdit}
        blocks={detail.blocks}
        exercises={exercises}
        assignees={assignees}
        athletes={athletes}
        groups={groups}
      />
    </>
  );
}
