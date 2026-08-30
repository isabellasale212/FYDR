'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createTarget, type TargetScope } from '@/lib/queries/nutritionTargets';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { mdLabel, todayIso } from '@/lib/format';

type Athlete = { id: string; first_name: string; last_name: string };
type Group = { id: string; name: string };

/** Nutrition-staff-only weight-trend indicator, computed server-side in
 *  page.tsx from the same real formula /nutrition's squad grid uses
 *  (nutritionRules.ts's massTrendFlag) — see that file's own header for the
 *  formula and why this is deliberately calm, symmetric, and never shown to
 *  an athlete. Plain, already-formatted strings, not the raw computation
 *  type, since this is a client component and has no reason to re-derive it. */
export type AthleteTrendDTO = { direction: 'above' | 'below'; note: string };

type Props = {
  orgId: string;
  userId: string;
  athletes: readonly Athlete[];
  groups: readonly Group[];
  /** Medical may only ever target 'athlete' scope, and only for an athlete with an
   *  open injury — enforced for real by the RLS policy, restricted here in the UI
   *  to the common case so the form doesn't offer a control that will always be
   *  refused. */
  canPickAnyScope: boolean;
  timezone: string;
  /** Keyed by athlete id. Absent entry = nothing worth saying, same as a null
   *  massTrendFlag — most athletes will have no entry here. */
  athleteTrends?: Record<string, AthleteTrendDTO>;
};

const MD_OPTIONS = [-5, -4, -3, -2, -1, 0, 1];

export function NutritionTargetForm({ orgId, userId, athletes, groups, canPickAnyScope, timezone, athleteTrends }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<TargetScope>(canPickAnyScope ? 'org_default' : 'athlete');
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [anyDay, setAnyDay] = useState(true);
  const [mdOffset, setMdOffset] = useState(0);
  const [energyKcal, setEnergyKcal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [fluidMl, setFluidMl] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selectedTrend = athleteTrends?.[athleteId];

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        createTarget(createClient(), orgId, userId, {
        scope,
        athleteId: scope === 'athlete' ? athleteId : null,
        groupId: scope === 'group' ? groupId : null,
        mdOffset: anyDay ? null : mdOffset,
        energyKcal: energyKcal.trim() === '' ? null : Number(energyKcal),
        proteinG: proteinG.trim() === '' ? null : Number(proteinG),
        carbsG: carbsG.trim() === '' ? null : Number(carbsG),
        fatG: fatG.trim() === '' ? null : Number(fatG),
        fluidMl: fluidMl.trim() === '' ? null : Number(fluidMl),
          reason: reason.trim() || null,
          // The org's real local today, not the server's UTC clock
          // (todayIso's hardcoded Europe/London fallback).
          effectiveFrom: todayIso(timezone),
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      router.push('/nutrition');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <p className="label">Applies to</p>
        <div className="chiprow">
          {canPickAnyScope ? (
            <button
              type="button"
              className="squad-chip"
              aria-pressed={scope === 'org_default'}
              onClick={() => setScope('org_default')}
            >
              Whole squad
            </button>
          ) : null}
          {canPickAnyScope ? (
            <button
              type="button"
              className="squad-chip"
              aria-pressed={scope === 'group'}
              onClick={() => setScope('group')}
              disabled={groups.length === 0}
            >
              A group
            </button>
          ) : null}
          <button
            type="button"
            className="squad-chip"
            aria-pressed={scope === 'athlete'}
            onClick={() => setScope('athlete')}
          >
            One athlete
          </button>
        </div>
        {!canPickAnyScope ? (
          <p className="tiny" style={{ marginTop: 6 }}>
            Medical sets a personal target only, for an athlete with an open injury —
            return-to-play nutrition is a medical concern, per the role rules.
          </p>
        ) : null}
      </div>

      {scope === 'group' ? (
        <label>
          <span className="label">Group</span>
          <select className="field" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {scope === 'athlete' ? (
        <label>
          <span className="label">Athlete</span>
          <select className="field" value={athleteId} onChange={(event) => setAthleteId(event.target.value)}>
            {athletes.map((a) => {
              const trend = athleteTrends?.[a.id];
              return (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name}
                  {trend ? (trend.direction === 'above' ? ' (trending above)' : ' (trending below)') : ''}
                </option>
              );
            })}
          </select>
          {selectedTrend ? (
            <p
              className={`tiny ${selectedTrend.direction === 'above' ? 'nutr-chase-warn' : 'nutr-chase-bad'}`}
              style={{ marginTop: 6 }}
            >
              {selectedTrend.note}
            </p>
          ) : null}
        </label>
      ) : null}

      <div>
        <p className="label">Day</p>
        <div className="chiprow">
          <button type="button" className="squad-chip" aria-pressed={anyDay} onClick={() => setAnyDay(true)}>
            Any day
          </button>
          {MD_OPTIONS.map((offset) => (
            <button
              key={offset}
              type="button"
              className="squad-chip"
              aria-pressed={!anyDay && mdOffset === offset}
              onClick={() => {
                setAnyDay(false);
                setMdOffset(offset);
              }}
            >
              {mdLabel(offset)}
            </button>
          ))}
        </div>
        <p className="tiny" style={{ marginTop: 6 }}>
          A specific day overrides &ldquo;any day&rdquo; for that scope. Set &ldquo;any day&rdquo;
          first as the fallback, then add day-specific rows as needed.
        </p>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <label>
          <span className="label">Protein (g)</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min="0"
            max="400"
            value={proteinG}
            onChange={(event) => setProteinG(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Carbohydrate (g)</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min="0"
            max="1000"
            value={carbsG}
            onChange={(event) => setCarbsG(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Fat (g)</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min="0"
            max="300"
            value={fatG}
            onChange={(event) => setFatG(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Fluid (ml)</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min="0"
            max="10000"
            value={fluidMl}
            onChange={(event) => setFluidMl(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Energy (kcal)</span>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min="0"
            max="8000"
            value={energyKcal}
            onChange={(event) => setEnergyKcal(event.target.value)}
          />
        </label>
      </div>

      {scope === 'athlete' ? (
        <label>
          <span className="label">Reason (optional)</span>
          <input
            className="field"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Return to play, energy reduced during limited training"
          />
        </label>
      ) : null}

      <p className="nutr-disclaimer">
        Coach- or medical-set guidance, not a clinical or dietetic prescription. For a diagnosed
        condition, an eating concern, or return-to-play fuelling, involve a registered dietitian
        before saving.
      </p>

      <button type="submit" className="btn-primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Save target'}
      </button>
    </form>
  );
}
