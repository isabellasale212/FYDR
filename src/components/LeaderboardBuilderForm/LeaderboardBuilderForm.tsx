'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createLeaderboard, type MetricDefinition } from '@/lib/queries/leaderboards';
import type { Group } from '@/lib/queries/groups';

const WINDOWS = [
  { value: 'days', label: 'Last 28 days', days: 28 },
  { value: 'season', label: 'This season', days: null },
  { value: 'all_time', label: 'All time', days: null },
] as const;

const AGGREGATION_LABEL: Record<string, string> = {
  best: 'Best in window',
  latest: 'Latest in window',
  mean: 'Mean',
  total: 'Total',
  count: 'Count',
};

type Props = {
  orgId: string;
  userId: string;
  catalogue: MetricDefinition[];
  groups: readonly Group[];
};

/** Six steps in the spec's own builder collapse to four here: no custom window dates, no
 *  qualification-record filter beyond the metric's own default, no top-N-vs-full-ranking
 *  choice (top-N-plus-self is always on, the spec's own recommended default, O-279). The
 *  eligibility rule is exactly what makes "leaderboard -> everything" safe, so it is not
 *  simplified at all: every ineligible metric is shown, disabled, with its real reason,
 *  never hidden. */
export function LeaderboardBuilderForm({ orgId, userId, catalogue, groups }: Props) {
  const router = useRouter();
  const eligible = catalogue.filter((m) => m.leaderboard_eligible);
  const ineligible = catalogue.filter((m) => !m.leaderboard_eligible);

  const [name, setName] = useState('');
  const [metricKey, setMetricKey] = useState(eligible[0]?.key ?? '');
  const metric = catalogue.find((m) => m.key === metricKey);
  const [aggregation, setAggregation] = useState(metric?.aggregations[0] ?? 'total');
  const [populationType, setPopulationType] = useState<'squad' | 'group'>('squad');
  const [groupId, setGroupId] = useState<string | null>(groups[0]?.id ?? null);
  const [windowType, setWindowType] = useState<(typeof WINDOWS)[number]['value']>('season');
  const [visibility, setVisibility] = useState<'staff' | 'published'>('staff');
  const [error, setError] = useState<string | null>(null);
  const [showWhyDisabled, setShowWhyDisabled] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        createLeaderboard(createClient(), orgId, userId, {
          name,
          metricKey,
          aggregation,
          populationType,
          groupId: populationType === 'group' ? groupId : null,
          windowType,
          windowDays: windowType === 'days' ? 28 : null,
          visibility,
        }),
      );
      if (result.error) throw new Error(result.error);
      return result.id;
    },
    onSuccess: (id) => {
      if (id) {
        router.push(`/leaderboards/${id}`);
        return;
      }
      /* No error and no id used to do nothing at all — a silent no-op. */
      setError('That didn’t save. Try again in a moment.');
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function selectMetric(key: string) {
    setMetricKey(key);
    const next = catalogue.find((m) => m.key === key);
    setAggregation(next?.aggregations[0] ?? 'total');
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError('Give the board a name.');
    if (!metricKey) return setError('Choose a metric.');
    if (populationType === 'group' && !groupId) return setError('Choose a group.');
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <p className="label">1. Metric</p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)', flexWrap: 'wrap' }}>
        {eligible.map((m) => (
          <button
            key={m.key}
            type="button"
            className="squad-chip"
            aria-pressed={metricKey === m.key}
            onClick={() => selectMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {/* "wellness and body composition never can" was the whole of the disabled list
          until migration 0056. It still is for a Premium club, but a Basic club now sees
          the nine GPS metrics here too, disabled on plan rather than on principle — two
          genuinely different reasons, and each row states its own. The copy no longer
          claims to know which one applies. */}
      <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
        Not every metric can be ranked. Wellness and body composition never can, and some
        depend on your plan. Tap one below to see why.
      </p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)', flexWrap: 'wrap' }}>
        {ineligible.map((m) => (
          <button
            key={m.key}
            type="button"
            className="squad-chip"
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
            onClick={() => setShowWhyDisabled(m.key)}
            aria-describedby={showWhyDisabled === m.key ? `why-${m.key}` : undefined}
          >
            {m.label}
          </button>
        ))}
      </div>
      {ineligible.map((m) =>
        showWhyDisabled === m.key ? (
          <div className="note" key={m.key} id={`why-${m.key}`} role="alertdialog" style={{ marginTop: 'var(--sp-10)' }}>
            <div className="note-glyph">!</div>
            <p className="note-text">
              <b>{m.label} cannot be ranked.</b> {m.ineligible_reason}
            </p>
          </div>
        ) : null,
      )}

      <p className="label" style={{ marginTop: 'var(--sp-18)' }}>
        2. Aggregation
      </p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
        {(metric?.aggregations ?? []).map((a) => (
          <button
            key={a}
            type="button"
            className="squad-chip"
            aria-pressed={aggregation === a}
            onClick={() => setAggregation(a)}
          >
            {AGGREGATION_LABEL[a] ?? a}
          </button>
        ))}
      </div>

      <p className="label" style={{ marginTop: 'var(--sp-18)' }}>
        3. Population
      </p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
        <button
          type="button"
          className="squad-chip"
          aria-pressed={populationType === 'squad'}
          onClick={() => setPopulationType('squad')}
        >
          Whole squad
        </button>
        <button
          type="button"
          className="squad-chip"
          aria-pressed={populationType === 'group'}
          onClick={() => setPopulationType('group')}
        >
          One group
        </button>
      </div>
      {populationType === 'group' ? (
        <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="squad-chip"
              aria-pressed={groupId === g.id}
              onClick={() => setGroupId(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      ) : null}

      <p className="label" style={{ marginTop: 'var(--sp-18)' }}>
        4. Window
      </p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            className="squad-chip"
            aria-pressed={windowType === w.value}
            onClick={() => setWindowType(w.value)}
          >
            {w.label}
          </button>
        ))}
      </div>

      <p className="label" style={{ marginTop: 'var(--sp-18)' }}>
        5. Visibility
      </p>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
        <button
          type="button"
          className="squad-chip"
          aria-pressed={visibility === 'staff'}
          onClick={() => setVisibility('staff')}
        >
          Staff only
        </button>
        <button
          type="button"
          className="squad-chip"
          aria-pressed={visibility === 'published'}
          onClick={() => setVisibility('published')}
        >
          Published to athletes
        </button>
      </div>
      {visibility === 'published' ? (
        <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
          Athletes in the population will see every ranked name and value, and their own
          position. Under-18 athletes are off by default and only appear if they choose to
          be. Every athlete can leave at any time.
        </p>
      ) : null}

      <label className="label" htmlFor="lb-name" style={{ marginTop: 'var(--sp-18)' }}>
        6. Name
      </label>
      <input
        id="lb-name"
        className="field"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        placeholder="Total session load"
      />

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-18)' }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.push('/leaderboards/manage')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
