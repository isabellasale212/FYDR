import { Fragment } from 'react';
import type React from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { emptyPeriodCopy, type EmptyDomain } from '@/lib/myDataEmpty';
import { fetchMyLatestRecord } from '@/lib/queries/myLatestRecord';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { WellnessChart, type FlagMarker } from '@/components/WellnessChart/WellnessChart';
import { FlagNotice } from '@/components/FlagNotice/FlagNotice';
import { fetchWellnessByAthlete, wellnessSeries } from '@/lib/queries/wellness';
import { fetchAthleteRecentSessions, fetchCurrentSeason } from '@/lib/queries/schedule';
import { fetchRecentCheckins } from '@/lib/queries/nutrition';
import {
  fetchHistory,
  fetchMyTestSummary,
  type HistoryRow,
  type MyTestSummary,
} from '@/lib/queries/testing';
import {
  fetchMyAssignedSessionsByWeek,
  fetchRecentGymSessions,
} from '@/lib/queries/programmes';
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
  rangeLabel,
  resolveRange,
  type RangeKey,
  type ResolvedRange,
} from '@/lib/period';
import { resolvePeriod } from '@/lib/period.server';
import { bandPosition } from '@/lib/stats';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My data · Fydr' };

/* AN ABSENT VALUE IS WORDS in these lists — "Not submitted", "Not logged" —
   in the value column, never a dash and never a zero. ATH-ADULT-12
   (2026-09-12), which also settles what 09 and 10 deferred to it: a dash
   reads as a low value at a glance, and the em dash that stood here (chosen
   over 23e's '·' because the dot rendered as a speck) was still a mark the
   reader had to decode. The words are the statement itself. BLANK ('·') is
   still right inside a dense TABLE, where a row is one line and a dot reads
   as a held space; the Sessions table keeps it until its own rebuild.

   Absent is still absent and still never zero. */

/** The rolling band the readiness chart draws around the line, and the span of
 *  the readiness view now that the period control has gone. */
const ROLLING_DAYS = 14;

/* WELLNESS_WINDOW_DAYS and OTHER_WINDOW_DAYS stood here for one afternoon.
   The redesign removed the period control and fixed the windows at 14 and 28
   days; the control is back (see PERIOD_ALLOWED below) and the windows are
   resolved again, so the two constants went. Kept as a note because the
   reference genuinely draws no dropdown: if it is ever removed a second time,
   14 for readiness and 28 for the rest is what the cards' own captions imply. */

/** How many rows each list shows before "See all". The reference draws four
 *  readiness days and three of everything else. */
const HISTORY_PREVIEW_ROWS = 4;
const LIST_PREVIEW_ROWS = 3;

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

/** The three the redesign reference draws in the bar (screens 03-08).
 *
 *  TABS AND SEGMENTS ARE NOW DIFFERENT LISTS, deliberately. The reference cuts
 *  the bar from six to three, and the changelog says the other three are
 *  "dropped from the tab bar (data still exists in the app, just not surfaced
 *  as separate tabs here)". Deleting the routes would have made that sentence
 *  false: `?tab=nutrition` is where NutritionCheckinForm sends an athlete who
 *  has just answered, and the training tab is the only screen in the app that
 *  shows session and RPE history now that Today's session list has gone.
 *
 *  So TABS stays the route vocabulary and SEGMENTS is only what the bar draws.
 *  Both dropped tabs are reached from the footer card at the bottom of this
 *  page (`md-more`), which is also the only remaining route to /my-data/boards. */
/* FIVE since 2026-09-12 (ATH-ADULT-12 D1, reversed by Isabella): Sessions and
   Nutrition stop being rows on a footer card and become tabs of their own,
   so the one control that claims to enumerate My data enumerates it. The
   objection that drove the 8 September footer card — three destinations
   orphaned — is answered by giving two of them their tab back; Leaderboards
   keeps its footer row, being a separate screen rather than a view of this
   one. The labels sit at --fs-11 so five fit 343px, and the track wraps to
   two rows at larger text rather than scrolling or clipping (B3, C9). */
const SEGMENTS = ['wellness', 'gym', 'training', 'nutrition', 'testing'] as const;

const SEGMENT_LABELS: Record<(typeof SEGMENTS)[number], string> = {
  wellness: 'Wellness',
  gym: 'Gym',
  /* "Sessions", the board's word: what you trained and how hard it felt. The
     route key stays `training` — a URL an athlete has already been sent must
     keep working. */
  training: 'Sessions',
  nutrition: 'Nutrition',
  /* "Tests", per 23m, not "Testing". The route key stays `testing`, and this
     is the label CLAUDE.md §6 defines. */
  testing: 'Tests',
};

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
/** The empty period — ATH-ADULT-12 C6 (2026-09-12), to PATTERN-S6's grammar.
 *  Reads the athlete's latest entry in the domain, any period, so the copy can
 *  say when it was and that it is still on record; offers the one action that
 *  widens the window (a Link that changes the period — never automatic); or,
 *  with nothing on record at all, says so with no action. */
async function EmptyPeriod({
  db,
  athleteId,
  domain,
  tab,
  periodKey,
  seasonStart,
  today,
  timezone,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  domain: EmptyDomain;
  tab: Tab;
  periodKey: RangeKey;
  seasonStart: string | null;
  today: string;
  timezone: string;
}) {
  const latest = await fetchMyLatestRecord(db, athleteId, domain);
  const copy = emptyPeriodCopy({
    domain,
    periodKey,
    rangeLabel: rangeLabel(periodKey),
    latest,
    latestLabel: latest ? formatDate(latest, timezone) : null,
    seasonStart,
    today,
  });
  return (
    <div className="empty-period">
      <h3 className="empty-period-title">{copy.title}</h3>
      <p className="empty-period-body">{copy.body}</p>
      {copy.action ? (
        <Link href={`/my-data?tab=${tab}&${PERIOD_PARAM}=${copy.action.period}`} className="btn-ghost empty-period-action">
          {copy.action.label}
        </Link>
      ) : null}
    </div>
  );
}

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
 * THE PERIOD, and this paragraph has now been rewritten twice in opposite
 * directions, so both turns are recorded rather than only the latest.
 *
 * It first said "Fixed 42-day window, no custom period picker" — a Phase 1a cut
 * on a two-tab screen. That was replaced when a real PeriodSelector was built
 * here: `docs/20-route-map.md` §4.7 lists one in this screen's panel table and
 * my-data.md specifies one in four places.
 *
 * THE 2026-09-08 REDESIGN REMOVES IT AGAIN. The reference draws no dropdown and
 * no date-range caption; each card states its own span instead. So the windows
 * are fixed constants once more (WELLNESS_WINDOW_DAYS, OTHER_WINDOW_DAYS) and
 * the specification now disagrees with the screen on this point — recorded in
 * docs/athlete/screens/06-my-data.md rather than left for someone to rediscover.
 * This was the only period control on the athlete surface.
 *
 * The Testing tab was already all-time and is unchanged — see TestingTab's own
 * comment for why that is a correctness argument about personal bests rather
 * than an omission.
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

  /* `?all=1` expands whichever list the open tab shows, on the same route.
     The reference draws a "See all N ->" link under every list; there is no
     "all readiness days" page and no "all sessions" page to send it to, and
     the Testing tab's own footer already refused to draw a link to a page that
     does not exist. Expanding in place is that link, built. */
  const showAll = params.all === '1';

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

  /* The outstanding count and the two queries feeding it went with the header
     pill: they existed only to render it, and nothing else on this screen asks
     what is still to do. Two fewer round trips on every load. */

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
  /* NARROWED WITH THE TAB BAR, and this is the part of dropping two tabs that
     could have gone wrong silently. A domain listed here has its flags routed
     INTO that tab; anything else falls through to the "Also noted for you"
     notice above the tab content. Leave `training` and `nutrition` in the set
     and their flags are delivered to two tabs that are no longer in the bar —
     a flag raised about an athlete, addressed to them, that they would never
     be shown. Out of the set, they surface on whichever tab is open. */
  const SEGMENT_DOMAINS = new Set(SEGMENTS as readonly string[]);
  const orphanFlags = visibleFlags.filter((f) => !SEGMENT_DOMAINS.has(f.domain));

  /* CARRYING THE PERIOD AGAIN. The chips must, or choosing "This season" and
     then tapping Gym silently puts the athlete back on 28 days — the bug this
     href was built to fix the first time. The resolved key, not the requested
     one, so a coerced URL does not survive a tab change. `?all=` is still not
     carried: expanding one list should not expand the next tab's. */
  const tabHref = (next: Tab) => `/my-data?tab=${next}&${PERIOD_PARAM}=${periodKey}`;

  return (
    <>
      <div className="hd">
        {/* Just the title, per Fydr Athlete App.dc.html 23e. The outstanding
            count lives on Today, beside the list it counts; repeating it on a
            history screen is a number with nothing to do here. */}
        <h1 className="d">My data</h1>
      </div>

      {/* A SEGMENTED PILL TRACK, three segments, per screens 03-08. It was six
          chips on a horizontally scrolling track — the old reference drew three
          and this build had six real ones, so the track scrolled rather than
          delete the only route to Training, Nutrition and Leaderboards.

          The new reference settles that differently: three segments, and the
          other three reached from the footer card at the bottom of this page.
          Nothing scrolls now, so the track can be what the changelog describes —
          a --surf2 band with 4px of padding and the live segment as a solid
          accent-filled pill.

          RENAMED from .seg/.seg-track to .md-seg/.md-seg-track. The classes are
          exempt from the "no pill-shaped buttons" rule by NAME
          (ATHLETE_PILL_EXEMPT), and that check matches by substring: `seg`
          would have matched .theme-seg, .lbw-segmented, .sg-segment and
          .dash-stat-bar-seg too, handing three staff controls a pill nobody
          asked for. `md-seg` matches these two rules and nothing else. */}
      <div className="md-seg-track" role="tablist" aria-label="Data segment">
        {SEGMENTS.map((key) => (
          <Link
            key={key}
            href={tabHref(key)}
            className="md-seg"
            role="tab"
            aria-selected={tab === key}
          >
            {SEGMENT_LABELS[key]}
          </Link>
        ))}
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
      <div>
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
          periodKey={periodKey}
          seasonStart={season?.starts_on ?? null}
          showAll={showAll}
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
          periodKey={periodKey}
          seasonStart={season?.starts_on ?? null}
        />
      ) : tab === 'nutrition' ? (
        <NutritionTab
          db={db}
          athleteId={athleteId}
          from={from}
          today={today}
          timezone={timezone}
          flags={flagsByDomain.get('nutrition') ?? []}
          periodKey={periodKey}
          seasonStart={season?.starts_on ?? null}
        />
      ) : tab === 'testing' ? (
        <TestingTab
          db={db}
          orgId={orgId}
          athleteId={athleteId}
          flags={flagsByDomain.get('testing') ?? []}
          timezone={timezone}
          periodKey={periodKey}
          showAll={showAll}
        />
      ) : (
        <GymTab
          db={db}
          athleteId={athleteId}
          from={from}
          today={today}
          timezone={timezone}
          flags={flagsByDomain.get('gym') ?? []}
          periodKey={periodKey}
          seasonStart={season?.starts_on ?? null}
          showAll={showAll}
        />
      )}

      {/* THE THREE DESTINATIONS THE REFERENCE'S TAB BAR NO LONGER REACHES.
       *
       *  This card is the one thing on this screen the reference does not draw,
       *  and it is here because the changelog's own sentence about the three
       *  dropped tabs — "data still exists in the app, just not surfaced as
       *  separate tabs here" — is not true without it:
       *
       *    - /my-data/boards had exactly ONE route in from anywhere in the
       *      athlete app, the Leaderboards segment. LeaveLeaderboardButton's
       *      router.push is a redirect after leaving a board, not a way to
       *      reach one. Without this row both board routes are orphaned,
       *      including the GPS tier gate added on 2026-09-08.
       *    - The weekly nutrition check-in history has one reader in the whole
       *      athlete app, the tab below. NutritionCheckinForm also redirects to
       *      ?tab=nutrition after a successful answer.
       *    - The training tab is the only screen showing session and RPE
       *      history, now that Today's session list has gone.
       *
       *  Deliberately at the bottom, in the row idiom the redesign established
       *  on Me, so it reads as a way out rather than a fourth tab. Delete the
       *  card and the three destinations go with it — that is the decision, not
       *  a side effect. */}
      <div className="card flush md-more">
        {/* Leaderboards alone since 2026-09-12: Sessions and Weekly check-ins
            are tabs again (D1). This row stays the only route in to
            /my-data/boards. */}
        <Link href="/my-data/boards" className="me-row">
          <span className="k">
            Leaderboards
            <span className="s">the boards you appear on</span>
          </span>
          <span className="chev" aria-hidden="true">
            &rsaquo;
          </span>
        </Link>
      </div>
    </>
  );
}

/** "Showing the 60 most recent of N" — one sentence, one place, so the four
 *  tables cannot word the same fact differently. Renders nothing when nothing
 *  was cut, which is every window up to two months. */
/** REWORDED WITH THE PERIOD CONTROL'S REMOVAL. This used to end "narrow the
 *  period to see a shorter stretch in full", which sent an athlete looking for
 *  a dropdown that is no longer on the screen. It now says what is true: the
 *  window is fixed, and this is what fits in it. */
function ListCapNote({ shown, more, noun }: { shown: number; more: boolean; noun: string }) {
  if (!more) return null;
  return (
    <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
      Showing the <b>{shown}</b> most recent {noun}. There are more than this window holds.
    </p>
  );
}

/** The reference's "See all 14 days ->" / "See all sessions ->" / "See all 7
 *  tests ->" footer link, on every one of the three tabs.
 *
 *  IT EXPANDS THE LIST IN PLACE rather than opening a page. There is no "all
 *  readiness days" screen, no "all sessions" screen and no "all tests" screen,
 *  and the Testing tab's own footer already refused to draw this link for
 *  exactly that reason — "a link to a page that does not exist is a worse
 *  footer than no link". `?all=1` on the same route is that link built: the
 *  server renders the full list, the URL is shareable and bookmarkable, and
 *  nothing had to be invented to receive it.
 *
 *  Absent once expanded, rather than turned into a "Show less". The full list
 *  IS the older behaviour of this screen; getting back is the tab itself. */
function SeeAllLink({
  tab,
  periodKey,
  shown,
  total,
  noun,
}: {
  tab: Tab;
  /* CARRIED, for the same reason the tab chips carry it: without it, expanding
     a list silently re-resolves the period from the sticky cookie, so an
     athlete on "This season" who taps "See all" lands back on 28 days and the
     list they asked to see in full is a different list. */
  periodKey: RangeKey;
  shown: number;
  total: number;
  noun: string;
}) {
  if (total <= shown) return null;
  return (
    <p className="hist-more">
      <Link href={`/my-data?tab=${tab}&${PERIOD_PARAM}=${periodKey}&all=1`}>
        See all {total} {noun} &rarr;
      </Link>
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
  showAll,
  periodKey,
  seasonStart,
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
  showAll: boolean;
  periodKey: RangeKey;
  seasonStart: string | null;
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

  /* The design's header numbers. All three are read off the series that
     already drives the chart, so the headline and the picture cannot
     disagree.
     The delta compares the latest logged day with the nearest logged day at
     least seven days before it — not "the value seven days ago", which is
     null on any day the athlete missed, and not a week-to-week mean, which
     would say something different from what the label claims. When there is
     no such earlier day the delta is omitted rather than shown as zero. */
  const logged = series.filter((s) => s.value !== null);
  const latest = logged.length > 0 ? logged[logged.length - 1]! : null;
  const latestReadiness = latest ? Math.round(latest.value!) : null;
  const latestMean = latest && latest.mean !== null ? Math.round(latest.mean) : null;
  const latestDate = latest ? latest.date : null;
  const priorWeek =
    latest === null
      ? null
      : [...logged].reverse().find((p) => p.date <= addDays(latest.date, -7)) ?? null;
  const readinessDelta =
    latest !== null && priorWeek !== null ? Math.round(latest.value!) - Math.round(priorWeek.value!) : null;
  const outside = series.filter((s) => {
    const p = bandPosition(s);
    return p === 'above' || p === 'below';
  }).length;

  /* The CHART spans the whole window; only the TABLE stops at LIST_LIMIT. That
   * asymmetry is deliberate: a line is legible at 730 points and a table is not,
   * and the coverage footer beneath the chart counts the real window, not the
   * rows rendered. */
  const tableDates = [...dates].reverse();
  /* Four rows, per the reference, unless ?all=1. LIST_LIMIT is still the hard
     ceiling on the expanded list — the preview is a display choice, the limit
     is a query-size one. */
  const shownDates = tableDates.slice(0, showAll ? LIST_LIMIT : HISTORY_PREVIEW_ROWS);

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
    <div className="stack">
      <section className="card" aria-labelledby="wellness-title">
        {/* Fydr Athlete App.dc.html 23e leads with the VALUE, not with an
            explanation of it: the score, how it moved, and the mean it moved
            against. The paragraph that used to sit here described the shaded
            band; the band is still drawn and still means the same thing, and
            the footer below already states the one fact that changes how the
            chart is read — that missed days are blank, never zero. */}
        <h2 className="eyebrow" id="wellness-title">
          Readiness
        </h2>
        <div className="rd-head">
          <p className="rd-value num">{latestReadiness !== null ? latestReadiness : BLANK}</p>
          <div className="rd-meta">
            {/* A delta states the change and never judges it (D3, 2026-09-12):
                one arrow, the figure in bold, what it is measured against.
                No colour ranks the direction. */}
            {readinessDelta !== null ? (
              <p className="rd-delta num">
                {readinessDelta >= 0 ? '↑' : '↓'} <b>{Math.abs(readinessDelta)}</b> on last week
              </p>
            ) : null}
            {/* "your 14-day mean 62", exactly as drawn. The trailing "· to
                4 Aug" went with the period control: it dated the window when
                the window was choosable, and beside a fixed 14-day span it is
                a date with nothing to distinguish. `latestDate` is still part
                of the condition — a mean with no date behind it is a mean of
                nothing — it is just no longer printed. */}
            {latestMean !== null && latestDate ? (
              <p className="rd-mean">
                your {ROLLING_DAYS}-day mean <span className="num">{latestMean}</span>
              </p>
            ) : null}
          </div>
        </div>

        {submitted === 0 ? (
          <EmptyPeriod db={db} athleteId={athleteId} domain="wellness" tab="wellness" periodKey={periodKey} seasonStart={seasonStart} today={today} timezone={timezone} />
        ) : (
          /* compact, per 23e — and because the labels were unreadable here.
             This SVG's 880-unit viewBox renders 320px wide inside the card, a
             scale of 0.364, which painted every fontSize={10} label at 3.6px.
             The staff pages that use this chart render it wide enough for the
             axis and keep it. */
          <WellnessChart
            series={series}
            min={0}
            max={100}
            ticks={[0, 25, 50, 75, 100]}
            title="Your readiness"
            timezone={timezone}
            flags={flagMarkers}
            compact
            area
            accentOnly
          />
        )}

        <FlagNotice flags={flags} timezone={timezone} />

        {/* TRIMMED, NOT DELETED. The reference draws no caption under the
          * readiness chart, and most of this one was period-control residue:
          * the coverage count is now the History card's own "n = 2 of 14 days"
          * on the right of its heading, and the date range dated a window that
          * was choosable and no longer is.
          *
          * The last sentence stays. "Days you missed are left blank, never
          * counted as zero" is not decoration — it is MET-001's defining
          * property, and a reader who assumes a gap is a nought misreads every
          * dip in the line. The "outside your usual range" count stays with it
          * for the same reason: it explains marks that are on the chart. */}
        <p className="cap">
          Days you missed are left blank, never counted as zero.
          {outside > 0 ? (
            <>
              {' '}
              <span className="num">{outside}</span> sit outside your usual range.
            </>
          ) : null}
        </p>
      </section>

      <section
        className="card flush"
        aria-labelledby="wellness-entries-title"
        /* Spec §7.3 fixed the value column at 54px on wellness so the
           column's left edge does not move when an absent day replaces a
           score. 92px since ATH-ADULT-12 — the tests column's width — because
           the absent day is now the words "Not submitted" (~88px at 13px/600)
           and the track must hold them on one line. Still fixed, for the same
           reason. */
        style={{ '--hist-val-w': '92px' } as React.CSSProperties}
      >
        {/* Fydr Athlete App.dc.html 23e: a row list, not a four-column table.
            At 390px the table was rendering "Missing" and two columns of dots
            squeezed against each other; the design puts the date and what was
            logged on the left and the score on the right, which is the shape a
            phone can actually hold. The correction disclosure below each row is
            unchanged — it is the reason this list is not just a map(). */}
        <div className="hist-head">
          <h2 className="card-title" id="wellness-entries-title">
            History
          </h2>
          <span className="hist-n num">
            n = {submitted} of {range.days} days
          </span>
        </div>
        {shownDates.map((date) => {
          const entry = byDate.get(date);
          const corrected = correctedByDate.get(date);
          return (
            <Fragment key={date}>
              <div className="hair" />
              <div className="hist-row">
                <div style={{ minWidth: 0 }}>
                  <p className="hist-date">
                    {formatDate(date, timezone)}
                    {corrected ? (
                      <span className="pill pill-neutral" style={{ marginInlineStart: 6 }}>
                        Corrected
                      </span>
                    ) : null}
                  </p>
                  {/* Never a row of zeros — the same rule the chart footer
                      states. Sleep and soreness because those are the two the
                      design shows, and the two an athlete recognises as the
                      reason a score moved. An absent day says what is absent
                      here and "Not submitted" in the value column, the
                      board's row. */}
                  <p className="hist-detail num">
                    {entry
                      ? `sleep ${dash(entry.sleep_hours)} h · soreness ${dash(entry.soreness)}`
                      : 'No morning check-in'}
                  </p>
                </div>
                <p className="hist-value num" data-missing={entry ? undefined : ''}>
                  {entry ? formatNumber(entry.readiness_score, 0) : 'Not submitted'}
                </p>
              </div>
              {corrected ? (
                /* Shown open, not behind a disclosure. The coach's version of this
                 * is expandable because a coach scans thirty athletes and wants the
                 * current number by default; this is one person's own record, a
                 * correction is rare, and the fact someone changed their answer is
                 * not something to make them go looking for. */
                <div className="hist-corrected">
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
                </div>
              ) : null}
            </Fragment>
          );
        })}
        <SeeAllLink
          tab="wellness"
          periodKey={periodKey}
          shown={shownDates.length}
          total={tableDates.length}
          noun="days"
        />
        {showAll ? (
          <ListCapNote
            shown={shownDates.length}
            more={tableDates.length > shownDates.length}
            noun="days"
          />
        ) : null}
        {/* The Actions column that used to hold a per-row "Correct" link is gone
          * with the athlete's correction path (migration 0058, and the note at
          * the top of CheckInForm.tsx). The whole column went rather than the
          * links inside it: a column of blanks headed "Actions" reads as broken.
          * One sentence carries what the links used to promise — and the
          * "Corrected" rows above are what make the second half of it true
          * rather than a promise (ADR-005 O-32). */}
        <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
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
  periodKey,
  seasonStart,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  from: string;
  today: string;
  range: ResolvedRange;
  timezone: string;
  flags: VisibleFlag[];
  periodKey: RangeKey;
  seasonStart: string | null;
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
    <div className="stack">
      <section className="card" aria-labelledby="training-title">
        <h2 className="card-title" id="training-title">
          Sessions
        </h2>
        <p className="import-sub">
          A blank RPE means no rating was submitted, which is not the same as an
          easy session.
        </p>

        <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />

        {sessions.length === 0 ? (
          <EmptyPeriod db={db} athleteId={athleteId} domain="training" tab="training" periodKey={periodKey} seasonStart={seasonStart} today={today} timezone={timezone} />
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
  timezone,
  flags,
  periodKey,
  seasonStart,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
  flags: VisibleFlag[];
  periodKey: RangeKey;
  seasonStart: string | null;
}) {
  /* NOT PAGED, provably: `nutrition_checkins_one_live_per_week` (migration 0004)
   * bounds nutrition_checkins_current to one row per athlete per week, so the
   * widest window this control offers (730 days) is at most ~105 rows. See
   * fetchRecentCheckins's own note. */
  const checkins = await fetchRecentCheckins(db, athleteId, from, today);
  const shown = checkins.slice(0, LIST_LIMIT);

  return (
    <div className="stack">
      <section className="card" aria-labelledby="nutrition-title">
        <h2 className="card-title" id="nutrition-title">
          Weekly check-in
        </h2>
        <p className="import-sub">
          No score, no streak, no comparison to anyone else.
        </p>

        <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />

        {checkins.length === 0 ? (
          <EmptyPeriod db={db} athleteId={athleteId} domain="nutrition" tab="nutrition" periodKey={periodKey} seasonStart={seasonStart} today={today} timezone={timezone} />
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
                    <td className="nm">
                      {ANSWER_LABEL[c.answer] ?? c.answer}
                      {/* ATH-ADULT-08 C1 (2026-09-12): the one correction, marked
                          the way every other corrected entry here is — the
                          neutral pill and what it was. */}
                      {c.prior ? (
                        <>
                          <span className="pill pill-neutral" style={{ marginInlineStart: 8, verticalAlign: 'middle' }}>
                            Corrected
                          </span>
                          <span className="sub" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
                            was {ANSWER_LABEL[c.prior.answer] ?? c.prior.answer}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td className="sub">
                      {/* A corrected week offers no second correction: 0107
                          refuses it, and the check-in page shows the spent
                          state, so the link would only lead to a refusal. */}
                      {c.prior ? null : (
                        <Link href={`/nutrition-check-in?week=${c.week_start}&correct=1`}>
                          Correct
                        </Link>
                      )}
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
          <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
            This one you can still change yourself, once &mdash; only you know the
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
/** Fydr Athlete App.dc.html 23k/23m share one shape with 23e's readiness card:
 *  an eyebrow, the number at display size, what it stands against on the right,
 *  then the chart. These two helpers are what the Gym and Tests tabs need that
 *  Wellness did not.
 *
 *  Monday-anchored, in UTC, off the date STRING rather than a local Date — the
 *  athlete's `today` already arrives resolved in the org's timezone, and
 *  re-reading it through the server's local clock is how a week boundary ends
 *  up one day out for half the year. */
function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  return addDays(iso, -((dow + 6) % 7));
}

/** "14 Jul". formatDate leads with the weekday, which is right for a single
 *  date and wrong under a bar four columns wide — "w/c Mon 14 Jul" says Monday
 *  twice, and at 11px on a 78px column it is the part that gets ellipsed. */
function dayMonth(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Tonnes once there are tonnes to speak of, kilograms below that.
 *  A 360 kg session shown as "0.4 t" has lost a digit of real precision to
 *  keep a unit consistent; the unit is the cheaper thing to vary, and every
 *  row states its own. Null is "Not logged", never 0 — a session logged
 *  without loads is not a session with no load in it. */
function volumeLabel(kg: number | null): string {
  if (kg === null) return 'Not logged';
  return kg >= 1000 ? `${formatNumber(kg / 1000, 1)} t` : `${formatNumber(kg, 0)} kg`;
}

/** A value with its unit. Space before everything except a percentage, which
 *  is the one unit English sets tight. */
function withUnit(value: string, unit: string): string {
  const u = unit.trim();
  return u === '%' ? `${value}%` : `${value} ${u}`;
}

/** Where the latest result stands against the all-time best.
 *
 *  Direction-aware, because half these tests are won by the smaller number: on
 *  a 10 m sprint a LARGER latest value is the worse one, and a comparison that
 *  assumes higher-is-better prints a slower time as an improvement. Same
 *  argument fetchMyTestSummary's header makes for carrying `higher_is_better`
 *  through in the first place.
 *
 *  'ahead' is reachable and is not a contradiction: pbValue is picked from
 *  `is_best` rows only, so a session whose best attempt was never flagged can
 *  leave the latest result genuinely better than the recorded PB. Saying
 *  "ahead of your recorded PB" is the honest reading — the record is what is
 *  behind, not the athlete. */
type PbStanding =
  | { kind: 'none' }
  | { kind: 'at' }
  | { kind: 'off'; amount: number }
  | { kind: 'ahead'; amount: number };

function pbStanding(s: MyTestSummary): PbStanding {
  if (s.latestValue === null || s.pbValue === null) return { kind: 'none' };
  if (s.latestValue === s.pbValue) return { kind: 'at' };
  const better = s.higher_is_better ? s.latestValue > s.pbValue : s.latestValue < s.pbValue;
  const amount = Math.abs(s.latestValue - s.pbValue);
  return better ? { kind: 'ahead', amount } : { kind: 'off', amount };
}

/** One point per test date, best attempt on that date, oldest first, most
 *  recent 8. Per-side tests log two `is_best` rows a date (left and right);
 *  taking whichever arrived first would draw a line that switches limbs
 *  mid-chart, so the better of the two wins by the test's own direction. */
function sparkPoints(rows: HistoryRow[], higherIsBetter: boolean): { date: string; value: number }[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!r.is_best) continue;
    const cur = byDate.get(r.test_date);
    if (cur === undefined || (higherIsBetter ? r.value > cur : r.value < cur)) {
      byDate.set(r.test_date, r.value);
    }
  }
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-8);
}

/** 23m's sparkline: BETTER IS UP, whichever direction the test runs in.
 *
 *  That is an editorial choice and the caption underneath states it, because
 *  the chart cannot. Plotting a sprint time on a raw axis draws improvement as
 *  a fall, which reads as decline to everyone who has ever seen a chart; the
 *  design's own caption ("Faster draws upward") is the design making the same
 *  call.
 *
 *  Uniform scaling — no preserveAspectRatio="none" — so the points stay round
 *  circles at every width instead of stretching into ellipses. */
function TestSparkline({
  points,
  higherIsBetter,
  pbValue,
  label,
}: {
  points: { date: string; value: number }[];
  higherIsBetter: boolean;
  pbValue: number | null;
  label: string;
}) {
  const W = 320;
  const H = 56;
  const PAD = 7;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1));
  const y = (v: number) => {
    if (span === 0) return H / 2;
    const t = (v - min) / span;
    const good = higherIsBetter ? t : 1 - t; // 1 = the best point in the series
    return PAD + (1 - good) * (H - PAD * 2);
  };

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const lastIdx = points.length - 1;
  const pbIdx = pbValue === null ? -1 : points.findIndex((p) => p.value === pbValue);
  const pbIsLatest = pbIdx === lastIdx;
  const lastPoint = points[lastIdx];
  const pbPoint = pbIdx >= 0 ? points[pbIdx] : undefined;
  if (!lastPoint) return null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block', marginTop: 'var(--sp-12)' }}
      role="img"
      aria-label={label}
    >
      <path d={d} fill="none" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pbPoint && !pbIsLatest ? (
        <circle cx={x(pbIdx)} cy={y(pbPoint.value)} r="4.5" fill="var(--accent-text)" />
      ) : null}
      {/* When the latest result IS the PB the two markers coincide, so the
          point is drawn once — gold, ringed in the PB's blue — rather than one
          hidden under the other. */}
      <circle
        cx={x(lastIdx)}
        cy={y(lastPoint.value)}
        r="4.5"
        fill="var(--warn-text)"
        stroke={pbIsLatest ? 'var(--accent-text)' : 'none'}
        strokeWidth={pbIsLatest ? 2 : 0}
      />
    </svg>
  );
}

async function TestingTab({
  db,
  orgId,
  athleteId,
  flags,
  timezone,
  showAll,
  periodKey,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  orgId: string;
  athleteId: string;
  flags: VisibleFlag[];
  timezone: string;
  showAll: boolean;
  periodKey: RangeKey;
}) {
  const summary = await fetchMyTestSummary(db, athleteId);
  /* Three rows, per the reference, unless ?all=1. The list is all-time and
     unwindowed, so this is the only thing standing between an athlete with
     twenty test definitions and a twenty-row card. */
  const shownTests = showAll ? summary : summary.slice(0, LIST_PREVIEW_ROWS);

  /* The headline test is the one most recently done, ties broken by name so
     the card does not reshuffle between two same-day tests on every render. */
  const featured =
    [...summary]
      .filter((s) => s.latestValue !== null && s.latestDate !== null)
      .sort((a, b) =>
        a.latestDate! < b.latestDate! ? 1 : a.latestDate! > b.latestDate! ? -1 : a.name.localeCompare(b.name),
      )[0] ?? null;

  const history = featured ? await fetchHistory(db, orgId, athleteId, featured.test_definition_id) : [];
  const spark = featured ? sparkPoints(history, featured.higher_is_better) : [];
  const standing = featured ? pbStanding(featured) : ({ kind: 'none' } as PbStanding);
  const upward = featured && !featured.higher_is_better && featured.unit.trim() === 's' ? 'Faster' : 'Better';

  const sparkFirst = spark[0];
  const sparkLast = spark[spark.length - 1];
  const sparkLabel =
    featured && sparkFirst && sparkLast
      ? `${featured.name}, ${spark.length} results from ${formatDate(sparkFirst.date, timezone)} to ${formatDate(
          sparkLast.date,
          timezone,
        )}: ${spark.map((p) => withUnit(p.value.toFixed(featured.decimal_places), featured.unit)).join(', ')}`
      : '';

  return (
    <div className="stack">
      {featured ? (
        <section className="card" aria-labelledby="test-headline">
          <h2 className="eyebrow" id="test-headline">
            {featured.name}
          </h2>
          <div className="rd-head">
            <p className="rd-value">
              <span className="num">{featured.latestValue!.toFixed(featured.decimal_places)}</span>{' '}
              <span className="rd-unit">{featured.unit.trim()}</span>
            </p>
            <div className="rd-meta">
              {standing.kind === 'off' ? (
                <p className="rd-delta num">
                  ↓ <b>{withUnit(standing.amount.toFixed(featured.decimal_places), featured.unit)}</b> off your PB
                </p>
              ) : standing.kind === 'ahead' ? (
                <p className="rd-delta num">
                  ↑ <b>{withUnit(standing.amount.toFixed(featured.decimal_places), featured.unit)}</b> ahead of your recorded PB
                </p>
              ) : standing.kind === 'at' ? (
                <p className="rd-delta">
                  At your personal best
                </p>
              ) : null}
              {featured.pbValue !== null ? (
                <p className="rd-mean">
                  PB <span className="num">{withUnit(featured.pbValue.toFixed(featured.decimal_places), featured.unit)}</span>
                  {featured.pbDate ? <> &middot; {formatDate(featured.pbDate, timezone)}</> : null}
                </p>
              ) : null}
            </div>
          </div>

          {spark.length >= 2 ? (
            <>
              <TestSparkline
                points={spark}
                higherIsBetter={featured.higher_is_better}
                pbValue={featured.pbValue}
                label={sparkLabel}
              />
              <p className="spark-cap">
                {upward} draws upward.{' '}
                {standing.kind === 'at'
                  ? 'The gold point is your latest, and it is your PB.'
                  : 'The gold point is your latest, the blue your PB.'}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      <section
        className="card flush"
        aria-labelledby="testing-title"
        /* Spec §7.3: 92px — it holds a value over a standing line
           ("0.10 s off PB"), which is the widest of the three. */
        style={{ '--hist-val-w': '92px' } as React.CSSProperties}
      >
        <div className="hist-head">
          <h2 className="card-title" id="testing-title">
            Your tests
          </h2>
          <span className="hist-n">latest against your PB</span>
        </div>
        <div style={{ padding: '0 var(--pad-card-x)' }}>
          <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />
        </div>

        {summary.length === 0 ? (
          <div style={{ padding: '0 var(--pad-card-x) var(--pad-card-y)' }}>
            <EmptyState
              headingLevel={3}
              title="No results yet"
              body="Nothing has been logged for you yet. Results are entered by your coach or physio at a testing session."
            />
          </div>
        ) : (
          shownTests.map((s) => {
            const st = pbStanding(s);
            return (
              <Fragment key={s.test_definition_id}>
                <div className="hair" />
                <div className="hist-row">
                  <div style={{ minWidth: 0 }}>
                    <p className="hist-name" title={TEST_NAME_EXPLAINER[s.name.toLowerCase()]}>
                      {s.name}
                    </p>
                    {/* No date line when there is no result: the value column
                        says "Not logged", and a second line saying the same
                        thing is the redundancy ATH-ADULT-12's rows drop. */}
                    {s.latestDate ? (
                      <p className="hist-date">{formatDate(s.latestDate, timezone)}</p>
                    ) : null}
                  </div>
                  <div className="hist-right">
                    <p className="hist-value num" data-missing={s.latestValue === null ? '' : undefined}>
                      {s.latestValue !== null
                        ? withUnit(s.latestValue.toFixed(s.decimal_places), s.unit)
                        : 'Not logged'}
                    </p>
                    {st.kind === 'off' ? (
                      <p className="hist-delta num">
                        {withUnit(st.amount.toFixed(s.decimal_places), s.unit)} off PB
                      </p>
                    ) : st.kind === 'at' ? (
                      <p className="hist-delta" data-at-pb="">
                        at PB
                      </p>
                    ) : st.kind === 'ahead' ? (
                      <p className="hist-delta num" data-ahead="">
                        {withUnit(st.amount.toFixed(s.decimal_places), s.unit)} ahead of PB
                      </p>
                    ) : null}
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
        {/* Spec §7.3's footer row. 23m's link reads "See all 7 tests →" because
            that card shows three of seven; this list shows all of them, so the
            row carries the one fact the numbers above need instead. A link to a
            page that does not exist is a worse footer than no link. */}
        <div className="hist-foot">
          <p className="cap" style={{ margin: 0 }}>
            All-time, not the window on the other tabs: a personal best measured inside a window
            is not a personal best. Your own results only &mdash; never a squad comparison.
          </p>
          {/* The "See all 7 tests →" link the reference draws is built now. It
              was refused before because the list already showed every test and
              there is no all-tests page to open; the list shows three now, and
              the link expands it here rather than opening a page that still
              does not exist. */}
          <SeeAllLink tab="testing" periodKey={periodKey} shown={shownTests.length} total={summary.length} noun="tests" />
        </div>
      </section>
    </div>
  );
}

/** The headline card's span, Fydr Athlete App.dc.html 23k ("last 4 weeks").
 *
 *  FIXED, and deliberately not the period control's window. Four calendar weeks
 *  is what the four bars ARE — at `all` the same chart would be 105 bars three
 *  pixels wide, and at `week` it would be one. The card says "last 4 weeks" on
 *  its face so the two spans on this screen cannot be confused, and the list
 *  below still honours whatever period was chosen. The Testing tab already sets
 *  this precedent for the same kind of reason (see its own note on all-time
 *  PBs); the difference here is that the span is stated in the card. */
const GYM_HEADLINE_WEEKS = 4;

/** Enough headroom that the four-week count is a count, not a cap.
 *  fetchRecentGymSessions truncates most-recent-first at its limit, so a
 *  number below the real total would read low and silently. Four weeks of
 *  twice-daily gym is 56; 200 is well past anything a human body does. */
const GYM_HEADLINE_CAP = 200;

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
  timezone,
  flags,
  showAll,
  periodKey,
  seasonStart,
}: {
  db: Awaited<ReturnType<typeof requireAthlete>>['db'];
  athleteId: string;
  from: string;
  today: string;
  timezone: string;
  flags: VisibleFlag[];
  showAll: boolean;
  periodKey: RangeKey;
  seasonStart: string | null;
}) {
  const weekStarts = Array.from({ length: GYM_HEADLINE_WEEKS }, (_, i) =>
    addDays(mondayOf(today), -7 * (GYM_HEADLINE_WEEKS - 1 - i)),
  );

  const headlineFrom = weekStarts[0] ?? mondayOf(today);

  const [fetched, recent, assignedWeeks] = await Promise.all([
    fetchRecentGymSessions(db, athleteId, from, today, LIST_LIMIT + 1),
    fetchRecentGymSessions(db, athleteId, headlineFrom, today, GYM_HEADLINE_CAP),
    fetchMyAssignedSessionsByWeek(db, athleteId, headlineFrom, today),
  ]);
  const sessions = fetched.slice(0, LIST_LIMIT);
  const more = fetched.length > LIST_LIMIT;
  const shownSessions = showAll ? sessions : sessions.slice(0, LIST_PREVIEW_ROWS);

  const countByWeek = new Map<string, number>();
  let headlineSets = 0;
  for (const s of recent) {
    const wk = mondayOf(s.entry_date);
    countByWeek.set(wk, (countByWeek.get(wk) ?? 0) + 1);
    headlineSets += s.set_count;
  }
  const assignedByWeek = new Map(assignedWeeks.map((w) => [w.week_start, w.assigned]));
  const weeks = weekStarts.map((start, i) => ({
    start,
    count: countByWeek.get(start) ?? 0,
    assigned: assignedByWeek.get(start) ?? null,
    /* The last bucket runs to today, not to Sunday. A part-week drawn like a
       whole one reads as a bad week rather than an unfinished one. */
    partial: i === GYM_HEADLINE_WEEKS - 1,
    label: i === GYM_HEADLINE_WEEKS - 1 ? 'This week' : `w/c ${dayMonth(start, timezone)}`,
  }));
  const done = weeks.reduce((a, w) => a + w.count, 0);
  /* Null, not 0, when the RPC returned no row for a week — "we do not know" and
     "nothing was set" are different facts, and only the second is a
     denominator. If ANY week is unknown the total is withheld rather than
     quietly under-reported, because a denominator smaller than the truth makes
     an athlete look more compliant than they are. */
  const assignedTotal = weeks.every((w) => w.assigned !== null)
    ? weeks.reduce((a, w) => a + (w.assigned ?? 0), 0)
    : null;
  /* Scaled to the tallest COMPLETED week, not to what was assigned. 23k's bars
     are a volume trend — "3, 4, 2, 1 sessions" — and scaling them against the
     denominator would quietly turn the same chart into a compliance ratio,
     which is a different statement than the one the card is making. The
     denominator has its own line above. */
  const peak = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <div className="stack">
      <section className="card" aria-labelledby="gym-headline">
        <h2 className="eyebrow" id="gym-headline">
          Sessions
        </h2>
        <div className="rd-head">
          <p className="rd-value num">{done}</p>
          <div className="rd-meta">
            {/* 23k's denominator, and §9 rule 2's: every aggregate states what
                it is out of. Backed by migration 0062, which maps each calendar
                week to its programme week through the assignment's start date
                and the blocks' durations.

                When it cannot be known — no programme assigned, or a week the
                RPC returned nothing for — the line says what IS true (the sets)
                rather than printing a denominator nobody can stand behind. */}
            {/* > 0, not just non-null. A zero denominator beside a non-zero
                count reads "3 of 0 assigned", which cannot be true of
                anything — and it is what this club's data produces, because
                only week 1 of each block has sessions authored while the
                blocks run 4 to 12 weeks. Zero assigned does not mean the
                athlete failed; it means nothing was scheduled, and the work
                they did was off-programme. The sets line is the true statement
                in that case. */}
            {assignedTotal !== null && assignedTotal > 0 ? (
              <p className="rd-delta">
                of <span className="num">{assignedTotal}</span> assigned
              </p>
            ) : (
              <p className="rd-delta">
                <span className="num">{headlineSets}</span> set{headlineSets === 1 ? '' : 's'} logged
              </p>
            )}
            <p className="rd-mean">
              last {GYM_HEADLINE_WEEKS} weeks &middot; from {dayMonth(headlineFrom, timezone)}
            </p>
          </div>
        </div>

        <div
          className="gb-chart"
          role="img"
          /* The same > 0 rule as the visible line. A label that reads "2 of 0
             sessions" is the identical nonsense, only audible — and a screen
             reader is the one place nobody can see it is wrong. */
          aria-label={`Completed gym sessions by week: ${weeks
            .map(
              (w) =>
                `${w.label}, ${w.count}${
                  w.assigned !== null && w.assigned > 0 ? ` of ${w.assigned}` : ''
                } session${w.count === 1 ? '' : 's'}${w.partial ? ', still running' : ''}`,
            )
            .join('; ')}`}
        >
          {weeks.map((w) => (
            <div className="gb-col" key={w.start}>
              <div className="gb-track">
                <div
                  className="gb-bar"
                  data-partial={w.partial ? '' : undefined}
                  data-zero={w.count === 0 ? '' : undefined}
                  style={w.count === 0 ? undefined : { height: `${Math.round((w.count / peak) * 100)}%` }}
                />
              </div>
              <div className="gb-label">{w.label}</div>
            </div>
          ))}
        </div>

        <p className="cap" style={{ marginTop: 'var(--sp-10)' }}>
          {/* "whatever period you pick" went with the period control. The
              sentence still earns its place: the list below this card runs over
              a different span from the bars, and saying so is the only thing
              stopping the two being read as one number. */}
          Completed sessions, four calendar weeks.
          {/* Only when there IS a lighter bar to explain. With nothing logged this
              week the last column is a zero rule like any other empty week, and a
              sentence pointing at a tint that is not on screen sends the reader
              looking for something that is not there. */}
          {weeks[GYM_HEADLINE_WEEKS - 1] && (weeks[GYM_HEADLINE_WEEKS - 1]?.count ?? 0) > 0
            ? ' This week is still running, so its bar is drawn lighter.'
            : ''}
        </p>
      </section>

      <section
        className="card flush"
        aria-labelledby="gym-title"
        /* Spec §7.3 gives gym 62px for the tonnage alone. 78px here: these rows
           are links to the correction screen and carry a chevron the design's
           rows do not, which needs the gap plus its own glyph. */
        style={{ '--hist-val-w': '78px' } as React.CSSProperties}
      >
        {/* 23k: a row list, not the six-column table this was. At 390px that
            table scrolled sideways and cut the Correct link in half — the
            screenshot that started this work shows it clipped mid-word. */}
        <div className="hist-head">
          <h2 className="card-title" id="gym-title">
            Sessions
          </h2>
          <span className="hist-n">tonnage from logged sets</span>
        </div>
        {/* Like the nutrition check-in and unlike wellness and RPE, gym set
          * logs stay the athlete's own to correct. `gym_set_logs` has no staff
          * write path of any kind (migration 0045), so `revise_gym_set_log` could
          * not be widened to coaches without first building one — and removing the
          * athlete's path would leave every mis-logged rep permanently wrong.
          * Building that staff path was out of scope for this change and is
          * recorded as O-31 in adr-005-immutable-entries.md. */}
        <div style={{ padding: '0 var(--pad-card-x)' }}>
          <FlagNotice flags={flags} heading="Noted by staff" timezone={timezone} />
        </div>

        {sessions.length === 0 ? (
          <div style={{ padding: '0 var(--pad-card-x) var(--pad-card-y)' }}>
            <EmptyPeriod db={db} athleteId={athleteId} domain="gym" tab="gym" periodKey={periodKey} seasonStart={seasonStart} today={today} timezone={timezone} />
          </div>
        ) : (
          shownSessions.map((s) => (
            <Fragment key={s.id}>
              <div className="hair" />
              <Link href={`/my-data/gym/${s.id}`} className="hist-row">
                <div style={{ minWidth: 0 }}>
                  <p className="hist-date">{formatDate(s.entry_date, timezone)}</p>
                  <p className="hist-detail">
                    {s.session_name ?? 'Gym session'} &middot; <span className="num">{s.set_count}</span>{' '}
                    {s.set_count === 1 ? 'set' : 'sets'}
                    {s.session_rpe !== null ? (
                      <>
                        {' '}
                        &middot; RPE <span className="num">{formatNumber(s.session_rpe, 1)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="hist-go">
                  <p className="hist-value num" data-missing={s.total_volume_kg === null ? '' : undefined}>
                    {volumeLabel(s.total_volume_kg)}
                  </p>
                  <span className="hist-chev" aria-hidden="true">
                    &rsaquo;
                  </span>
                </div>
              </Link>
            </Fragment>
          ))
        )}
        <div className="hist-foot">
          <p className="cap" style={{ margin: 0 }}>
            Open a session to fix a set you mis-logged &mdash; the original is kept, never
            overwritten. Gym sets stay yours to correct; your check-ins and session ratings do
            not.
          </p>
          <SeeAllLink
            tab="gym"
            periodKey={periodKey}
            shown={shownSessions.length}
            total={sessions.length}
            noun="sessions"
          />
          {showAll ? <ListCapNote shown={sessions.length} more={more} noun="sessions" /> : null}
        </div>
      </section>
    </div>
  );
}
