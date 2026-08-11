'use client';

import Link from 'next/link';
import { massState } from '@/lib/nutritionRules';
import { initials } from '@/lib/format';
import type { AthleteWithTargets } from './TargetsTable';

type Props = {
  athlete: AthleteWithTargets | null;
  planLabel: string;
  weekStart: string;
  weekEnd: string;
  overrideReason: string | null;
};

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* NUTRITION-SPEC.md §7, "Selected athlete — the whole picture". Two real
 * deviations, both documented at the source:
 *   - the trend band behind the sparkline is a real mean +/- 1SD, not a fabricated
 *     target range (lib/nutritionRules.ts's header explains why).
 *   - the right column is a real "Weekly check-in" panel (nutrition_checkins),
 *     replacing the spec's "target against what was eaten" bars, which need a daily
 *     intake number CLAUDE.md rule 8 says will never exist. */
export function SelectedAthleteCard({ athlete, planLabel, weekStart, weekEnd, overrideReason }: Props) {
  if (!athlete) {
    return (
      <div className="card" style={{ padding: '18px 20px' }}>
        <p className="tiny">Select an athlete from the table or the chase list.</p>
      </div>
    );
  }

  const state = athlete.massKg !== null ? massState(athlete.massKg, athlete.massBand) : 'in_range';
  const pillClass = state === 'above' ? 'pill-warn' : state === 'below' ? 'pill-bad' : 'pill-good';
  const pillLabel = state === 'above' ? 'Above trend' : state === 'below' ? 'Below trend' : 'In trend';

  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div className="nutr-selected-head">
        <div className="nutr-selected-avatar">{initials({ first_name: athlete.firstName, last_name: athlete.lastName })}</div>
        <div style={{ minWidth: 0 }}>
          <div className="nutr-selected-name">{athlete.displayName}</div>
          <div className="nutr-selected-sub">
            {athlete.unit} · {planLabel}
          </div>
        </div>
        <Link href={`/squad/${athlete.id}`} className="nutr-profile-link">
          Profile ›
        </Link>
      </div>

      <div className="nutr-selected-body">
        <div>
          {athlete.massKg !== null ? (
            <>
              <div className="nutr-mass-baseline">
                <span className="nutr-mono nutr-mass-value">{athlete.massKg.toFixed(1)}</span>
                <span className="nutr-mass-unit">kg</span>
                <span className={`pill ${pillClass}`}>{pillLabel}</span>
              </div>
              <div className="nutr-mass-detail">
                {athlete.massBand ? (
                  <>
                    typical range {athlete.massBand.low.toFixed(0)} to {athlete.massBand.high.toFixed(0)} kg ·{' '}
                  </>
                ) : null}
                {athlete.change7d !== null
                  ? `${athlete.change7d >= 0 ? '+' : ''}${athlete.change7d.toFixed(1)}% over 7 days`
                  : 'not enough history for a 7-day trend'}
                {athlete.change12wk !== null
                  ? ` · ${athlete.change12wk >= 0 ? '+' : ''}${athlete.change12wk.toFixed(1)}% over 12 weeks`
                  : ''}
              </div>
              <Sparkline history={athlete.massHistory} band={athlete.massBand} stateColour={state} />
            </>
          ) : (
            <p className="tiny">No weigh-in on record for this athlete yet.</p>
          )}

          <div className="nutr-logging-strip">
            {weekDates.map((date, i) => {
              const logged = athlete.loggedDatesThisWeek.includes(date);
              return (
                <div key={date} className={`nutr-logging-cell ${logged ? 'is-logged' : ''}`}>
                  <div className="nutr-logging-swatch" />
                  <span className="nutr-mono nutr-logging-initial">{DAY_INITIALS[i]}</span>
                </div>
              );
            })}
          </div>
          <p className="nutr-mono nutr-logging-caption">
            {athlete.loggedDatesThisWeek.length} of 7 days weighed in · {formatShort(weekStart)} to{' '}
            {formatShort(weekEnd)}
          </p>
        </div>

        <div>
          <div className="nutr-checkin-title">Weekly check-in</div>
          <p className="nutr-checkin-footnote">
            asked once a week, not a daily log · a missed week is not counted against them
          </p>
          <CheckinStrip checkins={athlete.recentCheckins} />
          {overrideReason ? <p className="nutr-override-note">{overrideReason}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Sparkline({
  history,
  band,
  stateColour,
}: {
  history: { date: string; kg: number }[];
  band: { low: number; high: number } | null;
  stateColour: 'above' | 'below' | 'in_range';
}) {
  if (history.length < 2) {
    return <div className="nutr-sparkline-empty tiny">Not enough weigh-ins yet for a trend line.</div>;
  }
  const values = history.map((h) => h.kg);
  let lo = Math.min(...values) - 1;
  let hi = Math.max(...values) + 1;
  if (band) {
    lo = Math.min(lo, band.low - 1);
    hi = Math.max(hi, band.high + 1);
  }
  const span = hi - lo || 1;
  const y = (v: number) => 62 - ((v - lo) / span) * 54;
  const x = (i: number) => (history.length === 1 ? 400 : (i / (history.length - 1)) * 400);

  const path = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(h.kg).toFixed(1)}`).join(' ');
  const last = history[history.length - 1]!;
  const dotColour =
    stateColour === 'above' ? 'var(--warn)' : stateColour === 'below' ? 'var(--bad)' : 'var(--accent)';

  const bandY = band ? y(band.high) : 0;
  const bandH = band ? Math.max(2, y(band.low) - y(band.high)) : 0;

  return (
    <div>
      <svg viewBox="0 0 400 70" preserveAspectRatio="none" className="nutr-sparkline">
        {band ? <rect x="0" y={bandY} width="400" height={bandH} fill="rgb(var(--accent-rgb) / 0.1)" /> : null}
        <path d={path} fill="none" stroke="var(--accent2)" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx={x(history.length - 1)} cy={y(last.kg)} r="4" fill={dotColour} />
      </svg>
      <div className="nutr-sparkline-axis">
        <span>12 weeks ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function CheckinStrip({ checkins }: { checkins: { weekStart: string; answer: 'yes' | 'roughly' | 'no' }[] }) {
  const recent = [...checkins].slice(0, 6).reverse();
  if (recent.length === 0) {
    return <p className="tiny">No check-ins submitted yet.</p>;
  }
  const missCount = recent.filter((c) => c.answer !== 'yes').length;
  const mostRecent = recent[recent.length - 1]!;
  return (
    <>
      <div className="nutr-checkin-strip">
        {recent.map((c) => (
          <div key={c.weekStart} className={`nutr-checkin-cell nutr-checkin-${c.answer}`} title={`${c.weekStart}: ${c.answer}`}>
            <span className="nutr-mono">{c.answer === 'yes' ? 'Y' : c.answer === 'roughly' ? 'R' : 'N'}</span>
          </div>
        ))}
      </div>
      <p className="tiny">
        {mostRecent.answer === 'yes'
          ? 'Said yes most recently'
          : mostRecent.answer === 'roughly'
            ? "Said 'roughly' most recently"
            : 'Said no most recently'}
        {missCount > 0 ? ` · ${missCount} of ${recent.length} recent weeks under target` : ''}
      </p>
    </>
  );
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}
