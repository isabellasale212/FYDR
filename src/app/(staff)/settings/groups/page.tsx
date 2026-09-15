import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';
import { GroupRowActions } from '@/components/GroupRowActions/GroupRowActions';
import { GroupReorderButtons } from '@/components/GroupReorderButtons/GroupReorderButtons';
import { fetchAthletesInNoGroup, fetchGroupsWithCounts } from '@/lib/queries/groups';
import { enumLabel } from '@/lib/format';
import { GROUP_EDIT, hasAnyRole } from '@/lib/access';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Groups · Fydr' };

/** screens/groups.md, screen 21. Simplified for this pass: no membership
 *  timeline, no as-at date, no merge, no drag reorder specifically (a step
 *  reorder is built instead — GroupReorderButtons, moveGroup()'s own
 *  comment explains the distinction). What the whole app's group filter
 *  depends on — creating groups, and adding or removing members without
 *  ever losing history — is built and works. */
export default async function GroupsPage() {
  const { db, orgId, claims } = await requireStaff();

  const [groups, noGroup] = await Promise.all([
    fetchGroupsWithCounts(db, orgId),
    fetchAthletesInNoGroup(db, orgId),
  ]);

  const canEditGroups = hasAnyRole(claims.roles, GROUP_EDIT);

  const sections = new Map<string, typeof groups>();
  for (const g of groups) {
    const list = sections.get(g.group_type) ?? [];
    list.push(g);
    sections.set(g.group_type, list);
  }

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/squad">Squad overview</Link> · Groups
          </p>
          <h1>Groups</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          {/* Screens 55-57: creating a group is the sport scientist's and the
              coach's. Hiding the link is the courtesy; /settings/groups/new
              turns the other three away itself, and 0078 is what actually
              refuses the write. */}
          {canEditGroups ? (
            <Link href="/settings/groups/new" className="btn-primary">
              + New group
            </Link>
          ) : null}
        </div>
      </div>

      

      {/* The "Team selections" signpost that stood here — teams are a separate
          table, never a group type (migration 0001, 04-data-model.md §17.13),
          and the weekly selection is /injuries/team-allocation — moved off
          this page on 16 Sept 2026 (Isabella's overnight queue, 3.4): team
          selection is the dashboard's Match tab, the coach's, for selecting
          on match days. The reasoning about groups versus teams stands and
          is repeated on that page. */}

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          body="Groups filter every squad screen. Most clubs start with positional groups: forwards, backs."
        />
      ) : (
        <div className="stack">
          {[...sections.entries()].map(([type, rows]) => (
            <section className="card flush" key={type} aria-labelledby={`sec-${type}`}>
              <h2
                className="sect"
                id={`sec-${type}`}
                style={{ padding: 'var(--s-7) var(--s-8) var(--s-4)' }}
              >
                {enumLabel(type)} groups
                <span className="tiny num">{rows.length}</span>
              </h2>
              {rows.map((g, index) => (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--sp-8)',
                    borderTop: '1px solid var(--hair)',
                    paddingInlineEnd: 'var(--s-5)',
                  }}
                >
                  {/* §0az: the arrows render for every role; a role outside
                      GROUP_EDIT gets them blocked with the reason on tap,
                      and moveGroup refuses out loud if the policy filters
                      the write anyway. The row wraps so the reason takes a
                      full line beneath the group. */}
                  {rows.length > 1 ? (
                    <GroupReorderButtons
                      orgId={orgId}
                      groupId={g.id}
                      groupName={g.name}
                      canMoveUp={index > 0}
                      canMoveDown={index < rows.length - 1}
                      canEdit={canEditGroups}
                    />
                  ) : null}
                  <Link href={`/settings/groups/${g.id}`} className="todo" style={{ flex: 1, minWidth: 0 }}>
                    <GroupSwatch colour={g.colour} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--w-bold)' }}>{g.name}</span>
                      {g.description ? (
                        <span
                          className="tiny"
                          style={{ display: 'block', marginTop: 'var(--sp-2)' }}
                        >
                          {g.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="tiny num">{g.member_count}</span>
                    <span className="chev" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                  {/* 3.4 (16 Sept 2026): Edit and Remove on every row. */}
                  <GroupRowActions orgId={orgId} groupId={g.id} name={g.name} groupType={g.group_type} members={g.member_count} canEdit={canEditGroups} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <p className="cap">
        <b>{groups.length}</b> group{groups.length === 1 ? '' : 's'}.{' '}
        {noGroup.length > 0 ? (
          <>
            <b>{noGroup.length}</b> athlete{noGroup.length === 1 ? '' : 's'} in no
            group: {noGroup.map((a) => `${a.first_name} ${a.last_name}`).join(', ')}.
          </>
        ) : (
          'Every athlete is in at least one group.'
        )}
      </p>
    </>
  );
}
