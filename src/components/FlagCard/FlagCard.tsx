'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import type { FlagListRow } from '@/lib/queries/flags';
import { acknowledgeFlag, addFlagNote, dismissFlag, staffNoteLines } from '@/lib/queries/flags';
import { createClient } from '@/lib/supabase/client';
import { Pill } from '@/components/Pill/Pill';
import { SEVERITY_STATUS } from '@/lib/status';
import { dateInTz, enumLabel, formatDate, formatDateTime, formatTime } from '@/lib/format';

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
  /** Is the person looking at this card medical staff?
   *
   *  Purely for wording, never for authorisation (CLAUDE.md rule 2): the write is
   *  gated by flags_staff_update (migration 0012), which grants UPDATE to coach and
   *  medical alike, and nothing here can change that. What it changes is what the
   *  card tells a clinician before they type. flags.staff_note is read by every
   *  coach in the organisation — flags_staff_select grants SELECT to coach and
   *  medical — so it is a shared staff note, and a physio needs to know that in the
   *  moment rather than infer it. See this file's note-audience comment below. */
  viewerIsMedical?: boolean;
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
export function FlagCard({ flag, orgId, userId, today, timezone, viewerIsMedical = false }: Props) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Optional, collapsed by default. screens/flags.md specifies Acknowledge as instant
  // and optimistic ("The card moves to the Acknowledged section with a 200 ms
  // transition... A 5-second Undo appears") — this stays true for the common case, a
  // plain click with no note. The note is additive, not a required second step: see
  // migration 0047's own header comment for why it exists at all and why it is
  // optional ("with the staff note, if any").
  const [addingNote, setAddingNote] = useState(false);
  const [note, setNote] = useState('');

  const acknowledge = useMutation({
    mutationFn: (noteText?: string) => acknowledgeFlag(createClient(), flag.id, orgId, userId, noteText),
    onSuccess: () => {
      setAddingNote(false);
      setNote('');
      router.refresh();
    },
    onError: () => setError('Could not acknowledge this flag. Try again.'),
  });

  /* The standalone note. Coach's own words: "add a button to add a note for each
   * query for each athlete." The button already on this card wrote a note only as
   * part of Acknowledge, which meant a coach could not note a flag they were not
   * ready to acknowledge, and could never add a second note afterwards — the whole
   * note affordance vanished the moment the flag left raised/notified. This
   * mutation writes flags.staff_note and nothing else (see addFlagNote), so it is
   * offered in every state of the card, acknowledged included.
   *
   * Who this note is FOR, decided rather than left implicit — the question a review
   * caught this card being confused about. It is a SHARED STAFF NOTE, coach-first:
   * flags_staff_select (0012) grants SELECT on flags to coach and medical org-wide,
   * so anything typed here is read by every coach in the club, and after
   * acknowledgement by the athlete as well. It is not, and cannot be made into, a
   * medical note.
   *
   * Medical staff can still write one, deliberately, and the reasoning is worth
   * recording because the alternative was tempting. /flags is open to coach and
   * medical (flags/page.tsx), the UPDATE policy covers both, and a physio's
   * NON-clinical context on a wellness or soreness flag — "seen this morning,
   * managing it, nothing for you to change" — is exactly what stops a coach chasing
   * an athlete. Hiding the composer from medical would not have removed the hazard
   * (they could still write through Acknowledge, whose note goes to the same column)
   * and would have pushed the useful half of the behaviour off the screen with it.
   * What was actually wrong was the copy: it described a coach-only audience to an
   * audience that includes clinicians, and never mentioned coaches to the one role
   * that needed to hear it. So the disclosure below names the real audience in every
   * state, and adds the CLAUDE.md rule 3 line for medical staff specifically —
   * diagnosis and treatment detail belong on the injury record, which coaching staff
   * cannot read, never in a column they can.
   *
   * The engine's own explanation shares this column and is never overwritten:
   * addFlagNote appends a line and preserves what is there (see its header), so a
   * flag can carry 0053's "Breached on N of the last M days" alongside a thread of
   * staff notes. */
  const saveNote = useMutation({
    mutationFn: (noteText: string) => addFlagNote(createClient(), flag.id, orgId, noteText),
    onSuccess: () => {
      setAddingNote(false);
      setNote('');
      router.refresh();
    },
    onError: () => setError('Could not save this note. Try again.'),
  });

  function submitNote(alsoAcknowledge: boolean) {
    const trimmed = note.trim();
    if (!trimmed) {
      setError('Write something before saving the note.');
      return;
    }
    setError(null);
    if (alsoAcknowledge) acknowledge.mutate(trimmed);
    else saveNote.mutate(trimmed);
  }

  const noteLines = staffNoteLines(flag.staff_note);
  const busy = acknowledge.isPending || saveNote.isPending;

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

  // Local calendar date, not the UTC one — a flag raised between
  // 23:00-00:00 UTC (00:00-01:00 local in BST) is really "today", not
  // "yesterday", so this must agree with `today` (already a local date).
  const raisedDate = dateInTz(new Date(flag.raised_at), timezone);
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
        <span className="tiny num" style={{ marginInlineStart: 'auto' }}>
          {raisedLabel}
        </span>
      </div>

      <p className="flag-who">
        <Link href={`/squad/${flag.athlete_id}`} aria-label={`View ${flag.name}'s player profile`}>
          <b>{flag.name}</b>
        </Link>
        {flag.squad_number !== null ? (
          <span className="tiny num"> #{flag.squad_number}</span>
        ) : null}
      </p>

      <p className="flag-line">
        {flag.what}
        {flag.observed ? <span className="v num"> {flag.observed}</span> : null}
        {flag.expected ? (
          <>
            {' '}
            vs <span className="base num">{flag.expected}</span> expected
          </>
        ) : null}
      </p>

      {/* Whatever's currently in flags.staff_note — the engine's own
       *  explanation (e.g. a gap-tolerance detail), and/or one or more
       *  coach-written notes, which now append rather than replace. Still
       *  not attributed to either source, because the column doesn't record
       *  which one it is — see FlagListRow's own comment. One line per note
       *  rather than one paragraph containing a line break, so a flag with
       *  an engine explanation and two coach notes reads as three short
       *  quoted lines instead of a run-on. */}
      {noteLines.map((line, i) => (
        <p className="flag-notice-note" key={`${flag.id}-note-${i}`}>
          &ldquo;{line}&rdquo;
        </p>
      ))}

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
      ) : addingNote ? (
        <div className="flag-dismiss">
          <label className="label" htmlFor={`ack-note-${flag.id}`}>
            Note on {flag.name.split(' ')[0]}&rsquo;s {flag.what} flag
          </label>
          <textarea
            id={`ack-note-${flag.id}`}
            className="field"
            rows={2}
            placeholder="e.g. We've eased Tuesday's session — nothing to do on your end."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {/* Who this note is for, said plainly and completely.
           *
           *  Two earlier versions of this line were both wrong in the same
           *  direction — they described a narrower audience than the database
           *  gives the text. It was first "Note for <athlete>" unconditionally,
           *  which promised athlete visibility the data model does not give on
           *  this path; then "stays with the coaching staff", which reads to a
           *  clinician as a confidentiality assurance when "the coaching staff"
           *  is the one audience CLAUDE.md rule 3 keeps clinical detail away
           *  from. The real audience, from the policies rather than from
           *  intent: flags_staff_select (0012) grants SELECT on flags to coach
           *  AND medical, org-wide, so every coach and every clinician in the
           *  club reads this the moment it is saved. The athlete is added to
           *  that audience — never removed from it — once someone acknowledges,
           *  because acknowledgement is what sets athlete_visible_at
           *  (flags_self_select). So the sentence now names the staff audience
           *  in both states and only the athlete's part changes. */}
          <p className="cap" style={{ margin: '6px 0 0' }}>
            {canAcknowledge
              ? `Every coach and medical staff member in the club can read this. ${flag.name.split(' ')[0]} sees it too once the flag is acknowledged.`
              : `Every coach and medical staff member in the club can read this, and so can ${flag.name.split(' ')[0]}, alongside the date the flag was raised.`}
          </p>
          {/* The rule 3 line, shown only to medical staff, because they are the
           *  only ones for whom this field is a hazard rather than a tool: they
           *  can write here (flags_staff_update covers medical), what they write
           *  is read by coaches, and coaches must never see diagnosis or
           *  treatment. Deliberately a warning and not a lock — see the
           *  audience note on the standalone-note mutation above for why
           *  removing the field from medical staff was rejected. */}
          {viewerIsMedical ? (
            <p className="cap" style={{ margin: '6px 0 0', color: 'var(--warn-text)' }}>
              Coaching staff read this field. Keep diagnosis and treatment detail out of
              it &mdash; that belongs on the injury record, where it stays with medical.
            </p>
          ) : null}
          <div className="flag-actions" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => submitNote(false)}
              disabled={busy}
            >
              {saveNote.isPending ? 'Saving…' : 'Save note'}
            </button>
            {/* The original bundled action, kept rather than dropped: it is
                still the fastest path for the common "read it, note it, done"
                case, and it is now one append plus the status write instead of
                an overwrite (acknowledgeFlag's own comment). Only offered while
                the flag can still be acknowledged. */}
            {canAcknowledge ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => submitNote(true)}
                disabled={busy}
              >
                {acknowledge.isPending ? 'Acknowledging…' : 'Save and acknowledge'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setAddingNote(false);
                setNote('');
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
              onClick={() => acknowledge.mutate(undefined)}
              disabled={busy}
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
          {/* Outside the canAcknowledge branch on purpose. This used to live
              inside it, which is exactly why a coach could not note a flag
              after acknowledging it — the button disappeared with the
              Acknowledge button. A note is now available on every open flag,
              as many times as the coach wants one. Label changes once a note
              exists so the card says whether it is starting or continuing a
              thread. */}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setAddingNote(true);
              setError(null);
            }}
            aria-label={`Add a note to ${flag.name}'s ${flag.what} flag`}
          >
            {noteLines.length > 0 ? '+ Another note' : '+ Add note'}
          </button>
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
