import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NutritionTargetForm, type AthleteTrendDTO } from '@/components/NutritionTargetForm/NutritionTargetForm';
import { addDays, todayIso } from '@/lib/format';
import { fetchBodyCompositionForAthletes } from '@/lib/queries/bodyComposition';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { buildWorkspaceAthlete } from '@/lib/nutritionWorkspace';
import { trendFlagSentence } from '@/lib/nutritionRules';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'New nutrition target · Fydr' };

export default async function NewNutritionTargetPage() {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  if (!isCoach && !isMedical) {
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
  const massSince = addDays(today, -90); // trailing ~13 weeks, same window /nutrition uses
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
      // This screen has no period control, so its trend window IS its fetch
      // window and there is nothing to clip. Stated explicitly because
      // buildWorkspaceAthlete now requires it: /nutrition fetches WIDER than
      // its trend (its week navigator can reach further back than the selected
      // period), so the trend's first day can no longer be inferred from the
      // rows in hand and every caller has to say which it means.
      trendFrom: massSince,
      weekStart: today,
      weekEnd: today,
      checkins: [],
      hasPersonalTargetOverride: false,
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
          canPickAnyScope={isCoach}
          timezone={timezone}
          athleteTrends={athleteTrends}
        />
      </div>
    </>
  );
}
