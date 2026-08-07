import { csvResponse, toCsv } from '@/lib/csv';
import { recordReportView } from '@/lib/queries/reports';
import { fetchRecentGpsSessions, fetchTrainingReportBoard } from '@/lib/queries/trainingReport';
import { parseGroupParam } from '@/lib/groupFilter';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV only, see lib/csv.ts's header. Exports the plain numbers, not the
 *  heat-map tint — colour is a reading aid for the screen, and a spreadsheet
 *  has no equivalent worth inventing one for. The reference population and
 *  window are still named in the file, same as the on-screen caption, so a
 *  number pulled out of context still carries what it was shaded against. */
export async function GET(request: Request) {
  const { db, orgId, claims } = await requireReportAccess();
  const url = new URL(request.url);
  const groupIds = parseGroupParam(url.searchParams.get('groups') ?? undefined);

  const sessions = await fetchRecentGpsSessions(db, orgId);
  const requested = url.searchParams.get('session');
  const selected = sessions.find((s) => s.sessionId === requested) ?? sessions[0] ?? null;

  if (!selected) {
    return csvResponse(toCsv([], [['x', 'No GPS data']]), 'training-report.csv');
  }

  const board = await fetchTrainingReportBoard(db, orgId, groupIds, selected.sessionId, selected.date);

  const rows = board.rows.map((r) => ({
    unit: r.group_name,
    name: `${r.last_name}, ${r.first_name}`,
    squad_number: r.squad_number ?? '',
    td_m: r.td !== null ? Math.round(r.td) : '',
    run_m: r.run !== null ? Math.round(r.run) : '',
    hsr_m: r.hsr !== null ? Math.round(r.hsr) : '',
    hie: r.hie ?? '',
    maxv_kmh: r.maxv_kmh ?? '',
    pct_max: r.pct_max ?? '',
    flagged: r.flagged ? 'yes' : '',
  }));

  const csv = toCsv(rows, [
    ['unit', 'Unit'],
    ['name', 'Player'],
    ['squad_number', 'Squad number'],
    ['td_m', 'TD (m)'],
    ['run_m', 'RUN (m)'],
    ['hsr_m', 'HSR (m)'],
    ['hie', 'HIE'],
    ['maxv_kmh', 'MAXV (km/h)'],
    ['pct_max', '%MAX'],
    ['flagged', 'Flagged'],
  ]);

  const withCaption =
    `# Training report, session ${selected.date}. Shading reference (screen only): ` +
    `squad, last 28 days, training sessions, n = ${board.reference.n} records.\r\n` +
    csv;

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'training',
    {
      session_id: selected.sessionId,
      date: selected.date,
      group_ids: groupIds,
      format: 'csv',
    },
    'export',
  );

  return csvResponse(withCaption, `training-report-${selected.date}.csv`);
}
