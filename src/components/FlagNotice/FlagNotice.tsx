import type { VisibleFlag } from '@/lib/queries/flags';
import { enumLabel, formatDate } from '@/lib/format';

type Props = {
  flags: readonly VisibleFlag[];
  /** Shown above the list, e.g. "Notes from your coach". Omitted (not rendered as an
   *  empty heading) when the caller already has its own section title, e.g. the wellness
   *  chart's own card heading. */
  heading?: string;
};

/**
 * Integration-audit major finding: the read half of "acknowledging a flag never becomes
 * visible to the athlete anywhere in the app". This is the always-legible surface —
 * my-data.md line ~241 asks for "a dated marker on the relevant chart with the staff
 * note"; on the Wellness tab that marker is drawn by WellnessChart itself, but the note
 * text lives here, underneath, because a note that only shows on SVG hover is not
 * legible on the touch device this app is actually built for (README: "Athlete mobile
 * app ... responsive mobile web"). For every other flag domain (see my-data/page.tsx's
 * own comment on why only wellness gets a chart at all in this build), this component
 * *is* the whole feature, not a supplement to one.
 *
 * Deliberately calm, not clinical: no severity colour, no red/amber wash, no word
 * "flag" or "threshold" in the rendered copy (task instruction: "clearly attributed to
 * staff, not clinical/alarming language" — matching carve-out 2's own worked example,
 * "your sleep has dropped for four days, we've adjusted your load", not a red badge).
 */
export function FlagNotice({ flags, heading }: Props) {
  if (flags.length === 0) return null;

  return (
    <div className="flag-notice">
      {heading ? <p className="flag-notice-heading">{heading}</p> : null}
      <div className="flag-notice-list">
        {flags.map((f) => (
          <div key={f.id} className="flag-notice-item">
            <div className="flag-notice-top">
              <span className="pill pill-neutral" style={{ fontSize: 10.5, padding: '2px 9px' }}>
                {enumLabel(f.domain)}
              </span>
              <span className="tiny mono">{formatDate(f.flag_date)}</span>
            </div>
            <p className="flag-notice-line">
              {f.what}
              {f.observed ? <span className="mono"> {f.observed}</span> : null}
              {f.expected ? (
                <>
                  {' '}
                  vs <span className="mono">{f.expected}</span> expected
                </>
              ) : null}
            </p>
            {f.staff_note ? <p className="flag-notice-note">&ldquo;{f.staff_note}&rdquo;</p> : null}
            <p className="flag-notice-attribution">
              {f.acknowledged_by_name ? `Seen by ${f.acknowledged_by_name}` : 'Seen by a staff member'} &middot;{' '}
              {formatDate(f.acknowledged_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
