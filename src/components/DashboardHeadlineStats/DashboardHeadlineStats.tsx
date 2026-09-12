'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HeadlineStats, SquadStateEntry } from '@/lib/queries/dashboard';
import { availabilityLabel, formatDate } from '@/lib/format';
import { runLabel } from '@/lib/missingRuns';

type Props = {
  stats: HeadlineStats;
  isAnchoredToPast: boolean;
  timezone: string;
  needYouHref: string;
  wellnessReportHref: string;
  squadHref: string;
  flagsHref: string;
  toMatchdayHref: string;
  /** The readiness card's own already-fetched modified/unavailable lists
   *  (fetchSaturdayReadiness, which absorbed the deleted fetchSquadState) —
   *  the Available tile's expand reuses that exact data rather than deriving
   *  a second version of the same fact. */
  squadModified: SquadStateEntry[];
  squadUnavailable: SquadStateEntry[];
};

type ExpandKey = 'wellness' | 'available' | null;

// One line per athlete, formatted by lib/format's availabilityLabel — the
// same call the readiness card's rows make. This used to be a hand-kept
// sibling copy of that rule, justified by a comment saying the two must
// "never describe the same athlete two different ways"; they diverged the
// moment the card began rendering restrictions and this copy did not. The
// shared function is the version of that promise the compiler can keep.
function namedWithReason(entries: SquadStateEntry[]): string[] {
  return entries.map(availabilityLabel);
}

/** The five headline tiles, DASHBOARD-SPEC.md's own top strip. Per-tile
 *  decision below, since "expandable to read further" and "clickable
 *  straight to the problem" aren't the same fix for every tile — a coach
 *  triaging fast wants whichever is faster for THAT tile, not one uniform
 *  treatment applied everywhere:
 *
 *   - Need you / Open flags: real navigation, unchanged destination. Both
 *     already point at the exact set being counted (/flags?date= for the
 *     day-scoped one, /flags for the standing count — audit coach finding
 *     13 fixed that). What was missing was the affordance: nothing marked
 *     these as clickable beyond a bare CSS cursor, which is exactly why a
 *     coach reviewing the live app didn't find them. A trailing › fixes
 *     that without touching where they go.
 *   - To matchday: navigation, but to a better place. It used to link back
 *     onto this same dashboard with a different ?day= (selecting Saturday
 *     in the week list below) — a real destination existed already,
 *     /schedule/fixtures/[fixtureId], and this tile now points at it
 *     directly. Falls back to /schedule with no id when there's genuinely
 *     no fixture booked.
 *   - Wellness in / Available: expand in place, not navigate. Both used to
 *     link to a squad-wide page (a compliance report, the full roster) a
 *     coach would then have to re-filter to find the exact names this tile
 *     is already counting — slower, not faster, for "straight to the
 *     problem". Expanding shows the real names right here instead:
 *     wellnessMissing is computed off the identical expected/submitted
 *     pair the percentage itself uses (dashboard.ts's own comment on why,
 *     rather than a second, differently-filtered query), and Available
 *     reuses the Squad state card's modified/unavailable lists. Both still
 *     keep a footer link to the full page for anyone who wants more. */
/** The written state of a summary card that opens a list — STAFF-SS-01 A2
 *  (2026-09-12). The stat is the button text; this line says what pressing
 *  does, in the words aria-expanded announces, and the glyph swaps ▸ / ▾
 *  rather than rotating (no motion token). */
function StatState({ open }: { open: boolean }) {
  return (
    <div className="dash-stat-state">
      <span aria-hidden="true">{open ? '▾' : '▸'}</span> {open ? 'Open · showing the list' : 'Closed · opens a list'}
    </div>
  );
}

export function DashboardHeadlineStats({
  stats,
  isAnchoredToPast,
  timezone,
  needYouHref,
  wellnessReportHref,
  squadHref,
  flagsHref,
  toMatchdayHref,
  squadModified,
  squadUnavailable,
}: Props) {
  const [expanded, setExpanded] = useState<ExpandKey>(null);

  const modifiedNamed = namedWithReason(squadModified);
  const unavailableNamed = namedWithReason(squadUnavailable);

  return (
    <>
      <div className="card dash-stats">
        <Link href={needYouHref} className="dash-stat">
          <div className="dash-stat-label">
            <span className="dash-stat-dot" style={{ background: 'var(--good)' }} aria-hidden="true" />
            Need you
          </div>
          <div className="dash-stat-value" style={{ color: stats.needYouCount > 0 ? 'var(--bad)' : undefined }}>
            {stats.needYouCount}
          </div>
          <div className="dash-stat-sub">athletes today</div>
          <div className="dash-stat-foot">across wellness and GPS ›</div>
        </Link>

        <button
          type="button"
          className="dash-stat"
          aria-expanded={expanded === 'wellness'}
          aria-label={`${expanded === 'wellness' ? 'Collapse' : 'Expand'} wellness submissions: ${stats.wellnessSub}`}
          onClick={() => setExpanded((k) => (k === 'wellness' ? null : 'wellness'))}
        >
          <div className="dash-stat-label">
            <span className="dash-stat-dot" style={{ background: 'var(--good)' }} aria-hidden="true" />
            Wellness in
          </div>
          <div className="dash-stat-value">
            {stats.wellnessPct !== null ? (
              <>
                {stats.wellnessPct}
                <span className="unit">%</span>
              </>
            ) : (
              '—'
            )}
          </div>
          {stats.wellnessPct !== null ? (
            <div className="dash-stat-bar-track" aria-hidden="true">
              <div className="dash-stat-bar-fill" style={{ width: `${stats.wellnessPct}%`, background: 'var(--good)' }} />
            </div>
          ) : null}
          <div className="dash-stat-sub">{stats.wellnessSub}</div>
          <div className="dash-stat-foot">
            {stats.wellnessPct === null
              ? 'not expected today'
              : isAnchoredToPast
                ? 'window closed 09:00 that day'
                : 'window closes 09:00'}
          </div>
          <StatState open={expanded === 'wellness'} />
        </button>

        <button
          type="button"
          className="dash-stat"
          aria-expanded={expanded === 'available'}
          aria-label={`${expanded === 'available' ? 'Collapse' : 'Expand'} squad availability: ${stats.modifiedCount} modified, ${stats.unavailableCount} out`}
          onClick={() => setExpanded((k) => (k === 'available' ? null : 'available'))}
        >
          <div className="dash-stat-label">
            <span className="dash-stat-dot" style={{ background: 'var(--domain-medical)' }} aria-hidden="true" />
            Available
          </div>
          <div className="dash-stat-value">
            {stats.availableCount} <span className="unit">/ {stats.availableTotal}</span>
          </div>
          <div className="dash-stat-bar" aria-hidden="true">
            {stats.availableCount > 0 ? (
              <span className="dash-stat-bar-seg" style={{ flex: stats.availableCount, background: 'var(--good)' }} />
            ) : null}
            {stats.modifiedCount > 0 ? (
              <span className="dash-stat-bar-seg" style={{ flex: stats.modifiedCount, background: 'var(--warn)' }} />
            ) : null}
            {stats.unavailableCount > 0 ? (
              <span className="dash-stat-bar-seg" style={{ flex: stats.unavailableCount, background: 'var(--bad)' }} />
            ) : null}
          </div>
          <div className="dash-stat-sub">
            {stats.modifiedCount} modified, {stats.unavailableCount} out
          </div>
          <div className="dash-stat-foot">
            injury status set by medical, other absences by coach
          </div>
          <StatState open={expanded === 'available'} />
        </button>

        <Link href={flagsHref} className="dash-stat" data-urgent={stats.openFlags > 0}>
          <div className="dash-stat-label">
            <span className="dash-stat-dot" style={{ background: 'var(--bad)' }} aria-hidden="true" />
            Open flags
          </div>
          {/* --bad-text, not --warn-text. The lift tones this tile red
              throughout (its own value is #8a2418) rather than mixing a red
              dot and wash with amber type, and red is what the count means:
              severity is a property of the individual flags, shown in the bar
              below, not of the total. */}
          <div className="dash-stat-value" style={{ color: stats.openFlags > 0 ? 'var(--bad-text)' : undefined }}>
            {stats.openFlags}
          </div>
          {stats.openFlags > 0 ? (
            <div className="dash-stat-bar" aria-hidden="true">
              {stats.flagsBySeverity.high > 0 ? (
                <span className="dash-stat-bar-seg" style={{ flex: stats.flagsBySeverity.high, background: 'var(--bad)' }} />
              ) : null}
              {stats.flagsBySeverity.medium > 0 ? (
                <span className="dash-stat-bar-seg" style={{ flex: stats.flagsBySeverity.medium, background: 'var(--warn)' }} />
              ) : null}
              {/* Low takes neutral ink, not a third tone: it is counted, but
                  it is not a warning, and giving it one would make every
                  quiet week look amber. */}
              {stats.flagsBySeverity.low > 0 ? (
                <span className="dash-stat-bar-seg" style={{ flex: stats.flagsBySeverity.low, background: 'rgb(var(--ink-rgb) / 0.16)' }} />
              ) : null}
            </div>
          ) : null}
          <div className="dash-stat-sub">
            {stats.awaitingAckFlags === 0 ? 'all acknowledged' : `${stats.awaitingAckFlags} awaiting acknowledgement`}
          </div>
          <div className="dash-stat-foot">wellness, gym, GPS ›</div>
        </Link>

        <Link href={toMatchdayHref} className="dash-stat">
          <div className="dash-stat-label">
            <span className="dash-stat-dot" style={{ background: 'var(--domain-pitch)' }} aria-hidden="true" />
            To matchday
          </div>
          <div className="dash-stat-value">
            {stats.toMatchdayDays ?? '—'} <span className="unit">{stats.toMatchdayDays === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="dash-stat-sub">{stats.opponent ? `v ${stats.opponent}` : 'no fixture'}</div>
          <div className="dash-stat-foot">
            {stats.sessionsLeft} session{stats.sessionsLeft === 1 ? '' : 's'} left to run ›
          </div>
        </Link>
      </div>

      {expanded === 'wellness' ? (
        <div className="dash-stat-expand" role="region" aria-label="Athletes still to submit wellness">
          <div className="dash-stat-expand-head">
            <span style={{ fontSize: 'var(--fs-13)', fontWeight: 700 }}>Still to submit</span>
            <span className="tiny" style={{ color: 'var(--muted)' }}>
              {stats.wellnessSub}
            </span>
          </div>
          {stats.wellnessMissing.length === 0 ? (
            <p className="tiny dash-stat-expand-empty">
              {stats.wellnessPct === null ? 'Nobody was expected to submit today.' : 'Nobody outstanding — everyone expected has submitted.'}
            </p>
          ) : (
            /* STAFF-SS-01 A4: who, how many mornings in a row, last entry —
               longest run first. A missing morning is "Not submitted",
               never 0 or 0%. */
            stats.wellnessMissing.map((row) => (
              <div key={row.athleteId} className="dash-stat-expand-row">
                <span className="dash-squad-dot" style={{ background: 'var(--warn)' }} aria-hidden="true" />
                <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>{row.name}</span>
                <span className="tiny" style={{ color: 'var(--muted)' }}>
                  Not submitted · {runLabel(row.runDays)} ·{' '}
                  {row.lastEntry ? `last entry ${formatDate(row.lastEntry, timezone)}` : 'no entry in the last 90 days'}
                </span>
              </div>
            ))
          )}
          <Link href={wellnessReportHref} className="dash-flags-all">
            Full compliance report ›
          </Link>
        </div>
      ) : null}

      {expanded === 'available' ? (
        <div className="dash-stat-expand" role="region" aria-label="Athletes not fully available">
          <div className="dash-stat-expand-head">
            <span style={{ fontSize: 'var(--fs-13)', fontWeight: 700 }}>Not fully available</span>
            <span className="tiny" style={{ color: 'var(--muted)' }}>
              {stats.modifiedCount} modified, {stats.unavailableCount} out of {stats.availableTotal}
            </span>
          </div>
          {modifiedNamed.length === 0 && unavailableNamed.length === 0 ? (
            <p className="tiny dash-stat-expand-empty">Full squad available — nobody carries a restriction.</p>
          ) : (
            <>
              {modifiedNamed.map((name) => (
                <div key={`mod-${name}`} className="dash-stat-expand-row">
                  <span className="dash-squad-dot" style={{ background: 'var(--warn)' }} aria-hidden="true" />
                  <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>{name}</span>
                </div>
              ))}
              {unavailableNamed.map((name) => (
                <div key={`out-${name}`} className="dash-stat-expand-row">
                  <span className="dash-squad-dot" style={{ background: 'var(--bad)' }} aria-hidden="true" />
                  <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>{name}</span>
                </div>
              ))}
            </>
          )}
          <Link href={squadHref} className="dash-flags-all">
            Full squad ›
          </Link>
        </div>
      ) : null}
    </>
  );
}
