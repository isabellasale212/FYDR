import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NutritionTargetForm, type AthleteTrendDTO } from '@/components/NutritionTargetForm/NutritionTargetForm';
import { addDays, todayIso } from '@/lib/format';
import { fetchBodyCompositionForAthletes } from '@/lib/queries/bodyComposition';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { buildWorkspaceAthlete } from '@/lib/nutritionWorkspace';
import { MASS_TREND_FLAG_WINDOW_DAYS, trendFlagSentence } from '@/lib/nutritionRules';
import { requireStaff } from '@/lib/session';
import { NUTRITION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'New nutrition target · Fydr' };

export default async function NewNutritionTargetPage() {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  /* docs/access-matrix.md §3.3, New nutrition target: VC X X X VC. The only
     row in the grid where the nutritionist holds a write the coach does not.
     This gate used to admit coach or medic and refuse the nutritionist, which
     is exactly backwards now that the role exists. */
  if (!hasAnyRole(claims.roles, NUTRITION_EDIT)) {
    redirect('/nutrition');
  }

  const [athletes, groups] = await Promise.all([
    fetchSquadList(db, orgId, []),
    fetchGroups(db, orgId),
  ]);

  // Coach request (2026-08-28), same nutrition-staff-only weight-trend indicator
  // /nutrition's own squad grid shows (nutritionWorkspace.ts's buildWorkspaceAthlete,
  // nutritionRules.ts's massTrendFlag) — reused here, not reimplemented, so the two
  // screens can never disagree about who is flagged or why. Only the fields the
  // trend formula actually needs (mass history) are real; position/groupIds/checkins
  // are irrelevant to massTrendFlag and passed as harmless placeholders.
  const today = todayIso(timezone);
  /* The trend indicator's OWN window, from the constant both screens read —
   * not a hand-copied 90 and not "the same window /nutrition uses", which is
   * what this line used to claim. It stopped being true the day /nutrition got
   * a mass-trend period selector: that screen's window became whatever a coach
   * had last picked, so the two screens computed the same flag over different
   * windows and could disagree about who was flagged — the exact outcome the
   * comment below promises sharing the function prevents. Sharing the function
   * is not enough when the callers feed it different windows, so the window is
   * now shared too. See MASS_TREND_FLAG_WINDOW_DAYS in lib/nutritionRules.ts. */
  const massSince = addDays(today, -MASS_TREND_FLAG_WINDOW_DAYS);
  const massByAthlete = await fetchBodyCompositionForAthletes(
    db,
    orgId,
    athletes.map((a) => a.id),
    massSince,
  );
  const athleteTrends: Record<string, AthleteTrendDTO> = {};
  for (const a of athletes) {
    const trendFlag = buildWorkspaceAthlete({
      id: a.id,
      firstName: a.first_name,
      lastName: a.last_name,
      position: null,
      groupIds: [],
      history: massByAthlete.get(a.id) ?? [],
      /* THE ONLY FIELD THIS SCREEN READS OFF THE RESULT IS `trendFlag`, which
       * answers to `flagFrom` alone. `trendFrom` is required by the type and is
       * set to the same date purely so the unread trend fields are computed
       * over something coherent rather than over an accidental window; nothing
       * on this page renders them.
       *
       * Both are stated explicitly because buildWorkspaceAthlete deliberately
       * refuses to infer either from the rows in hand: /nutrition fetches WIDER
       * than its trend (its week navigator can reach further back than the
       * selected period), so "the oldest row present" is not the trend's first
       * day there, and every caller has to say which window it means. */
      trendFrom: massSince,
      flagFrom: massSince,
      weekStart: today,
      weekEnd: today,
      checkins: [],
      hasPersonalTargetOverride: false,
      /* Null, not fetched: the only field read off this result is `trendFlag`, and the
       * staff target range (migration 0060) feeds no part of it. Fetching it here would
       * pull a staff-only value onto a screen that has no use for it, which is the kind
       * of accidental reach the table exists to avoid. The range is set and shown on
       * the player profile and the /nutrition workspace; this screen authors MACRO
       * targets, which is a different thing. */
      targetRange: null,
    }).trendFlag;
    if (trendFlag) {
      athleteTrends[a.id] = { direction: trendFlag.direction, note: trendFlagSentence(trendFlag) };
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/nutrition">Nutrition</Link> · New target
          </p>
          <h1>New nutrition target</h1>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName}
      </p>

      <div className="card">
        <NutritionTargetForm
          orgId={orgId}
          userId={claims.userId}
          athletes={athletes}
          groups={groups}
          canPickAnyScope={hasAnyRole(claims.roles, NUTRITION_EDIT)}
          timezone={timezone}
          athleteTrends={athleteTrends}
        />
      </div>
    </>
  );
}
