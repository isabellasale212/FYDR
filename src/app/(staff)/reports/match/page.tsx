import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ExportDialog } from '@/components/ExportDialog/ExportDialog';
import { ReportFigure } from '@/components/ReportFigure/ReportFigure';
import { ReportHeader } from '@/components/ReportHeader/ReportHeader';
import { ReportSelectNav } from '@/components/ReportSelectNav/ReportSelectNav';
import { TableShell } from '@/components/TableShell/TableShell';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';
import { formatDate, formatDateTime, formatLongDate, formatTime } from '@/lib/format';
import { SELECTION_WORDS, availabilityAtKickOffWords, fixtureWords, matchDefinition, matchFigure, minutesWords, selectionOf, sortRows } from '@/lib/matchReport';
import { fetchGroupAthleteIds, fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchFixtureSheet, fetchPastFixtures, scopeSheet } from '@/lib/queries/matchParticipation';
import { recordReportView } from '@/lib/queries/reports';
import { fetchStaffName } from '@/lib/queries/staffName';
import { requireReport } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

export const metadata = { title: 'Match report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;


/** The match report — the eighth, every club (Isabella, decision batch 13
 *  September 2026, "The match report, both halves approved"; built 15
 *  September). The post-match sheet (0127) read as a report: who was
 *  selected, who started, who came on, and minutes played, with each
 *  athlete's availability as it stood at kick-off. An athlete with no
 *  minutes recorded shows as not recorded, never as zero. One fixture at a
 *  time, chosen at the top; the sheet is where the data enters and the empty
 *  state says so. docs/screens/67-match-report.md. */
export default async function MatchReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireReport('match');
  const params = await searchParams;
  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  const canEdit = hasAnyRole(claims.roles, SESSION_EDIT);

  /* The group filter (CLAUDE.md §3): narrows the sheet's rows and the
     squad the figure counts over, and rides into both exports. */
  const groupIds = await resolveGroupFilter(params.groups);
  const [groups, scope, fixtures] = await Promise.all([fetchGroups(db, orgId), fetchGroupAthleteIds(db, orgId, groupIds), fetchPastFixtures(db, orgId, new Date().toISOString())]);
  const scopeLabel = groupScopeLabel(groups, groupIds);
  const fixtureId = typeof params.fixture === 'string' && fixtures.some((f) => f.id === params.fixture) ? params.fixture : (fixtures[0]?.id ?? null);
  const full = fixtureId ? await fetchFixtureSheet(db, orgId, fixtureId) : null;
  const sheet = full ? scopeSheet(full, scope) : null;
  await recordReportView(db, orgId, claims.userId, actorRole, 'match', { fixture_id: fixtureId, group_ids: groupIds });

  if (!sheet) {
    return (
      <>
        <ReportHeader groups={groups} groupIds={groupIds} eyebrow="Reports · Match" title="Match report" definition={matchDefinition('a fixture')} sub={<p className="eyebrow rhead-sub">{scopeLabel} · {orgName}</p>} />
        <EmptyState title="No fixture has kicked off yet." body="The match report reads the coach’s post-match sheet on a fixture. Once a fixture has kicked off it appears here, and its sheet is filled in from the fixture." action={{ href: '/schedule', label: 'Open the schedule' }} />
      </>
    );
  }

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
  const recordedBy = sheet.recorded.by ? await fetchStaffName(orgId, sheet.recorded.by) : null;
  const kickoffIso = sheet.fixture.kickoff_at.slice(0, 10);

  return (
    <>
      <ReportHeader
        groups={groups}
        groupIds={groupIds}
        eyebrow="Reports · Match"
        title="Match report"
        definition={matchDefinition(fx)}
        sub={
          <div className="rhead-sub">
            <p className="eyebrow" style={{ marginBottom: 'var(--sp-10)' }}>
              {scopeLabel} · {orgName} · {fx} · {formatLongDate(sheet.fixture.kickoff_at, timezone)}, kick off {formatTime(sheet.fixture.kickoff_at, timezone)} · {sheet.squad} athlete{sheet.squad === 1 ? '' : 's'} in {scopeLabel.toLowerCase()}
            </p>
            <p className="sub" style={{ margin: '0 0 10px' }}>
              {sheet.recorded.at ? `Sheet last saved ${formatDateTime(sheet.recorded.at, timezone)}${recordedBy ? ` by ${recordedBy.name}` : ''}.` : 'No sheet has been saved for this fixture.'}{' '}
              <Link href={`/schedule/fixtures/${sheet.fixture.id}`} className="linklike">
                Open the fixture
              </Link>
              {canEdit ? (
                <>
                  {' · '}
                  <Link href={`/schedule/fixtures/${sheet.fixture.id}/participation`} className="linklike">
                    {selected.length === 0 ? 'Fill in the sheet' : 'Edit the sheet'}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        }
        actions={
          <>
            <ExportDialog
              href={`/reports/match/export?fixture=${sheet.fixture.id}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`}
              descriptor={{
                fileName: `match-${kickoffIso}.csv`,
                report: 'Match report',
                window: `${fx} (${formatLongDate(sheet.fixture.kickoff_at, timezone)})`,
                scope: `${scopeLabel} (${selected.length} selected of ${sheet.squad})`,
                rows: selected.length,
                rowNoun: 'athlete selected',
                filters: [],
                medical: false,
              }}
            />
            <a href={`/reports/match/pdf?fixture=${sheet.fixture.id}${groupIds.length ? `&groups=${groupIds.join(',')}` : ''}`} className="rhead-btn">
              Export PDF
            </a>
          </>
        }
        period={
          <div className="rhead-period-stack">
            <div className="rhead-period-row">
              <ReportSelectNav
                label="Fixture"
                paramKey="fixture"
                value={sheet.fixture.id}
                options={fixtures.map((f) => ({ value: f.id, label: `${fixtureWords(f.opponent, formatDate(f.kickoff_at, timezone))}${f.sheet_rows === 0 ? ' · no sheet' : ''}` }))}
                clearValue={fixtures[0]?.id ?? ''}
                ariaLabel="Fixture"
              />
            </div>
            <p className="rhead-period-note">Fixtures that have kicked off, newest first. An upcoming fixture has no sheet by design.</p>
          </div>
        }
      />

      <ReportFigure {...figure} />

      {selected.length === 0 ? (
        <EmptyState
          title={`No post-match sheet for ${fx}.`}
          body="Nothing is recorded against this fixture: nobody is shown as selected, started, came on, or with minutes. The coach or the sport scientist fills in the sheet from the fixture; the report reads it the moment it is saved."
          action={canEdit ? { href: `/schedule/fixtures/${sheet.fixture.id}/participation`, label: 'Fill in the sheet' } : { href: `/schedule/fixtures/${sheet.fixture.id}`, label: 'Open the fixture' }}
        />
      ) : (
        <TableShell
          title="Who played"
          titleId="played-title"
          sort="Starters first, then who came on, then selected and not used; most minutes first, not recorded last"
          count={`${selected.length} selected · ${selected.filter((r) => r.minutes !== null).length} with minutes recorded`}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl tbl-cards">
              <caption className="visually-hidden">The post-match sheet for {fx}</caption>
              <thead>
                <tr>
                  <th scope="col">Athlete</th>
                  <th scope="col">Selection</th>
                  <th scope="col" className="r">Minutes</th>
                  <th scope="col">Availability at kick-off</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((r) => (
                  <tr key={r.athlete_id} data-selection={selectionOf(r)}>
                    <td className="nm" data-label="Athlete">
                      <Link href={`/squad/${r.athlete_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {r.first_name} {r.last_name}
                      </Link>
                      <span className="sub" style={{ display: 'block', fontWeight: 400 }}>
                        {r.position ?? 'No position set'}
                        {r.squad_number !== null ? ` · #${r.squad_number}` : ''}
                      </span>
                    </td>
                    <td data-label="Selection">{SELECTION_WORDS[selectionOf(r)]}</td>
                    <td className="r num" data-label="Minutes">
                      {r.minutes === null ? <span className="sub">{minutesWords(null)}</span> : minutesWords(r.minutes)}
                    </td>
                    <td className="sub" data-label="Availability at kick-off">
                      {availabilityAtKickOffWords(r.availability)}
                      {r.restrictions.length > 0 ? ` · ${r.restrictions.join(' · ')}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny" style={{ marginTop: 'var(--sp-12)' }}>
            Minutes are what the coach wrote on the sheet (MET-042); a blank is not recorded, and 0 is a real value. Availability is the record as it stood at kick-off — the row in force at that instant, with the restriction line the coach reads — not as it stands today.
          </p>
        </TableShell>
      )}
    </>
  );
}
