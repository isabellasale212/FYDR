import { csvResponse, toCsv } from '@/lib/csv';
import { GPS_IMPORT_HEADERS } from '@/lib/queries/gpsImport';
import { premiumOnlyResponse, requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

/** The fixed header row the import route requires, with one worked example
 *  row, so a coach who cannot get their vendor export to match can rebuild a
 *  file from a spreadsheet instead. See lib/queries/gpsImport.ts's header for
 *  why there is no vendor-mapping UI in this build to do this automatically. */
export async function GET() {
  const { claims, tier } = await requireStaff();

  /* Same pair of checks as the page and the upload route: this is the template
     for a Premium importer, so it is not a thing a Basic club has any use for,
     and it is not a thing a role without a write path onto gps_records has any
     use for either. No athlete data in it, which is exactly why it was missed —
     "harmless" is not the same as "in this plan". */
  if (!claims.roles.includes('coach') && !claims.roles.includes('medical')) {
    return premiumOnlyResponse('The GPS import template');
  }
  if (!isPremium(tier)) return premiumOnlyResponse('GPS import');

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
