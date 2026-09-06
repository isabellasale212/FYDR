import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupSwatch } from '@/components/GroupSwatch/GroupSwatch';
import { GroupReorderButtons } from '@/components/GroupReorderButtons/GroupReorderButtons';
import { fetchAthletesInNoGroup, fetchGroupsWithCounts } from '@/lib/queries/groups';
import { fetchTeams } from '@/lib/queries/teamAllocation';
import { enumLabel } from '@/lib/format';
import { GROUP_EDIT, SESSION_EDIT, hasAnyRole } from '@/lib/access';
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

  const [groups, noGroup, teams] = await Promise.all([
    fetchGroupsWithCounts(db, orgId),
    fetchAthletesInNoGroup(db, orgId),
    fetchTeams(db, orgId),
  ]);

  /* The comment here used to say team allocation "redirects anyone who is not
   * coach or medical", and justified this link's condition by that. It stopped
   * being true when that page moved to SESSION_EDIT: the link was then hidden
   * from the sport scientist, who may allocate, and offered to the medic, who
   * may not. Reading the destination's gate rather than describing it is what
   * keeps the two from drifting again. Hiding UI only, CLAUDE.md rule 2. */
  const canAllocate = hasAnyRole(claims.roles, SESSION_EDIT);
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
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

      

      {/* "Different team selections."
        *
        * This is a signpost, not a new concept, and that is a deliberate
        * decision rather than a shortcut. A weekly team selection already
        * exists in this build, in full: the `teams` table (migration 0003)
        * and `team_allocations` with its draft/published states, surfaced at
        * /injuries/team-allocation. Building a second selection concept here
        * would have meant two places a team is defined and two answers to
        * "who is in the 1st XV this week".
        *
        * The obvious alternative — a new group_type value such as 'team' or
        * 'selection' — is explicitly ruled out by a recorded decision, not
        * merely by preference: migration 0001 states "04-data-model.md
        * §17.13 is explicit that group_type does not gain a 'team' value.
        * Teams are a separate table so there is exactly one place a team is
        * defined", and migration 0003 gives the modelling reason — an
        * athlete is in Forwards and S&C Group A and Under 20 all at once,
        * but plays for exactly one team on a given weekend, and that
        * exclusivity cannot be expressed on group_memberships. Groups are
        * many-per-athlete and standing; a selection is one-per-athlete and
        * weekly. CLAUDE.md §1 says to stop and say so rather than contradict
        * a recorded decision, so this contradicts nothing and points at what
        * is already there.
        *
        * This also keeps CLAUDE.md rule 7 intact: the global group filter
        * keeps exactly one vocabulary. Teams deliberately do not enter it
        * (team-allocation.md's O-808, recorded as cut in
        * lib/queries/teamAllocation.ts), and adding a selection-shaped group
        * type here would have quietly created the second parallel filtering
        * concept that rule exists to prevent. */}
      <section className="card" aria-labelledby="teams-title" style={{ marginBottom: 14 }}>
        <h2 className="card-title" id="teams-title">
          Team selections
        </h2>
        

        {teams.length > 0 ? (
          <p className="cap" style={{ marginTop: 8 }}>
            {teams.length} team{teams.length === 1 ? '' : 's'} set up: {teams.map((t) => t.name).join(', ')}.
          </p>
        ) : (
          <p className="cap" style={{ marginTop: 8 }}>
            No teams are set up yet, so there is nothing to select into. Teams are standing squads
            such as 1st XV, 2nd XV or Colts.
          </p>
        )}

        {canAllocate ? (
          <div style={{ marginTop: 10 }}>
            <Link href="/injuries/team-allocation" className="btn-ghost">
              Open team allocation →
            </Link>
          </div>
        ) : (
          <p className="cap" style={{ marginTop: 10 }}>
            Selecting teams is a coach decision, with medical able to see the board. It is not part
            of your role.
          </p>
        )}
      </section>

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
                <span className="tiny num">{rows.length}</span>
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
                    <span className="tiny num">{g.member_count}</span>
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
