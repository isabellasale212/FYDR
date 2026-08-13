'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createThreshold, type BaselineType, type ThresholdComparison } from '@/lib/queries/thresholds';
import { METRIC_REGISTRY, getMetricInfo } from '@/lib/metrics';
import type { AppRole } from '@/lib/types/database';

const COMPARISONS: { value: ThresholdComparison; label: string }[] = [
  { value: 'below', label: 'Below a value' },
  { value: 'above', label: 'Above a value' },
  { value: 'pct_change_below', label: 'Drops by a percentage' },
  { value: 'pct_change_above', label: 'Rises by a percentage' },
  { value: 'z_score', label: 'Standard deviations from average' },
];

const BASELINES: { value: BaselineType; label: string; hint: string }[] = [
  {
    value: 'personal_rolling',
    label: "The athlete's own recent average",
    hint: 'Recommended. Fires when this athlete moves away from what is normal for them.',
  },
  {
    value: 'absolute',
    label: 'A fixed number',
    hint: 'The same line for everyone. Simple, but noisy for athletes whose normal sits near it.',
  },
  {
    value: 'squad_mean',
    label: "The squad's average that day",
    hint: 'Useful for spotting who is more affected than a hard session explains.',
  },
];

const SEVERITIES = ['low', 'medium', 'high'] as const;
const NOTIFY_OPTIONS: AppRole[] = ['coach', 'medical'];
const DEFAULT_METRIC = 'wellness.readiness_score';

type Props = { orgId: string; userId: string };

export function ThresholdEditorForm({ orgId, userId }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<string>(DEFAULT_METRIC);
  const [comparison, setComparison] = useState<ThresholdComparison>('below');
  const [direction, setDirection] = useState<'below' | 'above'>('below');
  const [value, setValue] = useState('');
  const [baselineType, setBaselineType] = useState<BaselineType>('personal_rolling');
  const [baselineDays, setBaselineDays] = useState('28');
  const [consecutiveDays, setConsecutiveDays] = useState('1');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('medium');
  const [notifyRoles, setNotifyRoles] = useState<Set<AppRole>>(new Set(['coach']));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const magnitude = Number(value);
      const signedValue = comparison === 'z_score' && direction === 'below' ? -magnitude : magnitude;

      const result = await withWriteTimeout(
        createThreshold(createClient(), orgId, userId, {
          name,
          description: null,
          domain: getMetricInfo(metric).domain,
          metric,
          comparison,
          value: signedValue,
          baseline_type: baselineType,
          baseline_days: baselineType === 'absolute' ? null : Number(baselineDays),
          consecutive_days: Number(consecutiveDays),
          severity,
          notify_roles: [...notifyRoles],
        }),
      );
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      router.push('/settings/thresholds');
      router.refresh();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function toggleRole(role: AppRole) {
    setNotifyRoles((current) => {
      const next = new Set(current);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError('Give the threshold a name.');
    if (!value.trim() || Number.isNaN(Number(value))) return setError('Enter a value.');
    if (notifyRoles.size === 0) return setError('Choose who this notifies.');
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <label className="label" htmlFor="th-name">
        Name
      </label>
      <input
        id="th-name"
        className="field"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
        placeholder="Readiness drop"
      />

      <label className="label" htmlFor="th-metric" style={{ marginTop: 14 }}>
        What to watch
      </label>
      <select
        id="th-metric"
        className="field"
        value={metric}
        onChange={(event) => setMetric(event.target.value)}
      >
        {Object.entries(METRIC_REGISTRY).map(([key, info]) => (
          <option key={key} value={key}>
            {info.label}
          </option>
        ))}
      </select>

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">The rule</legend>
        <select
          className="field"
          value={comparison}
          onChange={(event) => setComparison(event.target.value as ThresholdComparison)}
          aria-label="Comparison rule"
        >
          {COMPARISONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {comparison === 'z_score' ? (
            <select
              className="field"
              style={{ flex: 1 }}
              value={direction}
              onChange={(event) => setDirection(event.target.value as 'below' | 'above')}
              aria-label="Direction"
            >
              <option value="below">Below</option>
              <option value="above">Above</option>
            </select>
          ) : null}
          <input
            className="field"
            style={{ flex: 1 }}
            type="number"
            step="0.1"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={comparison === 'z_score' ? 'Standard deviations' : 'Value'}
            aria-label={comparison === 'z_score' ? 'Threshold value in standard deviations' : 'Threshold value'}
          />
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Compare against</legend>
        {BASELINES.map((b) => (
          <label
            key={b.value}
            style={{ display: 'block', marginTop: 8, cursor: 'pointer' }}
          >
            <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <input
                type="radio"
                name="baseline"
                checked={baselineType === b.value}
                onChange={() => setBaselineType(b.value)}
              />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{b.label}</span>
            </span>
            <span className="tiny" style={{ display: 'block', marginLeft: 24 }}>
              {b.hint}
            </span>
          </label>
        ))}

        {baselineType !== 'absolute' ? (
          <div style={{ marginTop: 10 }}>
            <label className="label" htmlFor="th-baseline-days">
              Over the last (days)
            </label>
            <input
              id="th-baseline-days"
              className="field"
              type="number"
              inputMode="numeric"
              min={7}
              max={90}
              value={baselineDays}
              onChange={(event) => setBaselineDays(event.target.value)}
              style={{ maxWidth: 120 }}
            />
          </div>
        ) : null}
      </fieldset>

      <label className="label" htmlFor="th-consecutive" style={{ marginTop: 14 }}>
        For this many days running
      </label>
      <input
        id="th-consecutive"
        className="field"
        type="number"
        inputMode="numeric"
        min={1}
        max={14}
        value={consecutiveDays}
        onChange={(event) => setConsecutiveDays(event.target.value)}
        style={{ maxWidth: 120 }}
      />

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Severity</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              className="squad-chip"
              aria-pressed={severity === s}
              onClick={() => setSeverity(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Notify</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {NOTIFY_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              className="squad-chip"
              aria-pressed={notifyRoles.has(role)}
              onClick={() => toggleRole(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create threshold'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => router.push('/settings/thresholds')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
