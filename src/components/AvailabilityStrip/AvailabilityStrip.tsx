import type { AvailabilityCounts } from '@/lib/queries/availability';
import { AVAILABILITY_STATUS } from '@/lib/status';

type Props = { counts: AvailabilityCounts };

const CELLS = [
  { key: 'available', status: AVAILABILITY_STATUS.available, glyphClass: 'g-good' },
  { key: 'modified', status: AVAILABILITY_STATUS.modified, glyphClass: 'g-warn' },
  { key: 'unavailable', status: AVAILABILITY_STATUS.unavailable, glyphClass: 'g-bad' },
  { key: 'unknown', status: AVAILABILITY_STATUS.unknown, glyphClass: 'g-faint' },
] as const;

/** Four counts, each with its glyph. Unknown is its own cell and is never
 *  folded into available: an athlete who has not been assessed is not a
 *  selectable athlete, and screens/dashboard.md is explicit about it. */
export function AvailabilityStrip({ counts }: Props) {
  return (
    <div className="avail">
      {CELLS.map((cell) => (
        <div key={cell.key}>
          <div className="v mono">{counts[cell.key]}</div>
          <div className="k">
            <span className={`g ${cell.glyphClass}`} aria-hidden="true">
              {cell.status.glyph}
            </span>
            {cell.status.label}
          </div>
        </div>
      ))}
    </div>
  );
}
