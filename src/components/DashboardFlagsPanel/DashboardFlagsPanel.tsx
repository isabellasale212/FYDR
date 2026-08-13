'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AttentionRow } from '@/lib/queries/flags';
import { enumLabel } from '@/lib/format';

type Props = {
  rows: AttentionRow[];
  openTotal: number;
  /** Still raised/notified — the count that actually needs a click. */
  awaitingAck: number;
  /** Severity counts across ALL open flags (not just the top rows), from
   *  the same query /flags reads — the summary line and the flags list can
   *  never disagree (audit coach findings 3/14). */
  bySeverity: Record<AttentionRow['severity'], number>;
};

const SEVERITY_COLOR: Record<AttentionRow['severity'], string> = {
  high: 'var(--bad)',
  medium: 'var(--warn-text)',
  low: 'var(--accent-text)',
};

/** A bold, filled pennant — deliberately not the thin two-stroke outline the
 *  old sidebar row used. This is the one flag glyph left in the app now
 *  that Flags has no nav row of its own, so it carries more weight: solid
 *  fill, --bad red, sized to read from across the screen. */
function FlagIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 2v16" stroke="var(--bad)" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M5 3c2.2-1.4 4.4-1.4 6.6 0 2.2 1.4 4.4 1.4 6.6 0v8c-2.2 1.4-4.4 1.4-6.6 0-2.2-1.4-4.4-1.4-6.6 0V3z"
        fill="var(--bad)"
      />
    </svg>
  );
}

/** ATHLETE-APP-SPEC.md's sibling on the staff side: flags used to have
 *  their own sidebar row (a full, severity-sorted list at /flags — still
 *  real, still there); this is what replaced it on the dashboard itself —
 *  a button, closed by default, showing the total and the worst severity
 *  breakdown before a coach has tapped anything, that expands into
 *  fetchDashboardAttention's real top-5-athletes-by-severity rows. Each
 *  row links to the athlete's own real Flags card
 *  (PlayerProfileFlags.tsx's #pp-flags-title) — the exact place on the
 *  profile a flag lives, already real, already actionable (acknowledge is
 *  right there), not a new destination invented for this panel. */
export function DashboardFlagsPanel({ rows, openTotal, awaitingAck, bySeverity }: Props) {
  const [open, setOpen] = useState(false);

  const high = bySeverity.high;
  const medium = bySeverity.medium;

  if (openTotal === 0) {
    return (
      <div className="dash-flags-panel" data-empty="true">
        <FlagIcon />
        <span className="dash-flags-summary">No open flags right now.</span>
      </div>
    );
  }

  return (
    <div className="dash-flags-panel">
      <button
        type="button"
        className="dash-flags-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} open flags summary: ${openTotal} open flag${openTotal === 1 ? '' : 's'}${
          high > 0 ? `, ${high} high severity` : ''
        }${medium > 0 ? `, ${medium} medium severity` : ''}, ${
          awaitingAck === 0 ? 'all acknowledged' : `${awaitingAck} awaiting acknowledgement`
        }`}
      >
        <FlagIcon />
        <span className="dash-flags-summary">
          <b>{openTotal}</b> open flag{openTotal === 1 ? '' : 's'}
          {high > 0 ? (
            <span style={{ color: 'var(--bad)' }}> · {high} high</span>
          ) : null}
          {medium > 0 ? (
            <span style={{ color: 'var(--warn-text)' }}> · {medium} medium</span>
          ) : null}
          <span className="tiny">
            {' '}
            · {awaitingAck === 0 ? 'all acknowledged' : `${awaitingAck} awaiting acknowledgement`}
          </span>
          {rows.length < openTotal ? (
            <span className="tiny"> · top {rows.length} athletes shown</span>
          ) : null}
        </span>
        <span className="dash-flags-chevron" data-open={open} aria-hidden="true">
          ⌄
        </span>
      </button>

      {open ? (
        <div className="dash-flags-list">
          {rows.map((r) => (
            <Link
              key={r.athlete_id}
              href={`/squad/${r.athlete_id}#pp-flags-title`}
              className="dash-flags-row"
              aria-label={`View ${r.name}'s ${enumLabel(r.domain).toLowerCase()} flag, ${r.severity} severity${
                r.escalated ? ', escalated' : ''
              }. ${r.what} ${r.value}${r.baseline ? ` versus ${r.baseline} expected` : ''}, ${r.duration}${
                r.flag_count > 1 ? `, plus ${r.flag_count - 1} more flag${r.flag_count - 1 === 1 ? '' : 's'} for this athlete` : ''
              }`}
            >
              <span
                className="dash-flags-dot"
                style={{ background: SEVERITY_COLOR[r.severity] }}
                aria-hidden="true"
              />
              <span className="dash-flags-name">{r.name}</span>
              {r.escalated ? <span className="pill pill-bad">Escalated</span> : null}
              <span className="pill pill-neutral">{enumLabel(r.domain)}</span>
              <span className="dash-flags-what">
                {r.what} <span className="mono">{r.value}</span>
                {r.baseline ? <span className="tiny"> vs {r.baseline}</span> : null}
              </span>
              <span className="tiny dash-flags-duration">{r.duration}</span>
              {r.flag_count > 1 ? (
                <span className="tiny mono">+{r.flag_count - 1} more</span>
              ) : null}
              <span className="chev" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}
          <Link href="/flags" className="dash-flags-all">
            See every open flag →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
