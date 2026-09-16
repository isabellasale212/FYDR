import type { Viewport } from 'next';
import { BackButton } from '@/components/BackButton/BackButton';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ViewportZoom } from '@/components/ViewportZoom/ViewportZoom';
import { StaffPhoneShell } from '@/components/StaffPhoneShell/StaffPhoneShell';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilterDetailed } from '@/lib/groupFilter.server';
import { StaleGroupFilter } from '@/components/StaleGroupFilter/StaleGroupFilter';
import { fetchGroupNames, fetchGroups } from '@/lib/queries/groups';
import { fetchOpenFlagAthleteCount } from '@/lib/queries/flags';
import { attentionDomains, dashboardVersion } from '@/lib/dashboardVersion';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import { DraftHousekeeping } from '@/components/DraftHousekeeping/DraftHousekeeping';
import { addDays, todayIso, zonedTimeToUtcIso } from '@/lib/format';

/** THE ZOOM CAP, the athlete app's fix replicated (Isabella, 16 Sept 2026,
 *  the evening queue, 2.1: "the staff shell still pinch-zooms"). Served in
 *  the HTML — maximum-scale=1, user-scalable=no — where an installed app
 *  reads it at parse, and relaxed in a BROWSER TAB only by ViewportZoom
 *  (lib/viewportMeta.ts), never the reverse. Double-tap zoom is dead by
 *  touch-action: manipulation on .app (base.css), the other half. The
 *  athlete layout carries the same export and the reasoning in full;
 *  06-design-system.md §11.7 records the divergence from WCAG 1.4.4 as
 *  Isabella's call. viewport-fit=cover stays. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/** The staff web shell. Staff only, so there is no /staff prefix on any route:
 *  20-route-map.md §2.1 rule 1. */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, orgId, claims, fullName, orgName, previewingTier, tier, timezone } = await requireStaff();
  /* Draft housekeeping (decision-batch-2026-09-15-pm.md #2): the club's day,
     and how long until its next midnight, computed here in the club's zone
     so the browser's clock is never asked which day it is. */
  const today = todayIso(timezone);
  const msToMidnight = Date.parse(zonedTimeToUtcIso(addDays(today, 1), '00:00', timezone)) - Date.now();

  /* The phone title bar's group dropdown (STAFF-SS-01; a dropdown since
     15 Sept 2026, #14): the active filter as the cookie holds it (§0ak — one
     cookie, every chip row writes it), named the way the pages name it for
     the stale-filter notice. Read here, once, for the shell's first paint;
     the pages still resolve their own scope from the URL and the cookie as
     before, and the shell follows them on the client. */
  const [groups, filter] = await Promise.all([fetchGroups(db, orgId), resolveGroupFilterDetailed(undefined)]);
  const groupIds = filter.groupIds;
  const groupLabel = groupScopeLabel(groups, groupIds);
  /* PATTERN-S8 D9 + §0ak (2026-09-13): the cookie named a group that is no
     longer live (archived since it was written). The server has already
     dropped it from every scope on this request; the client below rewrites
     the cookie without it and says so once. Names read by id, archived or
     not, for the sentence. */
  const droppedNames = filter.dropped.length > 0 ? [...(await fetchGroupNames(db, orgId, filter.dropped)).values()] : [];
  /* STAFF-SS-01 C3: the Flags tab badge — distinct athletes with an open
     flag in the active group scope, the number the dashboard's attention
     panel headlines. One lean read per staff page load. The role versions
     (C2, 2026-09-13): the badge counts the domains the viewer's attention
     card counts — load only for the S&C, their own domain for the
     nutritionist — so the two numbers never disagree. */
  const flagsBadge = await fetchOpenFlagAthleteCount(db, orgId, groupIds, attentionDomains(dashboardVersion(claims.roles)));

  return (
    <div className="app">
      <ViewportZoom />
      <DraftHousekeeping today={today} msToMidnight={msToMidnight} />
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
        flagsBadge={flagsBadge}
        /* #14 (15 Sept 2026): the bar's dropdown — names only, and the ids
           the cookie holds (the label above names the same set), for the
           first paint; the shell re-reads the URL and the cookie itself. */
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        groupIds={groupIds}
      />
      <main className="main" id="main">
        <BackButton />
        {filter.dropped.length > 0 ? <StaleGroupFilter valid={filter.groupIds} droppedNames={droppedNames} scopeLabel={groupLabel} /> : null}
        {children}
      </main>
    </div>
  );
}
