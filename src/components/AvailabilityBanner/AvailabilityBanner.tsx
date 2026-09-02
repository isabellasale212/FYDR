import type { CSSProperties } from 'react';
import type { AvailabilityReason, AvailabilityStatus } from '@/lib/types/database';
import { availabilityStatus } from '@/lib/status';
import { enumLabel } from '@/lib/format';

type Props = {
  status: AvailabilityStatus | null;
  restrictions: readonly string[];
  reasonCategory?: AvailabilityReason | null;
  note?: string | null;
};

const TONE_RGB = {
  good: 'var(--good-rgb)',
  warn: 'var(--warn-rgb)',
  bad: 'var(--bad-rgb)',
  accent: 'var(--accent-rgb)',
  neutral: 'var(--accent-rgb)',
} as const;


/** What the athlete may do today, stated first, in words he can act on. He is
 *  told the restriction and never the diagnosis, which is the same rule that
 *  applies to his coach.
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
export function AvailabilityBanner({ status, restrictions, reasonCategory, note }: Props) {
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
        {note ? <div className="s">{note}</div> : null}
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
