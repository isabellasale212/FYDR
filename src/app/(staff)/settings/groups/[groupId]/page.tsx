import { notFound } from 'next/navigation';
import { CLINICAL_ONLY, GROUP_EDIT, hasAnyRole } from '@/lib/access';
import Link from 'next/link';
import { GroupMemberManager } from '@/components/GroupMemberManager/GroupMemberManager';
import { GroupArchiveButton } from '@/components/GroupArchiveButton/GroupArchiveButton';
import { GroupEditForm } from '@/components/GroupEditForm/GroupEditForm';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';
import {
  fetchGroupDetail,
  fetchGroupMembers,
} from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { enumLabel, formatDate, initials } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Group · Fydr' };

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { db, orgId, timezone, claims } = await requireStaff();

  /* TWO different rules on one screen, and they are not the same question.

     EDITING THE GROUP ITSELF — its name, colour, and whether it is archived —
     is the sport scientist's and the coach's, screens 55-57. Migration 0078
     narrows groups' own policies to match; until today neither this page nor
     the database enforced it.

     MEMBERSHIP is governed separately by group_memberships, which carries a
     rehab carve-out that predates this decision: the medic may write membership
     for any group, the coach and sport scientist for any group that is not a
     rehab group. Mirrored exactly rather than replaced by GROUP_EDIT, so this
     screen never offers a control the database refuses and never hides one it
     allows. Widening or narrowing THAT rule is a separate decision nobody has
     taken. */
  const canEditGroup = hasAnyRole(claims.roles, GROUP_EDIT);

  const group = await fetchGroupDetail(db, orgId, groupId);
  if (!group) notFound();

  const [{ current, past }, squad] = await Promise.all([
    fetchGroupMembers(db, orgId, groupId),
    fetchSquadList(db, orgId, []),
  ]);

  const memberIds = new Set(current.map((m) => m.athlete_id));
  const candidates = squad
    .filter((a) => !memberIds.has(a.id))
    .map((a) => ({
      id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      position: a.position,
    }));

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings/groups">Groups</Link> · {enumLabel(group.group_type)}
          </p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GroupSwatch colour={group.colour} size={16} />
            {group.name}
          </h1>
        </div>
        {canEditGroup ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <GroupEditForm
              orgId={orgId}
              groupId={group.id}
              initialName={group.name}
              initialDescription={group.description}
              initialColour={group.colour}
            />
            <GroupArchiveButton orgId={orgId} groupId={group.id} archived={group.archived} />
          </div>
        ) : (
          /* Named, not blank. A row where controls used to be reads as a
             rendering fault; a sentence reads as a rule. */
          <span className="tiny">Groups are named and archived by the sport scientist and the coach.</span>
        )}
      </div>

      {group.archived ? (
        <div className="banner">
          <span className="g g-warn" aria-hidden="true">
            ⚠
          </span>
          <div>
            <b>Archived.</b> It no longer appears in the group filter. Restore it
            to make it selectable again; membership history is untouched either
            way.
          </div>
        </div>
      ) : null}

      {group.description ? <p className="import-sub">{group.description}</p> : null}

      <div className="stack">
        <GroupMemberManager
          orgId={orgId}
          groupId={group.id}
          current={current}
          candidates={candidates}
          timezone={timezone}
          canManage={
            group.group_type === 'rehab'
              ? hasAnyRole(claims.roles, CLINICAL_ONLY)
              : hasAnyRole(claims.roles, GROUP_EDIT) || hasAnyRole(claims.roles, CLINICAL_ONLY)
          }
        />

        <section className="card flush" aria-labelledby="past-title">
          <h2 className="card-title" id="past-title" style={{ padding: '16px 16px 8px' }}>
            Past members{' '}
            <span className="tiny num" style={{ fontWeight: 400 }}>
              {past.length}
            </span>
          </h2>
          {past.length === 0 ? (
            <p className="cap" style={{ padding: '0 16px 16px' }}>
              No athletes have been removed from this group.
            </p>
          ) : (
            past.map((member) => (
              <div
                key={`${member.athlete_id}-${member.added_at}`}
                className="todo"
                style={{ borderTop: '1px solid var(--hair)', cursor: 'default' }}
              >
                {/* .todo is a 4-column grid (38px, content, auto, 12px) —
                 *  a single-child row falls into the 38px column by implicit
                 *  grid placement, squeezing the whole line into a
                 *  one-word-per-line column. Same fix as the current-members
                 *  list above: a real .gl initials glyph fills the leading
                 *  slot instead of leaving it to grab whatever lands there. */}
                <span className="gl" aria-hidden="true">
                  {initials(member)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {member.first_name} {member.last_name}
                  </span>
                  <span className="tiny" style={{ display: 'block', marginTop: 2 }}>
                    {formatDate(member.added_at, timezone)} to {formatDate(member.removed_at, timezone)}
                  </span>
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
