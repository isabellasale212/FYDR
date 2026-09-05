import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaderboardBuilderForm } from '@/components/LeaderboardBuilderForm/LeaderboardBuilderForm';
import { fetchMetricCatalogue } from '@/lib/queries/leaderboards';
import { fetchGroups } from '@/lib/queries/groups';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'New leaderboard · Fydr' };

export default async function NewLeaderboardPage() {
  const { db, orgId, claims, tier } = await requireStaff();
  if (!claims.roles.some((r) => r === 'coach' || r === 'medic')) {
    redirect('/leaderboards/manage');
  }

  const [rawCatalogue, groups] = await Promise.all([fetchMetricCatalogue(db), fetchGroups(db, orgId)]);

  /* Tier, on the GPS metrics only. screens/leaderboards.md's own edge case 10: "GPS is
   * Premium-tier only per 00-product-overview.md." The other two GPS surfaces in this
   * app — reports/training and settings/imports — already refuse a Basic-tier org with
   * PlanGate; before migration 0056 made GPS rankable there was no third door, and now
   * there is, so it gets the same lock rather than becoming the way a Basic org reads
   * GPS data the training report withholds.
   *
   * Done by rewriting the catalogue rows rather than filtering them out, because the
   * builder already has exactly the right behaviour for a metric that cannot be picked:
   * screens/leaderboards.md "Metric picker behaviour" — "Ineligible metrics are SHOWN
   * and DISABLED, not hidden... selecting one opens EligibilityNotice with the argument
   * in plain language." A Basic-tier coach should see that GPS boards exist and what
   * they would need to rank them, not silently lack the option. No component change.
   *
   * This is a commercial gate, not an authorisation one, so a page-level check is the
   * right altitude — CLAUDE.md rule 2 is about roles, and both other GPS surfaces gate
   * at exactly this layer. It is genuinely not a server-enforced prohibition: a direct
   * PostgREST insert could still create a GPS board on a Basic org, the same hole
   * reports/training's own PlanGate has, and closing it properly needs the tier inside
   * compute_leaderboard. Named here rather than papered over. */
  const catalogue = isPremium(tier)
    ? rawCatalogue
    : rawCatalogue.map((m) =>
        m.key.startsWith('gps.')
          ? {
              ...m,
              leaderboard_eligible: false,
              ineligible_reason:
                'GPS metrics are part of the Premium plan. Your club is on Basic, so GPS ' +
                'data cannot be ranked yet — the same reason the training report and GPS ' +
                'import are unavailable. Everything else on this list still can be.',
            }
          : m,
      );

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/leaderboards/manage">Leaderboard</Link> · New
          </p>
          <h1>New leaderboard</h1>
        </div>
      </div>

      <LeaderboardBuilderForm orgId={orgId} userId={claims.userId} catalogue={catalogue} groups={groups} />
    </>
  );
}
