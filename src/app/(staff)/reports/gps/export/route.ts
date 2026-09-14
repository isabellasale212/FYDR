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
import { reportDefinition } from '@/lib/reportCatalogue';
import { requireReport, refuse } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import type { AppRole } from '@/lib/types/database';
import { exportAuditMetadata, exportCaption, type ExportDescriptor } from '@/lib/exportDescriptor';
import { formatDateTime } from '@/lib/format';

/** CSV only, see lib/csv.ts's header. Plain numbers, no colour — colour is a
 *  reading aid for the screen, and a spreadsheet has no equivalent worth
 *  inventing one for. Training and match modes export different real
 *  columns because they are different real shapes (vs self/vs unit for
 *  training; whole-match totals only for match — see
 *  lib/queries/trainingReport.ts's header for why there is no H1/H2 split
 *  to export either). */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone, tier, fullName } = await requireReport('gps');
  /* The page this exports refuses on Basic (reports/training/page.tsx), but a
     route handler is reachable by URL whether or not a button was drawn. */
  /* D-20 without exception (15 September 2026): the denied screen, logged. */
  if (!isPremium(tier)) await refuse(db, 'gps_report_premium', '/reports/gps');
  const url = new URL(request.url);
  // resolveGroupFilter, not parseGroupParam: the export resolves the sticky
  // filter cookie exactly as the on-screen report does (audit S4), and each
  // branch's caption names the resolved scope.
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const mode = url.searchParams.get('mode') === 'match' ? 'match' : 'training';
  const requested = url.searchParams.get('session');

  const groups = await fetchGroups(db, orgId);
  const scopeLabel = groupScopeLabel(groups, groupIds);

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;

  if (mode === 'match') {
    const sessions = await fetchMatchSessions(db, orgId, timezone);
    const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;
    if (!selected) return csvResponse(toCsv([], [['x', 'No match GPS data']]), 'gps-report.csv');

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
    /* PATTERN-S7 C3 / S8 C8: one descriptor for the dialog, the header and
       the audit row. PATTERN-S7 C1 (reconciled 2026-09-13): the definition
       line is written only once the catalogue has a sentence for this
       board (null today). */
    const descriptor: ExportDescriptor = {
      fileName: `match-report-${selected.date}.csv`,
      report: 'Match day GPS report',
      window: `v ${selected.opponent}, ${selected.date}`,
      scope: `${scopeLabel} (${rows.length} on the board)`,
      rows: rows.length,
      rowNoun: 'player on the board',
      filters: [`Session: v ${selected.opponent}, ${selected.date}`, 'Whole-match totals only — GPS is not recorded as a first-half/second-half split'],
      medical: false,
    };
    /* The match board's sentence is not yet written (the addendum); the GPS
       sentence belongs to the training-mode board below. */
    const withCaption = exportCaption(descriptor, null, { exportedBy: fullName, at: formatDateTime(new Date().toISOString(), timezone) }) + csv;

    await recordReportView(db, orgId, claims.userId, actorRole, 'gps', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, mode, ...exportAuditMetadata(descriptor) }, 'export');
    return csvResponse(withCaption, descriptor.fileName);
  }

  const sessions = await fetchTrainingSessions(db, orgId, timezone);
  const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;
  if (!selected) return csvResponse(toCsv([], [['x', 'No GPS data']]), 'gps-report.csv');

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
  const descriptor: ExportDescriptor = {
    fileName: `gps-report-${selected.date}.csv`,
    report: 'GPS report',
    window: `${selected.title}, ${selected.date}`,
    scope: `${scopeLabel} (${rows.length} on the board)`,
    rows: rows.length,
    rowNoun: 'player on the board',
    filters: [`Session: ${selected.title}, ${selected.date}`],
    medical: false,
  };
  const withCaption = exportCaption(descriptor, reportDefinition('gps'), { exportedBy: fullName, at: formatDateTime(new Date().toISOString(), timezone) }) + csv;

  await recordReportView(db, orgId, claims.userId, actorRole, 'gps', { session_id: selected.sessionId, date: selected.date, group_ids: groupIds, mode, ...exportAuditMetadata(descriptor) }, 'export');
  return csvResponse(withCaption, descriptor.fileName);
}
