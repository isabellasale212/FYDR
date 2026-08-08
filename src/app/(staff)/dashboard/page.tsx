import Link from 'next/link';
import { AttentionRow } from '@/components/AttentionRow/AttentionRow';
import { AvailabilityList } from '@/components/AvailabilityList/AvailabilityList';
import { AvailabilityStrip } from '@/components/AvailabilityStrip/AvailabilityStrip';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { parseGroupParam } from '@/lib/groupFilter';
import {
  fetchAvailabilityCounts,
  fetchNotFullyAvailable,
} from '@/lib/queries/availability';
import { fetchWellnessComplianceForDay } from '@/lib/queries/compliance';
import { fetchDashboardAttention } from '@/lib/queries/flags';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchDaySessions, fetchNextFixture } from '@/lib/queries/schedule';
import { formatDate, formatLongDate, mdLabel, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Dashboard · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A panel that failed does not blank the screen. screens/dashboard.md §Data
 *  requirements: the supporting queries are independent on purpose. */
function value<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function PanelError({ what }: { what: string }) {
  return (
    <div className="banner">
      <span className="g g-warn" aria-hidden="true">
        ⚠
      </span>
      <div>
        <b>{what} did not load.</b> The rest of the page is unaffected. Reload to
        try again.
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, timezone } = await requireStaff();
  const params = await searchParams;
  const groupIds = parseGroupParam(params.groups);
  const today = todayIso(timezone);

  const [groups, counts, notAvailable, attention, sessions, compliance, fixture] =
    await Promise.allSettled([
      fetchGroups(db, orgId),
      fetchAvailabilityCounts(db, orgId, groupIds),
      fetchNotFullyAvailable(db, orgId, groupIds),
      fetchDashboardAttention(db, orgId, today, groupIds, 5),
      fetchDaySessions(db, orgId, today, groupIds),
      fetchWellnessComplianceForDay(db, orgId, today, groupIds),
      fetchNextFixture(db, orgId, `${today}T00:00:00Z`),
    ]);

  const groupList = value(groups) ?? [];
  const countsValue = value(counts);
  const notAvailableRows = value(notAvailable);
  const attentionValue = value(attention);
  const sessionList = value(sessions);
  const complianceValue = value(compliance);
  const nextFixture = value(fixture);

  const unknownCount = countsValue?.unknown ?? 0;
  const namedCount = notAvailableRows
    ? notAvailableRows.filter((r) => r.status !== 'unknown').length
    : 0;

  const matchdaySession = sessionList?.find((s) => s.md_offset !== null);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            Squad · {orgName} · {formatDate(today)}
          </p>
          <h1>Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PrintButton />
          <ThemeToggle />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groupList} selected={groupIds} />
      </div>

      <div className="stack">
        {countsValue ? (
          <AvailabilityStrip counts={countsValue} />
        ) : (
          <PanelError what="The availability strip" />
        )}

        <section className="card" aria-labelledby="not-available-title">
          <h2 className="card-title" id="not-available-title">
            {notAvailableRows === null
              ? 'Who is not fully available'
              : `The ${namedCount} who are not fully available`}
            {unknownCount > 0 ? (
              <span className="pill pill-neutral mono" style={{ marginLeft: 8 }}>
                + {unknownCount} unknown
              </span>
            ) : null}
          </h2>
          <p className="import-sub">
            Named, with the restriction and where they are in the return. Medical
            detail is not shown to coaching staff.
          </p>
          {notAvailableRows === null ? (
            <PanelError what="The availability list" />
          ) : notAvailableRows.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="Everybody is available"
              body="No athlete in this filter carries a restriction or is unavailable today."
            />
          ) : (
            <AvailabilityList rows={notAvailableRows} />
          )}
          <p className="cap" style={{ marginTop: 10 }}>
            <Link href="/injuries">Injuries →</Link>
          </p>
        </section>

        <section className="card" aria-labelledby="attention-title">
          <h2 className="card-title" id="attention-title">
            Attention list{' '}
            {attentionValue ? (
              <span className="tiny mono" style={{ fontWeight: 400 }}>
                · top {attentionValue.rows.length} of {attentionValue.openTotal}{' '}
                open flags · ranked
              </span>
            ) : null}
          </h2>
          <p className="import-sub">
            Each against the athlete&rsquo;s own baseline. Capped at five; a list
            of fifteen is a list of zero.
          </p>
          {attentionValue === null ? (
            <PanelError what="The attention list" />
          ) : attentionValue.rows.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="Nothing is asking for attention"
              body="No open flag on any athlete in this filter. That is the result, not a failure to load."
            />
          ) : (
            attentionValue.rows.map((row, i) => (
              <AttentionRow key={row.athlete_id} row={row} rank={i + 1} />
            ))
          )}
        </section>

        <div className="grid2">
          <section className="card" aria-labelledby="today-title">
            <h2 className="card-title" id="today-title">
              Today · {formatDate(today)}
              {matchdaySession?.md_offset !== undefined &&
              matchdaySession?.md_offset !== null
                ? ` · ${mdLabel(matchdaySession.md_offset)}`
                : ''}
            </h2>
            <p className="import-sub">
              {nextFixture ? (
                <Link href={`/schedule/fixtures/${nextFixture.id}`}>
                  v {nextFixture.opponent}, {formatLongDate(nextFixture.kickoff_at)}
                </Link>
              ) : (
                'No fixture scheduled ahead of today.'
              )}
            </p>
            {sessionList === null ? (
              <PanelError what="Today's timetable" />
            ) : sessionList.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="Nothing is scheduled today"
                body="No session sits on today's date for this filter."
              />
            ) : (
              sessionList.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))
            )}
          </section>

          <section className="card" aria-labelledby="compliance-title">
            <h2 className="card-title" id="compliance-title">
              Wellness compliance · today
            </h2>
            <p className="import-sub">
              Submitted against expected, for the athletes in this filter.
            </p>
            {complianceValue === null ? (
              <PanelError what="Wellness compliance" />
            ) : complianceValue.expected === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No check-in is expected today"
                body="Compliance is only counted where an expectation was generated."
              />
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    marginTop: 18,
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 52,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      lineHeight: 1,
                    }}
                  >
                    {Math.round(
                      (complianceValue.submitted / complianceValue.expected) * 100,
                    )}
                    <span style={{ fontSize: 26 }}>%</span>
                  </div>
                </div>
                <hr className="hr" style={{ marginTop: 22 }} />
                <div className="kv">
                  <span className="sub">Submitted</span>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    {complianceValue.submitted} / {complianceValue.expected}
                  </span>
                </div>
                <div className="kv">
                  <span className="sub">Outstanding</span>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    {complianceValue.outstanding}
                  </span>
                </div>
                {complianceValue.missingNames.length > 0 ? (
                  <p className="cap">
                    {complianceValue.missingNames.slice(0, 6).join(', ')}
                    {complianceValue.missingNames.length > 6
                      ? ` and ${complianceValue.missingNames.length - 6} more`
                      : ''}{' '}
                    have not submitted. They are unknown, not available.
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
