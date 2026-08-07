'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { expireTarget, type TargetWithNames } from '@/lib/queries/nutritionTargets';
import { formatDate, mdLabel } from '@/lib/format';

type Props = {
  orgId: string;
  targets: readonly TargetWithNames[];
  isCoach: boolean;
  isMedical: boolean;
};

function macroSummary(t: TargetWithNames): string {
  const parts: string[] = [];
  if (t.protein_g !== null) parts.push(`${t.protein_g}g protein`);
  if (t.carbs_g !== null) parts.push(`${t.carbs_g}g carbs`);
  if (t.fat_g !== null) parts.push(`${t.fat_g}g fat`);
  if (t.fluid_ml !== null) parts.push(`${(t.fluid_ml / 1000).toFixed(1)}L fluid`);
  if (t.energy_kcal !== null) parts.push(`${t.energy_kcal} kcal`);
  return parts.length > 0 ? parts.join(' · ') : 'No values set';
}

export function NutritionTargetsList({ orgId, targets, isCoach, isMedical }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (id: string) => expireTarget(createClient(), orgId, id),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  if (targets.length === 0) {
    return (
      <div className="card">
        <p className="tiny">No targets set yet.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="card flush">
        {targets.map((t, index) => {
          const scopeLabel = t.athlete_name ?? t.group_name ?? 'Whole squad';
          const canExpire = isCoach || (isMedical && t.athlete_id !== null);
          return (
            <div key={t.id}>
              {index > 0 ? <div className="hair" /> : null}
              <div className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <div>
                  <span className="nm">{scopeLabel}</span>
                  <div className="tiny">
                    {mdLabel(t.md_offset) ?? 'Any day'} · {macroSummary(t)}
                    {t.reason ? ` · ${t.reason}` : ''}
                  </div>
                  <div className="tiny" style={{ marginTop: 2 }}>
                    From {formatDate(t.effective_from)}
                    {t.effective_to ? ` to ${formatDate(t.effective_to)}` : ''}
                  </div>
                </div>
                <span />
                {canExpire && !t.effective_to ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => mutation.mutate(t.id)}
                    disabled={mutation.isPending}
                  >
                    Expire
                  </button>
                ) : (
                  <span />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
