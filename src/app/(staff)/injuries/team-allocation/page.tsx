import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PublishWeekButton } from '@/components/PublishWeekButton/PublishWeekButton';
import { TeamAllocationBoard } from '@/components/TeamAllocationBoard/TeamAllocationBoard';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchTeams, fetchWeekBoard } from '@/lib/queries/teamAllocation';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Team allocation · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/team-allocation.md, screen 14, cut down hard — see
 *  lib/queries/teamAllocation.ts's header for exactly what and why. Route per
 *  20-route-map.md line 100, nested under /injuries because availability drives
 *  the allocation, the same reasoning the spec itself gives for putting this
 *  screen off the injury dashboard rather than its own top-level page. Admin has
 *  no access at all, per the role table — this page redirects them, same
 *  treatment as every other role boundary in this build. */
export default async function TeamAllocationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  if (!claims.roles.some((r) => r === 'coach' || r === 'medical')) {
    redirect('/injuries');
  }
  const isCoach = claims.roles.includes('coach');

  const params = await searchParams;
  const today = todayIso(timezone);
  const requestedDate = typeof params.week === 'string' ? params.week : today;
  const weekStart = mondayOf(requestedDate);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const weekEnd = addDays(weekStart, 6);

  const [teams, board] = await Promise.all([fetchTeams(db, orgId), fetchWeekBoard(db, orgId, weekStart)]);
  const draftCount = board.allocations.filter((a) => a.status === 'draft').length;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/injuries">Injuries</Link> · Team allocation
          </p>
          <h1>Team allocation</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isCoach ? <PublishWeekButton orgId={orgId} userId={claims.userId} weekStart={weekStart} draftCount={draftCount} /> : null}
          <ThemeToggle />
        </div>
      </div>

      <p className="eyebrow">Squad · {orgName}</p>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Link href={`/injuries/team-allocation?week=${prevWeek}`} className="btn-ghost" aria-label="Previous week">
          ‹ Previous
        </Link>
        <span className="nm mono">
          {formatDate(weekStart)} to {formatDate(weekEnd)}
        </span>
        <Link href={`/injuries/team-allocation?week=${nextWeek}`} className="btn-ghost" aria-label="Next week">
          Next ›
        </Link>
      </div>

      {!isCoach ? (
        <div className="note" style={{ marginTop: 14 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>Read only.</b> Medical sees the whole board and every availability status,
            and can change an athlete&rsquo;s availability from their own record, but
            cannot allocate or publish &mdash; that is a coach decision.
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <TeamAllocationBoard
          orgId={orgId}
          userId={claims.userId}
          weekStart={weekStart}
          teams={teams}
          board={board}
          canAllocate={isCoach}
        />
      </div>

      <p className="cap">
        Availability, restrictions and body area only &mdash; the same boundary as every
        other screen in this build. No diagnosis, no clinical notes, not even for
        medical, on this screen.
      </p>
    </>
  );
}
