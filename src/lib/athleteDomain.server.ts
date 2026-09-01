import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/uuid';
import { clampPeriod, DEFAULT_RANGE, type RangeKey } from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { FydrClaims } from '@/lib/supabase/claims';
import { fetchGroups, type Db, type Group } from '@/lib/queries/groups';
import { fetchCurrentSeason, type CurrentSeason } from '@/lib/queries/schedule';
import { fetchAthlete, type AthleteProfile } from '@/lib/queries/squad';

/* The three per-athlete domain pages — /squad/[athleteId]/nutrition, /wellness
 * and /gym — open identically: the same role gate, the same athlete lookup, the
 * same group filter, the same period resolution. This is that opening, written
 * once.
 *
 * WHY A SHARED LOADER AND NOT THREE COPIES. Two of the four steps are rules,
 * not conveniences, and a rule copied three times is a rule that will be right
 * twice:
 *
 *   THE ROLE GATE. squad/[athleteId]/page.tsx checks coach-or-medical before
 *   any per-athlete query runs, because a direct link or a bookmark reaches
 *   these routes without passing the roster page's own check
 *   (01-roles-and-permissions.md §1/§2: an athlete's performance, wellness,
 *   load and injury-availability detail is admin's clearest "cannot"). These
 *   three routes are that same detail, split by domain, so they take the same
 *   gate at the same point — before the athlete row is even read. Client rule
 *   2 still holds: RLS is the authorisation, this is the screen.
 *
 *   THE GROUP FILTER. Each of these pages carries a positional comparison,
 *   which aggregates other athletes, which makes it a multi-athlete view and
 *   the global filter mandatory (CLAUDE.md §3). Resolving it here means the
 *   pages cannot forget it, and means all three read the URL-then-cookie
 *   fallback the same way.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not resolve the range, only the
 * KEY. resolveRange() needs an `earliest` anchor for `all` — the earliest
 * weigh-in, the earliest wellness entry, the earliest gym log — and that is a
 * different query on every one of these pages. Returning a range built with a
 * null anchor would quietly degrade `all` to MAX_WINDOW_DAYS on all three and
 * make the label promise more than it shows, so each page resolves its own
 * with its own anchor. */

export type AthleteDomainContext =
  | { denied: true; orgName: string }
  | {
      denied: false;
      db: Db;
      claims: FydrClaims;
      orgId: string;
      orgName: string;
      timezone: string;
      today: string;
      athlete: AthleteProfile;
      /** Every group in the org, for the GroupFilter control and for
       *  groupScopeLabel. */
      groups: Group[];
      /** The active filter, URL first and sticky cookie second. */
      groupIds: string[];
      season: CurrentSeason | null;
      /** The key that will actually be queried, after clamping to this
       *  screen's legal set. */
      periodKey: RangeKey;
      /** Non-null when the reader's own choice was illegal here and got
       *  coerced — the one case worth a sentence on screen. A coercion of a
       *  screen's own default is not the reader's business and is not
       *  reported (see squad/[athleteId]/page.tsx's own note). */
      coercedFrom: RangeKey | null;
      /** True when the period came from the URL or the cookie rather than
       *  from this screen's default. Drives PeriodSelector's `sticky`: a
       *  screen must never write its own default into the account-wide
       *  cookie. */
      expressed: boolean;
    };

export async function loadAthleteDomainContext(
  athleteId: string,
  sp: Record<string, string | string[] | undefined>,
  opts: {
    /** The keys this screen's data can honestly express. Everything else
     *  renders disabled with its reason, never hidden. */
    allowed: readonly RangeKey[];
    /** This screen's default when the reader has expressed nothing. Defaults
     *  to DEFAULT_RANGE. */
    screenDefault?: RangeKey;
  },
): Promise<AthleteDomainContext> {
  const { db, orgId, orgName, timezone, claims } = await requireStaff();

  // Same gate as /squad and squad/[athleteId], applied before any per-athlete
  // query runs.
  if (!claims.roles.includes('coach') && !claims.roles.includes('medical')) {
    return { denied: true, orgName };
  }

  /* Shape-check before any per-athlete query, for the same reason the role
     gate sits here rather than in each page: wellness, gym and nutrition all
     enter through this function, so guarding it once covers all three — and
     covers whatever the next domain screen turns out to be. A malformed id
     reached Postgres and came back as an unhandled uuid-syntax error: a 500
     on a URL that simply does not name anything. */
  if (!isUuid(athleteId)) notFound();

  const [requestedPeriod, groupIds, groups, season, athlete] = await Promise.all([
    resolvePeriod(sp),
    resolveGroupFilter(sp.groups),
    fetchGroups(db, orgId),
    fetchCurrentSeason(db, orgId),
    fetchAthlete(db, orgId, athleteId),
  ]);

  /* notFound(), not a null in the return type. An athlete id that does not
   * resolve inside this org is a 404 for every one of these three routes with
   * no per-page variation, and making each page re-handle it would be three
   * chances to render a page with an undefined subject. Same call
   * squad/[athleteId]/page.tsx already makes for the same reason. */
  if (!athlete) notFound();

  const expressed = requestedPeriod.source !== 'default';
  const requestedKey = expressed ? requestedPeriod.key : (opts.screenDefault ?? DEFAULT_RANGE);
  const period = clampPeriod(requestedKey, {
    allowed: opts.allowed,
    seasonAvailable: season !== null,
  });

  return {
    denied: false,
    db,
    claims,
    orgId,
    orgName,
    timezone,
    today: todayIso(timezone),
    athlete,
    groups,
    groupIds,
    season,
    periodKey: period.key,
    coercedFrom: expressed ? period.coercedFrom : null,
    expressed,
  };
}
