import { notFound } from 'next/navigation';
import { csvResponse, toCsv } from '@/lib/csv';
import {
  fetchGpsRecordsForBatch,
  fetchImportBatch,
  recordImportExport,
} from '@/lib/queries/gpsImport';
import { formatDateTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';

/** The export half of the coach's ask: "access all previous gps imports and
 *  make them exportable." One batch, one CSV, via lib/csv.ts — the same
 *  toCsv/csvResponse pair every other export in this app uses, so a coach gets
 *  the same RFC 4180 file with the same quoting rules they already get from
 *  every report.
 *
 *  Four things copied from the screen this hangs off (/settings/imports)
 *  rather than decided here, because a download that disagrees with the page
 *  it came from is worse than no download:
 *
 *   - The role gate. requireStaff() is not enough: the imports page refuses
 *     anyone who is not coach or medical by hand, matching migration 0026's
 *     role table, and a route is a separate front door. RLS on import_batches
 *     and gps_records happens to enforce the same pair
 *     (import_batches_staff_select, gps_records_staff_select both require
 *     coach or medical), so this check is defence in depth rather than the
 *     only thing standing between an admin and the file — but it is what
 *     turns a silently-empty CSV into an honest 403.
 *   - The tier gate is deliberately NOT repeated. The page gates on
 *     isPremium() because importing is a Premium feature; a club that has
 *     since dropped to Basic still owns the GPS data it already imported, and
 *     locking them out of exporting their own records would be a data-
 *     portability problem, not a monetisation one. Downgrade must not strand
 *     data.
 *   - Org scoping. fetchImportBatch filters on org_id as well as id, so a
 *     guessed batch id from another club is indistinguishable from a
 *     nonexistent one: both are notFound(), and neither confirms the id
 *     exists somewhere. CLAUDE.md rule 1.
 *   - The timezone. The caption stamps the import time in the ORG's timezone
 *     via formatDateTime, never a raw UTC component read — CLAUDE.md rule 5.
 *     The page's own "When" column now does the same.
 *
 *  Accepted rows only, and the caption says so in words. Rejected rows were
 *  never stored (lib/queries/gpsImport.ts's header: no staging table, only a
 *  rejected_count), so there is nothing to export for them; a caption that
 *  quietly omitted this would let a coach reconcile 47 exported rows against a
 *  50-row file and conclude the export had lost three.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const { db, orgId, claims, timezone } = await requireStaff();

  if (!claims.roles.includes('coach') && !claims.roles.includes('medical')) {
    return new Response('GPS records are named-athlete performance data and are not part of this role.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const batch = await fetchImportBatch(db, orgId, batchId);
  if (!batch) notFound();

  const records = await fetchGpsRecordsForBatch(db, orgId, batchId);

  /* THIS FILE IS A RECORD OF WHAT WAS IMPORTED. IT IS NOT AN IMPORT FILE.
   *
   * An earlier version of this comment claimed the export "mirrors
   * GPS_IMPORT_HEADERS' shape... so a file exported here can be corrected in a
   * spreadsheet and re-imported without re-arranging columns". That was false
   * in two independent ways, and a coach who followed it got the importer's
   * template-mismatch error with no hint the file had come out of this app:
   *   1. parseGpsImportCsv requires EXACTLY the 10 GPS_IMPORT_HEADERS in order,
   *      starting 'Player Name'. This emits 12 columns and splits Player Name
   *      into Last/First plus Squad Number, so the length check fails first.
   *   2. parseCsvRecords takes row 0 as the header row, and the caption block
   *      below is prepended, so row 0 is `# GPS import <filename>...`.
   *
   * Reshaping this into a genuinely round-trippable file was the alternative
   * and was rejected on purpose. It would cost the caption (the provenance and
   * the accepted/rejected reconciliation this route exists to carry) and the
   * squad number (the one field that disambiguates two athletes sharing a name
   * — the exact case the importer rejects), and it would advertise a
   * correct-and-re-import workflow this build cannot support: there is no
   * duplicate detection and no revert (lib/queries/gpsImport.ts's header), so
   * re-importing a corrected export silently doubles the batch rather than
   * replacing it. A coach who wants an import-shaped file gets the real one
   * from /settings/imports/template, and the caption below says so.
   *
   * Columns are still named after the template's where they mean the same
   * thing, so the two files read alike side by side. That is a courtesy to the
   * reader, not a compatibility promise. */
  const rows = records.map((r) => ({
    last_name: r.last_name,
    first_name: r.first_name,
    squad_number: r.squad_number ?? '',
    record_date: r.record_date,
    total_distance_m: r.total_distance_m ?? '',
    high_speed_distance_m: r.high_speed_distance_m ?? '',
    sprint_distance_m: r.sprint_distance_m ?? '',
    max_speed_ms: r.max_speed_ms ?? '',
    accelerations: r.accelerations ?? '',
    decelerations: r.decelerations ?? '',
    player_load: r.player_load ?? '',
    // Stored in seconds, imported in minutes. Converted back so the exported
    // column means what its header says — "Duration (min)" holding seconds
    // would be a lie on its own terms, regardless of what reads the file.
    duration_min: r.duration_s === null ? '' : Math.round((r.duration_s / 60) * 10) / 10,
  }));

  const csv = toCsv(rows, [
    ['last_name', 'Last Name'],
    ['first_name', 'First Name'],
    ['squad_number', 'Squad Number'],
    ['record_date', 'Date'],
    ['total_distance_m', 'Total Distance (m)'],
    ['high_speed_distance_m', 'High Speed Distance (m)'],
    ['sprint_distance_m', 'Sprint Distance (m)'],
    ['max_speed_ms', 'Max Speed (m/s)'],
    ['accelerations', 'Accelerations'],
    ['decelerations', 'Decelerations'],
    ['player_load', 'Player Load'],
    ['duration_min', 'Duration (min)'],
  ]);

  /* The count is now a true total, not "however many the first page held" —
   * fetchGpsRecordsForBatch pages to completion. It is still reconciled out
   * loud against the batch's own accepted_count, because the two CAN legitimately
   * differ: gps_records deleted since the import are gone from this file but
   * still counted in the batch row the history table renders. Stating the gap
   * is the whole point of this caption; leaving a coach to spot it by
   * subtracting two numbers on two different screens is not. */
  const rejected = batch.rejected_count ?? 0;
  const accepted = batch.accepted_count;
  const reconciliation =
    accepted !== null && accepted !== records.length
      ? `# This batch recorded ${accepted} accepted row${accepted === 1 ? '' : 's'} at import. ` +
        `${records.length < accepted ? `${accepted - records.length} of them are no longer stored and are not in this file.` : `${records.length - accepted} more are stored against this batch than it recorded accepting.`}\r\n`
      : '';

  const caption =
    `# GPS import ${batch.filename ?? '(filename not recorded)'}, imported ` +
    `${formatDateTime(batch.created_at, timezone)}` +
    `${batch.imported_by_name ? ` by ${batch.imported_by_name}` : ''}.\r\n` +
    `# ${records.length} accepted row${records.length === 1 ? '' : 's'} exported — the complete set stored for this batch. ` +
    `${rejected} row${rejected === 1 ? ' was' : 's were'} ` +
    `rejected at import and are not stored, so they cannot be exported.\r\n` +
    reconciliation +
    // Said in the file itself, not only in a code comment: the person holding
    // this CSV is the one who needs to know it will not re-import.
    `# This is a record of what was imported, not an import file — it has extra columns and these caption lines. ` +
    `To import, start from the template at /settings/imports/template.\r\n\r\n`;

  const actorRole = claims.roles.includes('medical') && !claims.roles.includes('coach') ? 'medical' : 'coach';
  await recordImportExport(db, orgId, claims.userId, actorRole, batchId, records.length);

  /* The source filename in the download name, not a fixed gps-import.csv: a
   * coach exporting three batches in a row has to be able to tell them apart
   * in their Downloads folder. Slugged, because filename is whatever the
   * uploaded file was called and goes into a Content-Disposition header —
   * quotes or a newline in there is a header-injection shape, not merely
   * untidy. */
  const slug =
    (batch.filename ?? '')
      .replace(/\.csv$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'gps-import';
  return csvResponse(caption + csv, `${slug}-${batch.created_at.slice(0, 10)}.csv`);
}
