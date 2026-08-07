import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { fetchWellnessByAthlete, wellnessSeries } from '@/lib/queries/wellness';
import { fetchAthleteRecentSessions } from '@/lib/queries/schedule';
import { fetchRecentCheckins } from '@/lib/queries/nutrition';
import { fetchMyTestSummary } from '@/lib/queries/testing';
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
 * show, and now a Testing tab now that the testing domain exists too — this
 * comment used to say both stayed out "until the domains behind them exist",
 * and testing's domain now does. Gym stays out a while longer: there is no
 * single "my gym history" read built yet, only my-programme.md's forward-
 * looking session list. Leaderboards are linked separately below the tabs
 * rather than folded in as a tab, since it isn't a history list the same
 * shape as the others. Fixed 42-day window, no custom period picker — same
 * simplifications as the rest of this pass, same reasoning: ship the read
 * path well, note what is cut.
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
          : 'wellness';

  const today = todayIso(timezone);
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const dates = dateRange(from, WINDOW_DAYS);

  return (
    <>
      <div className="hd">
        <h1 className="d">My data</h1>
      </div>

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
      </div>

      <p className="cap" style={{ marginTop: 10 }}>
        <Link href="/my-data/boards">Leaderboards →</Link>
      </p>

      {tab === 'wellness' ? (
        <WellnessTab db={db} athleteId={athleteId} from={from} today={today} dates={dates} />
      ) : tab === 'training' ? (
        <TrainingTab db={db} orgId={orgId} athleteId={athleteId} from={from} today={today} />
      ) : tab === 'nutrition' ? (
        <NutritionTab db={db} athleteId={athleteId} from={from} today={today} />
      ) : (
        <TestingTab db={db} athleteId={athleteId} />
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
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  dates: string[];
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
          Against your own {ROLLING_DAYS} day rolling mean and &plusmn;1SD band.
          What matters is whether today is normal for you, not the raw number.
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
                    <td className="mono sub">{formatDate(date)}</td>
                    <td className="r mono">
                      {entry ? formatNumber(entry.readiness_score, 0) : 'Missing'}
                    </td>
                    <td className="r mono">
                      {entry ? `${dash(entry.sleep_hours)} h` : BLANK}
                    </td>
                    <td className="sub mono">
                      {entry?.submitted_at ? formatTime(entry.submitted_at) : BLANK}
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
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
}) {
  const sessions = await fetchAthleteRecentSessions(db, orgId, athleteId, from, today);
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
                        {formatDate(session.starts_at)} {formatTime(session.starts_at)}
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
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
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
                    <td className="mono sub">{formatDate(c.week_start)}</td>
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
                <span className="nm">{s.name}</span>
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
