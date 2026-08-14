import { csvResponse, toCsv } from '@/lib/csv';
import { recordReportView } from '@/lib/queries/reports';
import {
  fetchMatchBoard,
  fetchMatchSessions,
  fetchTrainingBoard,
  fetchTrainingSessions,
} from '@/lib/queries/trainingReport';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV only, see lib/csv.ts's header. Plain numbers, no colour — colour is a
 *  reading aid for the screen, and a spreadsheet has no equivalent worth
 *  inventing one for. Training and match modes export different real
 *  columns because they are different real shapes (vs self/vs unit for
 *  training; whole-match totals only for match — see
 *  lib/queries/trainingReport.ts's header for why there is no H1/H2 split
 *  to export either). */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the export resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and each
  // branch's caption names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const mode = url.searchParams.get('mode') === 'match' ? 'match' : 'training';
  const requested = url.searchParams.get('session');

  const groups = await fetchGroups(db, orgId);
  const scopeLabel = groupScopeLabel(groups, groupIds);

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  if (mode === 'match') {
    const sessions = await fetchMatchSessions(db, orgId);
    const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;
    if (!selected) return csvResponse(toCsv([], [['x', 'No match GPS data']]), 'training-report.csv');

    const board = await fetchMatchBoard(db, orgId, groupIds, selected);
    const rows = board.rows.map((r) => ({
      unit: r.group_name,
      name: `${r.last_name}, ${r.first_name}`,
      mins: r.mins ?? '',
      td_m: r.td !== null ? Math.round(r.td) : '',
      hsr_m: r.hsr !== null ? Math.round(r.hsr) : '',
      hsr_per_min: r.hsr_per_min ?? '',
      hie: r.hie ?? '',
      maxv_kmh: r.maxv_kmh ?? '',
    }));
    const csv = toCsv(rows, [
      ['unit', 'Unit'],
      ['name', 'Player'],
      ['mins', 'Mins'],
      ['td_m', 'TD (m)'],
      ['hsr_m', 'HSR (m)'],
      ['hsr_per_min', 'HSR/min'],
      ['hie', 'HIE'],
      ['maxv_kmh', 'MAXV (km/h)'],
    ]);
    const withCaption =
      `# Match day GPS report, v ${selected.opponent}, ${selected.date}. Scope: ${scopeLabel}. Whole-match totals only — ` +
      `GPS is not recorded as a first-half/second-half split.\r\n` + csv;

    await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, format: 'csv', mode }, 'export');
    return csvResponse(withCaption, `match-report-${selected.date}.csv`);
  }

  const sessions = await fetchTrainingSessions(db, orgId, timezone);
  const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;
  if (!selected) return csvResponse(toCsv([], [['x', 'No GPS data']]), 'training-report.csv');

  const board = await fetchTrainingBoard(db, orgId, groupIds, selected);
  const rows = board.rows.map((r) => ({
    unit: r.group_name,
    name: `${r.last_name}, ${r.first_name}`,
    td_m: r.td !== null ? Math.round(r.td) : '',
    run_m: r.run !== null ? Math.round(r.run) : '',
    hsr_m: r.hsr !== null ? Math.round(r.hsr) : '',
    hie: r.hie ?? '',
    maxv_kmh: r.maxv_kmh ?? '',
    vs_self: r.vs_self !== null ? `${r.vs_self}%` : '',
    vs_unit: r.vs_unit !== null ? `${r.vs_unit}%` : '',
  }));
  const csv = toCsv(rows, [
    ['unit', 'Unit'],
    ['name', 'Player'],
    ['td_m', 'TD (m)'],
    ['run_m', 'RUN (m)'],
    ['hsr_m', 'HSR (m)'],
    ['hie', 'HIE'],
    ['maxv_kmh', 'MAXV (km/h)'],
    ['vs_self', 'vs self'],
    ['vs_unit', 'vs unit'],
  ]);
  const withCaption = `# Training report, ${selected.title}, ${selected.date}. Scope: ${scopeLabel}.\r\n` + csv;

  await recordReportView(db, orgId, claims.userId, actorRole, 'training', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, format: 'csv', mode }, 'export');
  return csvResponse(withCaption, `training-report-${selected.date}.csv`);
}
