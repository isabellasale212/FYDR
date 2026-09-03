import { Fragment } from 'react';
import Link from 'next/link';
import { Dial } from '@/components/Dial/Dial';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PlanGate } from '@/components/PlanGate/PlanGate';
import { ReportSelectNav } from '@/components/ReportSelectNav/ReportSelectNav';
import { TrainingScatter } from '@/components/TrainingScatter/TrainingScatter';
import { TrainingSparkline } from '@/components/TrainingSparkline/TrainingSparkline';
import { fetchGroups } from '@/lib/queries/groups';
import { mondayOf } from '@/lib/queries/schedule';
import {
  fetchAthleteComparison,
  fetchComparableSessionsComparison,
  fetchMatchBoard,
  fetchMatchOverview,
  fetchMatchSessions,
  fetchPositionComparison,
  fetchRestOfWeekComparison,
  fetchScatterData,
  fetchSelectedAthletePanel,
  fetchTrainingBoard,
  fetchTrainingOverview,
  fetchTrainingSessions,
  scoreTone,
  type ComparisonScope,
  type ComparisonTable,
  type DialScore,
  type ReportMode,
} from '@/lib/queries/trainingReport';
import { recordReportView } from '@/lib/queries/reports';
import { addDays, formatDate, mdLabel } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireReportAccess } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';

/** Sessions with real GPS data, for the "jump to date" dropdown — every one
 *  on record, not just the handful the chip row below has room for
 *  (screens/training-report.md's own O-709, unresolved until now: "how does
 *  a coach reach an older session?"). The chip row keeps its original limit
 *  of 8 for quick recent access; this is the same fetchTrainingSessions /
 *  fetchMatchSessions the chips already use, called once with a higher cap
 *  so both controls share one query and can never disagree about what
 *  counts as "has data". */
const DATE_PICKER_LIMIT = 60;

/** Sentinel stored literally in `?athlete=`, not "param absent" — see its
 *  use below for why the distinction is real. */
const SQUAD_VIEW = '__squad__';

export const metadata = { title: 'Training report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TONE: Record<string, string> = { bad: 'var(--bad)', warn: 'var(--warn)', accent: 'var(--accent)', accent2: 'var(--accent2)' };
const BAND_TONE: Record<'far' | 'near' | 'mid' | 'low', string> = { far: 'var(--bad)', near: 'var(--warn)', mid: 'rgb(var(--accent-rgb) / 0.55)', low: 'var(--accent2)' };

/** Gameplan 4.2 / audit S8: TD/RUN/HSR/HIE/MAXV render on this board with no
 *  explanation anywhere. Definitions sourced from this build's own record of
 *  what each column means, not guessed from general rugby knowledge:
 *  screens/training-report.md's column table (§"Data requirements") and
 *  migration 0023_gps_records.sql's own comment, which is explicit that
 *  RUN and HIE have no fixed threshold in this build — vendor-defined
 *  bands, not a number Fydr enforces. MAXV's km/h display is confirmed in
 *  lib/queries/trainingReport.ts (`max_speed_ms * 3.6`). A lightweight
 *  `title` attribute, not a new component — none existed anywhere in this
 *  codebase (checked before writing this). */
const GPS_TERM_TITLE: Record<string, string> = {
  td: 'TD — Total distance: total metres covered in the session.',
  run: 'RUN — Running distance: metres covered at a running pace, between jogging and the high-speed running band. Exact speed threshold is set per GPS vendor.',
  hsr: 'HSR — High speed running: metres covered above the high-speed running threshold. Threshold is club-configurable.',
  'hsr/min': 'HSR/min — High speed running per minute of time on the pitch.',
  hie: 'HIE — High intensity efforts: count of sharp accelerations and decelerations above the effort threshold. Threshold is club-configurable.',
  'hie/min': 'HIE/min — High intensity efforts per minute of time on the pitch. Threshold is club-configurable.',
  maxv: 'MAXV — Maximum velocity: the fastest speed reached in the session, shown here in km/h.',
};

function qs(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

function DialView({ dial }: { dial: DialScore }) {
  /* An axis this session cannot score still gets its dial. Rendering two dials
   * where three belong leaves a reader working out which one is missing and
   * whether that is a data gap or a design choice; a dash with a reason answers
   * both. Same rule as everywhere else here — absent is not zero. */
  if (dial.value === null) {
    return (
      <div style={{ textAlign: 'center' }}>
        <Dial size={104} pct={0} scaleMax={130} tick={100} tone="var(--track)">
          <div>
            <span className="tr-dial-value" style={{ color: 'var(--faint)' }}>
              —
            </span>
            <div className="tr-dial-of">of typical</div>
          </div>
        </Dial>
        <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12.5 }}>{dial.label}</div>
        <div className="tiny" style={{ color: 'var(--faint)', fontWeight: 700 }}>
          Not scoreable
        </div>
        <div className="tiny num" style={{ color: 'var(--faint)' }}>
          {dial.raw === null ? 'no reading' : 'no reference'}
        </div>
      </div>
    );
  }
  const { tone, statusLabel } = scoreTone(dial.value);
  return (
    <div style={{ textAlign: 'center' }}>
      <Dial size={104} pct={dial.value} scaleMax={130} tick={100} tone={TONE[tone] ?? 'var(--accent)'}>
        <div>
          <span className="tr-dial-value">
            {dial.value}
            <span className="tr-dial-pct">%</span>
          </span>
          <div className="tr-dial-of">of typical</div>
        </div>
      </Dial>
      <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12.5 }}>{dial.label}</div>
      <div className="tiny" style={{ color: TONE[tone], fontWeight: 700 }}>
        {statusLabel}
      </div>
      <div className="tiny num" style={{ color: 'var(--faint)' }}>
        {dial.raw === null ? '—' : dial.raw < 100 ? dial.raw.toFixed(2) : Math.round(dial.raw).toLocaleString()}
        {dial.raw === null ? '' : dial.unit}
      </div>
    </div>
  );
}

function ComparisonTableView({ table }: { table: ComparisonTable }) {
  if (table.rows.length === 0) {
    return <p className="tiny">{table.caption}</p>;
  }
  const gridCols = `minmax(200px, 1.6fr) repeat(${table.columns.length - 1}, minmax(110px, 1fr))`;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="tr-table">
        <div className="tr-table-row" style={{ gridTemplateColumns: gridCols, borderTop: 'none' }}>
          {table.columns.map((c, i) => {
            const lookupKey = c.label.toLowerCase().includes('/min') ? `${c.key}/min` : c.key;
            return (
              <span
                key={c.key}
                className="tiny"
                style={{ textAlign: i === 0 ? 'left' : 'right', textTransform: 'uppercase', fontWeight: 700 }}
                title={GPS_TERM_TITLE[lookupKey]}
              >
                {c.label}
              </span>
            );
          })}
        </div>
        {table.rows.map((row) => {
          const content = (
            <>
              <div>
                <div className="nm" style={{ fontSize: 13.5 }}>
                  {row.label}
                </div>
                {row.sublabel ? <div className="tiny num" style={{ color: 'var(--faint)' }}>{row.sublabel}</div> : null}
              </div>
              {row.cells.map((cell, i) => {
                const tone = cell.pct !== null ? scoreTone(cell.pct).tone : null;
                // columns[0] is the row label, so cell i is column i + 1.
                const pill = table.columns[i + 1]?.pill;
                return (
                  <div key={i} className="tr-table-cell">
                    {pill && cell.value !== '—' ? (
                      <span className={`pill ${pill === 'good' ? 'pill-good' : 'pill-accent'} num`}>{cell.value}</span>
                    ) : (
                    <span className="num" style={{ fontSize: 13.5, color: tone ? TONE[tone] : undefined }}>
                      {cell.value}
                    </span>
                    )}
                    {cell.isScore && cell.pct !== null ? (
                      <div className="tr-bar-track">
                        <div
                          className="tr-bar-fill"
                          style={{ width: `${Math.min(100, (cell.pct / 130) * 100)}%`, background: tone ? TONE[tone] : 'var(--accent)' }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          );
          return row.href ? (
            <Link key={row.id} href={row.href} className={`tr-table-row${row.highlighted ? ' highlighted' : ''}`} style={{ gridTemplateColumns: gridCols }}>
              {content}
            </Link>
          ) : (
            <div key={row.id} className={`tr-table-row${row.highlighted ? ' highlighted' : ''}`} style={{ gridTemplateColumns: gridCols }}>
              {content}
            </div>
          );
        })}
      </div>
      <p className="cap" style={{ marginTop: 10 }}>
        {table.caption}
      </p>
    </div>
  );
}

/** TRAINING-REPORT-SPEC.md, a full pixel-and-behaviour rebuild of the
 *  previous heat-mapped board (screens/training-report.md) — see
 *  lib/queries/trainingReport.ts's header for the scoring model, the real
 *  data behind every number, and the one deliberate reduction: no
 *  first-half/second-half split anywhere (this schema has nothing to
 *  split from), so the Halves card and every halves-dependent column
 *  render as an explicit, labelled absence rather than invented numbers.
 *  Everything else — dials, the scoring model, all four comparison scopes,
 *  the scatter plot, the sparkline, the board — is real, live data. */

/* The board's heat ramps. Five bands against the squad's own p95 for THIS
 * session — a rank inside today's squad, never an absolute standard, which is
 * what the caption and the legend both say.
 *
 * p95 rather than the maximum: one outlier should not compress everyone else
 * into the bottom band, which is exactly what a max-anchored ramp does to a
 * squad containing a single flat-out winger. */
function p95Of(values: readonly (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  return v[Math.min(v.length - 1, Math.round(0.95 * (v.length - 1)))] ?? null;
}

/** Band 0-4, or null when there is nothing to shade against. */
function heatBand(value: number | null, ref: number | null): number | null {
  if (value === null || ref === null || ref <= 0) return null;
  const n = Math.min(1, Math.max(0, value / ref));
  return n < 0.2 ? 0 : n < 0.4 ? 1 : n < 0.6 ? 2 : n < 0.8 ? 3 : 4;
}

/** %Max is already a percentage of the athlete's own best, so it bands on fixed
 *  cuts rather than against the squad — 90% of your own top speed means the
 *  same thing whoever else played. */
function pctMaxBand(pct: number | null): number | null {
  if (pct === null) return null;
  return pct < 70 ? 0 : pct < 80 ? 1 : pct < 85 ? 2 : pct < 90 ? 3 : 4;
}

export default async function TrainingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, tier, timezone } = await requireReportAccess();

  if (!isPremium(tier)) {
    return (
      <PlanGate
        featureName="Training report"
        body="The per-athlete GPS board for one session. It needs GPS records, which arrive through the Premium import."
        metadata="Premium · GPS data import · heat-mapped session board"
      />
    );
  }

  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);
  const mode: ReportMode = sp.mode === 'match' ? 'match' : 'training';
  const groups = await fetchGroups(db, orgId);
  const groupsQs = groupIds.length > 0 ? groupIds.join(',') : undefined;
  // Carried as the raw URL value, not the resolved `selected.sessionId` —
  // both export routes already default to the most recent session when
  // `session` is absent (see export/route.ts), the same fallback this page
  // itself uses, so the header buttons don't need `selected` computed yet
  // and can render before the mode branches below do that work.
  const sessionParam = typeof sp.session === 'string' ? sp.session : undefined;
  // Day/week is a training-only frame — a match is already one day's data
  // and a "week of matches" is rarely more than one fixture, so there is no
  // real second state to switch to.
  const range: 'day' | 'week' = mode === 'training' && sp.range === 'week' ? 'week' : 'day';

  // Heat shading is a view preference, so it lives in the URL like the group
  // filter, the lens and the selected athlete do: shareable, back-button-safe,
  // and no client state on a page that is otherwise entirely server-rendered.
  // On is the default because the shading is the point of the board; off is for
  // reading the raw numbers, or for projecting it in a room where the tints do
  // not survive the projector.
  const heatOn = sp.heat !== 'off';
  /** `qs` with the heat preference carried through, so following any link on
   *  this page — a date, a player, a lens — does not silently turn it back on. */
  const q = (params: Record<string, string | undefined>): string =>
    qs({ ...params, heat: heatOn ? undefined : 'off' });

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  const header = (
    <div className="topbar">
      <div className="page-head">
        <p className="eyebrow">
          {orgName} · {mode === 'training' ? 'TRAINING' : 'MATCH DAY'} · {groupScopeLabel(groups, groupIds).toUpperCase()}
        </p>
        <h1>{mode === 'training' ? 'Training report' : 'Match day GPS report'}</h1>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tr-mode-switch">
          <Link href={`/reports/training${q({ mode: 'training', groups: groupsQs })}`} aria-current={mode === 'training'}>
            Training
          </Link>
          <Link href={`/reports/training${q({ mode: 'match', groups: groupsQs })}`} aria-current={mode === 'match'}>
            Match day
          </Link>
        </div>
        {/* The design's own top-bar control. A link, not a checkbox: it is a
            view state, and this page keeps every view state in the URL. */}
        <Link
          href={`/reports/training${qs({ mode, session: sessionParam, groups: groupsQs, heat: heatOn ? 'off' : undefined })}`}
          className="tr-heat-toggle"
          role="switch"
          aria-checked={heatOn}
        >
          Heat
          <span className="tr-heat-toggle-track" aria-hidden />
        </Link>
        <a href={`/reports/training/export${q({ mode, session: sessionParam, groups: groupsQs })}`} className="btn-ghost">
          Export CSV
        </a>
        <a href={`/reports/training/pdf${q({ mode, session: sessionParam, groups: groupsQs })}`} className="btn-ghost">
          Export PDF
        </a>
      </div>
    </div>
  );

  const groupFilterEl = (
    <div style={{ margin: '10px 0 14px' }}>
      <GroupFilter groups={groups} selected={groupIds} />
    </div>
  );

  // -------------------------------------------------------------------------
  if (mode === 'match') {
    const sessions = await fetchMatchSessions(db, orgId, timezone, DATE_PICKER_LIMIT);
    const selected = sessions.find((s) => s.sessionId === sp.session) ?? sessions[0] ?? null;

    if (!selected) {
      return (
        <>
          {groupFilterEl}
          {header}
          <EmptyState
            title="No match GPS data yet"
            body="No completed match has a GPS record on file. This week's fixture is upcoming and has no record yet, by design — an unplayed session is never rendered as measured data."
          />
        </>
      );
    }

    const [overview, board, comparison] = await Promise.all([
      fetchMatchOverview(db, orgId, groupIds, selected),
      fetchMatchBoard(db, orgId, groupIds, selected),
      fetchComparableSessionsComparison(db, orgId, groupIds, 'match', selected.sessionId, null),
    ]);

    await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, mode });

    const resultGood = selected.result?.startsWith('W');

    return (
      <>
        {groupFilterEl}
        {header}

        <div className="tr-jumprow">
          <ReportSelectNav
            label="Jump to date"
            paramKey="session"
            value={selected.sessionId}
            options={sessions.map((s) => ({ value: s.sessionId, label: `${formatDate(s.date, timezone)} · v ${s.opponent}` }))}
            ariaLabel="Jump to a match with GPS data"
          />
        </div>

        {!overview ? (
          <EmptyState title="No athletes in this filter" body="No one in the current group filter played in this match." />
        ) : (
          <>
            <div className="card tr-overview">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>v {selected.opponent}</span>
                  {selected.result ? (
                    <span className={`pill ${resultGood ? 'pill-good' : 'pill-bad'}`}>{selected.result}</span>
                  ) : null}
                </div>
                <div className="tr-facts">
                  <div>
                    <div className="tr-fact-label">Date</div>
                    <div className="tr-fact-value">{formatDate(selected.date, timezone)}</div>
                  </div>
                  <div>
                    <div className="tr-fact-label">Venue</div>
                    <div className="tr-fact-value">{selected.venue ?? (selected.homeAway === 'home' ? 'Home' : selected.homeAway === 'away' ? 'Away' : '—')}</div>
                  </div>
                  <div>
                    <div className="tr-fact-label">Competition</div>
                    <div className="tr-fact-value">{selected.competition ?? '—'}</div>
                  </div>
                  <div>
                    <div className="tr-fact-label">Squad</div>
                    <div className="tr-fact-value">{overview.athleteCount} athletes</div>
                  </div>
                </div>
                <div className="tr-read">
                  <p className="tiny num" style={{ color: 'var(--faint)', marginTop: 6 }}>
                    {overview.referenceLine}
                  </p>
                </div>
              </div>
              <div className="tr-dials">
                {overview.dials.map((d) => (
                  <DialView key={d.key} dial={d} />
                ))}
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Halves
                </h2>
              </div>
              <p className="tiny" style={{ marginTop: 8 }}>Not available.</p>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Comparison
                  </h2>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <ComparisonTableView table={comparison} />
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <h2 className="card-title">Board</h2>
              <p className="tiny num" style={{ color: 'var(--faint)' }}>
                n = {board.rows.length} played
              </p>
              <div className="tr-board" style={{ marginTop: 10 }}>
                <div className="tr-board-inner match">
                  <div
                    className="tr-board-row"
                    style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 62px repeat(4, minmax(76px, 1fr))', fontWeight: 700, color: 'var(--faint)', fontSize: 11, textTransform: 'uppercase' }}
                  >
                    <span>Player</span>
                    <span className="r">Mins</span>
                    <span className="r" title={GPS_TERM_TITLE.td}>TD</span>
                    <span className="r" title={GPS_TERM_TITLE.hsr}>HSR</span>
                    <span className="r" title={GPS_TERM_TITLE['hsr/min']}>HSR/min</span>
                    <span className="r" title={GPS_TERM_TITLE.hie}>HIE</span>
                  </div>
                  {board.unitOrder.map((unit) => (
                    <div key={unit}>
                      <div className="tr-board-unit-header">{unit}</div>
                      {board.rows
                        .filter((r) => r.group_name === unit)
                        .map((row) => (
                          <div key={row.athlete_id} className="tr-board-row" style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 62px repeat(4, minmax(76px, 1fr))' }}>
                            <Link href={`/reports/athlete/${row.athlete_id}`} className="nm" style={{ fontSize: 13.5 }} title="Open this player's full report">
                              {row.last_name}, {row.first_name}
                            </Link>
                            <span className="r num">{row.mins ?? '—'}</span>
                            <span className="r num">{row.td !== null ? Math.round(row.td).toLocaleString() : '—'}</span>
                            <span className="r num">{row.hsr !== null ? Math.round(row.hsr).toLocaleString() : '—'}</span>
                            <span className="r num">{row.hsr_per_min ?? '—'}</span>
                            <span className="r num">{row.hie ?? '—'}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Training mode
  const sessions = await fetchTrainingSessions(db, orgId, timezone, DATE_PICKER_LIMIT);
  const selected = sessions.find((s) => s.sessionId === sp.session) ?? sessions[0] ?? null;

  if (!selected) {
    return (
      <>
        {groupFilterEl}
        {header}
        <EmptyState title="No GPS data yet" body="No GPS records have been imported. This build has no import pipeline yet — a direct insert is the only path in." />
      </>
    );
  }

  // Chip row (recent, quick access), the full-history date dropdown, and the
  // day/week toggle — shared between the day and week returns below so the
  // two frames present an identical toolbar and neither can drift from the
  // other.
  const trainingToolbar = (activeRange: 'day' | 'week') => (
    <div className="tr-jumprow">
      <ReportSelectNav
        label="Jump to date"
        paramKey="session"
        value={selected.sessionId}
        options={sessions.map((s) => ({ value: s.sessionId, label: `${formatDate(s.date, timezone)} · ${s.title}` }))}
        ariaLabel="Jump to a training session with GPS data"
      />
      <div className="tr-mode-switch">
        <Link href={`/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, range: 'day' })}`} aria-current={activeRange === 'day'}>
          Day
        </Link>
        <Link href={`/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, range: 'week' })}`} aria-current={activeRange === 'week'}>
          Week
        </Link>
      </div>
    </div>
  );

  if (range === 'week') {
    const weekComparison = await fetchRestOfWeekComparison(db, orgId, groupIds, selected.sessionId, selected.date, timezone);
    const weekStart = mondayOf(selected.date);
    const weekEnd = addDays(weekStart, 6);

    await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, mode, range });

    return (
      <>
        {groupFilterEl}
        {header}
        {trainingToolbar('week')}

        <div className="card">
          <h2 className="card-title" style={{ margin: 0 }}>
            Week of {formatDate(weekStart, timezone)} to {formatDate(weekEnd, timezone)}
          </h2>
          <div style={{ marginTop: 14 }}>
            <ComparisonTableView table={weekComparison} />
          </div>
        </div>

        <p className="cap" style={{ marginTop: 14 }}>
          Export CSV and Export PDF above export the selected day&rsquo;s session board, not the week — there is no
          per-athlete week-level board to export, only this squad-mean summary.
        </p>
      </>
    );
  }

  const requestedScope = typeof sp.scope === 'string' ? sp.scope : 'restOfWeek';
  const scope: ComparisonScope = (['restOfWeek', 'comparableSessions', 'position', 'athlete'] as const).includes(requestedScope as ComparisonScope)
    ? (requestedScope as ComparisonScope)
    : 'restOfWeek';
  const lens = sp.lens === 'position' ? 'position' : 'self';

  const [overview, board, scatter] = await Promise.all([
    fetchTrainingOverview(db, orgId, groupIds, selected),
    fetchTrainingBoard(db, orgId, groupIds, selected),
    fetchScatterData(db, orgId, groupIds, selected, lens),
  ]);

  const comparison =
    scope === 'restOfWeek'
      ? await fetchRestOfWeekComparison(db, orgId, groupIds, selected.sessionId, selected.date, timezone)
      : scope === 'comparableSessions'
        ? await fetchComparableSessionsComparison(db, orgId, groupIds, 'training', selected.sessionId, selected.title)
        : scope === 'position'
          ? await fetchPositionComparison(db, orgId, groupIds, 'training', selected.sessionId, selected.title)
          : await fetchAthleteComparison(db, orgId, groupIds, 'training', selected.sessionId, selected.title);

  // SQUAD_VIEW is a real, explicit third state, not just "no param yet" —
  // selecting it from the dropdown below forces the squad-wide view even
  // though a scatter point would otherwise auto-select the top-band athlete.
  // Without it there was no way to ask for "no one" once someone had already
  // been picked, on this page or by following a link with `?athlete=` set.
  const athleteParam = typeof sp.athlete === 'string' ? sp.athlete : undefined;
  const selectedAthleteId = athleteParam === SQUAD_VIEW ? null : (athleteParam ?? scatter[0]?.athleteId ?? null);
  const athletePanel = selectedAthleteId ? await fetchSelectedAthletePanel(db, orgId, selected, selectedAthleteId) : null;
  // Board rows already carry every athlete in scope with a GPS record for
  // this session — the dropdown's real, data-backed option list, not a
  // separate athletes query.
  /* Shading references, computed once per render from the rows actually on
   * screen — so a group filter re-ranks the board inside the filtered squad
   * rather than shading against athletes who are not shown. */
  const hsrP95 = p95Of(board.rows.map((r) => r.hsr));
  const hieP95 = p95Of(board.rows.map((r) => r.hie));

  const athleteOptions = [...new Map(board.rows.map((r) => [r.athlete_id, `${r.last_name}, ${r.first_name}`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));

  await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, mode });

  const md = mdLabel(selected.mdOffset);

  return (
    <>
      {groupFilterEl}
      {header}

      {trainingToolbar('day')}

      {!overview ? (
        <EmptyState title="No athletes in this filter" body="No one in the current group filter has a GPS record for this session." />
      ) : (
        <>
          <div className="card tr-overview">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{selected.title}</span>
                {md ? <span className="pill pill-accent">{md}</span> : null}
              </div>
              <div className="tr-facts">
                <div>
                  <div className="tr-fact-label">Date</div>
                  <div className="tr-fact-value">{formatDate(selected.date, timezone)}</div>
                </div>
                <div>
                  <div className="tr-fact-label">Duration</div>
                  <div className="tr-fact-value">{selected.durationMin ? `${selected.durationMin} min` : '—'}</div>
                </div>
                <div>
                  <div className="tr-fact-label">Where</div>
                  <div className="tr-fact-value">{selected.location ?? '—'}</div>
                </div>
                <div>
                  <div className="tr-fact-label">Athletes</div>
                  <div className="tr-fact-value">{overview.athleteCount}</div>
                </div>
              </div>
              <div className="tr-read">
                {/* The headline sentence ("A lighter session than usual, and
                    high speed running is what made it lighter") is gone, as it
                    is on the match-day view: the three dials directly beside it
                    say the same thing per axis, with the numbers. The reference
                    line stays — it is the only place the values the dials are
                    scored AGAINST, and how many sessions are behind them,
                    appear at all. */}
                <p className="tiny num" style={{ color: 'var(--faint)', marginTop: 6 }}>
                  {overview.referenceLine}
                </p>
              </div>
            </div>
            <div className="tr-dials">
              {overview.dials.map((d) => (
                <DialView key={d.key} dial={d} />
              ))}
            </div>
          </div>

                    {/* THE DESIGN'S TWO-COLUMN PAIR: the board on the left, the athlete
              rail on the right, directly under the session card. They belong
              side by side because they are read together — you pick a player
              out of the board and read them beside it — and they belong here
              because the board is what this page is for. Comparison and the
              scatter follow underneath; they are real, wide tables that need
              the whole width and are not in this design at all. */}
          <div className="tr-lower">
            <div className="tr-lower-main">
<div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">Board</h2>
            <p className="tiny num" style={{ color: 'var(--faint)' }}>
              n = {board.rows.length} athletes
            </p>
            <div className="tr-board" style={{ marginTop: 10 }}>
              <div className="tr-board-inner">
                <div
                  className="tr-board-row"
                  style={{ gridTemplateColumns: 'minmax(170px, 1.3fr) repeat(5, minmax(66px, 1fr))', fontWeight: 700, color: 'var(--faint)', fontSize: 11, textTransform: 'uppercase' }}
                >
                  <span>Player</span>
                  <span className="r" title={GPS_TERM_TITLE.td}>TD</span>
                  <span className="r" title={GPS_TERM_TITLE.hsr}>HSR</span>
                  <span className="r" title={GPS_TERM_TITLE.hie}>HIE</span>
                  <span className="r" title={GPS_TERM_TITLE.maxv}>MaxV</span>
                  <span className="r" title="Today's max velocity as a percentage of this athlete's own best on record for this session type">
                    %Max
                  </span>
                </div>
                {board.unitOrder.map((unit) => {
                  const inUnit = board.rows.filter((r) => r.group_name === unit);
                  const unitMean =
                    inUnit.filter((r) => r.td !== null).length > 0
                      ? Math.round(
                          inUnit.reduce((t, r) => t + (r.td ?? 0), 0) / inUnit.filter((r) => r.td !== null).length,
                        )
                      : null;
                  return (
                    <div key={unit}>
                      {/* The unit's own mean sits on its header, which is where the
                          design puts the squad comparison: a coach reads a row
                          against the line above it rather than against a column of
                          percentages. */}
                      <div className="tr-board-unit-header">
                        <span>{unit}</span>
                        {unitMean !== null ? (
                          <span className="num tr-unit-mean">unit mean {unitMean.toLocaleString()} m</span>
                        ) : null}
                      </div>
                      {inUnit.map((row) => (
                        /* CLICKABLE. Selecting a player here does the same thing as
                           clicking one in the scatter — it sets ?athlete=, which
                           drives the Individual player card and the whole page's
                           lens. A link rather than a handler, so it is
                           back-button-safe and shareable, and so a coach can open
                           one in a new tab. */
                        <Link
                          key={row.athlete_id}
                          href={`/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens, athlete: row.athlete_id })}`}
                          className={`tr-board-row tr-board-row-link${row.athlete_id === selectedAthleteId ? ' selected' : ''}`}
                          /* The design washes a few rows red. It marks the ones
                             the rail already names: an athlete well ABOVE their
                             own high-speed norm. Up only, and deliberately —
                             running much less than usual is worth knowing but is
                             not the thing that hurts someone, and tinting both
                             directions the same colour would say it was. */
                          data-spike={heatOn && row.hsr_self_n >= 2 && (row.vs_self_hsr ?? 0) >= 125 ? '1' : undefined}
                          style={{ gridTemplateColumns: 'minmax(170px, 1.3fr) repeat(5, minmax(66px, 1fr))' }}
                          aria-current={row.athlete_id === selectedAthleteId}
                        >
                          <span className="nm" style={{ fontSize: 13.5 }}>
                            {row.last_name}, {row.first_name}
                          </span>
                          <span className="r num">{row.td !== null ? Math.round(row.td).toLocaleString() : '—'}</span>
                          <span className="r num tr-heat" data-band={heatOn ? heatBand(row.hsr, hsrP95) : null} data-ramp="hsr">
                            {row.hsr !== null ? Math.round(row.hsr).toLocaleString() : '—'}
                          </span>
                          <span className="r num tr-heat" data-band={heatOn ? heatBand(row.hie, hieP95) : null} data-ramp="hie">
                            {row.hie ?? '—'}
                          </span>
                          <span className="r num">{row.maxv_kmh ?? '—'}</span>
                          <span className="r num tr-heat" data-band={heatOn ? pctMaxBand(row.pct_max) : null} data-ramp="pct">
                            {row.pct_max !== null ? `${row.pct_max}%` : '—'}
                          </span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
            </div>
            <div className="tr-lower-rail">
              <div className="card" style={{ marginTop: 14 }}>
              {/* The design's rail card leads with the athlete, not a card title:
                    by the time you are reading this you already clicked their
                    row, so "Individual player" is a label for something you
                    know. The picker stays for the state the design does not
                    draw — nobody selected yet — because without it there is no
                    keyboard route into this card. */}
                {!athletePanel ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <h2 className="card-title" style={{ margin: 0 }}>
                      Individual player
                    </h2>
                    <ReportSelectNav
                      label="View"
                      paramKey="athlete"
                      value={selectedAthleteId ?? SQUAD_VIEW}
                      options={[{ value: SQUAD_VIEW, label: 'Whole squad (none selected)' }, ...athleteOptions]}
                      ariaLabel="View one athlete's own data for this session, or the whole squad"
                    />
                  </div>
                ) : null}
                {!athletePanel ? (
                <p className="tiny">Select an athlete above, or on the scatter, to see their detail.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'var(--avatar-bg)',
                        color: 'var(--avatar-text)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        flex: 'none',
                      }}
                    >
                      {athletePanel.name.split(', ').reverse().map((n) => n[0]).join('')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{athletePanel.name}</div>
                      <div className="tiny" style={{ color: 'var(--faint)' }}>
                        {athletePanel.unit}
                      </div>
                    </div>
                    {/* Straight to their profile, where the session this page
                        is about is one row of their whole history. */}
                    <Link
                      href={`/squad/${selectedAthleteId}`}
                      className="tiny"
                      style={{ marginLeft: 'auto', color: 'var(--accent-text)', fontWeight: 600 }}
                    >
                      Profile
                    </Link>
                  </div>

                  <div className="tr-selected-panel-table" style={{ marginTop: 14 }}>
                    <span className="tiny" style={{ fontWeight: 700 }}>
                      Metric
                    </span>
                    <span className="tiny r" style={{ fontWeight: 700 }}>
                      Today
                    </span>
                    <span className="tiny r" style={{ fontWeight: 700 }}>
                      vs self
                    </span>
                    <span className="tiny r" style={{ fontWeight: 700 }}>
                      vs unit
                    </span>
                    {athletePanel.rows.map((r) => (
                      <Fragment key={r.metric}>
                        <span>{r.metric}</span>
                        <span className="r num">{r.today}</span>
                        <span className="r num">{r.vsSelf}</span>
                        <span className="r num">{r.vsUnit}</span>
                      </Fragment>
                    ))}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <p className="tiny" style={{ marginBottom: 6 }}>
                      High speed running, last {athletePanel.sparkline.length} sessions
                    </p>
                    <TrainingSparkline
                      points={athletePanel.sparkline}
                      endTone={BAND_TONE[scatter.find((p) => p.athleteId === selectedAthleteId)?.band ?? 'mid']}
                    />
                    <p className="tiny num" style={{ color: 'var(--faint)', marginTop: 4 }}>
                      {athletePanel.footnote}
                    </p>
                  </div>

                  {/* "Raise a flag" used to sit here (`/flags?athlete=`),
                   * found dead while surveying flag-related nav for the
                   * dashboard panel: /flags never reads that param, and
                   * there is no manual-raise mutation anywhere in
                   * lib/queries/flags.ts — flags are only ever raised
                   * automatically by threshold logic (screens/flags.md's
                   * own model). A button that looked like it worked but
                   * silently landed on an unfiltered list is worse than
                   * no button; removed rather than wired to a manual-raise
                   * feature this pass has no spec authority to invent. */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <Link href={`/squad/${athletePanel.athleteId}`} className="btn-ghost">
                      Open profile
                    </Link>
                    {/* /reports/athlete/[athleteId] already exists as the
                     * dedicated one-athlete report — real period selector
                     * (ATHLETE_PERIODS: week/month/season/year/all, over the
                     * shared model in lib/period.ts; the old 28/90-day chip
                     * row is gone), real GPS totals for that period,
                     * wellness, load and testing, its own CSV/PDF export.
                     * That is the individual player's data in full;
                     * duplicating a second day/week/period picker for one
                     * athlete inside the training report would mean
                     * re-deriving athleteReport.ts's own query logic for
                     * no real benefit over linking to it. */}
                    <Link href={`/reports/athlete/${athletePanel.athleteId}`} className="btn-ghost">
                      Full player report
                    </Link>
                  </div>
                </>
              )}
            </div>
{/* OUTSIDE THEIR NORMAL RANGE, from the Training report design's own
              right rail. The board answers "who did most today"; this answers
              "who did something unlike themselves", which is a different and
              usually more actionable question — a low-volume athlete running
              hard for THEM never rises up a squad-ranked board.

              Compared against each athlete's own baseline, never the squad,
              which is the panel's own subtitle and the reason it exists. The
              baseline is their other sessions of this same title rather than a
              literal 28 days: same-title is what makes two sessions
              comparable, and it is the baseline the board's vs-self column
              already uses. Said plainly in the caption rather than borrowing
              the design's "28-day" wording, which this data is not. */}
          {(() => {
            const OUT = 12; // percent from their own normal before it is worth a coach's attention
            const outliers = board.rows
              .filter((r) => r.vs_self_hsr !== null && r.hsr_self_n >= 2 && Math.abs(r.vs_self_hsr - 100) >= OUT)
              .sort((a, b) => Math.abs((b.vs_self_hsr ?? 100) - 100) - Math.abs((a.vs_self_hsr ?? 100) - 100))
              .slice(0, 5);
            return (
              <div className="card" style={{ marginTop: 14 }}>
                <h2 className="card-title">Outside their normal range</h2>
                <p className="tiny" style={{ color: 'var(--muted)', marginTop: 2 }}>
                  High speed running against each athlete&rsquo;s own mean for this session, not the squad.
                </p>
                {outliers.length === 0 ? (
                  <p className="tiny" style={{ color: 'var(--faint)', marginTop: 12 }}>
                    Nobody ran more than {OUT}% from their own normal today. An athlete needs at least two
                    previous sessions of this type before they have a baseline to be outside of.
                  </p>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    {outliers.map((r) => {
                      const pct = r.vs_self_hsr ?? 100;
                      const up = pct >= 100;
                      const delta = `${up ? '+' : '−'}${Math.abs(pct - 100)}%`;
                      return (
                        <div key={r.athlete_id} className="tr-outlier">
                          <div className="tr-outlier-head">
                            <span className="tr-outlier-name">
                              {r.last_name}, {r.first_name}
                            </span>
                            <span
                              className="num tr-outlier-delta"
                              style={{ color: up ? 'var(--warn-text)' : 'var(--accent-text)' }}
                            >
                              {delta}
                            </span>
                          </div>
                          <p className="tiny" style={{ color: 'var(--muted)', margin: '3px 0 0' }}>
                            {r.last_name} ran {up ? 'more' : 'less'} high speed running than a normal {selected.title}{' '}
                            for {up ? 'them' : 'them'}.
                          </p>
                          {/* Fydr's copy rule: never shorten an evidence line. */}
                          <p className="tiny num" style={{ color: 'var(--faint)', margin: '3px 0 0' }}>
                            today {Math.round(r.hsr ?? 0).toLocaleString('en-GB')} m · their mean{' '}
                            {Math.round(r.hsr_self_mean ?? 0).toLocaleString('en-GB')} m · n = {r.hsr_self_n} sessions
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
{/* HEAT BANDS. The board's three ramps, named. Without it the shading is
              a colour a coach has to infer a meaning for; with it the scale is
              stated once and the board's own caption can stay short. */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">Heat bands</h2>
            {[
              { ramp: 'hsr', label: 'HSR', note: 'high speed running' },
              { ramp: 'hie', label: 'HIE', note: 'high intensity efforts' },
              { ramp: 'pct', label: '%Max', note: 'of their own best velocity' },
            ].map((r) => (
              <div key={r.ramp} className="tr-legend-row">
                <span className="tr-legend-label">
                  {r.label} <span style={{ color: 'var(--faint)', fontWeight: 400 }}>{r.note}</span>
                </span>
                <span className="tr-legend-ramp">
                  {[0, 1, 2, 3, 4].map((b) => (
                    <span key={b} className="tr-heat tr-legend-step" data-band={b} data-ramp={r.ramp} />
                  ))}
                </span>
              </div>
            ))}
            <div className="tr-legend-ends">
              <span>Low</span>
              <span>p95</span>
            </div>
          </div>
            </div>
          </div>

<div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Comparison
                </h2>
              </div>
              <div className="tr-scope-chips">
                {([
                  ['restOfWeek', 'Rest of the week'],
                  ['comparableSessions', 'Comparable sessions'],
                  ['position', 'Position'],
                  ['athlete', 'Athlete'],
                ] as const).map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope: key })}`}
                    className="tr-scope-chip"
                    aria-current={scope === key}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <ComparisonTableView table={comparison} />
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Scatter
                </h2>
                <div className="tr-scope-chips">
                  <Link
                    href={`/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens: 'self', athlete: selectedAthleteId ?? undefined })}`}
                    className="tr-scope-chip"
                    aria-current={lens === 'self'}
                  >
                    vs self
                  </Link>
                  <Link
                    href={`/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens: 'position', athlete: selectedAthleteId ?? undefined })}`}
                    className="tr-scope-chip"
                    aria-current={lens === 'position'}
                  >
                    vs unit
                  </Link>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <TrainingScatter
                  points={scatter}
                  selectedAthleteId={selectedAthleteId}
                  lens={lens}
                  hrefFor={(id) => `/reports/training${q({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens, athlete: id })}`}
                />
              </div>
            </div>
                  </>
      )}
    </>
  );
}
