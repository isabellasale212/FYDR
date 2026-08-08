import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { HeatCell } from '@/components/HeatCell/HeatCell';
import { PlanGate } from '@/components/PlanGate/PlanGate';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchGroups } from '@/lib/queries/groups';
import {
  bandFor,
  bandForPctMax,
  fetchRecentGpsSessions,
  fetchTrainingReportBoard,
} from '@/lib/queries/trainingReport';
import { recordReportView } from '@/lib/queries/reports';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Training report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/training-report.md, cut down against sixteen open questions —
 *  every decision, and every further cut, is recorded in
 *  lib/queries/trainingReport.ts's header. This is the last major screen of
 *  this stretch: one session, every athlete, every GPS metric, on one board,
 *  grouped by position, tinted so outliers are found by looking rather than
 *  reading. */
export default async function TrainingReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const sessions = await fetchRecentGpsSessions(db, orgId);
  const requestedSession = typeof params.session === 'string' ? params.session : null;
  const selected = sessions.find((s) => s.sessionId === requestedSession) ?? sessions[0] ?? null;

  const [groups, board] = await Promise.all([
    fetchGroups(db, orgId),
    selected
      ? fetchTrainingReportBoard(db, orgId, groupIds, selected.sessionId, selected.date)
      : Promise.resolve(null),
  ]);

  if (selected) {
    const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles[0]) as AppRole;
    await recordReportView(db, orgId, claims.userId, actorRole, 'training', {
      session_id: selected.sessionId,
      date: selected.date,
      group_ids: groupIds,
    });
  }

  const groupedRows = new Map<string, typeof board extends null ? never : NonNullable<typeof board>['rows']>();
  if (board) {
    for (const row of board.rows) {
      const list = groupedRows.get(row.group_name) ?? [];
      list.push(row);
      groupedRows.set(row.group_name, list);
    }
  }
  const unitOrder = board ? [...new Set(board.rows.map((r) => r.group_name))].sort((a, b) => {
    const sa = board.rows.find((r) => r.group_name === a)?.group_sort ?? 999;
    const sb = board.rows.find((r) => r.group_name === b)?.group_sort ?? 999;
    return sa - sb;
  }) : [];

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Training report
          </p>
          <h1>Training report</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {selected ? (
            <a
              href={`/reports/training/export?session=${selected.sessionId}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`}
              className="btn-ghost"
            >
              Export CSV
            </a>
          ) : null}
          <ThemeToggle />
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        Squad · Training · {orgName}
      </p>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No GPS data yet"
          body="No GPS records have been imported. This build has no import pipeline yet — see the page footer."
        />
      ) : (
        <>
          <div className="chiprow" style={{ marginBottom: 14 }}>
            {sessions.map((s) => (
              <Link
                key={s.sessionId}
                href={`/reports/training?session=${s.sessionId}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`}
                className="squad-chip"
                aria-pressed={selected?.sessionId === s.sessionId}
              >
                {formatDate(s.date)}
              </Link>
            ))}
          </div>

          {board ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div className="card">
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                    {board.stats.squad}
                  </div>
                  <div className="tiny">Squad, players</div>
                </div>
                <div className="card">
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                    {board.stats.avgTd ?? '—'} m
                  </div>
                  <div className="tiny">
                    Avg TD{' '}
                    {board.stats.avgTdDeltaPct !== null ? (
                      <span style={{ color: board.stats.avgTdDeltaPct >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                        {board.stats.avgTdDeltaPct >= 0 ? '▲' : '▼'} {Math.abs(board.stats.avgTdDeltaPct)}%
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="card">
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                    {board.stats.totalHsrKm ?? '—'} km
                  </div>
                  <div className="tiny">Total HSR, session</div>
                </div>
                <div className="card">
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: board.stats.flagged > 0 ? 'var(--bad)' : undefined }}>
                    {board.stats.flagged}
                  </div>
                  <div className="tiny">Flagged athletes</div>
                </div>
              </div>

              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="eyebrow">
                      <th scope="col" style={{ textAlign: 'left', padding: '6px 8px' }}>
                        Player
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: '6px 8px' }}>
                        TD
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: '6px 8px' }}>
                        RUN
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: '6px 8px' }}>
                        HSR
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: '6px 8px' }}>
                        HIE
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: '6px 8px' }}>
                        MAXV
                      </th>
                      <th scope="col" style={{ textAlign: 'right', padding: '6px 8px' }}>
                        %MAX
                      </th>
                    </tr>
                  </thead>
                  {unitOrder.map((unitName) => (
                    <tbody key={unitName}>
                      <tr>
                        <td colSpan={7} style={{ padding: '10px 8px 4px', color: unitName === 'UNASSIGNED' ? 'var(--muted)' : 'var(--accent)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                          {unitName}
                        </td>
                      </tr>
                      {(groupedRows.get(unitName) ?? []).map((row) => (
                        <tr key={row.athlete_id}>
                          <th scope="row" style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>
                            {row.last_name}, {row.first_name}
                            {row.flagged ? (
                              <span className="pill pill-bad" style={{ marginLeft: 6 }}>
                                Flag
                              </span>
                            ) : null}
                          </th>
                          <td className="r mono" style={{ padding: '6px 8px', textAlign: 'right' }}>
                            {row.td !== null ? Math.round(row.td).toLocaleString() : '–'}
                          </td>
                          <td className="r mono" style={{ padding: '6px 8px', textAlign: 'right' }}>
                            {row.run !== null ? Math.round(row.run).toLocaleString() : '–'}
                          </td>
                          <HeatCell
                            value={row.hsr !== null ? Math.round(row.hsr) : null}
                            band={bandFor(row.hsr, board.reference.hsrP95)}
                            hue="accent"
                            label="High speed running"
                            unit="m"
                          />
                          <HeatCell
                            value={row.hie}
                            band={bandFor(row.hie, board.reference.hieP95)}
                            hue="pink"
                            label="High intensity efforts"
                          />
                          <td className="r mono" style={{ padding: '6px 8px', textAlign: 'right' }}>
                            {row.maxv_kmh !== null ? row.maxv_kmh : '–'}
                          </td>
                          <HeatCell
                            value={row.pct_max}
                            band={bandForPctMax(row.pct_max)}
                            hue="green"
                            fill="solid"
                            label="Percentage of maximum"
                            unit="%"
                          />
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>

              <p className="cap">
                Shading vs squad, last 28 days, training sessions, n = {board.reference.n} records
                {board.reference.suppressed ? ' — shading unavailable: ' + board.reference.fallbackReason : ''}.
                TD and RUN are volume and are never shaded; HSR, HIE and %MAX are intensity,
                shaded relative to the squad (%MAX relative to the athlete&rsquo;s own rolling
                12-month maximum). Export gives the plain numbers, no shading — a spreadsheet has
                no equivalent worth inventing one for.
              </p>
            </>
          ) : null}
        </>
      )}
    </>
  );
}
