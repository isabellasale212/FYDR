import { BackButton } from '@/components/BackButton/BackButton';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { StaffPhoneShell } from '@/components/StaffPhoneShell/StaffPhoneShell';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchOpenFlagAthleteCount } from '@/lib/queries/flags';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

/** The staff web shell. Staff only, so there is no /staff prefix on any route:
 *  20-route-map.md §2.1 rule 1. */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, orgId, claims, fullName, orgName, previewingTier, tier } = await requireStaff();

  /* The phone title bar's group chip (STAFF-SS-01): the active filter as the
     cookie holds it (§0ak — one cookie, every chip row writes it), named the
     way the pages name it. Read here, once, for the shell; the pages still
     resolve their own scope from the URL and the cookie as before. */
  const [groups, groupIds] = await Promise.all([fetchGroups(db, orgId), resolveGroupFilter(undefined)]);
  const groupLabel = groupScopeLabel(groups, groupIds);
  /* STAFF-SS-01 C3: the Flags tab badge — distinct athletes with an open
     flag in the active group scope, the number the dashboard's attention
     panel headlines. One lean read per staff page load. */
  const flagsBadge = await fetchOpenFlagAthleteCount(db, orgId, groupIds);

  return (
    <div className="app">
      <Sidebar
        roles={claims.roles}
        fullName={fullName}
        orgName={orgName}
        premium={isPremium(tier)}
        previewingTier={previewingTier}
      />
      <StaffPhoneShell
        roles={claims.roles}
        fullName={fullName}
        orgName={orgName}
        premium={isPremium(tier)}
        previewingTier={previewingTier}
        groupLabel={groupLabel}
        flagsBadge={flagsBadge}
      />
      <main className="main" id="main">
        <BackButton />
        {children}
      </main>
    </div>
  );
}
