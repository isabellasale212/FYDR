import Link from 'next/link';
import type { NotFullyAvailableRow } from '@/lib/queries/availability';
import { availabilityStatus } from '@/lib/status';
import { BLANK, enumLabel, formatDate } from '@/lib/format';

type Props = { rows: readonly NotFullyAvailableRow[]; timezone: string };

const TONE_CLASS = {
  good: 'g-good',
  warn: 'g-warn',
  bad: 'g-bad',
  accent: 'g-faint',
  neutral: 'g-faint',
} as const;

/**
 * Everyone who is not fully available, named, with the restriction and where
 * they are in the return.
 *
 * A coach reads body area, availability, restrictions and expected return.
 * Never a diagnosis: injury_clinical is not fetched for this list and is not
 * reachable from the query behind it.
 */
export function AvailabilityList({ rows, timezone }: Props) {
  return (
    <div>
      {rows.map((row) => {
        const status = availabilityStatus(
          row.status === 'unknown' ? null : row.status,
        );
        const restrictions = row.restrictions;
        const shown = restrictions.slice(0, 2).map(enumLabel).join(' · ');
        const extra = restrictions.length > 2 ? ` +${restrictions.length - 2}` : '';

        return (
          <div className="arow" key={row.athlete_id}>
            <div className={`lbl ${TONE_CLASS[status.tone]}`}>
              <span aria-hidden="true">{status.glyph}</span>
              {status.label}
            </div>
            <div>
              <Link href={`/squad/${row.athlete_id}`} className="nm">
                {row.name}
              </Link>
              <div className="tiny">{row.position ?? BLANK}</div>
            </div>
            <div className="sub">
              {restrictions.length > 0 ? (
                <>
                  {shown}
                  {extra}
                </>
              ) : row.body_area ? (
                <>
                  {enumLabel(row.body_area)}
                  {row.side ? ` · ${enumLabel(row.side)}` : ''}
                </>
              ) : (
                <span className="tiny">No restriction recorded</span>
              )}
            </div>
            <div className="mono sub">
              {row.expected_return ? (
                <>Back {formatDate(row.expected_return, timezone)}</>
              ) : (
                <span className="tiny">Return not set</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
