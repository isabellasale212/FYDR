import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FixtureEditForm } from '@/components/FixtureEditForm/FixtureEditForm';
import { FixtureActions } from '@/components/FixtureActions/FixtureActions';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchFixtureDetail } from '@/lib/queries/schedule';
import { enumLabel, formatLongDate, formatTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';

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
  const { db, orgId, timezone } = await requireStaff();

  const fixture = await fetchFixtureDetail(db, orgId, fixtureId);
  if (!fixture) notFound();

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
        <ThemeToggle />
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
          {formatLongDate(fixture.kickoff_at.slice(0, 10))} &middot; kick off{' '}
          {formatTime(fixture.kickoff_at)}
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
        <FixtureActions orgId={orgId} fixture={fixture} />
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
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>

      <div style={{ marginTop: 14 }}>
        <p className="sect" style={{ marginBottom: 8 }}>
          Edit this fixture
        </p>
        <FixtureEditForm orgId={orgId} fixture={fixture} timezone={timezone} />
      </div>
    </>
  );
}
