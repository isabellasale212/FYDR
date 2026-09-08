import type { CSSProperties } from 'react';
import type { AvailabilityReason, AvailabilityStatus } from '@/lib/types/database';
import type { OpenInjury } from '@/lib/queries/availability';
import { availabilityStatus } from '@/lib/status';
import { bodyAreaPhrase, enumLabel, formatDate, todayIso, upcomingDate } from '@/lib/format';

type Props = {
  status: AvailabilityStatus | null;
  restrictions: readonly string[];
  reasonCategory?: AvailabilityReason | null;
  note?: string | null;
  /** The injury this availability row is linked to, or null. Null is the common
   *  case and not an error: an athlete can be unavailable for illness, exams,
   *  personal leave or a representative call-up, and fetchAthleteAvailability
   *  deliberately returns null rather than guessing at an unrelated open injury.
   *
   *  Added 2026-09-08. It was already being fetched on every Today load and
   *  discarded, so an athlete was told they were restricted and never told which
   *  injury, what stage of recovery, or when they were expected back. */
  injury?: OpenInjury | null;
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

  return (
    <div
      className="avail-banner"
      style={{ '--state-rgb': TONE_RGB[state.tone] } as CSSProperties}
    >
      {/* Spec §7.1: an 11px ring in the state's colour, not a glyph.
          The glyph was a second channel beside the colour, which is a rule this
          app applies everywhere — but not one that is needed here, because the
          status WORD sits immediately to its right. "Modified" is the message;
          the mark is punctuation. */}
      <span className="avail-ring" aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Just the status word. Fydr Athlete App.dc.html 23a reads "Modified",
            not "Modified availability" — the card is about availability, so
            the noun was doing no work. */}
        <div className="k">{state.label}</div>
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
        {status !== 'available' && note ? <div className="s">{note}</div> : null}

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
          /* Seventeen words became eight. The design's line here is "Speak to
             medical staff." — and medical IS the right authority, since
             availability is medically determined (CLAUDE.md rule 3), so
             naming the coach as an alternative was pointing at someone who
             cannot change it.
             "Everything else is on" is kept against the design: it is four
             words, and without them a list of three restrictions invites the
             reader to assume there is a fourth they have not been told. */
          <div className="s">Everything else is on. Speak to medical staff.</div>
        ) : null}
      </div>
    </div>
  );
}
