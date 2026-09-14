import { renderToBuffer } from '@react-pdf/renderer';
import { formatDate, formatLongDate, formatTime, todayIso } from '@/lib/format';
import { SELECTION_WORDS, availabilityAtKickOffWords, fixtureWords, matchDefinition, matchFigure, minutesWords, selectionOf, sortRows } from '@/lib/matchReport';
import { PdfFigure, PdfHeader, PdfReport, PdfSectionTitle, PdfTable, pdfResponse, pdfDisposition } from '@/lib/pdf';
import { fetchFixtureSheet, scopeSheet } from '@/lib/queries/matchParticipation';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { recordReportView } from '@/lib/queries/reports';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

/** The match report as a PDF — the same sentence, figure and table. */
export async function GET(request: Request) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('match');
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
  const figure = matchFigure({
    selected: selected.length,
    started: selected.filter((r) => r.started).length,
    cameOn: selected.filter((r) => r.came_on).length,
    withMinutes: selected.filter((r) => r.minutes !== null).length,
    squad: sheet.squad,
    fixture: fx,
  });
  const footer = `${orgName} · Fydr · generated ${formatDate(todayIso(timezone), timezone)} · not for redistribution without the club's own policy`;
  const buffer = await renderToBuffer(
    <PdfReport footer={footer}>
      <PdfHeader
        eyebrow={`Match · ${orgName}`}
        title="Match report"
        definition={matchDefinition(fx)}
        meta={`${fx} · ${formatLongDate(sheet.fixture.kickoff_at, timezone)}, kick off ${formatTime(sheet.fixture.kickoff_at, timezone)} · Scope: ${scopeLabel} (${sheet.squad} athlete${sheet.squad === 1 ? '' : 's'})`}
      />
      <PdfFigure {...figure} />
      <PdfSectionTitle title="Who played" caption="Starters first, then who came on, then selected and not used; most minutes first, not recorded last. A blank minutes cell on the sheet is not recorded, never 0." />
      <PdfTable
        emptyText={`No post-match sheet for ${fx}. Nothing is recorded against this fixture.`}
        rows={selected}
        columns={[
          { key: 'name', label: 'Athlete', width: '30%', render: (r) => `${r.first_name} ${r.last_name}` },
          { key: 'selection', label: 'Selection', width: '20%', render: (r) => SELECTION_WORDS[selectionOf(r)] },
          { key: 'minutes', label: 'Minutes', width: '14%', align: 'right', render: (r) => minutesWords(r.minutes) },
          { key: 'availability', label: 'Availability at kick-off', width: '36%', render: (r) => `${availabilityAtKickOffWords(r.availability)}${r.restrictions.length > 0 ? ` · ${r.restrictions.join(' · ')}` : ''}` },
        ]}
      />
    </PdfReport>,
  );
  await recordReportView(db, orgId, claims.userId, actorRole, 'match', { fixture_id: sheet.fixture.id, group_ids: groupIds, format: 'pdf' }, 'export');
  return pdfResponse(buffer, `match-${sheet.fixture.kickoff_at.slice(0, 10)}.pdf`, pdfDisposition(request));
}
