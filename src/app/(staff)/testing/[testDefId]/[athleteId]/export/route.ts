import { csvResponse, toCsv } from '@/lib/csv';
import { computeTestBestsBySide, fetchHistory, fetchTestDefinitions } from '@/lib/queries/testing';
import { fetchCurrentSeason } from '@/lib/queries/schedule';
import { recordReportView } from '@/lib/queries/reports';
import { formatNumber } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** CSV of one athlete's whole history on one test, plus the same three
 *  bests figures the page shows, as a caption block.
 *
 *  requireStaff, deliberately NOT requireReportAccess: this download must
 *  gate exactly as the page it downloads (which is requireStaff), so the
 *  export is never reachable by someone who cannot already read the same
 *  numbers on screen, and never denied to someone who can. The squad report
 *  under /reports uses requireReportAccess because its own page does.
 *
 *  Every attempt is exported, not only the best ones — a CSV is the shape
 *  someone re-analyses elsewhere, and dropping the non-best attempts would
 *  throw away the within-session spread that makes that worth doing. The
 *  `best` column marks which row the trigger (or a coach, via `best_source`)
 *  picked. */
/* `_request` is unread: unlike the squad-wide report exports, this route takes
 * both its ids from the path and resolves no group filter, so there is no
 * query string to parse. The parameter stays because Next passes params
 * positionally as the second argument. */
export async function GET(_request: Request, { params }: { params: Promise<{ testDefId: string; athleteId: string }> }) {
  const { testDefId, athleteId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireStaff();

  const [definitions, history, athleteRes, season] = await Promise.all([
    fetchTestDefinitions(db, orgId),
    fetchHistory(db, orgId, athleteId, testDefId),
    db.from('athletes').select('first_name, last_name').eq('org_id', orgId).eq('id', athleteId).maybeSingle(),
    fetchCurrentSeason(db, orgId),
  ]);

  const definition = definitions.find((d) => d.id === testDefId);
  if (!definition || !athleteRes.data) return new Response('Not found', { status: 404 });

  const athleteName = `${athleteRes.data.first_name} ${athleteRes.data.last_name}`;
  // Per side, not pooled — see computeTestBestsBySide. A per_side test writes
  // one caption block per side; a bilateral test writes exactly one, unlabelled,
  // as before.
  const bestsBySide = computeTestBestsBySide(history, definition, season);

  const rows = history.map((r) => ({
    date: r.test_date,
    attempt: r.attempt_number,
    side: r.side ?? '',
    value: formatNumber(r.value, definition.decimal_places),
    best: r.is_best ? 'yes' : '',
    best_source: r.is_best ? (r.is_best_manual ? 'manual' : 'automatic') : '',
    conditions: r.conditions ?? '',
  }));

  const csv = toCsv(rows, [
    ['date', 'Date'],
    ['attempt', 'Attempt'],
    ['side', 'Side'],
    ['value', `Value (${definition.unit})`],
    ['best', 'Best of session'],
    ['best_source', 'Best set by'],
    ['conditions', 'Conditions'],
  ]);

  const fmt = (v: number | null) => (v === null ? 'n/a' : formatNumber(v, definition.decimal_places));

  const bestsLines = bestsBySide
    .map(({ label, bests }) => {
      // The side is named on every line, not once above the block, so a line
      // copied out of the file on its own still says which limb it describes.
      const p = label ? `${label} — ` : '';
      // The trend's definition travels with the file. A percentage in a
      // spreadsheet with no stated basis is the thing this whole feature was
      // asked to avoid.
      const trendLine =
        bests.trendPct === null
          ? `# ${p}Season trend: n/a (needs a current season, a result in it, and a result before it)`
          : `# ${p}Season trend: ${bests.trendPct > 0 ? '+' : ''}${bests.trendPct.toFixed(1)}% — this season's best vs best before the season; positive = improvement`;
      // Separate from the trend line, because the two are separate questions:
      // an athlete's first season has no trend at all and can still be a
      // lifetime best. See computeTestBests's seasonIsNewAllTimeBest.
      const pbLine = bests.seasonIsNewAllTimeBest
        ? `# ${p}New lifetime best set this season — beats every result from outside the season.\r\n`
        : '';
      return (
        `# ${p}All-time best: ${fmt(bests.allTimeValue)}${bests.allTimeDate ? ` on ${bests.allTimeDate}` : ''} (date the mark was first set)\r\n` +
        `# ${p}Season's best${season ? ` (${season.name}, ${season.starts_on} to ${season.ends_on})` : ' (no current season set)'}: ` +
        `${fmt(bests.seasonValue)}${bests.seasonDate ? ` on ${bests.seasonDate}` : ''}\r\n` +
        `${trendLine}\r\n` +
        pbLine
      );
    })
    .join('');

  const caption =
    `# ${athleteName} — ${definition.name} (${definition.unit}). ${orgName}.\r\n` +
    `# ${definition.higher_is_better ? 'Higher' : 'Lower'} is better.` +
    `${definition.side_mode === 'per_side' ? ' Measured per side — the bests below are per side, never pooled.' : ''}\r\n` +
    bestsLines +
    '\r\n';

  const actorRole = (claims.roles.includes('medical') ? 'medical' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'testing-athlete',
    { athlete_id: athleteId, test_definition_id: testDefId, format: 'csv', timezone },
    'export',
  );

  const slug = athleteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return csvResponse(caption + csv, `${slug}-${definition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`);
}
