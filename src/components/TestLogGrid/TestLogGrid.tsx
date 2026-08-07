'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { logAttempt, type AthleteForLogging } from '@/lib/queries/testing';
import type { SideMode } from '@/lib/types/database';

type Props = {
  orgId: string;
  userId: string;
  testDefinitionId: string;
  testDate: string;
  defaultAttempts: number;
  sideMode: SideMode;
  decimalPlaces: number;
  unit: string;
  athletes: readonly AthleteForLogging[];
};

const SIDES = ['left', 'right'] as const;

export function TestLogGrid({ orgId, userId, testDefinitionId, testDate, defaultAttempts, sideMode, decimalPlaces, unit, athletes }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (input: { athleteId: string; attemptNumber: number; value: number; side: 'left' | 'right' | null }) =>
      logAttempt(createClient(), orgId, userId, {
        athleteId: input.athleteId,
        testDefinitionId,
        testDate,
        attemptNumber: input.attemptNumber,
        value: input.value,
        side: input.side,
      }),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  function attemptSlots(): Array<{ attempt: number; side: 'left' | 'right' | null }> {
    if (sideMode === 'bilateral') {
      return Array.from({ length: defaultAttempts }, (_, i) => ({ attempt: i + 1, side: null }));
    }
    const slots: Array<{ attempt: number; side: 'left' | 'right' | null }> = [];
    for (let i = 1; i <= defaultAttempts; i += 1) {
      for (const side of SIDES) slots.push({ attempt: i, side });
    }
    return slots;
  }

  const slots = attemptSlots();

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="card flush">
        {athletes.map((a, index) => (
          <div key={a.athlete_id}>
            {index > 0 ? <div className="hair" /> : null}
            <div style={{ padding: '10px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Link href={`/testing/${testDefinitionId}/${a.athlete_id}`} className="nm" style={{ flex: 1 }}>
                  {a.first_name} {a.last_name}
                </Link>
                {a.pbValue !== null ? (
                  <span className="tiny mono">
                    PB {a.pbValue.toFixed(decimalPlaces)}
                    {unit}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {slots.map((slot) => {
                  const key = `${a.athlete_id}:${slot.attempt}:${slot.side ?? 'b'}`;
                  const existing = a.attempts.find((x) => x.attempt_number === slot.attempt && (x.side ?? null) === slot.side);
                  const draft = drafts[key] ?? (existing ? String(existing.value) : '');
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="tiny" style={{ textAlign: 'center' }}>
                        {slot.side ? `${slot.side.charAt(0).toUpperCase()}${slot.attempt}` : slot.attempt}
                      </span>
                      <input
                        className="field mono"
                        style={{
                          width: 64,
                          padding: '6px 4px',
                          textAlign: 'center',
                          borderColor: existing?.is_best ? 'var(--good)' : undefined,
                        }}
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                        onBlur={() => {
                          const num = Number(draft);
                          if (draft.trim() === '' || Number.isNaN(num)) return;
                          if (existing && existing.value === num) return;
                          mutation.mutate({ athleteId: a.athlete_id, attemptNumber: slot.attempt, value: num, side: slot.side });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="tiny">
        Best attempt per athlete, per side, is marked automatically (green outline) — highest or
        lowest depending on the test&rsquo;s own direction. Tap a name for history and to mark a
        different attempt best by hand.
      </p>
    </div>
  );
}
