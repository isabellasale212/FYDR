import { Fragment } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { WellnessChart, type FlagMarker } from '@/components/WellnessChart/WellnessChart';
import { FlagNotice } from '@/components/FlagNotice/FlagNotice';
import { fetchWellnessByAthlete, wellnessSeries } from '@/lib/queries/wellness';
import { fetchAthleteRecentSessions, mondayOf } from '@/lib/queries/schedule';
import { fetchCheckinForWeek, fetchRecentCheckins } from '@/lib/queries/nutrition';
import { fetchMyTestSummary } from '@/lib/queries/testing';
import { fetchRecentGymSessions } from '@/lib/queries/programmes';
import { fetchOutstandingCount } from '@/lib/queries/compliance';
import { fetchMyVisibleFlags, staffNoteLines, type VisibleFlag } from '@/lib/queries/flags';
import {
  fetchTrainingRevisionChains,
  fetchWellnessWithRevisions,
} from '@/lib/queries/entryRevisions';
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

  /* Integration-audit major finding: acknowledging a flag never became visible anywhere
   * on the athlete side. my-data.md line ~241 scopes it as "flags | 'flags' where
   * athlete_visible_at is not null | Dated markers on the chart with the staff note" —
   * "the chart" only exists for one of the five segments here (Wellness; the other four
   * are plain tables, see GymTab's own comment on why no chart was built for gym either).
   * Rather than invent a chart for domains that don't have one, flag_domain is routed by
   * name: a domain that names an existing segment (wellness, gym, testing, training,
   * nutrition) surfaces on that segment's own tab; 'gps' and 'compliance' — the two
   * flag_domain values with no same-named segment on this page (04-data-model.md §10's
   * six-plus-training list against this page's five tabs) — have nowhere segment-shaped
   * to live, so they render in `orphanFlags` below, always visible regardless of which
   * tab is open, rather than being silently dropped. Chosen over guessing a semantic
   * mapping (e.g. "gps is really about training load, put it on the Training tab") —
   * CLAUDE.md §5: "do not guess and quietly implement" undocumented product behaviour. */
  const visibleFlags = await fetchMyVisibleFlags(db, athleteId, { from, to: today });
  const flagsByDomain = new Map<string, VisibleFlag[]>();
  for (const f of visibleFlags) {
    const list = flagsByDomain.get(f.domain) ?? [];
    list.push(f);
    flagsByDomain.set(f.domain, list);
  }
  const SEGMENT_DOMAINS = new Set(['wellness', 'gym', 'testing', 'training', 'nutrition']);
  const orphanFlags = visibleFlags.filter((f) => !SEGMENT_DOMAINS.has(f.domain));

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

      {/* gps and compliance domain flags have no matching segment (see the comment on
       * orphanFlags above) — shown here, above the tab content, so they stay visible no
       * matter which tab the athlete has open rather than living behind a tab that
       * doesn't describe them. */}
      <FlagNotice flags={orphanFlags} heading="Also noted for you" timezone={timezone} />

      {tab === 'wellness' ? (
        <WellnessTab
          db={db}
          orgId={orgId}
          athleteId={athleteId}
          from={from}
          today={today}
          dates={dates}
          timezone={timezone}
          flags={flagsByDomain.get('wellness') ?? []}
        />
      ) : tab === 'training' ? (
        <TrainingTab
          db={db}
          orgId={orgId}
          athleteId={athleteId}
          from={from}
          today={today}
          timezone={timezone}
          flags={flagsByDomain.get('training') ?? []}
        />
      ) : tab === 'nutrition' ? (
        <NutritionTab
          db={db}
          athleteId={athleteId}
          from={from}
          today={today}
          timezone={timezone}
          flags={flagsByDomain.get('nutrition') ?? []}
        />
      ) : tab === 'testing' ? (
        <TestingTab db={db} athleteId={athleteId} flags={flagsByDomain.get('testing') ?? []} timezone={timezone} />
      ) : (
        <GymTab
          db={db}
          athleteId={athleteId}
          from={from}
          today={today}
          timezone={timezone}
          flags={flagsByDomain.get('gym') ?? []}
        />
      )}
    </>
  );
}

async function WellnessTab({
  db,
  orgId,
  athleteId,
  from,
  today,
  dates,
  timezone,
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
  dates: string[];
  timezone: string;
  flags: VisibleFlag[];
}) {
  const entries = await fetchWellnessByAthlete(db, athleteId, { from, to: today });
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));

  /* ADR-005 O-32, and O-28's first clause: "the athlete sees their own chain in full".
   * A coach can now change a number this athlete reported, and until this read existed
   * the athlete was shown nothing — the table above reads `wellness_entries_current`,
   * which by construction cannot show that a value was corrected. A second query rather
   * than a widened first one because the two want opposite things: the chart needs the
   * live series with readiness_score, this needs the superseded rows. Only chains whose
   * live row is itself a revision are kept, so the map is empty on the overwhelming
   * majority of days and costs nothing to consult. */
  const corrections = await fetchWellnessWithRevisions(db, orgId, athleteId, {
    from,
    to: today,
  });
  const correctedByDate = new Map(
    corrections
      .filter((c) => c.current.revision_of !== null)
      .map((c) => [c.current.entry_date, c] as const),
  );
  const series = wellnessSeries(entries, dates, 'readiness', ROLLING_DAYS);
  const submitted = series.filter((s) => s.value !== null).length;
  const outside = series.filter((s) => {
    const p = bandPosition(s);
    return p === 'above' || p === 'below';
  }).length;

  // The wellness chart is one readiness line; wellness.readiness_score,
  // wellness.sleep_hours and wellness.soreness flags all land on it (there is only ever
  // one wellness chart on this page — see this file's own header comment on why views 2
  // to 4 of my-data.md's report pager were cut), so each marker's tooltip and the
  // FlagNotice line beneath both carry `what` to say which metric was actually flagged.
  const flagMarkers: FlagMarker[] = flags.map((f) => {
    // staff_note can now hold several notes separated by newlines (addFlagNote,
    // queries/flags.ts). A raw newline inside a one-line SVG tooltip renders
    // inconsistently across browsers, so join them with a separator here; the
    // FlagNotice below the chart is where they get one line each.
    const notes = staffNoteLines(f.staff_note).join(' · ');
    return {
      date: f.flag_date,
      tooltip: `${formatDate(f.flag_date, timezone)} — ${f.what}${notes ? `: ${notes}` : ''}`,
    };
  });

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="wellness-title">
        <h2 className="card-title" id="wellness-title">
          Readiness
        </h2>
        {/* Was: "Against your own 28 day rolling mean and ±1SD band...".
         *  Accurate, and unreadable for the audience — the club asked for
         *  less wording and less complexity here. The statistics are
         *  unchanged; only the explanation is. "Your usual range" is what
         *  the ±1SD band actually means to the person reading it. */}
        <p className="import-sub">
          The shaded band is your usual range. What matters is whether today is
          normal <em>for you</em>, not the number itself.
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
            flags={flagMarkers}
          />
        )}

        <FlagNotice flags={flags} timezone={timezone} />

        <p className="cap">
          <b>
            {submitted} of {WINDOW_DAYS}
          </b>{' '}
          days logged
          {outside > 0 ? (
            <>
              {' '}
              &middot; {outside} outside your usual range
            </>
          ) : null}
          . Days you missed are left blank, never counted as zero.
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
              </tr>
            </thead>
            <tbody>
              {[...dates].reverse().map((date) => {
                const entry = byDate.get(date);
                const corrected = correctedByDate.get(date);
                return (
                  <Fragment key={date}>
                    <tr>
                      <td className="mono sub">
                        {formatDate(date, timezone)}
                        {corrected ? (
                          <span className="pill pill-neutral" style={{ marginInlineStart: 6 }}>
                            Corrected
                          </span>
                        ) : null}
                      </td>
                      <td className="r mono">
                        {entry ? formatNumber(entry.readiness_score, 0) : 'Missing'}
                      </td>
                      <td className="r mono">
                        {entry ? `${dash(entry.sleep_hours)} h` : BLANK}
                      </td>
                      <td className="sub mono">
                        {entry?.submitted_at ? formatTime(entry.submitted_at, timezone) : BLANK}
                      </td>
                    </tr>
                    {corrected ? (
                      /* Shown open, not behind a disclosure. The coach's version of this
                       * is expandable because a coach scans thirty athletes and wants the
                       * current number by default; this is one person's own record, a
                       * correction is rare, and the fact someone changed their answer is
                       * not something to make them go looking for. No audit event either
                       * — see recordRevisionChainView's note on why. */
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--surf2)' }}>
                          <p className="cap" style={{ margin: 0 }}>
                            Corrected by {corrected.correctedBy ?? 'a member of staff'}
                            {corrected.correctedAt
                              ? ` on ${formatDate(corrected.correctedAt, timezone)}`
                              : ''}
                            .{' '}
                            {corrected.priorRevisions.length === 0
                              ? 'What you first reported is older than the window shown here.'
                              : 'What you reported:'}
                          </p>
                          {corrected.priorRevisions.length > 0 ? (
                            <ol className="cap" style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
                              {corrected.priorRevisions.map((rev) => (
                                <li key={rev.id} className="mono">
                                  {`sleep ${dash(rev.sleep_hours)} h · quality ${dash(
                                    rev.sleep_quality,
                                  )} · fatigue ${dash(rev.fatigue)} · soreness ${dash(
                                    rev.soreness,
                                  )} · stress ${dash(rev.stress)} · mood ${dash(rev.mood)}`}
                                </li>
                              ))}
                            </ol>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* The Actions column that used to hold a per-row "Correct" link is gone
          * with the athlete's correction path (migration 0058, and the note at
          * the top of CheckInForm.tsx). The whole column went rather than the
          * links inside it: a column of blanks headed "Actions" reads as broken.
          * One sentence carries what the links used to promise — and the
          * "Corrected" rows above are what make the second half of it true
          * rather than a promise (ADR-005 O-32). */}
        <p className="cap" style={{ marginTop: 8 }}>
          Check-ins can&rsquo;t be edited once sent. If a number here is wrong,
          tell your coach &mdash; they can record a correction from your profile.
          If they do, this table says <b>Corrected</b> on that day and shows you
          what you originally reported.
        </p>
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
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
  flags: VisibleFlag[];
}) {
  const sessions = await fetchAthleteRecentSessions(db, orgId, athleteId, from, today, timezone);
  const rated = sessions.filter((s) => s.rpe !== null).length;

  /* Same read, same reason, as the wellness table's — see its comment. Keyed by
   * session_id because that is what this table's rows are; an RPE entry always names
   * the session it rates (0046). */
  const correctedBySession = new Map(
    (await fetchTrainingRevisionChains(db, orgId, athleteId, { from, to: today }))
      .filter((c) => c.current.revision_of !== null && c.current.session_id !== null)
      .map((c) => [c.current.session_id as string, c] as const),
  );

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

        <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />

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
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const corrected = correctedBySession.get(session.id);
                    return (
                      <Fragment key={session.id}>
                        <tr style={{ opacity: session.status === 'cancelled' ? 0.55 : 1 }}>
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
                            {corrected ? (
                              <span className="pill pill-neutral" style={{ marginInlineStart: 6 }}>
                                Corrected
                              </span>
                            ) : null}
                          </td>
                          <td className="r mono">{session.duration_min ?? BLANK}</td>
                          <td className="r mono">{formatNumber(session.rpe, 1)}</td>
                          <td className="r mono">{formatNumber(session.session_load, 0)}</td>
                        </tr>
                        {corrected ? (
                          <tr>
                            <td colSpan={6} style={{ background: 'var(--surf2)' }}>
                              <p className="cap" style={{ margin: 0 }}>
                                Corrected by {corrected.correctedBy ?? 'a member of staff'}
                                {corrected.correctedAt
                                  ? ` on ${formatDate(corrected.correctedAt, timezone)}`
                                  : ''}
                                .{' '}
                                {corrected.priorRevisions.length === 0
                                  ? 'What you first reported is older than the window shown here.'
                                  : 'What you reported:'}
                              </p>
                              {corrected.priorRevisions.length > 0 ? (
                                <ol
                                  className="cap"
                                  style={{ margin: '4px 0 0', paddingInlineStart: 18 }}
                                >
                                  {corrected.priorRevisions.map((rev) => (
                                    <li key={rev.id} className="mono">
                                      {`RPE ${dash(rev.rpe)} · ${dash(rev.duration_min)} min · load ${dash(
                                        rev.session_load,
                                      )}`}
                                    </li>
                                  ))}
                                </ol>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="cap">
              <b>{rated}</b> of <b>{sessions.length}</b> sessions rated in this
              window.
            </p>
            {/* Same removal, same reason, and same "Corrected" row, as the
              * wellness table above. */}
            <p className="cap">
              Ratings can&rsquo;t be edited once sent. If one is wrong, tell your
              coach &mdash; they can record a correction from your profile. If they
              do, this table says <b>Corrected</b> on that session and shows you
              what you originally rated it.
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
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
  flags: VisibleFlag[];
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

        <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />

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
        {/* This Correct link SURVIVED the change that removed the wellness and
          * training ones, and the asymmetry is deliberate rather than an
          * oversight. `revise_nutrition_checkin` is athlete-only by design and
          * always has been: `nutrition_checkins` has no staff insert policy at
          * all (migration 0012 §11 — "a coach guessing whether a player hit
          * their protein target is not a self report"), so there is no coach
          * path to move this to. Closing the athlete's path here would leave the
          * weekly check-in correctable by nobody, which is worse than the
          * inconsistency. Recorded in adr-005-immutable-entries.md's
          * "Who may correct what" table. */}
        {checkins.length > 0 ? (
          <p className="cap" style={{ marginTop: 8 }}>
            This one you can still change yourself &mdash; only you know the
            answer, so no coach can correct it for you. Changing it keeps the old
            answer on record.
          </p>
        ) : null}
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
  flags,
  timezone,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  flags: VisibleFlag[];
  timezone: string;
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

        <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />

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
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
  flags: VisibleFlag[];
}) {
  const sessions = await fetchRecentGymSessions(db, athleteId, from, today);

  return (
    <div className="stack" style={{ marginTop: 14 }}>
      <section className="card" aria-labelledby="gym-title">
        <h2 className="card-title" id="gym-title">
          Sessions
        </h2>
        {/* Like the nutrition check-in above and unlike wellness and RPE, gym set
          * logs stay the athlete's own to correct. `gym_set_logs` has no staff
          * write path of any kind (migration 0045), so `revise_gym_set_log` could
          * not be widened to coaches without first building one — and removing the
          * athlete's path would leave every mis-logged rep permanently wrong.
          * Building that staff path was out of scope for this change and is
          * recorded as O-31 in adr-005-immutable-entries.md. */}
        <p className="import-sub">
          Completed gym sessions in this window. Tap Correct on a session to fix a set
          you mis-logged &mdash; the original is kept, never overwritten. Gym sets are
          still yours to correct; your check-ins and session ratings are not.
        </p>

        <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />

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
