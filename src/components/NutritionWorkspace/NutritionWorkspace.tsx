'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  DAY_TYPES,
  RULE_BOUNDS,
  computeTargets,
  type ComputedTargets,
  type DayTypeId,
  type MacroRule,
} from '@/lib/nutritionRules';
import { scaleDay, type ScaledMeal } from '@/lib/nutritionMeals';
import {
  assignPlan,
  createPlan,
  resolveRuleForAthlete,
  ruleToMacroRule,
} from '@/lib/queries/nutritionRules';
import type { ChaseRow } from '@/lib/nutritionWorkspace';
import { RuleStepper } from './RuleStepper';
import { SelectedAthleteCard } from './SelectedAthleteCard';
import { TargetsTable, type AthleteWithTargets } from './TargetsTable';
import type { PlanDTO, RuleWithNames, UnitGroupDTO, WorkspaceAthlete } from './types';

type Props = {
  orgId: string;
  userId: string;
  isCoach: boolean;
  isMedical: boolean;
  plans: PlanDTO[];
  groupsWithoutPlan: { id: string; name: string }[];
  rules: RuleWithNames[];
  athletes: WorkspaceAthlete[];
  chaseList: ChaseRow[];
  unitGroups: UnitGroupDTO[];
  weekStart: string;
  weekEnd: string;
};

/* NUTRITION-SPEC.md §2's layout skeleton and §9's state model, adapted for real data.
 * The literal spec's `rules`/`dayType`/`sel` state (§9) maps onto:
 *   selectedPlanId  -> which real nutrition_rules row is being previewed/edited
 *   protein/carb/fat/fluid -> that plan's live-edited (unsaved until Assign) values
 *   dayType         -> the fixed multiplier applied on top, never persisted
 *   selectedAthleteId -> drives the meal card and the whole-picture card
 * One deliberate improvement over the spec's own admittedly-inert demo (see this
 * file's sibling components for the individual real-data cuts): editing the
 * selected plan's steppers only live-previews for athletes whose OWN real resolved
 * rule actually IS that plan (see athletesWithTargets below) — every other athlete
 * keeps showing their own real, currently-saved rule. The literal spec's demo has
 * only one global rule set in play at a time, so this distinction does not exist
 * there; it has to exist here because this build has more than one real plan. */
export function NutritionWorkspace({
  orgId,
  userId,
  isCoach,
  isMedical,
  plans,
  groupsWithoutPlan,
  rules,
  athletes,
  chaseList,
  unitGroups,
  weekStart,
  weekEnd,
}: Props) {
  const router = useRouter();
  const canEdit = isCoach || isMedical;

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.ruleId ?? null);
  const selectedPlan = plans.find((p) => p.ruleId === selectedPlanId) ?? plans[0] ?? null;

  const [dayType, setDayType] = useState<DayTypeId>('training');
  const dayTypeInfo = DAY_TYPES.find((d) => d.id === dayType) ?? DAY_TYPES[0]!;

  const [protein, setProtein] = useState(selectedPlan?.protein ?? RULE_BOUNDS.protein.default);
  const [carb, setCarb] = useState(selectedPlan?.carb ?? RULE_BOUNDS.carb.default);
  const [fat, setFat] = useState(selectedPlan?.fat ?? RULE_BOUNDS.fat.default);
  const [fluid, setFluid] = useState(selectedPlan?.fluid ?? RULE_BOUNDS.fluid.default);

  useEffect(() => {
    if (!selectedPlan) return;
    setProtein(selectedPlan.protein);
    setCarb(selectedPlan.carb);
    setFat(selectedPlan.fat);
    setFluid(selectedPlan.fluid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan?.ruleId]);

  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(
    chaseList[0]?.athleteId ?? athletes[0]?.id ?? null,
  );
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanGroupId, setNewPlanGroupId] = useState(groupsWithoutPlan[0]?.id ?? '');
  const [assignError, setAssignError] = useState<string | null>(null);

  const currentRule: MacroRule = useMemo(
    () => ({ proteinGPerKg: protein, carbGPerKg: carb, fatGPerKg: fat, fluidMlPerKg: fluid, energyKcalCap: selectedPlan?.energyCap ?? null }),
    [protein, carb, fat, fluid, selectedPlan],
  );

  const athletesWithTargets: AthleteWithTargets[] = useMemo(
    () =>
      athletes.map((a) => {
        const resolved = resolveRuleForAthlete(rules, a.id, a.groupIds);
        if (!resolved) return { ...a, resolvedSource: null, targets: null };
        const isPreviewed = selectedPlan !== null && resolved.rule.id === selectedPlan.ruleId;
        const macroRule = isPreviewed ? currentRule : ruleToMacroRule(resolved.rule);
        const targets = a.massKg !== null ? computeTargets(macroRule, a.massKg, dayTypeInfo.multiplier) : null;
        return { ...a, resolvedSource: resolved.source, targets };
      }),
    [athletes, rules, selectedPlan, currentRule, dayTypeInfo.multiplier],
  );

  const unitGroupsWithTargets = useMemo(() => {
    const byId = new Map(athletesWithTargets.map((a) => [a.id, a]));
    return unitGroups.map((g) => ({
      unit: g.unit,
      athletes: g.athleteIds.map((id) => byId.get(id)).filter((a): a is AthleteWithTargets => a !== undefined),
    }));
  }, [unitGroups, athletesWithTargets]);

  const selectedAthlete = athletesWithTargets.find((a) => a.id === selectedAthleteId) ?? null;
  const selectedResolved = selectedAthlete ? resolveRuleForAthlete(rules, selectedAthlete.id, selectedAthlete.groupIds) : null;
  const selectedPlanLabel = selectedResolved
    ? (plans.find((p) => p.ruleId === selectedResolved.rule.id)?.name ?? 'Personal rule')
    : 'No plan assigned';
  const selectedOverrideReason = selectedResolved?.source === 'athlete' ? selectedResolved.rule.reason : null;

  const scaledMeals: ScaledMeal[] | null =
    selectedAthlete && selectedAthlete.massKg !== null ? scaleDay(selectedAthlete.massKg, dayTypeInfo.multiplier) : null;

  const dayTotals = useMemo(() => {
    if (!scaledMeals) return null;
    return scaledMeals.reduce(
      (acc, m) => ({
        proteinG: acc.proteinG + m.totals.proteinG,
        carbG: acc.carbG + m.totals.carbG,
        fatG: acc.fatG + m.totals.fatG,
        energyKcal: acc.energyKcal + m.totals.energyKcal,
      }),
      { proteinG: 0, carbG: 0, fatG: 0, energyKcal: 0 },
    );
  }, [scaledMeals]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan) throw new Error('No plan selected.');
      return assignPlan(createClient(), orgId, userId, {
        scope: selectedPlan.scope,
        athleteId: null,
        groupId: selectedPlan.groupId,
        protein,
        carb,
        fat,
        fluid,
        energyCap: selectedPlan.energyCap,
        reason: selectedPlan.reason,
        dayType,
        dayTypeLabel: dayTypeInfo.label,
        scopeLabel: selectedPlan.name,
      });
    },
    onSuccess: (result) => {
      if (result.error) return setAssignError(result.error);
      setAssignError(null);
      router.refresh();
    },
    onError: (e: Error) => setAssignError(e.message),
  });

  const createPlanMutation = useMutation({
    mutationFn: async () => createPlan(createClient(), orgId, userId, newPlanGroupId, rules),
    onSuccess: (result) => {
      if (result.error) return setAssignError(result.error);
      setAssignError(null);
      setShowNewPlan(false);
      router.refresh();
    },
    onError: (e: Error) => setAssignError(e.message),
  });

  const exampleTargets = computeTargets(currentRule, 100, dayTypeInfo.multiplier);
  const squadMeanEnergy = (() => {
    const withTargets = athletesWithTargets.filter((a) => a.targets !== null);
    if (withTargets.length === 0) return null;
    return Math.round(withTargets.reduce((s, a) => s + (a.targets?.energyKcal ?? 0), 0) / withTargets.length);
  })();

  return (
    <div className="nutrition-workspace nutr-layout">
      <div className="nutr-rail">
        <div className="card nutr-rail-card">
          <h2 className="card-title">Plans</h2>
          <div className="nutr-plan-list">
            {plans.map((plan) => (
              <button
                key={plan.ruleId}
                type="button"
                className={`nutr-plan-item ${plan.ruleId === selectedPlanId ? 'is-selected' : ''}`}
                onClick={() => setSelectedPlanId(plan.ruleId)}
              >
                <div className="nutr-plan-name">{plan.name}</div>
                <div className="nutr-plan-sub">
                  {plan.assignedCount} athlete{plan.assignedCount === 1 ? '' : 's'}
                  {plan.overrideCount > 0 ? ` · ${plan.overrideCount} override${plan.overrideCount === 1 ? '' : 's'} active` : ''}
                </div>
              </button>
            ))}
            {plans.length === 0 ? <p className="tiny">No plans yet.</p> : null}
          </div>
          {canEdit && groupsWithoutPlan.length > 0 ? (
            <>
              <button type="button" className="btn-primary nutr-new-plan-btn" onClick={() => setShowNewPlan((s) => !s)}>
                New plan
              </button>
              {showNewPlan ? (
                <div className="nutr-new-plan-form">
                  <select
                    className="field"
                    value={newPlanGroupId}
                    onChange={(e) => setNewPlanGroupId(e.target.value)}
                  >
                    {groupsWithoutPlan.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={createPlanMutation.isPending}
                    onClick={() => createPlanMutation.mutate()}
                  >
                    Create
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="card nutr-rail-card">
          <h2 className="card-title">Day type</h2>
          <p className="tiny" style={{ marginTop: -4, marginBottom: 8 }}>
            Carbohydrate is periodised. Protein and fat hold.
          </p>
          <div className="nutr-plan-list">
            {DAY_TYPES.map((dt) => (
              <button
                key={dt.id}
                type="button"
                className={`nutr-daytype-item ${dt.id === dayType ? 'is-selected' : ''}`}
                onClick={() => setDayType(dt.id)}
              >
                <span className="nutr-daytype-name">{dt.label}</span>
                <span className="nutr-mono nutr-daytype-carb">{(carb * dt.multiplier).toFixed(1)} g/kg</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card nutr-needs-word">
          <div className="nutr-needs-head">
            <h2 className="card-title" style={{ marginBottom: 0 }}>
              Needs a word
            </h2>
            <span className="pill pill-bad">{chaseList.length} open</span>
          </div>
          {chaseList.length === 0 ? (
            <p className="tiny" style={{ marginTop: 10 }}>
              Nothing needs a word right now.
            </p>
          ) : (
            chaseList.map((row) => (
              <button
                key={row.athleteId}
                type="button"
                className="nutr-chase-row"
                onClick={() => setSelectedAthleteId(row.athleteId)}
              >
                <div className="nutr-chase-top">
                  <span className="nutr-chase-name">{row.name}</span>
                  <span className={`nutr-mono nutr-chase-value nutr-chase-${row.colour}`}>{row.value}</span>
                </div>
                <div className="nutr-chase-reason">{row.label}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="nutr-main">
        <div className="card nutr-plan-rules-card">
          <div className="nutr-card-head">
            <div>
              <div className="nutr-plan-rules-title">{selectedPlan?.name ?? 'No plan selected'}</div>
              <div className="nutr-plan-rules-sub">
                {selectedPlan
                  ? `${selectedPlan.assignedCount} athletes${selectedPlan.referenceMassKg !== null ? ` · mean mass ${selectedPlan.referenceMassKg.toFixed(1)} kg` : ''}`
                  : 'Create a plan to begin'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-ghost" disabled title="Not implemented in this pass">
                Duplicate
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!canEdit || !selectedPlan || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                {assignMutation.isPending ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>

          {assignError ? (
            <p className="form-error" role="alert">
              {assignError}
            </p>
          ) : null}
          {assignMutation.isSuccess && !assignMutation.data?.error ? (
            <p className="tiny" style={{ color: 'var(--good-text)' }}>
              Saved · {assignMutation.data.synced} target{assignMutation.data.synced === 1 ? '' : 's'} recomputed
              {assignMutation.data.skipped > 0 ? `, ${assignMutation.data.skipped} left as-is (their own personal target)` : ''}
            </p>
          ) : null}

          <div className="nutr-rule-tiles">
            <RuleStepper
              label="Protein"
              value={protein}
              unit={RULE_BOUNDS.protein.unit}
              footnote={RULE_BOUNDS.protein.footnote}
              min={RULE_BOUNDS.protein.min}
              max={RULE_BOUNDS.protein.max}
              step={RULE_BOUNDS.protein.step}
              onChange={setProtein}
              disabled={!canEdit}
            />
            <RuleStepper
              label="Carbohydrate"
              value={carb * dayTypeInfo.multiplier}
              displayValue={(carb * dayTypeInfo.multiplier).toFixed(1)}
              unit={RULE_BOUNDS.carb.unit}
              footnote={`${dayTypeInfo.label} · ${RULE_BOUNDS.carb.footnote}`}
              min={RULE_BOUNDS.carb.min}
              max={RULE_BOUNDS.carb.max}
              step={RULE_BOUNDS.carb.step}
              onChange={(next) => setCarb(Math.round((next / dayTypeInfo.multiplier) * 100) / 100)}
              disabled={!canEdit}
            />
            <RuleStepper
              label="Fat"
              value={fat}
              unit={RULE_BOUNDS.fat.unit}
              footnote={RULE_BOUNDS.fat.footnote}
              min={RULE_BOUNDS.fat.min}
              max={RULE_BOUNDS.fat.max}
              step={RULE_BOUNDS.fat.step}
              onChange={setFat}
              disabled={!canEdit}
            />
            <RuleStepper
              label="Fluid"
              value={fluid}
              unit={RULE_BOUNDS.fluid.unit}
              footnote={RULE_BOUNDS.fluid.footnote}
              min={RULE_BOUNDS.fluid.min}
              max={RULE_BOUNDS.fluid.max}
              step={RULE_BOUNDS.fluid.step}
              onChange={setFluid}
              disabled={!canEdit}
            />
          </div>

          <div className="nutr-read-line">
            <p className="nutr-read-text">
              A 100 kg athlete on this plan eats {Math.round(exampleTargets.energyKcal).toLocaleString('en-GB')} kcal,{' '}
              {Math.round(exampleTargets.proteinG)} g protein and {Math.round(exampleTargets.carbsG)} g carbohydrate on a{' '}
              {dayTypeInfo.label.toLowerCase()}.
            </p>
            <div>
              <div className="nutr-mono nutr-read-mean">
                {squadMeanEnergy !== null ? squadMeanEnergy.toLocaleString('en-GB') : '·'}
              </div>
              <div className="nutr-read-mean-label">squad mean energy</div>
            </div>
          </div>
        </div>

        <div className="card nutr-day-food-card">
          <div className="nutr-card-head">
            <div>
              <div className="nutr-plan-rules-title">The day, as food</div>
              <div className="nutr-plan-rules-sub">
                {selectedAthlete
                  ? `Portions scale with body mass, so this is ${selectedAthlete.firstName}'s day${selectedAthlete.massKg !== null ? ` at ${selectedAthlete.massKg.toFixed(1)} kg` : ''}. Pick any athlete below to reprice it.`
                  : 'Pick an athlete below to price this day.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-ghost" disabled title="Not implemented in this pass">
                Food library
              </button>
              <button type="button" className="btn-ghost" disabled title="Not implemented in this pass">
                + Meal
              </button>
            </div>
          </div>

          {selectedAthlete && dayTotals && selectedAthlete.targets ? (
            <TotalsBars dayTotals={dayTotals} targets={selectedAthlete.targets} />
          ) : null}

          {scaledMeals ? (
            <>
              <div className="nutr-meal-grid">
                {scaledMeals.map((meal) => (
                  <MealCard key={meal.name} meal={meal} />
                ))}
              </div>
              <p className="nutr-mono nutr-meal-caption">
                Five meals · authored once for a 110 kg reference athlete · the tick on each bar is the
                target, and a plan that lands within 5% is close enough to publish
              </p>
            </>
          ) : (
            <p className="tiny" style={{ marginTop: 14 }}>
              Select an athlete with a recorded weigh-in to price a day of food for them.
            </p>
          )}
        </div>

        <TargetsTable
          unitGroups={unitGroupsWithTargets}
          selectedAthleteId={selectedAthleteId}
          onSelectAthlete={setSelectedAthleteId}
        />

        <SelectedAthleteCard
          athlete={selectedAthlete}
          planLabel={selectedPlanLabel}
          weekStart={weekStart}
          weekEnd={weekEnd}
          overrideReason={selectedOverrideReason}
        />
      </div>
    </div>
  );
}

function TotalsBars({
  dayTotals,
  targets,
}: {
  dayTotals: { proteinG: number; carbG: number; fatG: number; energyKcal: number };
  targets: ComputedTargets;
}) {
  const bars = [
    { label: 'Energy', planned: dayTotals.energyKcal, target: targets.energyKcal, unit: 'kcal' },
    { label: 'Protein', planned: dayTotals.proteinG, target: targets.proteinG, unit: 'g' },
    { label: 'Carbs', planned: dayTotals.carbG, target: targets.carbsG, unit: 'g' },
    { label: 'Fat', planned: dayTotals.fatG, target: targets.fatG, unit: 'g' },
  ];
  return (
    <div className="nutr-totals-grid">
      {bars.map((bar) => {
        const pct = bar.target > 0 ? Math.min(100, (bar.planned / bar.target) * 80) : 0;
        const deltaPct = bar.target > 0 ? ((bar.planned - bar.target) / bar.target) * 100 : 0;
        const offTarget = Math.abs(deltaPct) > 5;
        return (
          <div key={bar.label}>
            <div className="nutr-totals-baseline">
              <span className="nutr-totals-label">{bar.label}</span>
              <span className={`nutr-mono nutr-totals-delta ${offTarget ? 'is-off' : ''}`}>
                {deltaPct >= 0 ? '+' : ''}
                {deltaPct.toFixed(0)}%
              </span>
            </div>
            <div className="nutr-totals-track">
              <div className={`nutr-totals-fill ${offTarget ? 'is-off' : ''}`} style={{ width: `${pct}%` }} />
              <div className="nutr-totals-tick" style={{ left: '80%' }} />
            </div>
            <div className="nutr-mono nutr-totals-detail">
              {Math.round(bar.planned).toLocaleString('en-GB')} of {Math.round(bar.target).toLocaleString('en-GB')}{' '}
              {bar.unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MealCard({ meal }: { meal: ScaledMeal }) {
  return (
    <div className="nutr-meal-card">
      <div className="nutr-meal-header">
        <span className="nutr-meal-name">{meal.name}</span>
        <span className="nutr-mono nutr-meal-time">{meal.time}</span>
      </div>
      {meal.items.map((item) => (
        <div key={item.name} className="nutr-meal-item">
          <span className="nutr-meal-item-name">{item.name}</span>
          <span className="nutr-mono nutr-meal-item-qty">
            {item.scaledQty < 10 ? item.scaledQty.toFixed(1) : Math.round(item.scaledQty)} {item.unit}
          </span>
        </div>
      ))}
      <div className="nutr-meal-macros">
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.energyKcal)}</div>
          <div className="nutr-meal-macro-label">kcal</div>
        </div>
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.proteinG)}</div>
          <div className="nutr-meal-macro-label">P</div>
        </div>
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.carbG)}</div>
          <div className="nutr-meal-macro-label">C</div>
        </div>
        <div>
          <div className="nutr-mono nutr-meal-macro-value">{Math.round(meal.totals.fatG)}</div>
          <div className="nutr-meal-macro-label">F</div>
        </div>
      </div>
    </div>
  );
}
