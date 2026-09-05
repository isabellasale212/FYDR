import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { LeaderboardWall } from '@/components/LeaderboardWall/LeaderboardWall';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchLeaderboardWall } from '@/lib/queries/leaderboardWall';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

/* Renamed from "Testing wall". That name was accurate when every board came
 * from test_results; the wall now ranks GPS and wellness too, and the design
 * ("Fydr Leaderboard.dc.html") titles the screen Leaderboard, which is also
 * what the sidebar row has always said. */
export const metadata = { title: 'Leaderboard · Fydr' };

/** LEADERBOARD-SPEC.md's testing wall — the real content of the bare /leaderboards
 *  route now. A different feature from the real, staff-configured, consent-gated
 *  single-metric board system (moved to /leaderboards/manage, untouched in
 *  substance): this is staff-only, read-only, no opt-out, and never reaches an
 *  athlete. See src/lib/queries/leaderboardWall.ts's own header for exactly what's
 *  real, what's cut, and what's a documented placeholder in the nine boards below.
 *
 *  CLAUDE.md §3: this screen ranks the whole squad at once, so it needs the real,
 *  global group filter — and per LEADERBOARD-SPEC.md §2, unlike the older board
 *  detail page, the filter here genuinely re-ranks every board inside the filtered
 *  pool rather than hiding rows after an unfiltered rank, because the wall computes
 *  every rank fresh on every request instead of reading a persisted squad-wide
 *  position. */
export default async function LeaderboardWallPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, orgId, orgName, timezone, claims } = await requireStaff();

  // docs/20-route-map.md §2.3/§3: the wall's own roles list is
  // `coach, medical, admin`, with a role_note — "board and participant
  // counts only, no names against values" — and 01-roles-and-permissions.md
  // §2 gives admin `A` (aggregate) rather than `no` for "View leaderboards".
  // That aggregate-only rendering doesn't exist in this build: the wall is
  // LeaderboardWall, a named-athlete ranking per test, full stop, the same
  // gap reports.tsx documents in its own header ("no aggregate-only view
  // built to show them instead"). So admin is denied the wall's content
  // here, same as every other named-athlete screen — but unlike /flags,
  // the sidebar keeps this row for admin (matching the doc's own sidebar
  // array), because /leaderboards/manage genuinely is admin-relevant
  // (board configuration: name, metric, population, window, publish state
  // — never a named result) and is reachable from here. See that page's
  // own header for the other half of this split.
  const hasAccess = claims.roles.includes('coach') || claims.roles.includes('medic');
  if (!hasAccess) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">TESTING · GPS · WELLNESS · {orgName}</p>
            <h1>Leaderboard</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/leaderboards/manage" className="btn-ghost">
              Manage published boards →
            </Link>
          </div>
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            The leaderboard ranks every athlete, by name, against every board. Admin
            manages the club and does not read athlete performance data &mdash; see
            01-roles-and-permissions.md §1. Board management, which never shows a named
            result, is still open above.
          </p>
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);

  const [groups, wall] = await Promise.all([
    fetchGroups(db, orgId),
    fetchLeaderboardWall(db, orgId, timezone, groupIds),
  ]);

  const activeGroupLabel = groupScopeLabel(groups, groupIds);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          {/* The design's eyebrow names its three families; ours names the three
              this build actually has. "Gym" is deliberately not claimed — the
              strength boards here are test_results, not gym_set_logs. */}
          <p className="eyebrow">TESTING · GPS · WELLNESS · LATEST RESULT PER ATHLETE · {activeGroupLabel.toUpperCase()}</p>
          <h1>Leaderboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/leaderboards/manage" className="btn-ghost">
            Manage published boards →
          </Link>
        </div>
      </div>

      {/* The intro paragraph is gone per review. The scope it explained is a
          live control on the wall below and reads on every row; the sentence
          was an argument for a default the reader can already see and change. */}

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <LeaderboardWall data={wall} activeGroupLabel={activeGroupLabel} />
    </>
  );
}
