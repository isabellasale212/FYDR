'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import type { ProfileFlag } from '@/lib/queries/playerProfile';
import { acknowledgeFlag } from '@/lib/queries/flags';
import { createClient } from '@/lib/supabase/client';
import { enumLabel, formatDate, formatDateTime, formatTime } from '@/lib/format';

type Props = {
  flags: ProfileFlag[];
  orgId: string;
  userId: string;
  today: string;
  timezone: string;
};

const TONE_VAR: Record<'high' | 'medium' | 'low', string> = {
  high: 'var(--bad)',
  medium: 'var(--warn)',
  low: 'var(--accent)',
};

/* PLAYER-PROFILE-SPEC.md §8. The Flags card: open ones shown and actionable,
 * already-acknowledged ones collapsed behind "Show acknowledged (n)" per
 * §11's behaviour spec ("Acknowledge — toggles ack[flagId], which drives
 * the item's opacity, the button's label and fill, and the {n} open count
 * in the header"). No Dismiss action here — the spec's own card only draws
 * Acknowledge; Dismiss (with its mandatory reason) stays on the dedicated
 * Flags screen, which this card's "Thresholds ›" link's sibling nav already
 * reaches. */
export function PlayerProfileFlags({ flags, orgId, userId, today, timezone }: Props) {
  const router = useRouter();
  const [showAcked, setShowAcked] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optional note at acknowledgement, additive to §11's own spec (see this file's own
  // header comment) — migration 0046's flags.staff_note, surfaced athlete-side by
  // my-data.md's "with the staff note, if any". One item open at a time, matching this
  // card's existing single-pendingId pattern above rather than a per-row Set.
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const acknowledge = useMutation({
    mutationFn: ({ flagId, note }: { flagId: string; note?: string }) =>
      acknowledgeFlag(createClient(), flagId, orgId, userId, note),
    onMutate: ({ flagId }) => setPendingId(flagId),
    onSuccess: () => {
      setPendingId(null);
      setNoteDraftId(null);
      setNoteText('');
      router.refresh();
    },
    onError: () => {
      setPendingId(null);
      setError('Could not acknowledge this flag. Try again.');
    },
  });

  const unacknowledged = flags.filter((f) => f.status === 'raised' || f.status === 'notified');
  const acknowledged = flags.filter((f) => f.status === 'acknowledged' || f.status === 'monitoring');
  const visible = showAcked ? flags : unacknowledged;

  return (
    <section className="card pp-card pp-flags-card" aria-labelledby="pp-flags-title">
      <div className="pp-card-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="card-title" id="pp-flags-title">
            Flags
          </h2>
          {/* "Open" means what it means on the dashboard and /flags — every
              flag not yet dismissed/resolved, acknowledged ones included
              (this pill used to count only unacknowledged as "open", so the
              profile said "0 open" for athletes the dashboard flagged —
              audit coach finding 3). */}
          <span className="pill pill-warn">
            {flags.length} open
            {unacknowledged.length > 0 ? ` · ${unacknowledged.length} awaiting acknowledgement` : ''}
          </span>
        </div>
        <Link href="/settings/thresholds" className="pp-link">
          Thresholds ›
        </Link>
      </div>
      <p className="import-sub" style={{ margin: '4px 0 0' }}>
        Raised automatically when a value crosses a threshold. Acknowledging one records who saw it
        and when.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="cap" style={{ marginTop: 16 }}>
          {acknowledged.length > 0
            ? 'Nothing awaiting acknowledgement — every open flag has been seen.'
            : 'No open flags for this athlete.'}
        </p>
      ) : (
        <div className="pp-flags-list">
          {visible.map((flag) => {
            const isAcked = flag.status === 'acknowledged' || flag.status === 'monitoring';
            const canAck = flag.status === 'raised' || flag.status === 'notified';
            const raisedDate = flag.raised_at.slice(0, 10);
            const raisedLabel = raisedDate === today ? formatTime(flag.raised_at, timezone) : formatDate(flag.raised_at, timezone);

            return (
              <div
                key={flag.id}
                className={`pp-flag-item${isAcked ? ' ack' : ''}`}
                style={{ borderInlineStart: `3px solid ${TONE_VAR[flag.severity]}` }}
              >
                <div className="pp-flag-top">
                  <span className="pill pill-neutral" style={{ fontSize: 10.5, padding: '2px 9px' }}>
                    {enumLabel(flag.domain)}
                  </span>
                  {flag.escalated ? (
                    <span className={`pill ${canAck ? 'pill-bad' : 'pill-warn'}`} style={{ fontSize: 10.5, padding: '2px 9px' }}>
                      {canAck ? 'Escalated' : 'Was escalated'}
                    </span>
                  ) : null}
                  {flag.observed ? (
                    <span className="mono pp-flag-value" style={{ color: TONE_VAR[flag.severity] }}>
                      {flag.observed}
                    </span>
                  ) : null}
                  {flag.expected ? (
                    <span className="mono pp-flag-threshold">against {flag.expected} expected</span>
                  ) : null}
                </div>
                <p className="pp-flag-rule">{flag.ruleSentence}</p>
                <p className="mono pp-flag-evidence">{flag.evidence}</p>
                {noteDraftId === flag.id ? (
                  <div className="flag-dismiss" style={{ marginTop: 8 }}>
                    <label className="label" htmlFor={`pp-ack-note-${flag.id}`}>
                      Note for {flag.name.split(' ')[0]} (optional)
                    </label>
                    <textarea
                      id={`pp-ack-note-${flag.id}`}
                      className="field"
                      rows={2}
                      placeholder="e.g. We've eased Tuesday's session — nothing to do on your end."
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                    />
                    <div className="flag-actions" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="pp-ack-btn"
                        onClick={() => acknowledge.mutate({ flagId: flag.id, note: noteText })}
                        disabled={acknowledge.isPending && pendingId === flag.id}
                      >
                        {acknowledge.isPending && pendingId === flag.id ? 'Acknowledging…' : 'Acknowledge'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setNoteDraftId(null);
                          setNoteText('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pp-flag-bottom">
                    <span className="mono pp-flag-raised">raised {raisedLabel}</span>
                    {canAck ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="pp-ack-btn"
                          onClick={() => acknowledge.mutate({ flagId: flag.id })}
                          disabled={acknowledge.isPending && pendingId === flag.id}
                          aria-label={`Acknowledge flag for ${flag.name}`}
                        >
                          {acknowledge.isPending && pendingId === flag.id ? 'Acknowledging…' : 'Acknowledge'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => setNoteDraftId(flag.id)}
                          aria-label={`Acknowledge flag for ${flag.name} with a note`}
                        >
                          + Note
                        </button>
                      </div>
                    ) : (
                      <span className="pp-ack-btn" data-acked="true">
                        {/* The card's own copy promises "records who saw it
                            and when" — so show exactly that. */}
                        Acknowledged
                        {flag.acknowledged_by_name ? ` by ${flag.acknowledged_by_name}` : ''}
                        {flag.acknowledged_at ? ` · ${formatDateTime(flag.acknowledged_at, timezone)}` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!showAcked && acknowledged.length > 0 ? (
        <button
          type="button"
          className="btn-ghost"
          style={{ marginTop: 16, display: 'inline-block' }}
          onClick={() => setShowAcked(true)}
        >
          Show acknowledged ({acknowledged.length})
        </button>
      ) : null}
    </section>
  );
}
