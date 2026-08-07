import { csvResponse, toCsv } from '@/lib/csv';
import { GPS_IMPORT_HEADERS } from '@/lib/queries/gpsImport';
import { requireStaff } from '@/lib/session';

/** The fixed header row the import route requires, with one worked example
 *  row, so a coach who cannot get their vendor export to match can rebuild a
 *  file from a spreadsheet instead. See lib/queries/gpsImport.ts's header for
 *  why there is no vendor-mapping UI in this build to do this automatically. */
export async function GET() {
  await requireStaff();

  const example = {
    'Player Name': 'Jamie Barnes',
    Date: '2026-08-04',
    'Total Distance (m)': '6260',
    'High Speed Distance (m)': '589',
    'Sprint Distance (m)': '112',
    'Max Speed (m/s)': '8.42',
    Accelerations: '24',
    Decelerations: '21',
    'Player Load': '412.6',
    'Duration (min)': '78',
  };

  const csv = toCsv([example], GPS_IMPORT_HEADERS.map((h) => [h, h]));
  return csvResponse(csv, 'fydr-gps-import-template.csv');
}
