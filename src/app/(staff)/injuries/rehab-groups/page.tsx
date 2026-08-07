import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { RehabGroupBoard } from '@/components/RehabGroupBoard/RehabGroupBoard';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchRehabBoard, fetchRehabGroups } from '@/lib/queries/rehabGroups';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Rehab groups · Fydr' };

/** screens/rehab-groups.md, screen 42, cut down hard — see
 *  lib/queries/rehabGroups.ts's header for exactly what and why. Route per
 *  20-route-map.md line 99: /injuries/rehab-groups, nested under Injuries, not a
 *  sidebar destination — the provenance note at the top of the spec is explicit that
 *  this is a medical-owned secondary feature, not the headline screen (that's team
 *  allocation). Admin and athlete have no access at all, per the role table. */
export default async function RehabGroupsPage() {
  const { db, orgId, orgName, claims } = await requireStaff();
  if (!claims.roles.some((r) => r === 'coach' || r === 'medical')) {
    redirect('/injuries');
  }
  const isMedical = claims.roles.includes('medical');

  const [groups, board] = await Promise.all([fetchRehabGroups(db, orgId), fetchRehabBoard(db, orgId)]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/injuries">Injuries</Link> · Rehab groups
          </p>
          <h1>Rehab groups</h1>
        </div>
        <ThemeToggle />
      </div>

      <p className="eyebrow">Squad · {orgName}</p>

      {!isMedical ? (
        <div className="note" style={{ marginTop: 10 }}>
          <div className="note-glyph">i</div>
          <p className="note-text">
            <b>Rehab groups are managed by medical staff.</b> You see who is in which
            group and their phase, the same as their availability card, but allocating
            and setting phase is a medical decision.
          </p>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {board.members.length === 0 && groups.length === 0 ? (
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

        {groups.length > 0 || board.members.length > 0 ? (
          <RehabGroupBoard
            orgId={orgId}
            userId={claims.userId}
            groups={groups}
            members={board.members}
            canAllocate={isMedical}
          />
        ) : null}
      </div>

      <p className="cap">
        Availability, restrictions, body area and phase only &mdash; the same boundary as
        every other screen in this build. No diagnosis, no clinical notes, not even for
        medical, on this screen.
      </p>
    </>
  );
}
