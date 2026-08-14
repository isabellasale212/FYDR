'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import type { FlagListRow } from '@/lib/queries/flags';
import { acknowledgeFlag, dismissFlag } from '@/lib/queries/flags';
import { createClient } from '@/lib/supabase/client';
import { Pill } from '@/components/Pill/Pill';
import { SEVERITY_STATUS } from '@/lib/status';
import { enumLabel, formatDate, formatDateTime, formatTime } from '@/lib/format';

const DISMISS_REASONS = [
  'Normal for this athlete',
  'Known and expected',
  'Data error',
  'Already addressed',
  'Threshold too sensitive',
  'Other',
] as const;

type Props = {
  flag: FlagListRow;
  orgId: string;
  userId: string;
  today: string;
  timezone: string;
};

/**
 * One row on the Flags screen. screens/flags.md's card grammar, without the
 * chart and the recalibration prompt: severity, domain, who, the
 * observed-versus-expected sentence, and the two actions that matter,
 * Acknowledge and Dismiss.
 *
 * The list this renders inside comes from a server component fetch, not a
 * client-side query, so there is nothing for TanStack Query to invalidate
 * here. router.refresh() re-runs the server component and is what actually
 * shows the flag's new state, same mechanism OutboxFlusher uses after a
 * successful send.
 */
export function FlagCard({ flag, orgId, userId, today, timezone }: Props) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const acknowledge = useMutation({
    mutationFn: () => acknowledgeFlag(createClient(), flag.id, orgId, userId),
    onSuccess: () => router.refresh(),
    onError: () => setError('Could not acknowledge this flag. Try again.'),
  });

  const dismiss = useMutation({
    mutationFn: (finalReason: string) =>
      dismissFlag(createClient(), flag.id, orgId, userId, finalReason),
    onSuccess: () => {
      setDismissing(false);
      router.refresh();
    },
    onError: () => setError('Could not dismiss this flag. Try again.'),
  });

  function confirmDismiss() {
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) {
      setError(
        reason === 'Other'
          ? 'Say why this flag is not a concern.'
          : 'Choose a reason.',
      );
      return;
    }
    setError(null);
    dismiss.mutate(finalReason);
  }

  const raisedDate = flag.raised_at.slice(0, 10);
  const raisedLabel =
    raisedDate === today ? formatTime(flag.raised_at, timezone) : formatDate(flag.raised_at, timezone);

  const canAcknowledge = flag.status === 'raised' || flag.status === 'notified';

  return (
    <div className="card flag-card">
      <div className="flag-head">
        <Pill status={SEVERITY_STATUS[flag.severity]} />
        <span className="tiny">{enumLabel(flag.domain)}</span>
        {/* Escalation is history, not a transient state: a flag that went
            24h unseen stays marked after acknowledgement (the tag used to
            vanish on acknowledge — audit coach finding 21). */}
        {flag.escalated ? (
          canAcknowledge ? (
            <span className="pill pill-bad">Escalated</span>
          ) : (
            <span className="pill pill-warn">Was escalated</span>
          )
        ) : null}
        <span className="tiny mono" style={{ marginInlineStart: 'auto' }}>
          {raisedLabel}
        </span>
      </div>

      <p className="flag-who">
        <Link href={`/squad/${flag.athlete_id}`} aria-label={`View ${flag.name}'s player profile`}>
          <b>{flag.name}</b>
        </Link>
        {flag.squad_number !== null ? (
          <span className="tiny mono"> #{flag.squad_number}</span>
        ) : null}
      </p>

      <p className="flag-line">
        {flag.what}
        {flag.observed ? <span className="v mono"> {flag.observed}</span> : null}
        {flag.expected ? (
          <>
            {' '}
            vs <span className="base mono">{flag.expected}</span> expected
          </>
        ) : null}
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {dismissing ? (
        <div className="flag-dismiss">
          <label className="label" htmlFor={`reason-${flag.id}`}>
            Why is this not a concern?
          </label>
          <select
            id={`reason-${flag.id}`}
            className="field"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">Choose a reason</option>
            {DISMISS_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {reason === 'Other' ? (
            <input
              className="field"
              style={{ marginTop: 8 }}
              placeholder="Say why"
              value={otherReason}
              onChange={(event) => setOtherReason(event.target.value)}
            />
          ) : null}
          <div className="flag-actions" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={confirmDismiss}
              disabled={dismiss.isPending}
            >
              Dismiss flag
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDismissing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flag-actions">
          {canAcknowledge ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => acknowledge.mutate()}
              disabled={acknowledge.isPending}
              aria-label={`Acknowledge flag for ${flag.name}`}
            >
              {acknowledge.isPending ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          ) : (
            <span className="tiny">
              <span className="g-good" aria-hidden="true">
                ✓{' '}
              </span>
              {/* Who saw it and when — the promise the acknowledge action
                  makes ("records who saw it and when"), now kept on the
                  row itself (audit coach finding 21). */}
              Acknowledged
              {flag.acknowledged_by_name ? ` by ${flag.acknowledged_by_name}` : ''}
              {flag.acknowledged_at ? ` · ${formatDateTime(flag.acknowledged_at, timezone)}` : ''}
            </span>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setDismissing(true)}
            aria-label={`Dismiss flag for ${flag.name}`}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
