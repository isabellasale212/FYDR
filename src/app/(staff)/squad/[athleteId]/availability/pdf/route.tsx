import { notFound } from 'next/navigation';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildHistory } from '@/lib/availabilityHistory';
import { formatDate, formatDateTime, todayIso } from '@/lib/format';
import { fetchAvailabilityLedger } from '@/lib/queries/availability';
import { recordReportView } from '@/lib/queries/reports';
import { fetchUserNames } from '@/lib/queries/users';
import { PdfHeader, PdfReport, PdfTable, pdfResponse, pdfDisposition } from '@/lib/pdf';
import { actingRole } from '@/lib/access';
import { requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';

/** The availability history as a PDF — the screen's Print (PATTERN-S7 C4,
 *  2026-09-14: one renderer, the PDF; Print opens it). The same rows the
 *  screen and its CSV show, from the same function (PATTERN-S3 C7: "if a
 *  club disputes an injury, this screen and its CSV are the record"), so a
 *  printed copy is that record with its own header and footer rather than a
 *  screenshot of a table. Recorded like every export. */
export async function GET(request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  if (!isUuid(athleteId)) notFound();

  const [ledger, athleteRes] = await Promise.all([
    fetchAvailabilityLedger(db, orgId, athleteId),
    db.from('athletes').select('first_name, last_name').eq('org_id', orgId).eq('id', athleteId).is('deleted_at', null).maybeSingle(),
  ]);
  if (athleteRes.error) throw new Error(athleteRes.error.message);
  const athlete = athleteRes.data;
  if (!athlete) notFound();
  const names = await fetchUserNames(db, orgId, ledger.map((r) => r.set_by));
  const history = buildHistory(ledger, names);
  const today = todayIso(timezone);

  const buffer = await renderToBuffer(
    <PdfReport footer={`${orgName} · Availability history · ${athlete.first_name} ${athlete.last_name} · generated ${formatDate(today, timezone)} · not for redistribution`}>
      <PdfHeader
        eyebrow={`${orgName} · ${athlete.first_name} ${athlete.last_name}`}
        title="Availability history"
        meta={`${history.length} ${history.length === 1 ? 'change' : 'changes'} on record · newest first`}
        definition="Every change since the record began, one row per change. A row is never edited and never removed — a correction adds a row."
      />
      <PdfTable
        emptyText="Nothing on record. The first row appears when medical staff or a coach set a status."
        rows={history}
        columns={[
          { key: 'at', label: 'When', width: '18%', render: (r) => formatDateTime(r.at, timezone) },
          { key: 'status', label: 'Status', width: '16%', render: (r) => `${r.statusLabel}${r.current ? ' · current' : ''}` },
          { key: 'restrictions', label: 'Restrictions', width: '24%', render: (r) => r.restrictionLine },
          { key: 'changed', label: 'What changed', width: '26%', render: (r) => r.changed },
          { key: 'setBy', label: 'Set by', width: '16%', render: (r) => r.setBy ?? 'Not recorded' },
        ]}
      />
    </PdfReport>,
  );

  await recordReportView(
    db,
    orgId,
    claims.userId,
    actingRole(claims.roles),
    'availability_history',
    { athlete_id: athleteId, rows: history.length, format: 'pdf' },
    'export',
  );

  return pdfResponse(buffer, `availability-history-${athleteId}.pdf`, pdfDisposition(request));
}
