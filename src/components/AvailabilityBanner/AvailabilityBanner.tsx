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

const TONE_TEXT = {
  good: 'g-good',
  warn: 'g-warn',
  bad: 'g-bad',
  accent: 'g-faint',
  neutral: 'g-faint',
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
      <span className={`g ${TONE_TEXT[state.tone]}`} aria-hidden="true">
        {state.glyph}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="k">{state.label} availability</div>
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
          <div className="s">
            Everything else is on. Speak to your coach or medical staff before
            you change anything.
          </div>
        ) : null}
      </div>
    </div>
  );
}
