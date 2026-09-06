import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FixtureEditForm } from '@/components/FixtureEditForm/FixtureEditForm';
import { FixtureActions } from '@/components/FixtureActions/FixtureActions';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { fetchFixtureDetail, fetchWeekMdLabels, mondayOf } from '@/lib/queries/schedule';
import { enumLabel, formatLongDate, formatTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Fixture · Fydr' };

const STATUS_PILL: Record<string, string> = {
  scheduled: 'pill-neutral',
  postponed: 'pill-warn',
  cancelled: 'pill-bad',
  played: 'pill-good',
};

/** screens/fixture-detail.md, screen 17, Details tab only — see the query
 *  file header in lib/queries/schedule.ts for the exact cuts (no Selection
 *  tab, no availability tiles, no creation form). Route per
 *  20-route-map.md line 107. */
export default async function FixtureDetailPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const { db, orgId, claims, timezone } = await requireStaff();
  /* Not a redirect, unlike /schedule/fixtures/new. A match in the calendar is
     information every staff role may read — a medic wants to know when the game
     is. Only the write controls go, and they go because 0073 narrowed
     fixtures_staff_insert/update to the sport scientist and the coach. */
  const canEdit = hasAnyRole(claims.roles, SESSION_EDIT);

  const fixture = await fetchFixtureDetail(db, orgId, fixtureId, timezone);
  if (!fixture) notFound();

  // MD-n per session, re-anchored to EACH session's own real calendar week
  // (anchorMdOffsetsToWeek, format.ts) rather than the raw stored md_offset
  // — sessions anchored to this fixture aren't guaranteed to share one week,
  // so this fetches fetchWeekMdLabels once per distinct week represented
  // and merges the results, same primitive the week views use (audit B2).
  const weeks = [...new Set(fixture.weekSessions.map((s) => mondayOf(s.entry_date)))];
  const weekMdByWeek = await Promise.all(weeks.map((week) => fetchWeekMdLabels(db, orgId, week, timezone)));
  const weekMd = new Map<string, number | null>();
  for (const m of weekMdByWeek) for (const [date, offset] of m) weekMd.set(date, offset);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule">Schedule</Link> · Fixture
          </p>
          <h1>
            v {fixture.opponent}
          </h1>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className={`pill ${STATUS_PILL[fixture.status] ?? 'pill-neutral'}`}>
            {enumLabel(fixture.status)}
          </span>
          <span className="pill pill-neutral">{enumLabel(fixture.home_away)}</span>
          <span className="pill pill-neutral">{enumLabel(fixture.importance)}</span>
        </div>
        <p style={{ marginTop: 10 }}>
          {/* formatLongDate/formatTime both resolve the real local calendar
              date and time from the full instant via Intl + timeZone — no
              need to (and previously buggy to) pre-slice kickoff_at down to
              its UTC date first, which could read the wrong calendar day. */}
          {formatLongDate(fixture.kickoff_at, timezone)} &middot; kick off{' '}
          {formatTime(fixture.kickoff_at, timezone)}
        </p>
        <p className="tiny" style={{ marginTop: 4 }}>
          {fixture.venue ?? 'Venue not set'}
          {fixture.competition ? ` · ${fixture.competition}` : ''}
        </p>
        {fixture.status === 'played' ? (
          <p style={{ marginTop: 10 }}>
            <span className="label">Result</span>
            <br />
            {fixture.result ?? 'Not recorded yet.'}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        {canEdit ? <FixtureActions orgId={orgId} fixture={fixture} /> : null}
      </div>

      <section style={{ marginTop: 14 }} aria-labelledby="fixture-sessions">
        <p className="sect" id="fixture-sessions" style={{ marginBottom: 8 }}>
          Sessions anchored to this fixture
        </p>
        {fixture.weekSessions.length === 0 ? (
          <div className="card">
            <p className="tiny" style={{ margin: 0 }}>
              No session names this fixture yet. Set an MD offset against it when creating
              or editing a session.
            </p>
          </div>
        ) : (
          <div className="card flush">
            {fixture.weekSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                anchoredMdOffset={weekMd.get(session.entry_date) ?? null}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </section>

      <div style={{ marginTop: 14 }}>
        <p className="sect" style={{ marginBottom: 8 }}>
          Edit this fixture
        </p>
        {canEdit ? <FixtureEditForm orgId={orgId} fixture={fixture} timezone={timezone} /> : null}
      </div>
    </>
  );
}
