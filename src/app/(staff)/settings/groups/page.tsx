import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';
import { GroupReorderButtons } from '@/components/GroupReorderButtons/GroupReorderButtons';
import { fetchAthletesInNoGroup, fetchGroupsWithCounts } from '@/lib/queries/groups';
import { enumLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Groups · Fydr' };

/** screens/groups.md, screen 21. Simplified for this pass: no membership
 *  timeline, no as-at date, no merge, no drag reorder specifically (a step
 *  reorder is built instead — GroupReorderButtons, moveGroup()'s own
 *  comment explains the distinction). What the whole app's group filter
 *  depends on — creating groups, and adding or removing members without
 *  ever losing history — is built and works. */
export default async function GroupsPage() {
  const { db, orgId, orgName } = await requireStaff();

  const [groups, noGroup] = await Promise.all([
    fetchGroupsWithCounts(db, orgId),
    fetchAthletesInNoGroup(db, orgId),
  ]);

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/settings/groups/new" className="btn-primary">
            + New group
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6 }}>
        The named subsets of the squad every screen in {orgName} filters by. Get
        these right and every other filter is right.
      </p>

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
                style={{ padding: '14px 16px 8px' }}
              >
                {enumLabel(type)} groups
                <span className="tiny mono">{rows.length}</span>
              </h2>
              {rows.map((g, index) => (
                <div
                  key={g.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderTop: '1px solid var(--hair)',
                    paddingInlineEnd: 10,
                  }}
                >
                  {rows.length > 1 ? (
                    <GroupReorderButtons
                      orgId={orgId}
                      groupId={g.id}
                      groupName={g.name}
                      canMoveUp={index > 0}
                      canMoveDown={index < rows.length - 1}
                    />
                  ) : null}
                  <Link href={`/settings/groups/${g.id}`} className="todo" style={{ flex: 1, minWidth: 0 }}>
                    <GroupSwatch colour={g.colour} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700 }}>{g.name}</span>
                      {g.description ? (
                        <span
                          className="tiny"
                          style={{ display: 'block', marginTop: 2 }}
                        >
                          {g.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="tiny mono">{g.member_count}</span>
                    <span className="chev" aria-hidden="true">
                      ›
                    </span>
                  </Link>
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
