import { parseCsvRecords } from '@/lib/csvParse';
import type { Db } from './groups';

/* screens/imports.md, 07-integrations.md §3 — cut down hard, and every cut
 * is real, not an oversight:
 *
 *   - No vendor detection, no header-fingerprint matching, no column-mapping
 *     UI (07-integrations.md §3.3-3.4). This build accepts exactly one
 *     fixed header row (GPS_IMPORT_HEADERS below), documented and shown to
 *     the coach via a downloadable template. A club whose vendor export
 *     doesn't match re-headers the file in a spreadsheet before uploading —
 *     manual, but honest about what exists, matching this whole session's
 *     stance on CSV rather than pretending a mapping engine that isn't here.
 *   - No staging/review table (import_batch_rows, imports.md's "Schema
 *     changes required"). A row either matches and validates, or it's
 *     rejected with a reason shown in the result summary — there is no
 *     screen where a coach reviews and edits ambiguous rows before commit.
 *     Migration 0026's header has the full schema-consequence list.
 *   - No fuzzy athlete matching, no athlete_import_aliases. "Player Name"
 *     must match an active athlete's "First Last" (or preferred name)
 *     exactly, case- and whitespace-insensitive. A name that matches zero or
 *     more than one athlete is rejected with that reason, not guessed at.
 *   - No duplicate/supersede detection, no revert. A commit is a straight
 *     insert; re-uploading the same file twice makes two batches of
 *     duplicate rows. Real, and left for a human to notice — same tier of
 *     gap as "no undo" elsewhere in this build.
 *   - No unit conversion (07-integrations.md §3.6 — km/h, mph). The fixed
 *     header names the unit (e.g. "Max Speed (m/s)") and the value is taken
 *     at face value; a file in the wrong unit fails the 0-12.5 m/s
 *     plausibility check per row rather than being silently converted.
 *
 * This closes the gap every earlier GPS file in this build named by name:
 * "no import pipeline is built... a direct database write." Now there's a
 * real one, sized for what a v1 needs rather than what the spec's endgame
 * describes.
 */

export const GPS_IMPORT_HEADERS = [
  'Player Name',
  'Date',
  'Total Distance (m)',
  'High Speed Distance (m)',
  'Sprint Distance (m)',
  'Max Speed (m/s)',
  'Accelerations',
  'Decelerations',
  'Player Load',
  'Duration (min)',
] as const;

const REQUIRED_HEADERS = ['Player Name', 'Date', 'Total Distance (m)'] as const;

export type ImportRosterAthlete = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

export type RejectedRow = {
  row: number; // 1-based, counting the header as row 1 (matches what a coach sees in a spreadsheet)
  reason: string;
};

export type AcceptedRow = {
  athlete_id: string;
  record_date: string;
  total_distance_m: number;
  high_speed_distance_m: number | null;
  sprint_distance_m: number | null;
  max_speed_ms: number | null;
  accelerations: number | null;
  decelerations: number | null;
  player_load: number | null;
  duration_s: number | null;
};

export type ImportParseResult = {
  accepted: AcceptedRow[];
  rejected: RejectedRow[];
  templateMismatch: string | null; // set (and both lists empty) when the header row itself doesn't match
};

function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Builds the {name -> athlete} lookup once per import. A name that maps to
 *  more than one athlete becomes a deliberate ambiguity entry (null),
 *  caught below instead of silently picking one. */
function buildRosterIndex(roster: ImportRosterAthlete[]): Map<string, ImportRosterAthlete | null> {
  const index = new Map<string, ImportRosterAthlete | null>();
  const add = (key: string, athlete: ImportRosterAthlete) => {
    if (!index.has(key)) {
      index.set(key, athlete);
    } else if (index.get(key)?.id !== athlete.id) {
      index.set(key, null); // ambiguous
    }
  };
  for (const a of roster) {
    add(normaliseName(`${a.first_name} ${a.last_name}`), a);
    if (a.preferred_name) add(normaliseName(`${a.preferred_name} ${a.last_name}`), a);
  }
  return index;
}

function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : NaN; // NaN signals "present but not a number"
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseGpsImportCsv(text: string, roster: ImportRosterAthlete[]): ImportParseResult {
  const { headers, records } = parseCsvRecords(text);

  const normalisedActual = headers.map((h) => h.trim());
  const headerMatches =
    normalisedActual.length === GPS_IMPORT_HEADERS.length &&
    GPS_IMPORT_HEADERS.every((h, i) => h === normalisedActual[i]);

  if (!headerMatches) {
    return {
      accepted: [],
      rejected: [],
      templateMismatch:
        `Header row doesn't match the expected template. Expected exactly: ${GPS_IMPORT_HEADERS.join(', ')}. ` +
        `Download the template and re-export from your GPS software's spreadsheet using those column names, in that order.`,
    };
  }

  const rosterIndex = buildRosterIndex(roster);
  const accepted: AcceptedRow[] = [];
  const rejected: RejectedRow[] = [];

  records.forEach((record, idx) => {
    const rowNum = idx + 2; // header is row 1
    const isBlank = REQUIRED_HEADERS.every((h) => (record[h] ?? '').trim() === '') && Object.values(record).every((v) => v.trim() === '');
    if (isBlank) return; // silently skip fully blank trailing rows, common in spreadsheet exports

    for (const h of REQUIRED_HEADERS) {
      if ((record[h] ?? '').trim() === '') {
        rejected.push({ row: rowNum, reason: `Missing required value for "${h}"` });
        return;
      }
    }

    const name = record['Player Name'] ?? '';
    const athlete = rosterIndex.get(normaliseName(name));
    if (athlete === undefined) {
      rejected.push({ row: rowNum, reason: `No athlete on the roster matches "${name}"` });
      return;
    }
    if (athlete === null) {
      rejected.push({ row: rowNum, reason: `"${name}" matches more than one athlete — rename to be unambiguous, e.g. add a squad number` });
      return;
    }

    const date = (record['Date'] ?? '').trim();
    if (!DATE_RE.test(date)) {
      rejected.push({ row: rowNum, reason: `"Date" must be YYYY-MM-DD, got "${date}"` });
      return;
    }

    const totalDistance = parseNumber(record['Total Distance (m)'] ?? '');
    if (totalDistance === null || Number.isNaN(totalDistance) || totalDistance < 0) {
      rejected.push({ row: rowNum, reason: `"Total Distance (m)" must be a positive number` });
      return;
    }

    const maxSpeed = parseNumber(record['Max Speed (m/s)'] ?? '');
    if (Number.isNaN(maxSpeed)) {
      rejected.push({ row: rowNum, reason: `"Max Speed (m/s)" is not a number` });
      return;
    }
    // 07-integrations.md §3.8's own plausibility band, reused verbatim —
    // already the convention this codebase applies elsewhere for this field.
    if (maxSpeed !== null && (maxSpeed < 0 || maxSpeed > 12.5)) {
      rejected.push({ row: rowNum, reason: `"Max Speed (m/s)" of ${maxSpeed} is outside the plausible 0-12.5 range — check the column is really m/s, not km/h or mph` });
      return;
    }

    const hsr = parseNumber(record['High Speed Distance (m)'] ?? '');
    const sprint = parseNumber(record['Sprint Distance (m)'] ?? '');
    const accel = parseNumber(record['Accelerations'] ?? '');
    const decel = parseNumber(record['Decelerations'] ?? '');
    const load = parseNumber(record['Player Load'] ?? '');
    const duration = parseNumber(record['Duration (min)'] ?? '');
    const numericFields: [string, number | null][] = [
      ['High Speed Distance (m)', hsr],
      ['Sprint Distance (m)', sprint],
      ['Accelerations', accel],
      ['Decelerations', decel],
      ['Player Load', load],
      ['Duration (min)', duration],
    ];
    const badField = numericFields.find(([, v]) => Number.isNaN(v));
    if (badField) {
      rejected.push({ row: rowNum, reason: `"${badField[0]}" is not a number` });
      return;
    }

    accepted.push({
      athlete_id: athlete.id,
      record_date: date,
      total_distance_m: totalDistance,
      high_speed_distance_m: hsr,
      sprint_distance_m: sprint,
      max_speed_ms: maxSpeed,
      accelerations: accel === null ? null : Math.round(accel),
      decelerations: decel === null ? null : Math.round(decel),
      player_load: load,
      duration_s: duration === null ? null : Math.round(duration * 60),
    });
  });

  return { accepted, rejected, templateMismatch: null };
}

export async function fetchImportRoster(db: Db, orgId: string): Promise<ImportRosterAthlete[]> {
  const { data, error } = await db
    .from('athletes')
    .select('id, first_name, last_name, preferred_name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function commitGpsImport(
  db: Db,
  orgId: string,
  userId: string,
  filename: string,
  accepted: AcceptedRow[],
  rejectedCount: number,
): Promise<{ batchId: string | null; error: string | null }> {
  const { data: batch, error: batchError } = await db
    .from('import_batches')
    .insert({
      org_id: orgId,
      filename,
      row_count: accepted.length + rejectedCount,
      accepted_count: accepted.length,
      rejected_count: rejectedCount,
      imported_by: userId,
    })
    .select('id')
    .single();
  if (batchError || !batch) return { batchId: null, error: batchError?.message ?? 'Could not start the import batch' };

  if (accepted.length > 0) {
    const { error: rowsError } = await db.from('gps_records').insert(
      accepted.map((r) => ({
        org_id: orgId,
        athlete_id: r.athlete_id,
        record_date: r.record_date,
        total_distance_m: r.total_distance_m,
        high_speed_distance_m: r.high_speed_distance_m,
        sprint_distance_m: r.sprint_distance_m,
        max_speed_ms: r.max_speed_ms,
        accelerations: r.accelerations,
        decelerations: r.decelerations,
        player_load: r.player_load,
        duration_s: r.duration_s,
        source: 'file_import' as const,
        import_batch_id: batch.id,
      })),
    );
    if (rowsError) return { batchId: batch.id, error: rowsError.message };
  }

  return { batchId: batch.id, error: null };
}

export type ImportBatchSummary = {
  id: string;
  filename: string | null;
  row_count: number | null;
  accepted_count: number | null;
  rejected_count: number | null;
  created_at: string;
  imported_by_name: string | null;
};

export async function fetchRecentImportBatches(db: Db, orgId: string): Promise<ImportBatchSummary[]> {
  const { data, error } = await db
    .from('import_batches')
    .select('id, filename, row_count, accepted_count, rejected_count, created_at, users(full_name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((b) => ({
    id: b.id,
    filename: b.filename,
    row_count: b.row_count,
    accepted_count: b.accepted_count,
    rejected_count: b.rejected_count,
    created_at: b.created_at,
    imported_by_name: (b.users as { full_name: string | null } | null)?.full_name ?? null,
  }));
}
