import { renderToBuffer } from '@react-pdf/renderer';
import { fetchEffectiveToday, fetchSaturdayReadiness } from '@/lib/queries/dashboard';
import { fetchGroups } from '@/lib/queries/groups';
import { recordReportView } from '@/lib/queries/reports';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { dashboardVersion, leadCardNames } from '@/lib/dashboardVersion';
import { formatDate, formatLongDate, todayIso } from '@/lib/format';
import { PdfHeader, PdfReport, PdfSectionTitle, PdfTable, PdfTile, PdfTileRow, pdfResponse, pdfDisposition } from '@/lib/pdf';
import { actingRole } from '@/lib/access';
import { requireStaff } from '@/lib/session';

/** The availability board as a PDF — the dashboard's Print (PATTERN-S7 C4,
 *  2026-09-14: one renderer, the PDF; Print opens it). The workflow this is
 *  for is the one 06-design-system.md §14.7 and the dashboard spec both name:
 *  a physio pins a printed availability board on the treatment-room wall.
 *  Until now that printed the live screen through a print stylesheet —
 *  tiles, week strip, attention panel and all. This is the board and nothing
 *  else: the four counts, then the athletes who are not fully available with
 *  the line every role reads (status and restriction, lib/dashboardLead.ts's
 *  restrictionStatusLine). No reason line, even for the medic: a printed
 *  sheet is an export, and the ruling on exports (14 September 2026, #5)
 *  keeps clinical detail on the medic's screen. The nutritionist's version
 *  carries the counts and no names, as their dashboard does (frame 7).
 *
 *  requireStaff, as the dashboard itself; the group filter from the query. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  const url = new URL(request.url);
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const version = dashboardVersion(claims.roles);
  const names = leadCardNames(version);
  const wallClockToday = todayIso(timezone);

  const [groups, effectiveToday] = await Promise.all([fetchGroups(db, orgId), fetchEffectiveToday(db, orgId, wallClockToday)]);
  const readiness = await fetchSaturdayReadiness(db, orgId, groupIds, effectiveToday, timezone);
  const scope = groupScopeLabel(groups, groupIds);
  const notFully = [...readiness.unavailableNames, ...readiness.modifiedNames];

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Availability board · generated ${formatDate(wallClockToday, timezone)} · not for redistribution`}>
      <PdfHeader
        eyebrow={`${scope} · ${orgName}`}
        title="Availability board"
        meta={`As of ${formatLongDate(effectiveToday, timezone)}${readiness.opponent ? ` · next: v ${readiness.opponent}` : ''}`}
        definition="Who can train and play today, as medical staff and coaches have set it. Status and restriction only; nothing clinical."
      />
      <PdfTileRow>
        <PdfTile label="Available" value={String(readiness.available)} tone="good" />
        <PdfTile label="Modified" value={String(readiness.modified)} tone={readiness.modified > 0 ? 'warn' : undefined} />
        <PdfTile label="Unavailable" value={String(readiness.unavailable)} tone={readiness.unavailable > 0 ? 'bad' : undefined} />
        <PdfTile label="Not recorded" value={String(readiness.notRecorded)} />
      </PdfTileRow>
      <PdfSectionTitle
        title="Not fully available"
        caption={names ? `${readiness.withStatus} of ${readiness.squadTotal} have a current status.` : 'Counts only for your role; the squad list names them.'}
      />
      {names ? (
        <PdfTable
          emptyText="Everyone with a status is fully available."
          rows={notFully}
          columns={[
            { key: 'name', label: 'Athlete', width: '30%', render: (r) => r.name },
            { key: 'line', label: 'Status and restriction', width: '70%', render: (r) => r.line },
          ]}
        />
      ) : null}
    </PdfReport>,
  );

  await recordReportView(
    db,
    orgId,
    claims.userId,
    actingRole(claims.roles),
    'availability_board',
    { as_of: effectiveToday, group_ids: groupIds, rows: names ? notFully.length : 0, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `availability-board-${effectiveToday}.pdf`, pdfDisposition(request));
}
