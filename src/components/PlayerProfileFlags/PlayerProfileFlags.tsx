'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import type { ProfileFlag } from '@/lib/queries/playerProfile';
import { acknowledgeFlag, addFlagNote, staffNoteLines } from '@/lib/queries/flags';
import { createClient } from '@/lib/supabase/client';
import { dateInTz, enumLabel, formatDate, formatDateTime, formatTime } from '@/lib/format';

type Props = {
  flags: ProfileFlag[];
  orgId: string;
  userId: string;
  today: string;
  timezone: string;
  /** Wording only, never authorisation — see FlagCard's own prop comment. The note
   *  written here lands in flags.staff_note, which flags_staff_select (0012) exposes
   *  to every coach in the organisation, so a clinician is told that before typing. */
  viewerIsMedical?: boolean;
  /** Which flag DOMAINS this viewer may act on, decided 2026-09-06.
   *
   *  Data, not a predicate, and that is a constraint rather than a preference:
   *  this is a Client Component, and Next refuses a function prop across that
   *  boundary at RUNTIME -- the first version of this passed
   *  `(domain) => canEditFlag(...)` and the profile returned a 500 the moment a
   *  nutritionist opened it. It has to be a list because this component owns its
   *  own loop; the page cannot answer per flag before handing the list over.
   *
   *  'all' rather than an array of every domain, so a domain added to the enum
   *  later is included by default for the roles that hold everything. */
  editableFlagDomains?: readonly string[] | 'all';
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
export function PlayerProfileFlags({
  flags,
  orgId,
  userId,
  today,
  timezone,
  viewerIsMedical = false,
  editableFlagDomains = 'all',
}: Props) {
  const canEditFlagDomain = (domain: string): boolean =>
    editableFlagDomains === 'all' || editableFlagDomains.includes(domain);
  const router = useRouter();
  const [showAcked, setShowAcked] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optional note at acknowledgement, additive to §11's own spec (see this file's own
  // header comment) — migration 0047's flags.staff_note, surfaced athlete-side by
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

  /* Standalone note, mirroring FlagCard's. Same reason: bundling the note into
   * Acknowledge meant no note before acknowledging and no second note after.
   * This card is the per-athlete view of the same rows /flags shows, so the two
   * must offer the same action or a coach's note appears and disappears
   * depending on which screen they happened to open. */
  const saveNote = useMutation({
    mutationFn: ({ flagId, note }: { flagId: string; note: string }) =>
      addFlagNote(createClient(), flagId, orgId, note),
    onMutate: ({ flagId }) => setPendingId(flagId),
    onSuccess: () => {
      setPendingId(null);
      setNoteDraftId(null);
      setNoteText('');
      router.refresh();
    },
    onError: () => {
      setPendingId(null);
      setError('Could not save this note. Try again.');
    },
  });

  function submitNote(flagId: string, alsoAcknowledge: boolean) {
    const trimmed = noteText.trim();
    if (!trimmed) {
      setError('Write something before saving the note.');
      return;
    }
    setError(null);
    if (alsoAcknowledge) acknowledge.mutate({ flagId, note: trimmed });
    else saveNote.mutate({ flagId, note: trimmed });
  }

  const unacknowledged = flags.filter((f) => f.status === 'raised' || f.status === 'notified');
  const acknowledged = flags.filter((f) => f.status === 'acknowledged' || f.status === 'monitoring');
  const visible = showAcked ? flags : unacknowledged;

  return (
    <section className="card pp-card pp-flags-card" aria-labelledby="pp-flags-title">
      <div className="pp-card-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', flexWrap: 'wrap' }}>
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
      {/* The intro is gone per review. Both halves were already visible: the
          pill above counts what is awaiting acknowledgement, and each row
          carries its own rule and evidence, which is the "crossed a threshold"
          fact stated about the actual reading rather than in the abstract. */}

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-10)' }}>
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="cap" style={{ marginTop: 'var(--sp-16)' }}>
          {acknowledged.length > 0
            ? 'Nothing awaiting acknowledgement — every open flag has been seen.'
            : 'No open flags for this athlete.'}
        </p>
      ) : (
        <div className="pp-flags-list">
          {visible.map((flag) => {
            const isAcked = flag.status === 'acknowledged' || flag.status === 'monitoring';
            const canAck = flag.status === 'raised' || flag.status === 'notified';
            // Local calendar date, not the UTC one — a flag raised between
            // 23:00-00:00 UTC (00:00-01:00 local in BST) is really "today",
            // not "yesterday", so this must agree with `today` (already a
            // local date).
            const raisedDate = dateInTz(new Date(flag.raised_at), timezone);
            const raisedLabel = raisedDate === today ? formatTime(flag.raised_at, timezone) : formatDate(flag.raised_at, timezone);

            return (
              <div
                key={flag.id}
                className={`pp-flag-item${isAcked ? ' ack' : ''}`}
                style={{ borderInlineStart: `3px solid ${TONE_VAR[flag.severity]}` }}
              >
                <div className="pp-flag-top">
                  <span className="pill pill-neutral" style={{ fontSize: 'var(--fs-11)', padding: '2px 9px' }}>
                    {enumLabel(flag.domain)}
                  </span>
                  {flag.escalated ? (
                    <span className={`pill ${canAck ? 'pill-bad' : 'pill-warn'}`} style={{ fontSize: 'var(--fs-11)', padding: '2px 9px' }}>
                      {canAck ? 'Escalated' : 'Was escalated'}
                    </span>
                  ) : null}
                  {flag.observed ? (
                    <span className="num pp-flag-value" style={{ color: TONE_VAR[flag.severity] }}>
                      {flag.observed}
                    </span>
                  ) : null}
                  {flag.expected ? (
                    <span className="num pp-flag-threshold">against {flag.expected} expected</span>
                  ) : null}
                </div>
                <p className="pp-flag-rule">{flag.ruleSentence}</p>
                <p className="num pp-flag-evidence">{flag.evidence}</p>
                {/* Whatever's currently in flags.staff_note — see
                 *  FlagCard.tsx's identical addition for the full reasoning
                 *  (the engine's own explanation, and/or coach notes, which
                 *  now append — same column, not distinguished). One quoted
                 *  line per note, via the shared splitter. */}
                {staffNoteLines(flag.staff_note).map((line, i) => (
                  <p className="flag-notice-note" key={`${flag.id}-note-${i}`}>
                    &ldquo;{line}&rdquo;
                  </p>
                ))}
                {noteDraftId === flag.id ? (
                  <div className="flag-dismiss" style={{ marginTop: 'var(--sp-8)' }}>
                    <label className="label" htmlFor={`pp-ack-note-${flag.id}`}>
                      Note on this {enumLabel(flag.domain).toLowerCase()} flag
                    </label>
                    <textarea
                      id={`pp-ack-note-${flag.id}`}
                      className="field"
                      rows={2}
                      placeholder="e.g. We've eased Tuesday's session — nothing to do on your end."
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                    />
                    {/* The same audience sentence FlagCard shows, for the same
                        reason — see its long note-audience comment. staff_note is
                        readable by every coach and every clinician in the club
                        (flags_staff_select, 0012) from the moment it is saved; the
                        athlete joins that audience once acknowledgement sets
                        athlete_visible_at. The previous copy ("stays with the
                        coaching staff") named a narrower audience than the policy
                        gives and read as confidentiality to a clinician. */}
                    <p className="cap" style={{ margin: '6px 0 0' }}>
                      {canAck
                        ? `Every coach and medical staff member in the club can read this. ${flag.name.split(' ')[0]} sees it too once the flag is acknowledged.`
                        : `Every coach and medical staff member in the club can read this, and so can ${flag.name.split(' ')[0]}, alongside the date the flag was raised.`}
                    </p>
                    {viewerIsMedical ? (
                      <p className="cap" style={{ margin: '6px 0 0', color: 'var(--warn-text)' }}>
                        Coaching staff read this field. Keep diagnosis and treatment detail
                        out of it &mdash; that belongs on the injury record, where it stays
                        with medical.
                      </p>
                    ) : null}
                    <div className="flag-actions" style={{ marginTop: 'var(--sp-8)' }}>
                      <button
                        type="button"
                        className="pp-ack-btn"
                        onClick={() => submitNote(flag.id, false)}
                        disabled={pendingId === flag.id && (acknowledge.isPending || saveNote.isPending)}
                      >
                        {saveNote.isPending && pendingId === flag.id ? 'Saving…' : 'Save note'}
                      </button>
                      {canAck ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => submitNote(flag.id, true)}
                          disabled={pendingId === flag.id && (acknowledge.isPending || saveNote.isPending)}
                        >
                          {acknowledge.isPending && pendingId === flag.id
                            ? 'Acknowledging…'
                            : 'Save and acknowledge'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setNoteDraftId(null);
                          setNoteText('');
                          setError(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pp-flag-bottom">
                    <span className="num pp-flag-raised">raised {raisedLabel}</span>
                    {/* The note button now sits OUTSIDE the canAck branch (it used
                        to be inside, which is why it vanished the moment a flag was
                        acknowledged). Acknowledged rows still show who saw it and
                        when — the note button is added beside that, not instead. */}
                    <div style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'center' }}>
                      {!canEditFlagDomain(flag.domain) ? (
                        /* Same rule as the Flags screen, said the same way. */
                        <span className="tiny">Read-only for your role &mdash; you can act on nutrition flags.</span>
                      ) : canAck ? (
                        <button
                          type="button"
                          className="pp-ack-btn"
                          onClick={() => acknowledge.mutate({ flagId: flag.id })}
                          disabled={pendingId === flag.id && (acknowledge.isPending || saveNote.isPending)}
                          aria-label={`Acknowledge flag for ${flag.name}`}
                        >
                          {acknowledge.isPending && pendingId === flag.id ? 'Acknowledging…' : 'Acknowledge'}
                        </button>
                      ) : (
                        <span className="pp-ack-btn" data-acked="true">
                          {/* The card's own copy promises "records who saw it
                              and when" — so show exactly that. */}
                          Acknowledged
                          {flag.acknowledged_by_name ? ` by ${flag.acknowledged_by_name}` : ''}
                          {flag.acknowledged_at ? ` · ${formatDateTime(flag.acknowledged_at, timezone)}` : ''}
                        </span>
                      )}
                      {canEditFlagDomain(flag.domain) ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setNoteDraftId(flag.id);
                            setNoteText('');
                            setError(null);
                          }}
                          aria-label={`Add a note to ${flag.name}'s ${enumLabel(flag.domain).toLowerCase()} flag`}
                        >
                          {staffNoteLines(flag.staff_note).length > 0 ? '+ Another note' : '+ Add note'}
                        </button>
                      ) : null}
                    </div>
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
          style={{ marginTop: 'var(--sp-16)', display: 'inline-block' }}
          onClick={() => setShowAcked(true)}
        >
          Show acknowledged ({acknowledged.length})
        </button>
      ) : null}
    </section>
  );
}
