'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createTestDefinition } from '@/lib/queries/testing';
import { humanizeDbError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import type { SideMode, TestCategory } from '@/lib/types/database';
import { enumLabel } from '@/lib/format';

const CATEGORIES: TestCategory[] = ['strength', 'power', 'speed', 'endurance', 'mobility', 'body_comp', 'skill'];

export function TestDefinitionForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [testCategory, setTestCategory] = useState<TestCategory>('power');
  const [unit, setUnit] = useState('');
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const [sideMode, setSideMode] = useState<SideMode>('bilateral');
  const [defaultAttempts, setDefaultAttempts] = useState('3');
  const [decimalPlaces, setDecimalPlaces] = useState('1');
  const [protocol, setProtocol] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        createTestDefinition(createClient(), orgId, {
          name,
          testCategory,
          unit,
          higherIsBetter,
          sideMode,
          defaultAttempts: Number(defaultAttempts) || 1,
          decimalPlaces: Number(decimalPlaces) || 0,
          protocol,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(humanizeDbError(result.error, 'staff'));
      setError(null);
      setName('');
      setUnit('');
      setProtocol('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !unit.trim()) return setError('Name and unit are both required.');
        setError(null);
        mutation.mutate();
      }}
    >
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <label>
        <span className="label">Name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="CMJ height" />
      </label>
      <label>
        <span className="label">Category</span>
        <select className="field" value={testCategory} onChange={(e) => setTestCategory(e.target.value as TestCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {enumLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Protocol (optional)</span>
        <textarea
          className="field"
          rows={2}
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          placeholder="How to run it — setup, equipment, what counts as a valid attempt. Shown to whoever logs results."
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1 }}>
          <span className="label">Unit</span>
          <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cm" />
        </label>
        <label style={{ flex: 1 }}>
          <span className="label">Decimal places</span>
          <input className="field" type="number" inputMode="numeric" min="0" max="3" value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          <span className="label">Attempts</span>
          <input className="field" type="number" inputMode="numeric" min="1" max="10" value={defaultAttempts} onChange={(e) => setDefaultAttempts(e.target.value)} />
        </label>
        {/* Audit finding 40: nowhere explained what logging N attempts
         * actually computes. It's real behaviour, not a guess — the
         * server-side mark_best_attempt trigger (migration 0024, fixed in
         * 0025) always keeps exactly one is_best = true row per athlete,
         * date and side: whichever attempt is highest (or lowest, per
         * "Direction" below), never a mean of the N. */}
        <p className="tiny" style={{ color: 'var(--muted)', marginTop: 4 }}>
          Athletes get up to this many tries per session. The best one (per
          the direction below) is kept as that session&rsquo;s result —
          attempts are never averaged.
        </p>
      </div>
      <div>
        <p className="label">Direction</p>
        <div className="chiprow">
          <button type="button" className="squad-chip" aria-pressed={higherIsBetter} onClick={() => setHigherIsBetter(true)}>
            Higher is better
          </button>
          <button type="button" className="squad-chip" aria-pressed={!higherIsBetter} onClick={() => setHigherIsBetter(false)}>
            Lower is better
          </button>
        </div>
      </div>
      <div>
        <p className="label">Sides</p>
        <div className="chiprow">
          <button type="button" className="squad-chip" aria-pressed={sideMode === 'bilateral'} onClick={() => setSideMode('bilateral')}>
            One value
          </button>
          <button type="button" className="squad-chip" aria-pressed={sideMode === 'per_side'} onClick={() => setSideMode('per_side')}>
            Left and right
          </button>
        </div>
      </div>
      {testCategory === 'body_comp' ? (
        <p className="tiny">Body composition tests are never leaderboard eligible, automatically.</p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Adding…' : 'Add test'}
      </button>
    </form>
  );
}
