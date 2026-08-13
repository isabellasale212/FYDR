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
 *  should see stated plainly, not folded into "No restriction recorded." */
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
          {restrictions.length > 0
            ? restrictions.map(enumLabel).join(' · ')
            : reasonCategory
              ? enumLabel(reasonCategory)
              : status === 'available'
                ? 'Everything is on.'
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
