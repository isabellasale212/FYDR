import { Fragment } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { WellnessChart, type FlagMarker } from '@/components/WellnessChart/WellnessChart';
import { FlagNotice } from '@/components/FlagNotice/FlagNotice';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { fetchWellnessByAthlete, wellnessSeries } from '@/lib/queries/wellness';
import { fetchAthleteRecentSessions, fetchCurrentSeason, mondayOf } from '@/lib/queries/schedule';
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
import {
  PERIOD_PARAM,
  clampPeriod,
  resolveRange,
  type RangeKey,
  type ResolvedRange,
} from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import { bandPosition } from '@/lib/stats';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My data · Fydr' };

/** The rolling band the readiness chart draws around the line. Also the reason
 *  `day` is not a legal period on this screen — see PERIOD_ALLOWED. */
const ROLLING_DAYS = 14;

/** How many rows any one table on this page renders, most recent first.
 *
 *  Not a query bound and not a fudge for the row ceiling — the queries beneath
 *  are paged or provably bounded (see the per-tab notes). It is a rendering
 *  bound: at `all` the window is up to MAX_WINDOW_DAYS (730) and a 730-row
 *  table is not a thing anyone reads. my-data.md's own performance section
 *  already draws this line at 60 ("the entry list is virtualised beyond 60
 *  rows"); virtualisation does not exist here, so the list stops at 60 and SAYS
 *  it stopped, which is the honest half of that rule.
 *
 *  60 is above every previous cap on this page, so nothing an athlete could see
 *  before is hidden now: the wellness table was 42 rows and the training table
 *  was EIGHT (fetchAthleteRecentSessions's `limit` default, never overridden
 *  here — its "n of m sessions rated in this window" footer was therefore
 *  counting out of 8, not out of the window it named). */
const LIST_LIMIT = 60;

/** The five periods this screen's data can honestly express.
 *
 *  `day` is excluded, and it is the DISABLED-with-a-reason kind of exclusion,
 *  not the absent kind (lib/period.ts's header draws that distinction; the
 *  absent kind is `season` on a club with no season row, which PeriodSelector
 *  handles itself). The readiness chart is a line plus a 14-day rolling mean
 *  and ±1SD band — `wellnessSeries(entries, dates, 'readiness', ROLLING_DAYS)`
 *  — and `rollingBand` computes that band from the points inside the window,
 *  with no runway fetched outside it. A one-day window is therefore one point
 *  and no band at all: the chart renders, and the single sentence the tab
 *  exists to say ("is today normal for you") becomes unanswerable.
 *
 *  ONE HOLE, STATED RATHER THAN PATCHED: `season` can reach the same one-point
 *  shape without going through `day`. resolveRange collapses a season whose
 *  starts_on is in the FUTURE down to `today` (a club can legitimately have a
 *  current season starting next month — see that function's own comment on why
 *  it collapses rather than inverting the window), so "This season" during
 *  pre-season is a single day. That is left alone on purpose: unlike `day` it is
 *  a true statement about the club's calendar rather than a period that cannot
 *  mean anything, and the window line beneath the control says "1 day", so the
 *  athlete is told what they are looking at rather than shown a band that was
 *  drawn from one observation. */
const PERIOD_ALLOWED: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];

/** Appended to the disabled option's own label by PeriodSelector, so the option
 *  reads "Today — one day cannot show your usual range". Written for the
 *  athlete, not for the codebase: this is the only period control on the
 *  athlete side and "a metric with a trailing aggregate" is not their
 *  vocabulary. */
const PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'one day cannot show your usual range',
};

/** WHAT AN ATHLETE SEES WHEN THEY HAVE NOT CHOSEN A PERIOD.
 *
 *  This replaces a hardcoded 42-day window, and 28 is NARROWER than 42, so the
 *  choice is stated rather than made quietly.
 *
 *  42 was never specified anywhere. It was a constant in this file with no
 *  reference behind it, and docs/screens/my-data.md says 28 in five separate
 *  places — the wireframe is captioned "Wellness segment, 28-day period", the
 *  entry-point table says "First ever open lands on Wellness, last 28 days",
 *  edge case 1 works through "the 28-day view" and its "7 of 28 days" coverage
 *  line, the accessibility table spells the control's spoken label as "Last 28
 *  days, 9 July to 5 August", and the performance budget sizes the query as "a
 *  single athlete over 28 days". CLAUDE.md §5, "when the spec and the code
 *  disagree, the spec wins": 42 is the undocumented deviation here, not 28.
 *
 *  28 is also ACWR_CHRONIC_WINDOW_DAYS (lib/period.ts reads `month` straight
 *  off it), so the default window and the chronic-load window this club's
 *  staff screens use are the same number rather than two nearby ones.
 *
 *  The 14 days are not lost, and that is the part that makes this defensible
 *  rather than a silent narrowing: the window is now stated on screen with its
 *  real dates, every wider option is one click away, and the choice sticks
 *  (period.server.ts's cookie) so an athlete who wants a season picks it once.
 *  The alternative — keeping 42 as an unlabelled default — cannot be expressed:
 *  42 is not a RangeKey, and a PeriodSelector whose `value` matches no option
 *  silently displays a different option than the one that rendered. */
const SCREEN_DEFAULT_RANGE: RangeKey = 'month';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = ['wellness', 'training', 'nutrition', 'testing', 'gym'] as const;
type Tab = (typeof TABS)[number];

function isTab(v: unknown): v is Tab {
  return typeof v === 'string' && (TABS as readonly string[]).includes(v);
}

function dateRange(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

/** The earliest date this athlete has anything on record, across the four
 *  domains the period control governs, for the `all` window.
 *
 *  Athlete-scoped on purpose rather than reusing analytics.ts's
 *  `fetchEarliestEntryDate`, which filters on `org_id` and is only
 *  athlete-scoped by RLS accident on this surface — a query whose correctness
 *  depends on a policy the file does not mention is a query waiting to be
 *  copied somewhere the policy does not apply.
 *
 *  ONE date across all four domains, not one per domain, because one control
 *  drives all five tabs: resolving `all` per-tab would mean "All on record"
 *  covered a different span depending on which chip was open, and the footer
 *  under the chart would contradict the footer under the table. The min is the
 *  honest joint answer — it is the first day this athlete has ANY record.
 *
 *  Four `.limit(1)` reads on indexed columns, and only when the athlete has
 *  actually asked for `all`. Null (a brand-new athlete with nothing logged)
 *  degrades to resolveRange's 730-day floor, which is what that function
 *  already does with a missing anchor. */
async function fetchMyEarliestRecord(
  db: Awaited<ReturnType<typeof requireAthlete>>['db'],
  athleteId: string,
): Promise<string | null> {
  /* Four branches rather than one parameterised helper, for the reason
   * analytics.ts's fetchEarliestEntryDate already states about the same shape:
   * "a dynamic table name loses supabase-js's row typing entirely, and two
   * four-line branches are cheaper than an `any`." Same trade here, twice over,
   * and nutrition's column is `week_start` rather than `entry_date` anyway. */
  const [wellness, training, gym, nutrition] = await Promise.all([
    db
      .from('wellness_entries_current')
      .select('entry_date')
      .eq('athlete_id', athleteId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('training_entries_current')
      .select('entry_date')
      .eq('athlete_id', athleteId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('gym_session_logs_current')
      .select('entry_date')
      .eq('athlete_id', athleteId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('nutrition_checkins_current')
      .select('week_start')
      .eq('athlete_id', athleteId)
      .not('week_start', 'is', null)
      .order('week_start', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const res of [wellness, training, gym, nutrition]) {
    if (res.error) throw new Error(res.error.message);
  }

  const dates = [
    wellness.data?.entry_date ?? null,
    training.data?.entry_date ?? null,
    gym.data?.entry_date ?? null,
    nutrition.data?.week_start ?? null,
  ].filter((d): d is string => d !== null);

  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/** The window, spelled out, under the control. my-data.md region C: "The
 *  resolved range is mandatory: 'Last 28 days' alone does not tell the athlete
 *  whether today is included." */
function WindowLine({ range, timezone }: { range: ResolvedRange; timezone: string }) {
  return (
    <p className="cap" style={{ margin: '6px 0 0' }}>
      {formatDate(range.from, timezone)} &ndash; {formatDate(range.to, timezone)} &middot;{' '}
      <span className="num">{range.days}</span> day{range.days === 1 ? '' : 's'}
      {range.clipped ? (
        <>
          {' '}
          &middot; showing the last 2 years, which is as far back as this goes
        </>
      ) : null}
    </p>
  );
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
 * history list the same shape as the others.
 *
 * THE PERIOD. This header used to end "Fixed 42-day window, no custom period
 * picker — same simplifications as the rest of this pass, same reasoning: ship
 * the read path well, note what is cut." That reasoning has expired and the
 * sentence is replaced rather than left to contradict the code. It was a Phase
 * 1a cut on a TWO-tab screen; the screen now has five tabs and a leaderboards
 * link, `docs/20-route-map.md` §4.7 has always listed a `PeriodSelector` in
 * this screen's own panel table, and my-data.md specifies one in four places.
 * There is now one control (lib/period.ts, the shared model) and it drives all
 * five tabs from one resolved window.
 *
 * FOUR OF THE FIVE TABS. The Testing tab is all-time and stays all-time — see
 * TestingTab's own comment for why that is a correctness argument about
 * personal bests rather than an omission, and note that it is now SAID on
 * screen instead of being a silent difference between siblings.
 */
export default async function MyDataPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, timezone } = await requireAthlete();
  const params = await searchParams;
  const tab: Tab = isTab(params.tab) ? params.tab : 'wellness';

  const today = todayIso(timezone);

  /* PERIOD RESOLUTION, in the order lib/period.ts's contract requires.
   *
   * `resolvePeriod` reads `?period=` first and falls back to the sticky
   * `fydr-period` cookie only when the URL says NOTHING — so a period chosen on
   * another screen carries over, and a bookmarked or hand-cleared `?period=`
   * beats it. This screen has no legacy period vocabulary of its own (it never
   * had a `?days=` or `?range=`), so `approximated`/`legacyDays` cannot be set
   * by any link that exists and nothing renders them.
   *
   * `clampPeriod` then coerces server-side, which the control alone cannot do:
   * `?period=day` typed by hand, or `?period=season` at a club with no season
   * row, must not reach a query. Both coerce to this screen's default and the
   * page says which happened rather than quietly rendering something else. */
  const requested = await resolvePeriod(params);
  const season = await fetchCurrentSeason(db, orgId);
  const { key: periodKey, coercedFrom } = clampPeriod(requested.key, {
    allowed: PERIOD_ALLOWED,
    seasonAvailable: season !== null,
    fallback: SCREEN_DEFAULT_RANGE,
  });

  const earliest = periodKey === 'all' ? await fetchMyEarliestRecord(db, athleteId) : null;
  const range = resolveRange(periodKey, today, season?.starts_on ?? null, earliest);
  const from = range.from;
  const dates = dateRange(range.from, range.days);

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
   * CLAUDE.md §5: "do not guess and quietly implement" undocumented product behaviour.
   *
   * Bounded by the resolved period like every other read on this page, INCLUDING on the
   * Testing tab, whose results are not. Deliberate and small: a flag is a dated thing a
   * staff member wrote in a window, not a lifetime record, and "everything ever noted
   * about you" is a different screen. fetchMyVisibleFlags pages, because at `all` an
   * athlete can hold more than PostgREST will return in one go. */
  const visibleFlags = await fetchMyVisibleFlags(db, athleteId, { from, to: today });
  const flagsByDomain = new Map<string, VisibleFlag[]>();
  for (const f of visibleFlags) {
    const list = flagsByDomain.get(f.domain) ?? [];
    list.push(f);
    flagsByDomain.set(f.domain, list);
  }
  const SEGMENT_DOMAINS = new Set(['wellness', 'gym', 'testing', 'training', 'nutrition']);
  const orphanFlags = visibleFlags.filter((f) => !SEGMENT_DOMAINS.has(f.domain));

  /* The chips carry the resolved period. They used to be bare
   * `/my-data?tab=training` hrefs, which DROPPED `?period=`: choosing "This
   * season" and then tapping Gym silently put the athlete back on 28 days. Same
   * class of bug PeriodSelector's own header calls out on the athlete report's
   * hand-built `?days=` href, and the same fix — the link is built from what
   * actually resolved, not from the tab name alone. The resolved key, not the
   * requested one, so a coerced URL does not survive a tab change. */
  const tabHref = (next: Tab) => `/my-data?tab=${next}&${PERIOD_PARAM}=${periodKey}`;

  return (
    <>
      <div className="hd">
        <h1 className="d">My data</h1>
        <span className={`pill status-pill ${outstanding > 0 ? 'pill-warn' : 'pill-good'}`}>
          {outstanding > 0 ? (
            <>
              <span className="num">{outstanding}</span> to do
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
       * distinction, not just a styling one). Leaderboards deliberately does
       * NOT carry the period: a board is a standing ranking, not a window. */}
      <div className="chiprow" role="tablist" aria-label="Data segment" style={{ marginTop: 4 }}>
        <Link href={tabHref('wellness')} className="squad-chip" role="tab" aria-selected={tab === 'wellness'}>
          Wellness
        </Link>
        <Link href={tabHref('training')} className="squad-chip" role="tab" aria-selected={tab === 'training'}>
          Training
        </Link>
        <Link href={tabHref('nutrition')} className="squad-chip" role="tab" aria-selected={tab === 'nutrition'}>
          Nutrition
        </Link>
        <Link href={tabHref('testing')} className="squad-chip" role="tab" aria-selected={tab === 'testing'}>
          Testing
        </Link>
        <Link href={tabHref('gym')} className="squad-chip" role="tab" aria-selected={tab === 'gym'}>
          Gym
        </Link>
        <Link href="/my-data/boards" className="squad-chip">
          Leaderboards
        </Link>
      </div>

      {/* THE CONTROL, and the one tab it does not govern.
       *
       * On Testing the selector is ABSENT rather than rendered-and-inert. This
       * is not the "disabled with the reason, not hidden" rule being broken:
       * that rule is about OPTIONS inside a control that still governs the
       * screen (which is why `day` is disabled above rather than removed). A
       * control every one of whose options would be a lie is a different thing
       * — it would visibly do nothing on that tab — so the row keeps its shape
       * and states the fact instead. Switching tabs preserves the period, so
       * nothing is lost by its absence here. */}
      <div style={{ marginTop: 12 }}>
        {tab === 'testing' ? (
          <p className="tiny" style={{ color: 'var(--muted)', margin: 0 }}>
            Period: all time
          </p>
        ) : (
          <>
            <PeriodSelector
              value={periodKey}
              allowed={PERIOD_ALLOWED}
              reasons={PERIOD_REASONS}
              season={season ? { name: season.name } : null}
              ariaLabel="Period shown"
            />
            <WindowLine range={range} timezone={timezone} />
            {coercedFrom === 'day' ? (
              <p className="cap" style={{ margin: '4px 0 0' }}>
                A single day was asked for. Your usual range needs {ROLLING_DAYS} days to draw, so
                this is showing {range.label.toLowerCase()} instead.
              </p>
            ) : coercedFrom === 'season' ? (
              <p className="cap" style={{ margin: '4px 0 0' }}>
                Your club hasn&rsquo;t set a current season up, so this is showing{' '}
                {range.label.toLowerCase()} instead.
              </p>
            ) : null}
          </>
        )}
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
          range={range}
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
          range={range}
          timezone={timezone}
          flags={flagsByDomain.get('training') ?? []}
        />
      ) : tab === 'nutrition' ? (
        <NutritionTab
          db={db}
          athleteId={athleteId}
          from={from}
          today={today}
          range={range}
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
          range={range}
          timezone={timezone}
          flags={flagsByDomain.get('gym') ?? []}
        />
      )}
    </>
  );
}

/** "Showing the 60 most recent of N" — one sentence, one place, so the four
 *  tables cannot word the same fact differently. Renders nothing when nothing
 *  was cut, which is every window up to two months. */
function ListCapNote({ shown, more, noun }: { shown: number; more: boolean; noun: string }) {
  if (!more) return null;
  return (
    <p className="cap" style={{ marginTop: 8 }}>
      Showing the <b>{shown}</b> most recent {noun} in this window. There are more &mdash; narrow
      the period to see a shorter stretch in full.
    </p>
  );
}

async function WellnessTab({
  db,
  orgId,
  athleteId,
  from,
  today,
  dates,
  range,
  timezone,
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
  dates: string[];
  range: ResolvedRange;
  timezone: string;
  flags: VisibleFlag[];
}) {
  /* NOT PAGED, and provably so rather than by assumption:
   * `wellness_entries_one_live_per_day` (migration 0004) means
   * wellness_entries_current holds at most one row per athlete per day, so the
   * widest window this control can ask for (MAX_WINDOW_DAYS, 730) is at most
   * 730 rows against PostgREST's 1000-row cap. queries/playerProfile.ts states
   * the same proof for the same call and names the condition under which it
   * stops holding: "if that index is ever dropped, fetchWellnessByAthlete must
   * be paged." */
  const entries = await fetchWellnessByAthlete(db, athleteId, { from, to: today });
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));

  /* ADR-005 O-32, and O-28's first clause: "the athlete sees their own chain in full".
   * A coach can now change a number this athlete reported, and until this read existed
   * the athlete was shown nothing — the table above reads `wellness_entries_current`,
   * which by construction cannot show that a value was corrected. A second query rather
   * than a widened first one because the two want opposite things: the chart needs the
   * live series with readiness_score, this needs the superseded rows. Only chains whose
   * live row is itself a revision are kept, so the map is empty on the overwhelming
   * majority of days and costs nothing to consult.
   *
   * This one IS paged, and the difference from the read above is the whole point of the
   * proof: it reads the BASE table, and the one-live-per-day index is partial — it
   * bounds live rows only, so superseded revisions sit outside it and the row count has
   * no ceiling. See fetchWellnessWithRevisions. */
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

  /* The CHART spans the whole window; only the TABLE stops at LIST_LIMIT. That
   * asymmetry is deliberate: a line is legible at 730 points and a table is not,
   * and the coverage footer beneath the chart counts the real window, not the
   * rows rendered. */
  const tableDates = [...dates].reverse();
  const shownDates = tableDates.slice(0, LIST_LIMIT);

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

        {/* Was `{submitted} of {WINDOW_DAYS}` — a coverage line that printed a
          * module constant. It now reports the window that actually resolved,
          * which is the only version of this sentence that can stay true once
          * the window is choosable. */}
        <p className="cap">
          <b>
            {submitted} of {range.days}
          </b>{' '}
          days logged &middot; {formatDate(range.from, timezone)} to{' '}
          {formatDate(range.to, timezone)}
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
              {shownDates.map((date) => {
                const entry = byDate.get(date);
                const corrected = correctedByDate.get(date);
                return (
                  <Fragment key={date}>
                    <tr>
                      <td className="num sub">
                        {formatDate(date, timezone)}
                        {corrected ? (
                          <span className="pill pill-neutral" style={{ marginInlineStart: 6 }}>
                            Corrected
                          </span>
                        ) : null}
                      </td>
                      <td className="r num">
                        {entry ? formatNumber(entry.readiness_score, 0) : 'Missing'}
                      </td>
                      <td className="r num">
                        {entry ? `${dash(entry.sleep_hours)} h` : BLANK}
                      </td>
                      <td className="sub num">
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
                                <li key={rev.id} className="num">
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
        <ListCapNote
          shown={shownDates.length}
          more={tableDates.length > shownDates.length}
          noun="days"
        />
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
  range,
  timezone,
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
  range: ResolvedRange;
  timezone: string;
  flags: VisibleFlag[];
}) {
  /* LIST_LIMIT + 1, so a full page is the signal that there is more rather than
   * a second count query. This call used to pass no limit at all and therefore
   * took fetchAthleteRecentSessions's default of EIGHT — which is why the
   * footer below, which reads "n of m sessions rated in this window", was
   * counting out of 8 while naming a 42-day window. It now counts out of what
   * the window really holds, up to the cap, and says when the cap bit. */
  const fetched = await fetchAthleteRecentSessions(
    db,
    orgId,
    athleteId,
    from,
    today,
    timezone,
    LIST_LIMIT + 1,
  );
  const sessions = fetched.slice(0, LIST_LIMIT);
  const more = fetched.length > LIST_LIMIT;
  const rated = sessions.filter((s) => s.rpe !== null).length;

  /* Same read, same reason, as the wellness table's — see its comment. Keyed by
   * session_id because that is what this table's rows are; an RPE entry always names
   * the session it rates (0046). Paged: training_entries is bounded per SESSION rather
   * than per day, so an athlete training twice a day is several rows a day before any
   * correction is counted. */
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
            body={`You are not named in any session between ${formatDate(
              range.from,
              timezone,
            )} and ${formatDate(range.to, timezone)}.`}
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
                          <td className="num sub">
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
                          <td className="r num">{session.duration_min ?? BLANK}</td>
                          <td className="r num">{formatNumber(session.rpe, 1)}</td>
                          <td className="r num">{formatNumber(session.session_load, 0)}</td>
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
                                    <li key={rev.id} className="num">
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
              <b>{rated}</b> of <b>{sessions.length}</b> sessions rated between{' '}
              {formatDate(range.from, timezone)} and {formatDate(range.to, timezone)}.
            </p>
            <ListCapNote shown={sessions.length} more={more} noun="sessions" />
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
  range,
  timezone,
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  range: ResolvedRange;
  timezone: string;
  flags: VisibleFlag[];
}) {
  /* NOT PAGED, provably: `nutrition_checkins_one_live_per_week` (migration 0004)
   * bounds nutrition_checkins_current to one row per athlete per week, so the
   * widest window this control offers (730 days) is at most ~105 rows. See
   * fetchRecentCheckins's own note. */
  const checkins = await fetchRecentCheckins(db, athleteId, from, today);
  const shown = checkins.slice(0, LIST_LIMIT);

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
            body={`No check-ins between ${formatDate(range.from, timezone)} and ${formatDate(
              range.to,
              timezone,
            )}. Your weekly check-ins appear here once you start answering.`}
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
                {shown.map((c) => (
                  <tr key={c.id}>
                    <td className="num sub">{formatDate(c.week_start, timezone)}</td>
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
        <ListCapNote shown={shown.length} more={checkins.length > shown.length} noun="weeks" />
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
 *  rows; fetchMyTestSummary just shapes it per test, latest result plus PB.
 *
 *  THE ONE TAB THE PERIOD CONTROL DOES NOT DRIVE, and it stays that way.
 *
 *  This was a real inconsistency before the control existed — four tabs on a
 *  fixed 42 days and this one silently all-time, with nothing on screen saying
 *  so — and there were two ways to close it. Bounding it to the window is the
 *  wrong one, and not marginally:
 *
 *   - A PERSONAL BEST IS ALL-TIME OR IT IS NOT A PERSONAL BEST. Bounding
 *     `test_date` would relabel "best you have ever done" as "best in the last
 *     28 days", which for almost every athlete is a LOWER number than the truth.
 *     That is the identical failure fetchMyTestSummary's own header records
 *     being fixed once already — the "phantom PB regression", an athlete with a
 *     41.6 all-time best shown 31.0 because that was their latest session — and
 *     re-introducing it through the front door because the sibling tabs have a
 *     control would be worse than the original bug, which at least was an
 *     accident.
 *   - It is what the spec asks for. my-data.md O-296, "how much history should
 *     an athlete be able to see", answers itself with "full history", and the
 *     role table scopes this tab as "history, personal bests".
 *
 *  So the fix is the label, not the query: the control is replaced on this tab
 *  by the words "Period: all time" (see the page body), and the copy below says
 *  what that covers. The difference is now stated where it is visible rather
 *  than discovered by an athlete wondering why a number did not move.
 *
 *  fetchMyTestSummary is nonetheless PAGED now. It has no window to widen and
 *  never had one, which is exactly what made it unbounded by construction and
 *  the most dangerous read on the page: descending on test_date, a silent 1000
 *  row cut drops the OLDEST results, which is where an athlete's real all-time
 *  best usually lives. */
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
        <p className="cap">
          This tab ignores the period used on the other tabs, on purpose: a personal best is
          the best you have <em>ever</em> done, so showing it inside a window would show you a
          smaller number than the truth. Latest and PB are both all-time. Anything staff have
          noted below is from the last period you chose.
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
 *  yet to correct, same reasoning as revise_gym_session_log's own status gate.
 *
 *  The heaviest read on this page once the window can reach 730 days, and the only one
 *  capped in the DATABASE rather than paged: the set count behind each row is one row
 *  per set logged, tens of thousands over two seasons. See fetchRecentGymSessions's own
 *  header for why a deterministic most-recent-first `.limit()` is the right shape here
 *  and paging is not. */
async function GymTab({
  db,
  athleteId,
  from,
  today,
  range,
  timezone,
  flags,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  range: ResolvedRange;
  timezone: string;
  flags: VisibleFlag[];
}) {
  const fetched = await fetchRecentGymSessions(db, athleteId, from, today, LIST_LIMIT + 1);
  const sessions = fetched.slice(0, LIST_LIMIT);
  const more = fetched.length > LIST_LIMIT;

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
            body={`No completed gym sessions between ${formatDate(
              range.from,
              timezone,
            )} and ${formatDate(range.to, timezone)}.`}
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
                    <td className="num sub">{formatDate(s.entry_date, timezone)}</td>
                    <td className="nm">{s.session_name ?? 'Gym session'}</td>
                    <td className="r num">{s.set_count}</td>
                    <td className="r num">
                      {s.total_volume_kg !== null ? formatNumber(s.total_volume_kg, 0) : BLANK}
                    </td>
                    <td className="r num">{formatNumber(s.session_rpe, 1)}</td>
                    <td className="sub">
                      <Link href={`/my-data/gym/${s.id}`}>Correct</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListCapNote shown={sessions.length} more={more} noun="sessions" />
      </section>
    </div>
  );
}
