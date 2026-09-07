'use client';

import Link from 'next/link';
import { MASS_FLAG_PCT_7D, massState } from '@/lib/nutritionRules';
import type { MacroRule } from '@/lib/nutritionRules';
import { initials } from '@/lib/format';
import type { AthleteWithTargets } from './TargetsTable';

type Props = {
  athlete: AthleteWithTargets | null;
  planLabel: string;
  weekStart: string;
  weekEnd: string;
  overrideReason: string | null;
  /** Finding 42: the raw per-kg rule behind a personal override, so the note below can
   *  say what changed instead of showing free-text (or nothing) on its own. */
  overrideRule: MacroRule | null;
  /** Finding 40: needed to spell out the "why this number" sentence for energy. */
  dayTypeLabel: string;
};

function describeOverride(reason: string | null, rule: MacroRule | null): string | null {
  const numbers = rule
    ? `${rule.proteinGPerKg} g/kg protein · ${rule.carbGPerKgByDay.training}/${rule.carbGPerKgByDay.match}/${rule.carbGPerKgByDay.rest} g/kg carb (train/match/rest) · ${rule.fatGPerKg} g/kg fat · ${rule.fluidMlPerKg} ml/kg fluid`
    : null;
  if (reason && numbers) return `Personal override — ${reason} (${numbers})`;
  if (reason) return `Personal override — ${reason}`;
  if (numbers) return `Personal override — ${numbers}`;
  return null;
}

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* NUTRITION-SPEC.md §7, "Selected athlete — the whole picture".
 *
 * THE SPARKLINE CARRIES TWO BANDS AND THEY MEAN OPPOSITE KINDS OF THING. This is the
 * one chart in the app where both appear over the same line, so it is the one that
 * most has to keep them apart:
 *
 *   TREND BAND    computeMassBand — WHERE THEY HAVE BEEN. Their own mean ± 1 SD.
 *                 Filled accent rect, no outline. Exists for anyone with two
 *                 weigh-ins; nobody authored it. Called "typical range" in the copy
 *                 and "In trend / Above trend / Below trend" in the pill.
 *   TARGET BAND   body_mass_target_ranges (migration 0060) — WHERE STAFF WANT THEM.
 *                 Unfilled dashed neutral bracket. Exists only where a coach or
 *                 physio set one. Called "staff target" in the copy and "On target /
 *                 Above target / Below target" in its own pill.
 *
 * Fill versus stroke, solid versus dashed, accent versus neutral, plus two separate
 * captions and two separate pills. Four channels, because the failure this guards
 * against — a reader taking "he's in the band" to mean the wrong one of the two — is
 * silent, and one channel is one refactor from being lost.
 *
 * The target band is STAFF ONLY and NEVER RANKED (the client's own rules; migration
 * 0060's header). This component renders only from (staff)/nutrition.
 *
 * Two other real deviations from the spec, both documented at the source:
 *   - the right column is a real "Weekly check-in" panel (nutrition_checkins),
 *     replacing the spec's "target against what was eaten" bars, which need a daily
 *     intake number CLAUDE.md rule 8 says will never exist.
 *   - there is no per-meal breakdown, for the same reason. */
export function SelectedAthleteCard({
  athlete,
  planLabel,
  weekStart,
  weekEnd,
  overrideReason,
  overrideRule,
  dayTypeLabel,
}: Props) {
  if (!athlete) {
    return (
      <div className="card">
        <p className="tiny">Select an athlete from the table or the chase list.</p>
      </div>
    );
  }

  const state = athlete.massKg !== null ? massState(athlete.massKg, athlete.massBand) : 'in_range';
  const pillClass = state === 'above' ? 'pill-warn' : state === 'below' ? 'pill-bad' : 'pill-good';
  const pillLabel = state === 'above' ? 'Above trend' : state === 'below' ? 'Below trend' : 'In trend';
  /* The STAFF-TARGET pill, migration 0060 — a different question from the trend pill
   * beside it, so it gets its own words. "Above trend" means he has moved away from
   * where HE has been; "Above target" means he is outside where STAFF want him. An
   * athlete can easily be one and not the other, which is exactly why both pills are
   * shown rather than one merged verdict. Null when nobody has set a range: the
   * absence of a target is not "on target". */
  const targetState =
    athlete.targetRange !== null && athlete.massKg !== null
      ? massState(athlete.massKg, athlete.targetRange)
      : null;
  const targetPill = targetState
    ? {
        className:
          targetState === 'above' ? 'pill-warn' : targetState === 'below' ? 'pill-bad' : 'pill-good',
        label:
          targetState === 'above'
            ? 'Above target'
            : targetState === 'below'
              ? 'Below target'
              : 'On target',
      }
    : null;

  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));

  // Finding 40: "why this number" for the one figure a coach is most likely to ask
  // about — same shape as the plan card's illustrative example, but this athlete's
  // own real mass and target rather than a stand-in 100 kg athlete.
  const energyBreakdown =
    athlete.targets && athlete.massKg !== null
      ? `${Math.round(athlete.targets.energyKcal).toLocaleString('en-GB')} kcal because ${athlete.massKg.toFixed(1)} kg × ${(athlete.targets.energyKcal / athlete.massKg).toFixed(0)} kcal/kg, ${dayTypeLabel.toLowerCase()}`
      : null;
  const overrideNote = describeOverride(overrideReason, overrideRule);

  return (
    <div className="card">
      <div className="nutr-selected-head">
        <div className="nutr-selected-avatar">{initials({ first_name: athlete.firstName, last_name: athlete.lastName })}</div>
        <div style={{ minWidth: 0 }}>
          <div className="nutr-selected-name">{athlete.displayName}</div>
          <div className="nutr-selected-sub">
            {athlete.unit} · {planLabel}
          </div>
          {energyBreakdown ? <div className="nutr-selected-energy">{energyBreakdown}</div> : null}
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
                {/* The staff-target pill sits beside the trend pill and says "target"
                  * in every one of its three states, because the two pills otherwise
                  * differ only in the word after "Above" and would be read as
                  * duplicates of one another. */}
                {targetPill ? (
                  <span className={`pill ${targetPill.className}`}>{targetPill.label}</span>
                ) : null}
              </div>
              <div className="nutr-mass-detail">
                {athlete.massBand ? (
                  <>
                    typical range {athlete.massBand.low.toFixed(0)} to {athlete.massBand.high.toFixed(0)} kg ·{' '}
                  </>
                ) : null}
                {athlete.targetRange ? (
                  <>
                    staff target {athlete.targetRange.low.toFixed(1)} to{' '}
                    {athlete.targetRange.high.toFixed(1)} kg ·{' '}
                  </>
                ) : null}
                {athlete.change7d !== null
                  ? `${athlete.change7d >= 0 ? '+' : ''}${athlete.change7d.toFixed(1)}% over 7 days`
                  : 'not enough history for a 7-day trend'}
                {athlete.change12wk !== null
                  ? ` · ${athlete.change12wk >= 0 ? '+' : ''}${athlete.change12wk.toFixed(1)}% over 12 weeks`
                  : ''}
                {athlete.change7d !== null ? ` · flags at ${MASS_FLAG_PCT_7D}%+ in 7 days` : ''}
              </div>
              <Sparkline
                history={athlete.massHistory}
                band={athlete.massBand}
                targetRange={athlete.targetRange}
                stateColour={state}
              />
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
          
          <CheckinStrip checkins={athlete.recentCheckins} />
          {overrideNote ? <p className="nutr-override-note">{overrideNote}</p> : null}
        </div>
      </div>
    </div>
  );
}

function Sparkline({
  history,
  band,
  targetRange,
  stateColour,
}: {
  history: { date: string; kg: number }[];
  /** WHERE THEY HAVE BEEN — computeMassBand. Drawn as a filled rect. */
  band: { low: number; high: number } | null;
  /** WHERE STAFF WANT THEM — body_mass_target_ranges. Drawn as a dashed outline.
   *  Never the same ink as `band`; see this file's header. */
  targetRange: { low: number; high: number } | null;
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
  /* The target bounds widen the y domain the same way the trend band does, and for a
   * sharper reason: an athlete far outside their target is exactly the case a
   * nutritionist opened this card to look at, and clipping the bracket to the viewBox
   * would draw "3 kg over" and "15 kg over" identically, flush against the top edge. */
  if (targetRange) {
    lo = Math.min(lo, targetRange.low - 1);
    hi = Math.max(hi, targetRange.high + 1);
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
        {/* Filled, no outline: where they have been. */}
        {band ? <rect x="0" y={bandY} width="400" height={bandH} fill="rgb(var(--accent-rgb) / 0.1)" /> : null}
        {/* Outlined, no fill, dashed, neutral: where staff want them. Drawn AFTER the
          * trend band so its edges stay legible where the two overlap — which is the
          * common case, and the one where an under-drawn bracket would vanish. */}
        {targetRange ? (
          <rect
            x="0"
            y={y(targetRange.high)}
            width="400"
            height={Math.max(2, y(targetRange.low) - y(targetRange.high))}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="1.2"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path d={path} fill="none" stroke="var(--accent2)" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx={x(history.length - 1)} cy={y(last.kg)} r="4" fill={dotColour} />
      </svg>
      {targetRange ? (
        <div className="nutr-sparkline-legend">
          <span className="nutr-legend-item">
            <span className="nutr-legend-band" aria-hidden="true" /> where they have been
          </span>
          <span className="nutr-legend-item">
            <span className="nutr-legend-bracket" aria-hidden="true" /> where staff want them
          </span>
        </div>
      ) : null}
      {/* Was the literal string "12 weeks ago", correct only while the window
        * behind this line was a hardcoded 90 days on /nutrition. That window is
        * now the coach's own choice (`?period=`), so the axis names the real
        * first point instead of a fixed number of weeks it can no longer
        * promise. Derived from the data already in hand — no prop to keep in
        * sync with the page, and therefore nothing that can drift out of it. */}
      <div className="nutr-sparkline-axis">
        <span>{formatShort(history[0]!.date)}</span>
        <span>{formatShort(last.date)}</span>
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
