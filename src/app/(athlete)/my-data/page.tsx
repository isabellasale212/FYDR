import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { fetchWellnessByAthlete, wellnessSeries } from '@/lib/queries/wellness';
import { fetchAthleteRecentSessions, mondayOf } from '@/lib/queries/schedule';
import { fetchCheckinForWeek, fetchRecentCheckins } from '@/lib/queries/nutrition';
import { fetchMyTestSummary } from '@/lib/queries/testing';
import { fetchRecentGymSessions } from '@/lib/queries/programmes';
import { fetchOutstandingCount } from '@/lib/queries/compliance';
import {
  BLANK,
  addDays,
  dash,
  enumLabel,
  formatDate,
  formatNumber,
  formatTime,
  todayIso,
} from '@/lib/format';
import { bandPosition } from '@/lib/stats';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My data · Fydr' };

const WINDOW_DAYS = 42;
const ROLLING_DAYS = 14;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function dateRange(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/**
 * The athlete's own history. screens/my-data.md scopes five segments (
 * Wellness, Gym, Testing, Boards) plus a period picker, revision comparisons
 * and materialised-view-backed aggregates; Phase 1a's own line in
 * 10-roadmap.md narrows that to "My data (wellness and training tabs only)",
 * extended here with a Nutrition tab once the weekly check-in existed to
 * show, a Testing tab once the testing domain existed, and now a Gym tab
 * (integration-audit blocker B3) — this comment used to say Gym stayed out
 * because "there is no single 'my gym history' read built yet, only
 * my-programme.md's forward-looking session list"; fetchRecentGymSessions is
 * that read now. Deliberately minimal, matching the other tabs on this page:
 * recent complete sessions, a set count, a "Correct" link through to a
 * per-session detail page — no volume trend, no e1RM chart, no PR callouts,
 * all real, larger, separately scoped features. Leaderboards are linked
 * separately below the tabs rather than folded in as a tab, since it isn't a
 * history list the same shape as the others. Fixed 42-day window, no custom
 * period picker — same simplifications as the rest of this pass, same
 * reasoning: ship the read path well, note what is cut.
 */
export default async function MyDataPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, timezone } = await requireAthlete();
  const params = await searchParams;
  const tab =
    params.tab === 'training'
      ? 'training'
      : params.tab === 'nutrition'
        ? 'nutrition'
        : params.tab === 'testing'
          ? 'testing'
          : params.tab === 'gym'
            ? 'gym'
            : 'wellness';

  const today = todayIso(timezone);
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const dates = dateRange(from, WINDOW_DAYS);
  const nutritionWeekStart = addDays(mondayOf(today), -7);
  const nutritionCheckin = await fetchCheckinForWeek(db, athleteId, nutritionWeekStart);
  const outstanding = await fetchOutstandingCount(db, athleteId, today, !!nutritionCheckin);

  return (
    <>
      <div className="hd">
        <h1 className="d">My data</h1>
        <span className={`pill status-pill ${outstanding > 0 ? 'pill-warn' : 'pill-good'}`}>
          {outstanding > 0 ? (
            <>
              <span className="mono">{outstanding}</span> to do
            </>
          ) : (
            'Up to date'
          )}
        </span>
      </div>

      {/* Five chips, §10: the four history segments this build has real
       * data for, plus Leaderboards as a fifth — a real navigational chip
       * to /my-data/boards rather than a fifth ?tab= segment, since its
       * content isn't a history list the same shape as the other four
       * (see fetchMyBoards's own header comment for why that's a real
       * distinction, not just a styling one). */}
      <div className="chiprow" role="tablist" aria-label="Data segment" style={{ marginTop: 4 }}>
        <Link
          href="/my-data?tab=wellness"
          className="squad-chip"
          role="tab"
          aria-selected={tab === 'wellness'}
        >
          Wellness
        </Link>
        <Link
          href="/my-data?tab=training"
          className="squad-chip"
          role="tab"
          aria-selected={tab === 'training'}
        >
          Training
        </Link>
        <Link
          href="/my-data?tab=nutrition"
          className="squad-chip"
          role="tab"
          aria-selected={tab === 'nutrition'}
        >
          Nutrition
        </Link>
        <Link
          href="/my-data?tab=testing"
          className="squad-chip"
          role="tab"
          aria-selected={tab === 'testing'}
        >
          Testing
        </Link>
        <Link
          href="/my-data?tab=gym"
          className="squad-chip"
          role="tab"
          aria-selected={tab === 'gym'}
        >
          Gym
        </Link>
        <Link href="/my-data/boards" className="squad-chip">
          Leaderboards
        </Link>
      </div>

      {tab === 'wellness' ? (
        <WellnessTab db={db} athleteId={athleteId} from={from} today={today} dates={dates} timezone={timezone} />
      ) : tab === 'training' ? (
        <TrainingTab db={db} orgId={orgId} athleteId={athleteId} from={from} today={today} timezone={timezone} />
      ) : tab === 'nutrition' ? (
        <NutritionTab db={db} athleteId={athleteId} from={from} today={today} timezone={timezone} />
      ) : tab === 'testing' ? (
        <TestingTab db={db} athleteId={athleteId} />
      ) : (
        <GymTab db={db} athleteId={athleteId} from={from} today={today} timezone={timezone} />
      )}
    </>
  );
}

async function WellnessTab({
  db,
  athleteId,
  from,
  today,
  dates,
  timezone,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  dates: string[];
  timezone: string;
}) {
  const entries = await fetchWellnessByAthlete(db, athleteId, { from, to: today });
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));
  const series = wellnessSeries(entries, dates, 'readiness', ROLLING_DAYS);
  const submitted = series.filter((s) => s.value !== null).length;
  const outside = series.filter((s) => {
    const p = bandPosition(s);
    return p === 'above' || p === 'below';
  }).length;

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="wellness-title">
        <h2 className="card-title" id="wellness-title">
          Readiness
        </h2>
        <p className="import-sub">
          Against your own {ROLLING_DAYS} day rolling mean and{' '}
          <span title="The normal range for your own numbers, not anyone else's.">
            &plusmn;1SD band
          </span>{' '}
          &mdash; the normal range for your own numbers. What matters is whether
          today is normal for you, not the raw number.
        </p>

        {submitted === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing logged yet"
            body="Your check-ins appear here once you start submitting."
          />
        ) : (
          <WellnessChart
            series={series}
            min={0}
            max={100}
            ticks={[0, 25, 50, 75, 100]}
            title="Your readiness"
            timezone={timezone}
          />
        )}

        <p className="cap">
          <b>
            {submitted} of {WINDOW_DAYS}
          </b>{' '}
          days submitted; the {WINDOW_DAYS - submitted} missing days are drawn as
          gaps, never as zero. {outside} day{outside === 1 ? '' : 's'} fell
          outside your own band.
        </p>
      </section>

      <section className="card flush" aria-labelledby="wellness-entries-title">
        <h2 className="card-title" id="wellness-entries-title" style={{ padding: '16px 16px 0' }}>
          Entries
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <caption className="visually-hidden">Wellness entries, most recent first</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="r">
                  Readiness
                </th>
                <th scope="col" className="r">
                  Sleep
                </th>
                <th scope="col">Submitted</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...dates].reverse().map((date) => {
                const entry = byDate.get(date);
                return (
                  <tr key={date}>
                    <td className="mono sub">{formatDate(date, timezone)}</td>
                    <td className="r mono">
                      {entry ? formatNumber(entry.readiness_score, 0) : 'Missing'}
                    </td>
                    <td className="r mono">
                      {entry ? `${dash(entry.sleep_hours)} h` : BLANK}
                    </td>
                    <td className="sub mono">
                      {entry?.submitted_at ? formatTime(entry.submitted_at, timezone) : BLANK}
                    </td>
                    <td className="sub">
                      {entry ? (
                        <Link href={`/check-in?date=${date}&correct=1`}>Correct</Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function TrainingTab({
  db,
  orgId,
  athleteId,
  from,
  today,
  timezone,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
}) {
  const sessions = await fetchAthleteRecentSessions(db, orgId, athleteId, from, today, timezone);
  const rated = sessions.filter((s) => s.rpe !== null).length;

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="training-title">
        <h2 className="card-title" id="training-title">
          Sessions
        </h2>
        <p className="import-sub">
          What you were scheduled for and what you reported afterwards. A blank
          RPE means no rating was submitted, which is not the same as an easy
          session.
        </p>

        {sessions.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing in this window"
            body="You are not named in any session in the last 42 days."
          />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <caption className="visually-hidden">Recent sessions with reported RPE</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Session</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="r">
                      Minutes
                    </th>
                    <th scope="col" className="r">
                      RPE
                    </th>
                    <th scope="col" className="r">
                      Load
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} style={{ opacity: session.status === 'cancelled' ? 0.55 : 1 }}>
                      <td className="mono sub">
                        {formatDate(session.starts_at, timezone)} {formatTime(session.starts_at, timezone)}
                      </td>
                      <td className="nm">{session.title}</td>
                      <td className="sub">
                        {enumLabel(session.session_type)}
                        {session.status === 'cancelled' ? (
                          <span className="pill pill-bad" style={{ marginInlineStart: 6 }}>
                            Cancelled
                          </span>
                        ) : null}
                      </td>
                      <td className="r mono">{session.duration_min ?? BLANK}</td>
                      <td className="r mono">{formatNumber(session.rpe, 1)}</td>
                      <td className="r mono">{formatNumber(session.session_load, 0)}</td>
                      <td className="sub">
                        {session.rpe !== null ? (
                          <Link href={`/rpe/${session.id}?correct=1`}>Correct</Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cap">
              <b>{rated}</b> of <b>{sessions.length}</b> sessions rated in this
              window.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

const ANSWER_LABEL: Record<string, string> = { yes: 'Yes', roughly: 'Roughly', no: 'No' };

async function NutritionTab({
  db,
  athleteId,
  from,
  today,
  timezone,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
}) {
  const checkins = await fetchRecentCheckins(db, athleteId, from, today);

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="nutrition-title">
        <h2 className="card-title" id="nutrition-title">
          Weekly check-in
        </h2>
        <p className="import-sub">
          Did you hit your protein target most days that week &mdash; one question,
          answered once a week. No score, no streak, no comparison to anyone else.
        </p>

        {checkins.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing answered yet"
            body="Your weekly check-ins appear here once you start answering."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <caption className="visually-hidden">Weekly nutrition check-ins, most recent first</caption>
              <thead>
                <tr>
                  <th scope="col">Week of</th>
                  <th scope="col">Answer</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.id}>
                    <td className="mono sub">{formatDate(c.week_start, timezone)}</td>
                    <td className="nm">{ANSWER_LABEL[c.answer] ?? c.answer}</td>
                    <td className="sub">
                      <Link href={`/nutrition-check-in?week=${c.week_start}&correct=1`}>
                        Correct
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Gameplan 4.2 / audit S8: test names like "IMTP peak force" are standard
 *  S&C field-test vocabulary a coach or physio knows, not a 16-year-old
 *  reading their own results. Confirmed against this org's live
 *  `test_definitions` (unit + higher_is_better) rather than assumed:
 *  Bronco is timed in seconds, lower is better (a shuttle-run test);
 *  IMTP peak force is in newtons, higher is better (a maximum-strength
 *  test); Yo-Yo IR1 is in metres, higher is better (a shuttle-run test).
 *  Exact-name lookup, case-insensitive — an unrecognised test name (this
 *  org's freeform "10m sprint" etc. are already self-explanatory) gets no
 *  tooltip rather than an invented one. */
const TEST_NAME_EXPLAINER: Record<string, string> = {
  'imtp peak force': 'Isometric mid-thigh pull: a maximum-strength test, measured in newtons of force. Higher is better.',
  'yo-yo ir1': 'Yo-Yo Intermittent Recovery Test, level 1: a shuttle-run test of aerobic fitness, measured in metres covered. Higher is better.',
  'bronco test': 'A repeated shuttle-run test of aerobic endurance, timed in seconds. Lower (faster) is better.',
};

/** screens/testing.md's own role table: "Athlete: Own results only: history,
 *  personal bests." RLS already scopes test_results to the caller's own
 *  rows; fetchMyTestSummary just shapes it per test, latest result plus PB. */
async function TestingTab({
  db,
  athleteId,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
}) {
  const summary = await fetchMyTestSummary(db, athleteId);

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="testing-title">
        <h2 className="card-title" id="testing-title">
          Test results
        </h2>
        <p className="import-sub">
          Your own results and personal bests only &mdash; never a squad
          comparison here.
        </p>

        {summary.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="No results yet"
            body="Nothing has been logged for you yet. Results are entered by your coach or physio at a testing session."
          />
        ) : (
          <div className="stack" style={{ gap: 6, marginTop: 10 }}>
            {summary.map((s) => (
              <div key={s.test_definition_id} className="load-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <span className="nm" title={TEST_NAME_EXPLAINER[s.name.toLowerCase()]}>{s.name}</span>
                <span className="tiny">
                  {s.latestValue !== null ? `Latest ${s.latestValue.toFixed(s.decimal_places)}${s.unit}` : dash(null)}
                </span>
                <span className="pill pill-good">
                  {s.pbValue !== null ? `PB ${s.pbValue.toFixed(s.decimal_places)}${s.unit}` : dash(null)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Blocker B3 (integration audit): the one segment this page had no read for at all.
 *  fetchRecentGymSessions is athlete-scoped by construction (gym_session_logs_current
 *  RLS), complete sessions only — an in_progress or abandoned one has nothing submitted
 *  yet to correct, same reasoning as revise_gym_session_log's own status gate. */
async function GymTab({
  db,
  athleteId,
  from,
  today,
  timezone,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
}) {
  const sessions = await fetchRecentGymSessions(db, athleteId, from, today);

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="gym-title">
        <h2 className="card-title" id="gym-title">
          Sessions
        </h2>
        <p className="import-sub">
          Completed gym sessions in this window. Tap Correct on a session to fix a set
          you mis-logged &mdash; the original is kept, never overwritten.
        </p>

        {sessions.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="Nothing logged yet"
            body="Completed gym sessions appear here."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <caption className="visually-hidden">Recent completed gym sessions</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Session</th>
                  <th scope="col" className="r">
                    Sets
                  </th>
                  <th scope="col" className="r">
                    Volume
                  </th>
                  <th scope="col" className="r">
                    RPE
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="mono sub">{formatDate(s.entry_date, timezone)}</td>
                    <td className="nm">{s.session_name ?? 'Gym session'}</td>
                    <td className="r mono">{s.set_count}</td>
                    <td className="r mono">
                      {s.total_volume_kg !== null ? formatNumber(s.total_volume_kg, 0) : BLANK}
                    </td>
                    <td className="r mono">{formatNumber(s.session_rpe, 1)}</td>
                    <td className="sub">
                      <Link href={`/my-data/gym/${s.id}`}>Correct</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
