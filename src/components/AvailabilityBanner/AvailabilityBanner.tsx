import type { CSSProperties } from 'react';
import type { AvailabilityReason, AvailabilityStatus } from '@/lib/types/database';
import type { OpenInjury } from '@/lib/queries/availability';
import { availabilityStatus } from '@/lib/status';
import { bodyAreaPhrase, enumLabel, formatDate, todayIso, upcomingDate } from '@/lib/format';

type Props = {
  status: AvailabilityStatus | null;
  restrictions: readonly string[];
  reasonCategory?: AvailabilityReason | null;
  /** The injury this availability row is linked to, or null. Null is the common
   *  case and not an error: an athlete can be unavailable for illness, exams,
   *  personal leave or a representative call-up, and fetchAthleteAvailability
   *  deliberately returns null rather than guessing at an unrelated open injury.
   *
   *  Added 2026-09-08. It was already being fetched on every Today load and
   *  discarded, so an athlete was told they were restricted and never told which
   *  injury, what stage of recovery, or when they were expected back. */
  injury?: OpenInjury | null;
  /** What medical staff wrote on this availability row.
   *
   *  RESTORED 8 September 2026, having been removed earlier the same day by the
   *  redesign — the reference's Modified row carries a restriction line, one
   *  instruction and a chevron, and no third line for this. Removing the prop
   *  took away the only place an athlete reads what staff actually said about
   *  their own availability, so it is back. Only shown when the athlete is not
   *  available: a note attached to "available" has nothing to qualify. */
  note?: string | null;
  timezone: string;
};

const TONE_RGB = {
  good: 'var(--good-rgb)',
  warn: 'var(--warn-rgb)',
  bad: 'var(--bad-rgb)',
  accent: 'var(--accent-rgb)',
  neutral: 'var(--accent-rgb)',
} as const;


/** What the athlete may do today, stated first, in words they can act on. They are
 *  told the restriction and never the diagnosis, which is the same rule that
 *  applies to their coach.
 *
 *  reasonCategory and note render here too now (ADR-008 / gameplan 2.6) —
 *  both were already fetched by fetchAthleteAvailability before this change
 *  and simply had nowhere to show. A non-injury reason (exams, personal,
 *  representative honours, illness) is exactly the kind of thing an athlete
 *  should see stated plainly, not folded into "No restriction recorded."
 *
 *  status === 'available' is checked FIRST, before restrictions or
 *  reasonCategory are even looked at (integration-audit majors, Bug 1). This
 *  is deliberate defense in depth, not just tidiness: setAvailability()
 *  (lib/queries/injuries.ts) cannot safely be made to force reason_category
 *  to null server-side for every 'available' row, because a COACH's insert
 *  is required by RLS (availability_coach_insert_noninjury, migration 0042)
 *  to always carry a non-null, non-injury reason_category, with no exception
 *  for status — see that policy and 200_coach_noninjury_availability_test.sql
 *  §3c, "a COACH cannot insert with no reason_category at all", which throws
 *  42501 for exactly the 'available' + null case. So a coach-authored
 *  'available' row can legitimately still carry a leftover, meaningless
 *  reason_category value in the database, forever — this check order is what
 *  makes that harmless: no matter what is stored, a status of 'available'
 *  always reads as "Everything is on." here, never a stale reason. */
export function AvailabilityBanner({
  status,
  restrictions,
  reasonCategory,
  note,
  injury = null,
  timezone,
}: Props) {
  const state = availabilityStatus(status);
  /* The tone-family card (ATH-ADULT-02, S4, 2026-09-11): fill, border and
     every word from one family, no ring. `data-tone` is what the stylesheet
     keys the text colour on — the *-pill-text tokens, the ones built for
     type on a tint, measured at 4.5:1 or better in both themes by
     test-ath-adult-02.ts. Available stays the plain card. */
  const tone = status === 'available' || status === null ? null : state.tone === 'bad' ? 'bad' : 'warn';

  return (
    <div
      /* The anchor the one-line banner above To do links down to. */
      id="availability"
      className="avail-banner"
      data-tone={tone ?? undefined}
      style={{ '--state-rgb': TONE_RGB[state.tone] } as CSSProperties}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Just the status word. Fydr Athlete App.dc.html 23a reads "Modified",
            not "Modified availability" — the card is about availability, so
            the noun was doing no work. The ring that used to sit beside it is
            gone with the tone-family card: the fill carries the colour now,
            and the word was always the message. Beside it, the reason as a
            chip — a white chip on the tint, so it still reads as a chip. */}
        <div className="avail-head">
          <div className="k">{state.label}</div>
          {status !== 'available' && reasonCategory ? (
            <span className="avail-chip">{enumLabel(reasonCategory)}</span>
          ) : null}
        </div>
        <div className="v">
          {status === 'available'
            ? 'Everything is on.'
            : restrictions.length > 0
              ? restrictions.map(enumLabel).join(' · ')
              : reasonCategory
                ? enumLabel(reasonCategory)
                : 'No restriction recorded.'}
        </div>
        {/* Only when they are not fully available, which is the guard
            reason_category above already has and for the same reason. A note
            belongs to the availability row it was written on, and clearing an
            athlete creates a new row — but nothing forces whoever writes it to
            clear the text, and one of the thirty-four available rows on file
            reads "Live-verification: flu, off this week." Under "Everything is
            on." that is not a note, it is a contradiction, and the player has
            no way to tell which half is current. Three more available rows
            carry a leftover reason_category, which is the same shape.

            Staff surfaces are unaffected: this is the athlete's banner, and a
            coach reading the same row still sees whatever is stored. */}

        {/* THE INJURY, and only when they are not fully available.
            Availability and injury are separate records: somebody can be
            training fully with an injury still open on file, and telling a
            cleared player about it here would read as a restriction they do not
            have. So this sits under the same guard as the line below it, which
            is the guard the whole banner has always respected.

            Three facts, in the order an athlete asks for them: what it is, how
            far along they are, when they are expected back. The stage goes
            through enumLabel because "return_to_play" is an enum and a player is
            not required to read one. Expected return is guarded separately —
            most open injuries have none, and an unguarded date renders the
            string "Invalid Date" on a player's phone.

            NO CLINICAL DETAIL. body_area, side and status come from `injuries`,
            which this athlete may read in full. Diagnosis and mechanism live
            behind injury_clinical_athlete_view, are a separate decision, and are
            deliberately not here. */}
        {status !== 'available' && injury ? (
          <div className="s">
            {bodyAreaPhrase(injury)} · {enumLabel(injury.status)}
            {/* Only while it is still ahead. See upcomingDate: every open
                injury on file carries a date already gone, and "Expected return
                Sun 9 Aug" on the 8th of September is not information. */}
            {upcomingDate(injury.expected_return, todayIso(timezone))
              ? ` · Expected return ${formatDate(injury.expected_return, timezone)}`
              : ''}
          </div>
        ) : null}

        {status !== 'available' ? (
          /* "Speak to medical staff." alone since the 2026-09-08 redesign.
             Medical is the right authority — availability is medically
             determined, CLAUDE.md rule 3 — so naming the coach was always
             pointing at someone who cannot change it.
             "Everything else is on" used to open this line, kept against the
             earlier design on the argument that a list of three restrictions
             otherwise invites the reader to assume a fourth they were not told.
             The reference drops it and Isabella confirmed. The argument was not
             wrong; it lost to a calmer row, and it is written down here so
             anybody restoring the words knows what they are restoring. */
          <div className="s">Speak to medical staff.</div>
        ) : null}
        {/* Below the instruction, not instead of it: the instruction is the
            same on every restricted day and the note is what changes. */}
        {status !== 'available' && note ? <div className="s">{note}</div> : null}
      </div>
    </div>
  );
}
