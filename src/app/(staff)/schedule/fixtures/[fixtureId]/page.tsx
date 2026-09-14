import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FixtureEditForm } from '@/components/FixtureEditForm/FixtureEditForm';
import { FixtureActions } from '@/components/FixtureActions/FixtureActions';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { fetchFixtureDetail, fetchWeekMdLabels, mondayOf } from '@/lib/queries/schedule';
import { enumLabel, formatLongDate, formatTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { fetchUnlinkedMatchSessions } from '@/lib/queries/matchParticipation';
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
  searchParams,
}: {
  params: Promise<{ fixtureId: string }>;
  searchParams: Promise<{ attach?: string }>;
}) {
  const { fixtureId } = await params;
  const sp = await searchParams;
  const { db, orgId, claims, timezone } = await requireStaff();
  /* Not a redirect, unlike /schedule/fixtures/new. A match in the calendar is
     information every staff role may read — a medic wants to know when the game
     is. Only the write controls go, and they go because 0073 narrowed
     fixtures_staff_insert/update to the sport scientist and the coach. */
  const canEdit = hasAnyRole(claims.roles, SESSION_EDIT);

  const fixture = await fetchFixtureDetail(db, orgId, fixtureId, timezone);
  if (!fixture) notFound();
  /* 0127: the post-match sheet's rows for the door's count, and the club's
     unlinked match sessions for the attach action (the orphan's answer). */
  const [sheetRows, unlinked] = await Promise.all([
    db.from('match_participation').select('athlete_id, minutes').eq('org_id', orgId).eq('fixture_id', fixtureId),
    canEdit && fixture.weekSessions.every((s) => s.session_type !== 'match') ? fetchUnlinkedMatchSessions(db, orgId) : Promise.resolve([]),
  ]);
  const sheetCount = sheetRows.data?.length ?? 0;
  const sheetMinutes = (sheetRows.data ?? []).filter((r) => r.minutes !== null).length;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-10)', flexWrap: 'wrap' }}>
          <span className={`pill ${STATUS_PILL[fixture.status] ?? 'pill-neutral'}`}>
            {enumLabel(fixture.status)}
          </span>
          <span className="pill pill-neutral">{enumLabel(fixture.home_away)}</span>
          <span className="pill pill-neutral">{enumLabel(fixture.importance)}</span>
        </div>
        <p style={{ marginTop: 'var(--sp-10)' }}>
          {/* formatLongDate/formatTime both resolve the real local calendar
              date and time from the full instant via Intl + timeZone — no
              need to (and previously buggy to) pre-slice kickoff_at down to
              its UTC date first, which could read the wrong calendar day. */}
          {formatLongDate(fixture.kickoff_at, timezone)} &middot; kick off{' '}
          {formatTime(fixture.kickoff_at, timezone)}
        </p>
        <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
          {fixture.venue ?? 'Venue not set'}
          {fixture.competition ? ` · ${fixture.competition}` : ''}
        </p>
        {fixture.status === 'played' ? (
          <p style={{ marginTop: 'var(--sp-10)' }}>
            <span className="label">Result</span>
            <br />
            {fixture.result ?? 'Not recorded yet.'}
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: 'var(--sp-14)' }}>
        {canEdit ? <FixtureActions orgId={orgId} fixture={fixture} /> : null}
      </div>

      {/* The post-match sheet (0127): the fixture is the match, so the sheet
          lives here. Every staff role reads the count and the report; the
          coach and the sport scientist write. */}
      <section className="card" style={{ marginTop: 'var(--sp-14)' }} aria-labelledby="sheet-door" data-sheet={sheetCount > 0 ? 'some' : 'none'}>
        <h2 className="card-title" id="sheet-door">
          Post-match sheet
        </h2>
        <p className="tiny" style={{ marginTop: 'var(--sp-2)' }}>
          {sheetCount === 0
            ? 'Nothing recorded against this fixture yet: who was selected, who started, who came on, and minutes played.'
            : `${sheetCount} athlete${sheetCount === 1 ? '' : 's'} selected · minutes recorded for ${sheetMinutes} of ${sheetCount}.`}
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-10)', flexWrap: 'wrap' }}>
          {canEdit ? (
            <Link href={`/schedule/fixtures/${fixtureId}/participation`} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} data-sheet-link>
              {sheetCount === 0 ? 'Fill in the sheet' : 'Edit the sheet'}
            </Link>
          ) : null}
          <Link href={`/reports/match?fixture=${fixtureId}`} className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Match report
          </Link>
        </div>
      </section>

      {/* The attach action: a fixture with no match session of its own may
          take an existing unlinked one (a match session created before the
          fixture existed). An action, never a backfill; audited as a session
          update. Offered only while there is something to attach. */}
      {canEdit && unlinked.length > 0 ? (
        <section className="card" style={{ marginTop: 'var(--sp-14)' }} aria-labelledby="attach-title" data-attach>
          <h2 className="card-title" id="attach-title">
            Attach an existing match session
          </h2>
          <p className="tiny" style={{ marginTop: 'var(--sp-2)' }}>
            This fixture has no match session anchored to it, and the club has {unlinked.length} match session{unlinked.length === 1 ? '' : 's'} with no fixture. Attaching one links its ratings and attendance to this match.
          </p>
          {sp.attach === 'done' ? <p className="tiny" role="status">Attached.</p> : sp.attach === 'failed' ? <p className="form-error" role="alert">Not attached. The session may already be linked, or attaching belongs to the coach and the sport scientist.</p> : null}
          <form method="post" action={`/schedule/fixtures/${fixtureId}/attach`} style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center', marginTop: 'var(--sp-10)', flexWrap: 'wrap' }}>
            <label className="visually-hidden" htmlFor="attach-session">Match session to attach</label>
            <select id="attach-session" name="session" className="field" style={{ minWidth: 260 }}>
              {unlinked.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title} · {formatLongDate(u.starts_at, timezone)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ghost">
              Attach to this fixture
            </button>
          </form>
        </section>
      ) : null}

      <section style={{ marginTop: 'var(--sp-14)' }} aria-labelledby="fixture-sessions">
        <p className="sect" id="fixture-sessions" style={{ marginBottom: 'var(--sp-8)' }}>
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

      <div style={{ marginTop: 'var(--sp-14)' }}>
        <p className="sect" style={{ marginBottom: 'var(--sp-8)' }}>
          Edit this fixture
        </p>
        {canEdit ? <FixtureEditForm orgId={orgId} fixture={fixture} timezone={timezone} /> : null}
      </div>
    </>
  );
}
