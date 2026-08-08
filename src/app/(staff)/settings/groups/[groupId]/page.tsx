import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GroupMemberManager } from '@/components/GroupMemberManager/GroupMemberManager';
import { GroupArchiveButton } from '@/components/GroupArchiveButton/GroupArchiveButton';
import { GroupEditForm } from '@/components/GroupEditForm/GroupEditForm';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import {
  fetchGroupDetail,
  fetchGroupMembers,
} from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { enumLabel, formatDate } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Group · Fydr' };

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { db, orgId } = await requireStaff();

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <GroupEditForm
            orgId={orgId}
            groupId={group.id}
            initialName={group.name}
            initialDescription={group.description}
            initialColour={group.colour}
          />
          <GroupArchiveButton orgId={orgId} groupId={group.id} archived={group.archived} />
          <ThemeToggle />
        </div>
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
        />

        <section className="card flush" aria-labelledby="past-title">
          <h2 className="card-title" id="past-title" style={{ padding: '16px 16px 8px' }}>
            Past members{' '}
            <span className="tiny mono" style={{ fontWeight: 400 }}>
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
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {member.first_name} {member.last_name}
                  </span>
                  <span className="tiny" style={{ display: 'block', marginTop: 2 }}>
                    {formatDate(member.added_at)} to {formatDate(member.removed_at)}
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
