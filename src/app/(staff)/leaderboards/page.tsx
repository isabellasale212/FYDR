import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { LeaderboardWall } from '@/components/LeaderboardWall/LeaderboardWall';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchLeaderboardWall } from '@/lib/queries/leaderboardWall';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

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
  const { db, orgId, timezone } = await requireStaff();
  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);

  const [groups, wall] = await Promise.all([
    fetchGroups(db, orgId),
    fetchLeaderboardWall(db, orgId, timezone, groupIds),
  ]);

  const activeGroupNames = groups.filter((g) => groupIds.includes(g.id)).map((g) => g.name);
  const activeGroupLabel = activeGroupNames.length > 0 ? activeGroupNames.join(' + ') : 'All squads';

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">TESTING · LATEST RESULT PER ATHLETE · {activeGroupLabel.toUpperCase()}</p>
          <h1>Leaderboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/leaderboards/manage" className="btn-ghost">
            Manage published boards →
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <p className="lbw-intro">
        Every athlete, every test, one screen. Ranked inside their own positional unit by
        default, because a hooker who is 24th in the squad on sprint speed might be the
        fastest front row you have.
      </p>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <LeaderboardWall data={wall} activeGroupLabel={activeGroupLabel} />
    </>
  );
}
