'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  requestProposalChanges,
  signOffProposal,
  type InjuryProposal,
  type InjuryTimelineEvent,
} from '@/lib/queries/injuryTimeline';
import { enumLabel, formatDate, formatDateTime } from '@/lib/format';

/** The injury timeline, and the medic's sign-off on an S&C proposal.
 *
 *  MEDIC ONLY. The page decides that — this component is never rendered for
 *  anybody else — and injury_timeline_medic_select (migration 0080) is the
 *  guarantee underneath. Both layers, for the same reason fetchInjuryClinical
 *  has both: a policy cannot be refactored away, and not rendering means a
 *  future bug shows an empty card rather than a leak.
 *
 *  The S&C never sees this timeline. Since 0124 (PATTERN-S3 C6) they do see
 *  the decision: the same proposal sits on /programmes/proposals as Proposed,
 *  Approved or Returned, with the medic's return reason on the row. Both
 *  surfaces write through decide_proposal, so they cannot disagree.
 *
 *  NO EDIT AND NO DELETE, anywhere in this component. There is no grant for
 *  either (0080), so a second thought becomes a second event rather than a
 *  rewrite of the first — which is what makes a clinical log worth reading. */

const NOTE_MAX = 1000;

function eventSentence(event: InjuryTimelineEvent): string {
  const p = event.payload;
  const text = (key: string): string => (typeof p[key] === 'string' ? (p[key] as string) : '');

  switch (event.type) {
    case 'injury_logged': {
      const area = enumLabel(text('body_area'));
      const side = text('side');
      return side ? `Injury logged — ${enumLabel(side)} ${area.toLowerCase()}.` : `Injury logged — ${area}.`;
    }
    case 'stage_change':
      return `Stage changed from ${enumLabel(text('from'))} to ${enumLabel(text('to'))}.`;
    case 'programme_proposed':
      return `Proposed a block: ${text('programme') || 'a programme'}.`;
    case 'programme_signed_off':
      return `Signed off: ${text('programme') || 'the proposed block'}. It is now live for the athlete.`;
    case 'note':
      return p.kind === 'changes_requested' ? `Changes requested: ${text('text')}` : text('text');
  }
}

function ProposalRow({ proposal, timezone }: { proposal: InjuryProposal; timezone: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [reason, setReason] = useState('');

  const signOffMutation = useMutation({
    mutationFn: () => signOffProposal(createClient(), proposal.assignment_id),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      router.refresh();
    },
  });

  const changesMutation = useMutation({
    mutationFn: (text: string) => requestProposalChanges(createClient(), proposal.assignment_id, text),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setRequesting(false);
      setReason('');
      router.refresh();
    },
  });

  const pending = signOffMutation.isPending || changesMutation.isPending;

  /* Required, per the decision of 2026-09-06: sending a block back without
     saying why leaves the S&C guessing, and a re-save with no reason is the
     failure mode this field exists to prevent. Checked here so the medic finds
     out while typing, and again in requestProposalChanges so a caller that
     skips this component cannot write an empty one. */
  function submitChanges() {
    const text = reason.trim();
    if (!text) {
      setError('Say what needs changing — the S&C only sees the reason you give.');
      return;
    }
    setError(null);
    changesMutation.mutate(text);
  }

  const live = proposal.status === 'active';
  const returned = proposal.status === 'returned';
  const decided = live || returned;

  return (
    <div
      className="load-row"
      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start' }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="nm">{proposal.programme_name}</span>
          <span className={`pill ${live ? 'pill-good' : returned ? 'pill-neutral' : 'pill-warn'}`}>
            {live ? 'Signed off' : returned ? 'Returned' : 'Awaiting your sign-off'}
          </span>
        </div>
        <div className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
          From {formatDate(proposal.starts_on, timezone)}
          {proposal.ends_on ? ` to ${formatDate(proposal.ends_on, timezone)}` : ''}
          {live ? '' : ' · not visible to the athlete yet'}
        </div>
        {returned && proposal.return_reason ? (
          <p className="tiny" style={{ marginTop: 'var(--sp-4)' }} data-return-reason>
            Your reason: {proposal.return_reason}
          </p>
        ) : null}

        {requesting ? (
          <div className="report-note-form">
            <label className="label" htmlFor={`reason-${proposal.assignment_id}`}>
              What needs changing
            </label>
            <textarea
              id={`reason-${proposal.assignment_id}`}
              className="field"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="e.g. No overhead pressing until the AC joint settles — swap to landmine press and keep the lower body work as it is."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={`reason-help-${proposal.assignment_id}`}
            />
            <p className="tiny" id={`reason-help-${proposal.assignment_id}`} style={{ marginTop: 'var(--sp-4)' }}>
              Required. The S&amp;C reads it on the proposals list, and it goes on the timeline as
              your note. The block is returned — nothing reaches the athlete unless it is proposed
              again and signed off.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-8)', marginTop: 'var(--sp-8)' }}>
              <button type="button" className="btn-primary" onClick={submitChanges} disabled={pending}>
                {changesMutation.isPending ? 'Saving…' : 'Send back'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() => {
                  setRequesting(false);
                  setReason('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-6)' }}>
            {error}
          </p>
        ) : null}
      </div>

      {decided ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            onClick={() => signOffMutation.mutate()}
          >
            {signOffMutation.isPending ? 'Signing off…' : 'Sign off'}
          </button>
          {requesting ? null : (
            <button
              type="button"
              className="btn-ghost"
              disabled={pending}
              onClick={() => {
                setRequesting(true);
                setError(null);
              }}
            >
              Request changes
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function InjuryTimeline({
  events,
  proposals,
  timezone,
}: {
  events: readonly InjuryTimelineEvent[];
  proposals: readonly InjuryProposal[];
  timezone: string;
}) {
  return (
    <div className="stack" style={{ gap: 'var(--sp-14)' }}>
      {proposals.length > 0 ? (
        <section className="card">
          <h2 className="card-title">Gym work proposed for this injury</h2>
          <p className="tiny" style={{ marginTop: 'var(--sp-2)' }}>
            The S&amp;C drafts the block; it reaches the athlete only once you sign it off. A
            returned one carries your reason to the S&amp;C on the proposals list.
          </p>
          <div className="stack" style={{ gap: 'var(--sp-6)', marginTop: 'var(--sp-10)' }}>
            {proposals.map((p) => (
              <ProposalRow key={p.assignment_id} proposal={p} timezone={timezone} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">Timeline</h2>
        <p className="tiny" style={{ marginTop: 'var(--sp-2)' }}>
          Medical only. Neither the athlete nor the S&amp;C can read this, and nothing on it can
          be edited or removed.
        </p>
        {events.length === 0 ? (
          <p className="tiny" style={{ marginTop: 'var(--sp-10)' }}>
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="report-notes">
            {events.map((e) => (
              <li key={e.id} className="report-note">
                <p className="report-note-body">{eventSentence(e)}</p>
                <p className="report-note-attribution">
                  {e.author_name ?? enumLabel(e.created_by_role)} ·{' '}
                  {formatDateTime(e.created_at, timezone)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
