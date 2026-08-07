'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { createTestDefinition } from '@/lib/queries/testing';
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
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createTestDefinition(createClient(), orgId, {
        name,
        testCategory,
        unit,
        higherIsBetter,
        sideMode,
        defaultAttempts: Number(defaultAttempts) || 1,
      }),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setName('');
      setUnit('');
      router.refresh();
    },
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
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ flex: 1 }}>
          <span className="label">Unit</span>
          <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cm" />
        </label>
        <label style={{ flex: 1 }}>
          <span className="label">Attempts</span>
          <input className="field" type="number" min="1" max="10" value={defaultAttempts} onChange={(e) => setDefaultAttempts(e.target.value)} />
        </label>
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
