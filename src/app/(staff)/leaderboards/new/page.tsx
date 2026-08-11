import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaderboardBuilderForm } from '@/components/LeaderboardBuilderForm/LeaderboardBuilderForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { fetchGroups } from '@/lib/queries/groups';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New leaderboard · Fydr' };

export default async function NewLeaderboardPage() {
  const { db, orgId, claims } = await requireStaff();
  if (!claims.roles.some((r) => r === 'coach' || r === 'medical')) {
    redirect('/leaderboards/manage');
  }

  const [catalogue, groups] = await Promise.all([fetchMetricCatalogue(db), fetchGroups(db, orgId)]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/leaderboards/manage">Leaderboard</Link> · New
          </p>
          <h1>New leaderboard</h1>
        </div>
        <ThemeToggle />
      </div>

      <LeaderboardBuilderForm orgId={orgId} userId={claims.userId} catalogue={catalogue} groups={groups} />
    </>
  );
}
