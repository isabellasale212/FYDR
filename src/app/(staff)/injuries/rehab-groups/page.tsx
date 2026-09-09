import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { RehabGroupBoard } from '@/components/RehabGroupBoard/RehabGroupBoard';
import { fetchRehabBoard, fetchRehabGroups } from '@/lib/queries/rehabGroups';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireInjuryAccess } from '@/lib/session';
import { CLINICAL_ONLY, REHAB_ALLOCATION, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Rehab groups · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/rehab-groups.md, screen 42, cut down hard — see
 *  lib/queries/rehabGroups.ts's header for exactly what and why. Route per
 *  20-route-map.md line 99: /injuries/rehab-groups, nested under Injuries, not a
 *  sidebar destination — the provenance note at the top of the spec is explicit that
 *  this is a medical-owned secondary feature, not the headline screen (that's team
 *  allocation). Admin and athlete have no access at all, per the role table.
 *
 *  CLAUDE.md §3's group filter, added per screens/rehab-groups.md line 67: "applies
 *  to the unallocated pool, not to the groups themselves" — the sibling rule to team
 *  allocation's. "Groups" here means two different things at once: the rehab groups
 *  athletes are allocated *into* (RehabGroup, from fetchRehabGroups — untouched by
 *  this filter, always shown in full) and the squad groups (Forwards, Academy, …,
 *  from fetchGroups) the filter narrows the pool *by*. Named rehabGroups/squadGroups
 *  below specifically so that distinction can't get silently crossed. */
export default async function RehabGroupsPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireInjuryAccess();
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);
  /* Allocation is wider than the medic alone: 0068 grants rehab_assignments to
     the sport scientist and the S&C too, so the screen was narrower than its own
     policy. Approved 2026-09-05. */
  const canAllocate = hasAnyRole(claims.roles, REHAB_ALLOCATION);
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [rehabGroups, board, squadGroups] = await Promise.all([
    fetchRehabGroups(db, orgId),
    fetchRehabBoard(db, orgId),
    fetchGroups(db, orgId),
  ]);

  const poolFilterIds = groupIds.length > 0 ? await fetchGroupAthleteIds(db, orgId, groupIds) : null;
  const filteredMembers = poolFilterIds
    ? board.members.filter((m) => m.group_id !== null || poolFilterIds.includes(m.athlete_id))
    : board.members;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/injuries">Injuries</Link> · Rehab groups
          </p>
          <h1>Rehab groups</h1>
        </div>
      </div>

      <p className="eyebrow">{groupScopeLabel(squadGroups, groupIds)} · {orgName}</p>

      <div style={{ margin: '10px 0' }}>
        <GroupFilter groups={squadGroups} selected={groupIds} />
      </div>

      {!isMedical ? (
        <div className="note" style={{ marginTop: 'var(--sp-10)' }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>Rehab groups are managed by medical staff.</b> You see who is in which
            group and their phase, the same as their availability card, but allocating
            and setting phase is a medical decision.
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 'var(--sp-14)' }}>
        {board.members.length === 0 && rehabGroups.length === 0 ? (
          <EmptyState
            title="No rehab groups yet"
            body={
              isMedical
                ? 'Rehab groups let injured athletes train together under a shared phase. Create one in Groups (group type “rehab”) to get started.'
                : 'No rehab groups have been created.'
            }
          />
        ) : board.members.length === 0 ? (
          <EmptyState
            title="No athletes in rehabilitation"
            body="The squad is fully available. Groups still exist below, ready for when they're needed."
          />
        ) : null}

        {rehabGroups.length > 0 || board.members.length > 0 ? (
          <RehabGroupBoard
            orgId={orgId}
            userId={claims.userId}
            groups={rehabGroups}
            members={filteredMembers}
            canAllocate={canAllocate}
            timezone={timezone}
          />
        ) : null}
      </div>

      {/* THE BOUNDARY IS NOT THE SAME ON EVERY SCREEN, and this caption used to
          say it was. It sat next to team-allocation's, which claimed the same
          sameness while listing different fields — so one of them had to be
          wrong. Checked against the queries rather than the prose: rehabGroups.ts
          really does return availability, restrictions, body_area and phase (and
          this board EDITS phase), which 28-rehab-groups.md sanctions as "the
          limited injury view". team-allocation returns availability alone. Both
          field lists were fine; the "same as every other screen" clause was the
          falsehood, in both.

          THEN THE BOARD ITSELF DISAGREED WITH THIS CAPTION TOO. The first
          correction kept "restrictions", because rehabGroups.ts returns them —
          but RehabGroupBoard never renders them (0 references to
          member.restrictions), while it does render `side` and `expected_return`,
          which the caption did not mention. Fetched is not shown. This now names
          what the row actually draws, and the guard checks the caption against
          the BOARD as well as the query for exactly this reason.

          THE GAP BEHIND IT IS NOW CLOSED. 28-rehab-groups.md always said the
          coach sees "body area, restrictions and expected return", and the row
          never drew restrictions — `git log -S "restrictions"` on the board
          returns no commits, so nothing ever decided to leave them off. Isabella
          decided on 2026-09-09 to render them, and the row now does, so this
          caption names them again. */}
      <p className="cap">
        Availability, body area and side, restrictions, expected return, and rehab phase
        &mdash; the limited injury view a shared phase cannot be managed without. No
        diagnosis, no clinical notes, not even for medical, on this screen.
      </p>
    </>
  );
}
