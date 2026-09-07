'use client';

import { useState } from 'react';
import Link from 'next/link';
import { enumLabel } from '@/lib/format';
import type { AttentionRow } from '@/lib/queries/flags';

type Props = {
  rows: AttentionRow[];
  openTotal: number;
  awaitingAck: number;
  /** Severity counts across ALL open flags (not just the top rows), from
   *  fetchDashboardAttention — so the header reports the squad, not the page. */
  bySeverity: Record<AttentionRow['severity'], number>;
};

function FlagIcon() {
  return (
    <svg className="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M3.5 14V2.5h9l-2 3 2 3h-9" strokeLinejoin="round" />
    </svg>
  );
}

/* Fydr Dashboard Flags.dc.html.
 *
 * The panel used to be one collapsible summary over a list of one-line rows,
 * each linking away to a profile. A coach reading it could see THAT an athlete
 * was flagged but not WHY without leaving the dashboard — and the row already
 * said "+3 more" without ever showing what the three were.
 *
 * Now each athlete's row expands in place onto its own flags: which rule fired,
 * the reading and the baseline that fired it, and how hard. All of it comes off
 * the rows the panel already had, so an expanded row cannot disagree with the
 * count beside it.
 *
 * One athlete open at a time. The point of the panel is triage across the
 * squad; several rows open at once turns it back into the scrolling list it
 * replaced. */
export function DashboardFlagsPanel({ rows, openTotal, awaitingAck, bySeverity }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  /* Collapsed on load, per the design review. The dashboard's job is to say
     what needs attention; forty-two flags expanded by default pushed the rest
     of the page below the fold to say it. The header still carries the count
     and the severity split, so nothing is hidden — only the rows are. */
  const [listOpen, setListOpen] = useState(false);

  if (openTotal === 0) {
    return (
      <div className="dash-flags-panel" data-empty="true">
        <FlagIcon />
        <span className="dash-flags-summary">No open flags right now.</span>
      </div>
    );
  }

  const high = bySeverity.high;
  const medium = bySeverity.medium;

  return (
    <div className="dash-flags-panel">
      {/* The whole header is the toggle, not a chevron you have to hit — a
          full-width target on a row that is already one line of related facts.
          A <button> rather than a div with a handler, so it is reachable by
          keyboard and announces its own state. */}
      <button
        type="button"
        className="dash-flags-head"
        aria-expanded={listOpen}
        aria-controls="dash-flags-list"
        onClick={() => setListOpen((v) => !v)}
      >
        <span className="dash-flags-badge" aria-hidden="true">
          <FlagIcon />
        </span>
        <span className="dash-flags-headtext">
          <span className="dash-flags-headline">
            <span className="dash-flags-count">{openTotal}</span>
            <span className="dash-flags-word">open flag{openTotal === 1 ? '' : 's'}</span>
          </span>
          {high > 0 || medium > 0 ? (
            <span className="dash-flags-pills">
              {high > 0 ? <span className="pill pill-bad">{high} high priority</span> : null}
              {medium > 0 ? <span className="pill pill-warn">{medium} medium priority</span> : null}
            </span>
          ) : null}
          {/* LOW-SEVERITY FLAGS GET NO PILL, which is existing behaviour kept
              deliberately rather than an omission: they are counted in the
              total above, and a third pill on every card would spend the row's
              attention on the tier that least needs it. */}
          <span className="dash-flags-head-meta">
            {awaitingAck === 0
              ? 'all of these have been reviewed'
              : `${awaitingAck} of these haven't been reviewed by anyone yet`}
          </span>
        </span>
        {rows.length < openTotal ? (
          <span className="dash-flags-head-scope">top {rows.length} athletes</span>
        ) : null}
        <span className="dash-flags-head-chevron" data-open={listOpen} aria-hidden="true">
          &#9660;
        </span>
      </button>

      {listOpen ? (
      <div className="dash-flags-list" id="dash-flags-list">
        {rows.map((r) => {
          const isOpen = openId === r.athlete_id;
          return (
            <div
              key={r.athlete_id}
              className="dash-flags-item"
              data-open={isOpen}
              /* The severity moves from an 8px dot to the row's own left edge.
                 Same three tiers, same tokens — high --bad, medium --warn, low
                 --domain-recovery — so a low flag still reads as a low flag. */
              data-severity={r.severity}
            >
              <button
                type="button"
                className="dash-flags-row"
                aria-expanded={isOpen}
                onClick={() => setOpenId((cur) => (cur === r.athlete_id ? null : r.athlete_id))}
              >
                <span className="dash-flags-main">
                  <span className="dash-flags-nameline">
                    <span className="dash-flags-name">{r.name}</span>
                    <span className="dash-flags-position">{r.position ?? enumLabel(r.domain)}</span>
                  </span>
                  <span className="dash-flags-what">
                    {r.what} {r.value}
                    {r.baseline ? ` vs his own ${r.baseline}` : ''}
                  </span>
                </span>
                <span className="dash-flags-meta">
                  {/* NOT "Sent to medical staff". `escalated` means the flag has
                      gone 24 hours unacknowledged (screens/30-flags.md §55) —
                      a timer, not a handover. Nothing routes it to anybody, and
                      a pill saying otherwise would be a false claim on the card
                      a medic reads first. */}
                  {r.escalated ? <span className="pill pill-bad">Unacknowledged 24h+</span> : null}
                  <span className="dash-flags-duration">{r.unreviewed}</span>
                </span>
                <span className="dash-flags-chevron" data-open={isOpen} aria-hidden="true">
                  ›
                </span>
              </button>

              {isOpen ? (
                <div className="dash-flags-detail">
                  {r.flags.map((f) => (
                    <div key={f.id} className="dash-flags-evidence">
                      <span className="dash-flags-rule">{f.rule}</span>
                      <span className="dash-flags-eviline">{f.evidence}</span>
                      <span
                        className={`pill ${
                          f.severity === 'high' ? 'pill-bad' : f.severity === 'medium' ? 'pill-warn' : 'pill-neutral'
                        }`}
                      >
                        {enumLabel(f.severity)}
                      </span>
                    </div>
                  ))}
                  {/* The first click goes to the PERSON, not the task. Changed
                      2026-09-06: this was "Review N flags", straight into flag
                      handling, which answered a question the reader had not
                      asked yet. Someone opening a flag from the dashboard is
                      usually working out who this is and what else is going on
                      with them, and the profile carries that — availability,
                      recent wellness, load, and the flags themselves.

                      Acknowledging is still a real write and still belongs
                      where the flags are managed. It has not moved: the profile
                      carries the same flag card, and /flags is one click from
                      the sidebar. Both links here carry the athlete so the
                      destination opens on them. */}
                  <div className="dash-flags-actions">
                    <Link href={`/squad/${r.athlete_id}`} className="btn-primary">
                      View player profile
                    </Link>
                    <Link href={`/reports/athlete/${r.athlete_id}`} className="btn-ghost">
                      Open athlete report
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        <Link href="/flags" className="dash-flags-all">
          See every open flag →
        </Link>
      </div>
      ) : null}
    </div>
  );
}
