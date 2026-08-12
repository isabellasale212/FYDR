import { Fragment } from 'react';
import Link from 'next/link';
import { Dial } from '@/components/Dial/Dial';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PlanGate } from '@/components/PlanGate/PlanGate';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { TrainingScatter } from '@/components/TrainingScatter/TrainingScatter';
import { TrainingSparkline } from '@/components/TrainingSparkline/TrainingSparkline';
import { fetchGroups } from '@/lib/queries/groups';
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
import { formatDate, mdLabel } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireReportAccess } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Training report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TONE: Record<string, string> = { bad: 'var(--bad)', warn: 'var(--warn)', accent: 'var(--accent)', accent2: 'var(--accent2)' };
const BAND_TONE: Record<'far' | 'near' | 'mid' | 'low', string> = { far: 'var(--bad)', near: 'var(--warn)', mid: 'rgb(var(--accent-rgb) / 0.55)', low: 'var(--accent2)' };

function qs(params: Record<string, string | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
}

function DialView({ dial }: { dial: DialScore }) {
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
      <div className="tiny mono" style={{ color: 'var(--faint)' }}>
        {dial.raw < 100 ? dial.raw.toFixed(2) : Math.round(dial.raw).toLocaleString()}
        {dial.unit}
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
          {table.columns.map((c, i) => (
            <span key={c.key} className="tiny" style={{ textAlign: i === 0 ? 'left' : 'right', textTransform: 'uppercase', fontWeight: 700 }}>
              {c.label}
            </span>
          ))}
        </div>
        {table.rows.map((row) => {
          const content = (
            <>
              <div>
                <div className="nm" style={{ fontSize: 13.5 }}>
                  {row.label}
                </div>
                {row.sublabel ? <div className="tiny mono" style={{ color: 'var(--faint)' }}>{row.sublabel}</div> : null}
              </div>
              {row.cells.map((cell, i) => {
                const tone = cell.pct !== null ? scoreTone(cell.pct).tone : null;
                return (
                  <div key={i} className="tr-table-cell">
                    <span className="mono" style={{ fontSize: 13.5, color: tone ? TONE[tone] : undefined }}>
                      {cell.value}
                    </span>
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
export default async function TrainingReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, tier } = await requireReportAccess();

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

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  const header = (
    <div className="topbar">
      <div className="page-head">
        <p className="eyebrow">
          {orgName} · {mode === 'training' ? 'TRAINING' : 'MATCH DAY'} · {groupScopeLabel(groups, groupIds).toUpperCase()}
        </p>
        <h1>{mode === 'training' ? 'Training report' : 'Match day GPS report'}</h1>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="tr-mode-switch">
          <Link href={`/reports/training${qs({ mode: 'training', groups: groupsQs })}`} aria-current={mode === 'training'}>
            Training
          </Link>
          <Link href={`/reports/training${qs({ mode: 'match', groups: groupsQs })}`} aria-current={mode === 'match'}>
            Match day
          </Link>
        </div>
        <ThemeToggle />
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
    const sessions = await fetchMatchSessions(db, orgId);
    const selected = sessions.find((s) => s.sessionId === sp.session) ?? sessions[0] ?? null;

    if (!selected) {
      return (
        <>
          {header}
          {groupFilterEl}
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
        {header}
        {groupFilterEl}

        <div className="chiprow" style={{ marginBottom: 16 }}>
          {sessions.map((s) => (
            <Link
              key={s.sessionId}
              href={`/reports/training${qs({ mode: 'match', session: s.sessionId, groups: groupsQs })}`}
              className="tr-session-chip"
              aria-current={selected.sessionId === s.sessionId}
            >
              v {s.opponent}
              <span className="suffix">{s.result ?? '—'}</span>
            </Link>
          ))}
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
                    <div className="tr-fact-value">{formatDate(selected.date)}</div>
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
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{overview.headline}</p>
                  <p className="tiny" style={{ maxWidth: '76ch', marginTop: 4 }}>
                    Scored per minute, not per session — a replacement on for 20 minutes is not comparable with an
                    80-minute starter any other way.
                  </p>
                  <p className="tiny mono" style={{ color: 'var(--faint)', marginTop: 6 }}>
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
              <p className="tiny" style={{ marginTop: 8, maxWidth: '76ch' }}>
                Not available. GPS is recorded as one whole-match total per athlete, with no
                first-half/second-half split and no record of when substitutions happened, so
                there is nothing real to draw a half-by-half comparison from. Showing one anyway
                would mean presenting an invented split as if a device had measured it, for real,
                named athletes. The dials and comparison above use whole-match totals and per-minute rates, both
                real; only the half-by-half breakdown is a real, stated gap.
              </p>
            </div>

            <div className="card" style={{ marginTop: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Comparison
                  </h2>
                  <p className="tiny">Every completed match on record, scored against the others.</p>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <ComparisonTableView table={comparison} />
              </div>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
              <h2 className="card-title">Board</h2>
              <p className="tiny mono" style={{ color: 'var(--faint)' }}>
                Whole-match values · no H1/H2 split (see the Halves note above) · n = {board.rows.length} played
              </p>
              <div className="tr-board" style={{ marginTop: 10 }}>
                <div className="tr-board-inner match">
                  <div
                    className="tr-board-row"
                    style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 62px repeat(4, minmax(76px, 1fr))', fontWeight: 700, color: 'var(--faint)', fontSize: 11, textTransform: 'uppercase' }}
                  >
                    <span>Player</span>
                    <span className="r">Mins</span>
                    <span className="r">TD</span>
                    <span className="r">HSR</span>
                    <span className="r">HSR/min</span>
                    <span className="r">HIE</span>
                  </div>
                  {board.unitOrder.map((unit) => (
                    <div key={unit}>
                      <div className="tr-board-unit-header">{unit}</div>
                      {board.rows
                        .filter((r) => r.group_name === unit)
                        .map((row) => (
                          <div key={row.athlete_id} className="tr-board-row" style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) 62px repeat(4, minmax(76px, 1fr))' }}>
                            <span className="nm" style={{ fontSize: 13.5 }}>
                              {row.last_name}, {row.first_name}
                            </span>
                            <span className="r mono">{row.mins ?? '—'}</span>
                            <span className="r mono">{row.td !== null ? Math.round(row.td).toLocaleString() : '—'}</span>
                            <span className="r mono">{row.hsr !== null ? Math.round(row.hsr).toLocaleString() : '—'}</span>
                            <span className="r mono">{row.hsr_per_min ?? '—'}</span>
                            <span className="r mono">{row.hie ?? '—'}</span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
              <p className="cap" style={{ marginTop: 10 }}>
                Whole-match totals only, real per-athlete GPS · MaxV column omitted here, shown on the training
                board · n = {board.rows.length} played.
              </p>
            </div>
          </>
        )}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // Training mode
  const sessions = await fetchTrainingSessions(db, orgId);
  const selected = sessions.find((s) => s.sessionId === sp.session) ?? sessions[0] ?? null;

  if (!selected) {
    return (
      <>
        {header}
        {groupFilterEl}
        <EmptyState title="No GPS data yet" body="No GPS records have been imported. This build has no import pipeline yet — a direct insert is the only path in." />
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
      ? await fetchRestOfWeekComparison(db, orgId, groupIds, selected.sessionId, selected.date)
      : scope === 'comparableSessions'
        ? await fetchComparableSessionsComparison(db, orgId, groupIds, 'training', selected.sessionId, selected.title)
        : scope === 'position'
          ? await fetchPositionComparison(db, orgId, groupIds, 'training', selected.sessionId, selected.title)
          : await fetchAthleteComparison(db, orgId, groupIds, 'training', selected.sessionId, selected.title);

  const selectedAthleteId = typeof sp.athlete === 'string' ? sp.athlete : (scatter[0]?.athleteId ?? null);
  const athletePanel = selectedAthleteId ? await fetchSelectedAthletePanel(db, orgId, selected, selectedAthleteId) : null;

  await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, mode });

  const md = mdLabel(selected.mdOffset);

  return (
    <>
      {header}
      {groupFilterEl}

      <div className="chiprow" style={{ marginBottom: 16 }}>
        {sessions.map((s) => (
          <Link
            key={s.sessionId}
            href={`/reports/training${qs({ mode: 'training', session: s.sessionId, groups: groupsQs })}`}
            className="tr-session-chip"
            aria-current={selected.sessionId === s.sessionId}
          >
            {formatDate(s.date)}
            <span className="suffix">{mdLabel(s.mdOffset) ?? s.title}</span>
          </Link>
        ))}
      </div>

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
                  <div className="tr-fact-value">{formatDate(selected.date)}</div>
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
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{overview.headline}</p>
                <p className="tiny mono" style={{ color: 'var(--faint)', marginTop: 6 }}>
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

          <div className="card" style={{ marginTop: 14, padding: '18px 20px' }}>
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
                    href={`/reports/training${qs({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope: key })}`}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 14, alignItems: 'start', marginTop: 14 }} className="tr-scatter-selected-grid">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Scatter
                </h2>
                <div className="tr-scope-chips">
                  <Link
                    href={`/reports/training${qs({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens: 'self', athlete: selectedAthleteId ?? undefined })}`}
                    className="tr-scope-chip"
                    aria-current={lens === 'self'}
                  >
                    vs self
                  </Link>
                  <Link
                    href={`/reports/training${qs({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens: 'position', athlete: selectedAthleteId ?? undefined })}`}
                    className="tr-scope-chip"
                    aria-current={lens === 'position'}
                  >
                    vs unit
                  </Link>
                </div>
              </div>
              <p className="tiny" style={{ marginTop: 4 }}>
                Dot size is high intensity efforts. Colour is distance from{' '}
                {lens === 'self' ? 'their own recent mean' : 'their unit'}. Click any athlete.
              </p>
              <div style={{ marginTop: 14 }}>
                <TrainingScatter
                  points={scatter}
                  selectedAthleteId={selectedAthleteId}
                  lens={lens}
                  hrefFor={(id) => `/reports/training${qs({ mode: 'training', session: selected.sessionId, groups: groupsQs, scope, lens, athlete: id })}`}
                />
              </div>
            </div>

            <div className="card">
              {!athletePanel ? (
                <p className="tiny">Select an athlete on the scatter to see their detail.</p>
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
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{athletePanel.name}</div>
                      <div className="tiny" style={{ color: 'var(--faint)' }}>
                        {athletePanel.unit}
                      </div>
                    </div>
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
                        <span className="r mono">{r.today}</span>
                        <span className="r mono">{r.vsSelf}</span>
                        <span className="r mono">{r.vsUnit}</span>
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
                    <p className="tiny mono" style={{ color: 'var(--faint)', marginTop: 4 }}>
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
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">Board</h2>
            <p className="tiny mono" style={{ color: 'var(--faint)' }}>
              Raw session values · vs self is the athlete&rsquo;s own mean for this session type, vs unit is their
              positional unit&rsquo;s · n = {board.rows.length} athletes
            </p>
            <div className="tr-board" style={{ marginTop: 10 }}>
              <div className="tr-board-inner">
                <div
                  className="tr-board-row"
                  style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) repeat(5, minmax(66px, 1fr)) 84px 84px', fontWeight: 700, color: 'var(--faint)', fontSize: 11, textTransform: 'uppercase' }}
                >
                  <span>Player</span>
                  <span className="r">TD</span>
                  <span className="r">Run</span>
                  <span className="r">HSR</span>
                  <span className="r">HIE</span>
                  <span className="r">MaxV</span>
                  <span className="r">vs self</span>
                  <span className="r">vs unit</span>
                </div>
                {board.unitOrder.map((unit) => (
                  <div key={unit}>
                    <div className="tr-board-unit-header">
                      <span>{unit}</span>
                    </div>
                    {board.rows
                      .filter((r) => r.group_name === unit)
                      .map((row) => (
                        <div
                          key={row.athlete_id}
                          className={`tr-board-row${row.athlete_id === selectedAthleteId ? ' selected' : ''}`}
                          style={{ gridTemplateColumns: 'minmax(180px, 1.4fr) repeat(5, minmax(66px, 1fr)) 84px 84px' }}
                        >
                          <span className="nm" style={{ fontSize: 13.5 }}>
                            {row.last_name}, {row.first_name}
                          </span>
                          <span className="r mono">{row.td !== null ? Math.round(row.td).toLocaleString() : '—'}</span>
                          <span className="r mono">{row.run !== null ? Math.round(row.run).toLocaleString() : '—'}</span>
                          <span className="r mono">{row.hsr !== null ? Math.round(row.hsr).toLocaleString() : '—'}</span>
                          <span className="r mono">{row.hie ?? '—'}</span>
                          <span className="r mono">{row.maxv_kmh ?? '—'}</span>
                          <span className="r mono" style={{ color: row.vs_self !== null ? TONE[scoreTone(row.vs_self).tone] : undefined }}>
                            {row.vs_self !== null ? `${row.vs_self}%` : '—'}
                          </span>
                          <span className="r mono" style={{ color: row.vs_unit !== null ? TONE[scoreTone(row.vs_unit).tone] : undefined }}>
                            {row.vs_unit !== null ? `${row.vs_unit}%` : '—'}
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="cap" style={{ marginTop: 14 }}>
            <Link href={`/reports/training/export?mode=training&session=${selected.sessionId}${groupsQs ? `&groups=${groupsQs}` : ''}`}>Export CSV</Link> ·
            no PDF for this report, per reports.ts&rsquo;s own reasoning for the reports that stay CSV-only.
          </p>
        </>
      )}
    </>
  );
}
