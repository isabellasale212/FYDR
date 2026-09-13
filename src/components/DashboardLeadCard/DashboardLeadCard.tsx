import Link from 'next/link';
import type { SaturdayReadiness, SquadStateEntry } from '@/lib/queries/dashboard';
import { leadSubLine, leadTitle } from '@/lib/dashboardLead';

/* STAFF-SS-01 C2 — the matchday lead card (2026-09-13). The board's pattern:
 * "The matchday card is the one emphasised card. The lead keeps 'Ready for
 * {matchday}' with doubtful and ruled out. No other dashboard card may take
 * the emphasised treatment." It replaces the readiness card that sat in the
 * right column: the same read (fetchSaturdayReadiness), moved to the top
 * and restated —
 *
 *   the eyebrow "Ready for Saturday", the fixture as a title, and the
 *   denominator said ("27 of 30 have a current status · 3 not recorded ·
 *   MD in 5 days"); three counts, Full / Doubtful / Ruled out; then the
 *   two named lists as tone cards (A1's treatment), one athlete a row with
 *   the status word and the restriction line — what a session is planned
 *   against — and, for the medic only, the reason beneath it (data rule 6
 *   literally: an injury's line under "Medical · visible to medical staff",
 *   a non-clinical reason without the label).
 *
 * The ring (MET-014) is gone — Full + Doubtful IS the named count, and the
 * three numbers say it; the week load (MET-015), the flags affecting
 * selection and the sessions left keep their place as the card's tail line
 * rather than leaving the page: a registry surface is not dropped by a
 * layout step (on the decision sheet). */

export type ReasonLine = { text: string; clinical: boolean };

type Props = {
  readiness: SaturdayReadiness;
  /** The fixture's weekday — the card is only drawn when there is one. */
  matchday: string;
  timezone: string;
  scopeLabel: string;
  /** The medic's reason lines keyed by athlete id; null for every other
   *  role, which is what makes the lists say nothing about why. */
  reasons: ReadonlyMap<string, ReasonLine> | null;
  squadHref: string;
  flagsHref: string;
  scheduleHref: string;
};

function AthleteRow({ entry, reason, squadHref }: { entry: SquadStateEntry; reason: ReasonLine | null; squadHref: string }) {
  return (
    <Link href={`${squadHref}/${entry.athleteId}`} className="dash-lead-row">
      <span className="dash-lead-name">{entry.name}</span>
      <span className="dash-lead-line">{entry.line}</span>
      {reason ? (
        <>
          <span className="dash-lead-reason">{reason.text}</span>
          {reason.clinical ? <span className="dash-lead-med">Medical · visible to medical staff</span> : null}
        </>
      ) : null}
    </Link>
  );
}

export function DashboardLeadCard({ readiness, matchday, timezone, scopeLabel, reasons, squadHref, flagsHref, scheduleHref }: Props) {
  const doubtful = readiness.modifiedNames;
  const out = readiness.unavailableNames;
  const flagsRow = readiness.rows.find((r) => r.key === 'flags');
  const sessionsRow = readiness.rows.find((r) => r.key === 'sessions');
  const withReason = reasons ? ', with reason' : '';

  return (
    <section className="card dash-lead" aria-labelledby="dash-lead-title">
      <div className="dash-lead-head">
        <div>
          <p className="eyebrow">Ready for {matchday}</p>
          <h2 id="dash-lead-title" className="dash-lead-title">
            {readiness.opponent && readiness.kickoffAt
              ? leadTitle({ opponent: readiness.opponent, kickoffAt: readiness.kickoffAt, homeAway: readiness.homeAway }, timezone)
              : 'Next fixture'}
          </h2>
          <p className="dash-lead-sub">
            {leadSubLine({ withStatus: readiness.withStatus, squadTotal: readiness.squadTotal, daysOut: readiness.daysOut })} · {scopeLabel}
          </p>
        </div>
        <div className="dash-lead-stats" role="list" aria-label="Availability for selection">
          {(
            [
              { key: 'full', n: readiness.available, label: 'Full', tone: undefined },
              { key: 'doubtful', n: readiness.modified, label: 'Doubtful', tone: 'warn' },
              { key: 'out', n: readiness.unavailable, label: 'Ruled out', tone: 'bad' },
            ] as const
          ).map((s) => (
            <Link key={s.key} href={squadHref} className="dash-lead-stat" role="listitem" data-tone={s.tone}>
              <span className="dash-lead-stat-n num">{s.n}</span>
              <span className="dash-lead-stat-k">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="dash-lead-lists">
        <div className="dash-lead-list" data-tone="warn">
          <h3 className="dash-lead-list-title">
            Doubtful · {doubtful.length}
            {withReason}
          </h3>
          {doubtful.length === 0 ? (
            <p className="dash-lead-none">Nobody this week</p>
          ) : (
            doubtful.map((e) => <AthleteRow key={e.athleteId} entry={e} reason={reasons?.get(e.athleteId) ?? null} squadHref={squadHref} />)
          )}
        </div>
        <div className="dash-lead-list" data-tone="bad">
          <h3 className="dash-lead-list-title">
            Ruled out · {out.length}
            {withReason}
          </h3>
          {out.length === 0 ? (
            <p className="dash-lead-none">Nobody this week</p>
          ) : (
            out.map((e) => <AthleteRow key={e.athleteId} entry={e} reason={reasons?.get(e.athleteId) ?? null} squadHref={squadHref} />)
          )}
        </div>
      </div>

      <div className="dash-lead-tail">
        {readiness.weekLoad ? (
          <span>
            <span className="dash-lead-tail-k">Week load so far</span>{' '}
            <span className="num">{readiness.weekLoad.pct !== null ? `${readiness.weekLoad.pct}%` : '—'}</span>
          </span>
        ) : null}
        {flagsRow ? (
          <Link href={flagsHref}>
            <span className="dash-lead-tail-k">Flags affecting selection</span> <span className="num">{flagsRow.value}</span> ›
          </Link>
        ) : null}
        {sessionsRow ? (
          <Link href={scheduleHref}>
            <span className="dash-lead-tail-k">Sessions left to run</span> <span className="num">{sessionsRow.value}</span> ›
          </Link>
        ) : null}
      </div>
    </section>
  );
}
