import { NextResponse } from 'next/server';
import { commitGpsImport, fetchImportRoster, parseGpsImportCsv } from '@/lib/queries/gpsImport';
import { requireStaff } from '@/lib/session';

export type UploadResult = {
  ok: boolean;
  error: string | null;
  batchId: string | null;
  filename: string | null;
  acceptedCount: number;
  rejectedCount: number;
  rejected: { row: number; reason: string }[];
};

const MAX_BYTES = 5 * 1024 * 1024; // a season of GPS data for a squad is a few thousand rows; 5MB is generous headroom

/** lib/queries/gpsImport.ts has the full scope-reasoning for this pipeline.
 *  This route is deliberately thin: read the file, parse it, match against
 *  the live roster, commit whatever validates, report the rest. */
export async function POST(request: Request): Promise<NextResponse<UploadResult>> {
  const { db, orgId, claims } = await requireStaff();

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: 'No file received.', batchId: null, filename: null, acceptedCount: 0, rejectedCount: 0, rejected: [] },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { ok: false, error: 'That file is empty.', batchId: null, filename: file.name, acceptedCount: 0, rejectedCount: 0, rejected: [] },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File is too large (over ${Math.round(MAX_BYTES / 1024 / 1024)}MB).`, batchId: null, filename: file.name, acceptedCount: 0, rejectedCount: 0, rejected: [] },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json(
      { ok: false, error: 'Only .csv files are accepted.', batchId: null, filename: file.name, acceptedCount: 0, rejectedCount: 0, rejected: [] },
      { status: 400 },
    );
  }

  const text = await file.text();
  const roster = await fetchImportRoster(db, orgId);
  const result = parseGpsImportCsv(text, roster);

  if (result.templateMismatch) {
    return NextResponse.json(
      { ok: false, error: result.templateMismatch, batchId: null, filename: file.name, acceptedCount: 0, rejectedCount: 0, rejected: [] },
      { status: 400 },
    );
  }

  if (result.accepted.length === 0 && result.rejected.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'The file has a valid header but no data rows.', batchId: null, filename: file.name, acceptedCount: 0, rejectedCount: 0, rejected: [] },
      { status: 400 },
    );
  }

  const { batchId, error } = await commitGpsImport(db, orgId, claims.userId, file.name, result.accepted, result.rejected.length);

  if (error) {
    return NextResponse.json(
      { ok: false, error, batchId, filename: file.name, acceptedCount: 0, rejectedCount: result.rejected.length, rejected: result.rejected },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    error: null,
    batchId,
    filename: file.name,
    acceptedCount: result.accepted.length,
    rejectedCount: result.rejected.length,
    rejected: result.rejected,
  });
}
