import { notFound } from 'next/navigation';
import { csvResponse, toCsv } from '@/lib/csv';
import { buildHistory } from '@/lib/availabilityHistory';
import { formatDateTime } from '@/lib/format';
import { fetchAvailabilityLedger } from '@/lib/queries/availability';
import { recordReportView } from '@/lib/queries/reports';
import { fetchUserNames } from '@/lib/queries/users';
import { actingRole } from '@/lib/access';
import { requireStaff } from '@/lib/session';
import { isUuid } from '@/lib/uuid';

/** The availability history as a CSV — the same rows the screen shows, from
 *  the same function (PATTERN-S3 C7). "If a club disputes an injury, this
 *  screen and its CSV are the record", so the export is recorded like every
 *  report export. */
export async function GET(_request: Request, { params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params;
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!isUuid(athleteId)) notFound();

  const ledger = await fetchAvailabilityLedger(db, orgId, athleteId);
  const names = await fetchUserNames(db, orgId, ledger.map((r) => r.set_by));
  const history = buildHistory(ledger, names);

  const csv = toCsv(
    history.map((r) => ({
      at: formatDateTime(r.at, timezone),
      at_iso: r.at,
      status: r.statusLabel,
      current: r.current ? 'yes' : '',
      restrictions: r.restrictionLine,
      changed: r.changed,
      set_by: r.setBy ?? '',
    })),
    [
      ['at', 'When'],
      ['at_iso', 'When (ISO)'],
      ['status', 'Status'],
      ['current', 'Current'],
      ['restrictions', 'Restrictions'],
      ['changed', 'What changed'],
      ['set_by', 'Set by'],
    ],
  );

  await recordReportView(
    db,
    orgId,
    claims.userId,
    actingRole(claims.roles),
    'availability_history',
    { athlete_id: athleteId, rows: history.length, format: 'csv' },
    'export',
  );

  return csvResponse(csv, `availability-history-${athleteId}.csv`);
}
