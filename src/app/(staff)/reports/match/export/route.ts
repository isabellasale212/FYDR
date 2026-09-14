import { csvResponse, toCsv } from '@/lib/csv';
import { formatDate, formatDateTime, formatLongDate } from '@/lib/format';
import { SELECTION_WORDS, availabilityAtKickOffWords, fixtureWords, matchDefinition, minutesWords, selectionOf, sortRows } from '@/lib/matchReport';
import { fetchFixtureSheet, scopeSheet } from '@/lib/queries/matchParticipation';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { recordReportView } from '@/lib/queries/reports';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';
import { exportAuditMetadata, exportCaption, type ExportDescriptor } from '@/lib/exportDescriptor';

/** The match report as a CSV: the definition sentence first, one row per
 *  athlete selected, minutes as words where not recorded — never zero. */
export async function GET(request: Request) {
  const { db, orgId, claims, timezone, fullName } = await requireReport('match');
  const url = new URL(request.url);
  const fixtureId = url.searchParams.get('fixture') ?? '';
  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  const groupIds = await resolveGroupFilter(url.searchParams.get('groups') ?? undefined);
  const [groups, scope, full] = await Promise.all([fetchGroups(db, orgId), fetchGroupAthleteIds(db, orgId, groupIds), /^[0-9a-f-]{36}$/.test(fixtureId) ? fetchFixtureSheet(db, orgId, fixtureId) : Promise.resolve(null)]);
  if (!full) return new Response('Not found', { status: 404 });
  const sheet = scopeSheet(full, scope);
  const scopeLabel = groupScopeLabel(groups, groupIds);

  const fx = fixtureWords(sheet.fixture.opponent, formatDate(sheet.fixture.kickoff_at, timezone));
  const selected = sortRows(sheet.rows.filter((r) => r.selected));
  const rows = selected.map((r) => ({
    name: `${r.first_name} ${r.last_name}`,
    position: r.position ?? '',
    selection: SELECTION_WORDS[selectionOf(r)],
    minutes: minutesWords(r.minutes),
    availability: availabilityAtKickOffWords(r.availability),
    restrictions: r.restrictions.join(' · '),
  }));
  const csv = toCsv(rows, [
    ['name', 'Athlete'],
    ['position', 'Position'],
    ['selection', 'Selection'],
    ['minutes', 'Minutes'],
    ['availability', 'Availability at kick-off'],
    ['restrictions', 'Restrictions at kick-off'],
  ]);
  const kickoffIso = sheet.fixture.kickoff_at.slice(0, 10);
  const descriptor: ExportDescriptor = {
    fileName: `match-${kickoffIso}.csv`,
    report: 'Match report',
    window: `${fx} (${formatLongDate(sheet.fixture.kickoff_at, timezone)})`,
    scope: `${scopeLabel} (${selected.length} selected of ${sheet.squad})`,
    rows: selected.length,
    rowNoun: 'athlete selected',
    filters: [],
    medical: false,
  };
  const caption =
    exportCaption(descriptor, matchDefinition(fx), { exportedBy: fullName, at: formatDateTime(new Date().toISOString(), timezone) }) +
    `# Minutes: a blank cell in the sheet is written as "Not recorded", never 0. ${selected.filter((r) => r.minutes !== null).length} of ${selected.length} selected have minutes recorded.\r\n`;
  await recordReportView(db, orgId, claims.userId, actorRole, 'match', { fixture_id: sheet.fixture.id, group_ids: groupIds, ...exportAuditMetadata(descriptor) }, 'export');
  return csvResponse(caption + csv, descriptor.fileName);
}
