import { AnalyticsBarChart, type AnalyticsBar } from '@/components/AnalyticsBarChart/AnalyticsBarChart';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PlanGate, PlanGateCard } from '@/components/PlanGate/PlanGate';
import { ReportSelectNav, type ReportSelectOption } from '@/components/ReportSelectNav/ReportSelectNav';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import {
  ACWR_BAND_HIGH,
  ACWR_BAND_LOW,
  ACWR_BAND_TEXT,
  acwrBandTone,
} from '@/lib/acwr';
import {
  CHART_OPTIONS,
  DEFAULT_CHART,
  DEFAULT_RANGE,
  MAX_WINDOW_DAYS,
  METRICS,
  RANGE_OPTIONS,
  chartIsPremium,
  chartUnavailableReason,
  isChartKey,
  isRangeKey,
  resolveMetric,
  resolveRange,
  type ChartKey,
  type RangeKey,
} from '@/lib/analyticsBuilder';
import {
  fetchBuilderAthletes,
  fetchCurrentSeasonWindow,
  fetchEarliestEntryDate,
  fetchMetricSeries,
} from '@/lib/queries/analytics';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { BLANK, formatDate, formatNumber, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';
import type { Band } from '@/lib/stats';
import { ANALYTICS, hasAnyRole } from '@/lib/access';

/* MOVED from /analytics, which is now the four fixed comparison boards the
 * Analytics design specifies. This builder is not deleted: it is a working,
 * general tool — one metric, one population, one window — that can express any
 * of those four boards and a great many more, and it is what the metric
 * catalogue and fetchMetricSeries were built for. It keeps its own route so
 * nothing is lost, and the boards page does not link to it, because the design
 * has no such control. Delete it deliberately if it is genuinely unwanted;
 * do not let it rot here by accident. */
export const metadata = { title: 'Build a view · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ALL_ATHLETES = 'all';

/**
 * Analytics — the single-metric builder.
 *
 * ═══ WHAT CHANGED, AND WHY IT CONTRADICTS SOMETHING ═══════════════════════
 *
 * This screen used to be two fixed squad-wide tables (an ACWR table and a
 * wellness-outlier table) with a group filter and nothing else. Both are still
 * reachable — ACWR is the default metric, wellness readiness is one select
 * away — but they are now two rows of a catalogue rather than the whole page.
 *
 * Two instructions drove this, both from the coach:
 *
 *  1. "add a dropdown menu to be able to select specific players to analyse. i
 *     want a graph that i can manipulate with different types of tables/graphs.
 *     different timelines, different positions, different metrics and dropdown
 *     menus for all."
 *  2. "for the setting page move the analytics bar chart ... onto the premium
 *     plan side."
 *
 * ═══ THE TIER GATE, AND HOW WIDE IT IS ════════════════════════════════════
 *
 * (2) is a real behaviour change. What ships is the narrow reading: the BAR
 * CHART is Premium; the Analytics screen is not. A Basic (`core`) club keeps
 * the screen it already has — every metric, the athlete and group pickers, the
 * timelines, the trend chart and the athlete table — and the "Bar, by athlete"
 * view shows a locked panel naming what it would buy, alongside a pointer to
 * the Table view, which is the SAME query and the same per-athlete numbers.
 *
 * WHY NOT THE WHOLE ROUTE. An earlier pass of this file gated `/analytics`
 * itself behind isPremium(), and that was wrong on two counts:
 *
 *  - It is wider than the sentence that authorised it. The instruction names
 *    two things, "the analytics bar chart" and "apple health connection", and
 *    the Apple Health half was implemented narrowly: a plan-card column move
 *    plus a Locked state on ONE Settings row, with no route gated at all
 *    (`src/app/(staff)/settings/page.tsx`). Reading the two halves of one
 *    sentence at two different scopes is not an interpretation, it is a slip.
 *  - It deleted a live screen from paying customers. /analytics is shipped and
 *    running; every existing `core` org would have opened it the next morning
 *    and found it gone. `docs/12-product-tiers.md` §3.3 is explicit that this
 *    is "the highest-regret" class of change — "reversing it later is a
 *    downgrade for existing customers" — and a downgrade of that size is a
 *    commercial decision that needs the buyer's sign-off on the SCOPE, not
 *    just on the sentence. Nothing in the instruction asks for it.
 *
 * What the narrow gate still costs the spec, stated plainly: nothing.
 * `docs/12-product-tiers.md` §2.3 row 27 ("Analytics — Both") and
 * `docs/screens/analytics.md`'s Club-tier row ("five presets, single-metric
 * builder, LINE AND BAR only") are now contradicted on exactly one word — the
 * bar chart moves out of Club — and O-854's recommendation ("Club gets the
 * full analytics builder") survives everywhere else. Both docs are updated to
 * say so rather than being left describing something else.
 *
 * ═══ WHAT IS DELIBERATELY NOT HERE ════════════════════════════════════════
 *
 * analytics.md's builder is much larger than this one. Not built, and not
 * half-built: cross-metric correlation (needs a second metric slot and a lag
 * model), scatter and heatmap visualisations (a scatter needs two metrics, a
 * heatmap needs two categorical dimensions — this builder produces neither),
 * and saved/shared views (there is no `saved_views` table in this schema).
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, timezone, claims, tier } = await requireStaff();

  /* The builder is behind the same gate as the screen it belongs to — see
     analytics/page.tsx. Route-level, so a bookmarked /analytics/build refuses
     rather than rendering a Premium screen with its chart panel locked. */
  if (!isPremium(tier)) {
    return (
      <PlanGate
        featureName="Analytics"
        body="The metric builder, the athlete and group pickers, and every chart on the Analytics screen."
        metadata="Premium · analytics · metric builder"
      />
    );
  }

  /* Role BEFORE tier, deliberately. docs/20-route-map.md §2.3 gives /analytics
   * to coach and medical only, and 01-roles-and-permissions.md (superseded) §2 gives admin
   * a flat `no` for "Build custom analytics". An admin denied by role would
   * still be denied after an upgrade, so showing them a "buy Premium" panel
   * would be selling them something that does not unlock this. Role is the
   * boundary that cannot be purchased, so it answers first. */
  /* D-02: was coach-or-medic, which is the four-role model's "any staff" and the
     opposite of what this screen is meant to be. The sport scientist alone. */
  const hasAccess = hasAnyRole(claims.roles, ANALYTICS);
  if (!hasAccess) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">{orgName}</p>
            <h1>Analytics</h1>
          </div>
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            Analytics is named-athlete performance data. Admin manages the club and does not
            read athlete performance data &mdash; see 01-roles-and-permissions.md (superseded) §1.
          </p>
        </div>
      </>
    );
  }

  /* Tier, AFTER role, and it gates one visualisation rather than the route —
   * see this file's header for the scope argument. Server-resolved from
   * `organisations.tier` via requireStaff(), never from anything the client
   * sends, and read through isPremium() so 12-product-tiers.md §2's
   * fail-closed rule (an unrecognised tier is the LOWER tier) holds here the
   * same way it holds in Settings. */
  const onPremium = isPremium(tier);

  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const metric = resolveMetric(params.metric);
  const today = todayIso(timezone);

  /* Everything the controls need to render themselves, in parallel. The
   * earliest entry date is per-SOURCE, not per-org: "all on record" for a
   * wellness metric is the first wellness check-in, which is not the first
   * training entry, and using one for the other would draw a long empty run
   * at the head of the chart. */
  const [groups, athletes, season, earliest] = await Promise.all([
    fetchGroups(db, orgId),
    fetchBuilderAthletes(db, orgId, groupIds),
    fetchCurrentSeasonWindow(db, orgId),
    fetchEarliestEntryDate(db, orgId, metric.source),
  ]);

  /* Timeline. "This season" is offered only when the club actually has a
   * current season row — schedule.ts already treats a missing one as a real
   * condition rather than a default, and an option that silently means
   * something else is worse than an option that is not there. A URL asking
   * for a season that does not exist falls back rather than erroring. */
  const seasonAvailable = season !== null;
  const rawRange = params.range;
  const requestedRange: RangeKey = isRangeKey(rawRange) ? rawRange : DEFAULT_RANGE;
  const rangeKey: RangeKey = requestedRange === 'season' && !seasonAvailable ? DEFAULT_RANGE : requestedRange;
  const range = resolveRange(rangeKey, today, season?.starts_on ?? null, earliest);

  /* Athlete. Resolved against the list the GROUP FILTER produced, so the two
   * controls compose in one direction only: the group filter narrows the
   * picker, never the other way round. Picking Forwards while Adeyemi (a back)
   * is selected silently keeping Adeyemi would make the group chip a lie, so
   * the selection is dropped and the page says it was. */
  const athleteParam = typeof params.athlete === 'string' ? params.athlete : ALL_ATHLETES;
  const selectedAthlete = athletes.find((a) => a.id === athleteParam) ?? null;
  const athleteDropped = athleteParam !== ALL_ATHLETES && selectedAthlete === null;

  /* Chart type. Two different things can stop a chart being drawn, and they
   * are kept apart on purpose:
   *
   *  ILLEGAL — analytics.md: "disabled with the reason, not hidden". One day is
   *  one point and a point is not a trend, so `line` is disabled for the `day`
   *  timeline in the control AND coerced here; the control alone would not stop
   *  a hand-typed or bookmarked URL.
   *
   *  LOCKED — the bar chart on a Basic plan. NOT coerced and NOT disabled: it
   *  stays selectable and renders a panel saying what it is and what it costs,
   *  the same shape the Apple Health row in Settings uses. Coercing it would
   *  silently show a different answer than the one asked for; disabling it
   *  would make a purchasable feature look broken.
   *
   * The substitute for an illegal chart is the bar view, except on Basic where
   * the bar view is the locked one — there the table is the substitute, and it
   * carries the identical per-athlete numbers. */
  const requestedChart: ChartKey = isChartKey(params.chart) ? params.chart : DEFAULT_CHART;
  const coercion = chartUnavailableReason(requestedChart, rangeKey);
  const chart: ChartKey = coercion === null ? requestedChart : onPremium ? 'bar' : 'table';
  const chartLocked = chartIsPremium(chart) && !onPremium;

  const result = await fetchMetricSeries(
    db,
    orgId,
    metric,
    { from: range.from, to: range.to },
    groupIds,
    selectedAthlete?.id ?? null,
  );

  /* ---- control options ------------------------------------------------- */

  const metricOptions: ReportSelectOption[] = METRICS.map((m) => ({ value: m.key, label: m.label }));

  const athleteOptions: ReportSelectOption[] = [
    { value: ALL_ATHLETES, label: `Everyone in scope (${athletes.length})` },
    ...athletes.map((a) => ({
      value: a.id,
      // Position is shown here because it is the one roster fact that makes
      // two similar names distinguishable at a glance. It is a LABEL, not a
      // filter — see the scope note under the controls.
      label: a.position ? `${a.last_name}, ${a.first_name} · ${a.position}` : `${a.last_name}, ${a.first_name}`,
    })),
  ];

  const rangeOptions: ReportSelectOption[] = RANGE_OPTIONS.filter(
    (r) => r.key !== 'season' || seasonAvailable,
  ).map((r) => ({
    value: r.key,
    label: r.key === 'season' && season ? `This season · ${season.name}` : r.label,
  }));

  /* A locked chart is marked in the label and stays CHOOSABLE; only an illegal
   * one is disabled. Same distinction the Settings integrations list already
   * draws between "Locked" (a tier restriction, purchasable) and a disabled
   * "Connect" (something the build genuinely cannot do). */
  const chartOptions: ReportSelectOption[] = CHART_OPTIONS.map((c) => ({
    value: c.key,
    label: chartIsPremium(c.key) && !onPremium ? `${c.label} · Premium` : c.label,
    disabled: chartUnavailableReason(c.key, rangeKey) !== null,
  }));

  /* ---- axis ------------------------------------------------------------ */

  const axis = lineAxis(metric.axis, metric.ticks, result.series, metric.decimals);

  const bars: AnalyticsBar[] = result.byAthlete.map((r) => ({
    key: r.athlete_id,
    label: `${r.first_name.slice(0, 1)}. ${r.last_name}`,
    value: r.value,
    suppressed: r.suppressed,
    // The ONLY metric with a published band is ACWR, and its tone comes from
    // lib/acwr.ts so this screen cannot invent a threshold or drift from the
    // one the reports and the profile dial already use. Every other metric is
    // neutral: colouring "fatigue 3.1" red would be this file inventing a
    // sports-science cutoff the product has never agreed on.
    tone: metric.key === 'acwr' ? acwrBandTone(r.value) : 'neutral',
  }));

  const scopeLine = [
    metric.label,
    selectedAthlete
      ? `${selectedAthlete.first_name} ${selectedAthlete.last_name}`
      : `${groupScopeLabel(groups, groupIds)} · ${result.athletesInScope} athlete${result.athletesInScope === 1 ? '' : 's'}`,
    `${formatDate(range.from, timezone)} – ${formatDate(range.to, timezone)} · ${range.days} day${range.days === 1 ? '' : 's'}`,
  ].join(' · ');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            {groupScopeLabel(groups, groupIds)} · {orgName}
          </p>
          <h1>Analytics</h1>
        </div>
      </div>

      {/* CLAUDE.md §3 / rule 7. The group filter was already on this screen
          before the builder existed and it stays exactly where it was: it is
          the GLOBAL filter, persisted in the URL and a cookie and shared with
          every other screen, so it sits above the page's own controls rather
          than inside them. The coach asked for "different positions" — in this
          product a position IS a group: `groups.group_type` has 'positional'
          as its first enum value and CLAUDE.md §3's own examples are
          "forwards, backs". A second, parallel position dropdown reading the
          free-text `athletes.position` column would be a rival filter that the
          rest of the app does not honour and that no other screen persists,
          which is precisely what the brief forbids. So: positions are filtered
          here, through the one filter every screen already shares. */}
      <div style={{ marginBottom: 'var(--sp-14)' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <section className="card" aria-labelledby="builder-title">
        <h2 className="card-title" id="builder-title">
          Build a view
        </h2>
        

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px 18px',
            marginTop: 'var(--sp-12)',
          }}
        >
          <ReportSelectNav label="Metric" paramKey="metric" value={metric.key} options={metricOptions} />
          <ReportSelectNav
            label="Athlete"
            paramKey="athlete"
            value={selectedAthlete?.id ?? ALL_ATHLETES}
            options={athleteOptions}
            clearValue={ALL_ATHLETES}
          />
          <ReportSelectNav label="Timeline" paramKey="range" value={rangeKey} options={rangeOptions} />
          <ReportSelectNav label="Show as" paramKey="chart" value={chart} options={chartOptions} />
        </div>

        <p className="cap" style={{ marginTop: 'var(--sp-12)' }} role="status">
          <b>{scopeLine}</b>
        </p>

        {athleteDropped ? (
          <p className="cap">
            The athlete you had selected is not in the current group filter, so this is showing
            everyone in scope instead. Clear the filter above to pick them again.
          </p>
        ) : null}
        {coercion ? (
          <p className="cap">
            {coercion}{' '}
            {chart === 'bar'
              ? 'Showing the bar view instead.'
              : 'Showing the table instead — it carries the same per-athlete numbers as the bar view, which is Premium.'}
          </p>
        ) : null}
        {range.clipped ? (
          <p className="cap">
            Clipped to the last {MAX_WINDOW_DAYS} days. Analytics windows cap at two years, so a
            longer history is read through Reports and exports rather than drawn as one line.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 'var(--sp-14)' }} aria-labelledby="result-title">
        <h2 className="card-title" id="result-title">
          {metric.label}
        </h2>
        <p className="import-sub">{metric.note}</p>

        {chartLocked ? (
          /* The locked capability, in the place it would have been drawn —
             not in place of the screen. Everything above and below this card
             (the metric catalogue, the pickers, the provenance line) is still
             live for a Basic club, and the Table view one control away holds
             the identical byAthlete numbers this chart would have ranked. */
          <PlanGateCard
            heading="Bar, by athlete is a Premium view"
            body="One bar per athlete, ranked biggest first, with the descriptive band drawn behind them — the view a coach scans to find who is at the top of a metric this week. Your plan includes everything else on this screen: every metric, the athlete and group pickers, every timeline, the trend chart, and the Table view, which lists the same per-athlete numbers this chart would rank."
            metadata="Premium · bar, by athlete · the same query, drawn as a ranking"
            style={{ marginTop: 'var(--sp-14)', maxWidth: 680 }}
          />
        ) : result.athletesInScope === 0 ? (
          <p className="cap">
            No athlete matches this filter, so there is nothing to measure. Widen the group
            filter above.
          </p>
        ) : result.daysWithData === 0 && chart === 'line' ? (
          <p className="cap">
            Nothing was submitted for {metric.label.toLowerCase()} anywhere in this window. Not
            drawn as a flat line at zero &mdash; no entry and an entry of zero are different
            facts.
          </p>
        ) : chart === 'line' ? (
          <>
            <WellnessChart
              series={result.series}
              timezone={timezone}
              min={axis.min}
              max={axis.max}
              ticks={axis.ticks}
              title={scopeLine}
              decimals={metric.decimals}
            />
            
            {axis.extended ? (
              /* Say it, rather than letting a reader who has learnt this
                 metric's usual gridlines read a differently-scaled chart as
                 the familiar one. The alternative — holding the declared axis
                 and clamping — is what this screen used to do, and it drew a
                 spike as a flat line sitting on the top gridline while
                 printing the true number beside it. */
              <p className="cap">
                A value in this window sits outside {metric.label.toLowerCase()}&rsquo;s usual{' '}
                {formatNumber(metric.axis![0], metric.decimals)}&ndash;
                {formatNumber(metric.axis![1], metric.decimals)} range, so the axis has been
                widened to {formatNumber(axis.min, metric.decimals)}&ndash;
                {formatNumber(axis.max, metric.decimals)} to hold it. Nothing is flattened to
                fit &mdash; a spike is drawn at its real height, which is the whole reason to
                look.
              </p>
            ) : null}
          </>
        ) : chart === 'bar' ? (
          <>
            <AnalyticsBarChart
              bars={bars}
              unit={metric.unit}
              decimals={metric.decimals}
              band={metric.key === 'acwr' ? [ACWR_BAND_LOW, ACWR_BAND_HIGH] : null}
              suggestedMax={metric.axis ? metric.axis[1] : null}
              title={scopeLine}
            />
            <p className="cap">
              {metric.aggregate === 'trailing'
                ? `Each bar is the ratio as it stands on ${formatDate(range.to, timezone)} — a trailing figure is not averaged over the window, because an average of overlapping windows is not a longer window.`
                : `Each bar is the athlete’s mean over the window, across the days they actually submitted. Days without an entry are not counted as zero.`}
              {metric.key === 'acwr' ? ` The shaded strip is the descriptive ${ACWR_BAND_TEXT} band.` : ''}
            </p>
          </>
        ) : (
          <AthleteTable
            rows={result.byAthlete}
            metricLabel={metric.label}
            unit={metric.unit}
            decimals={metric.decimals}
            aggregateLabel={metric.aggregate === 'trailing' ? `On ${formatDate(range.to, timezone)}` : 'Window mean'}
            timezone={timezone}
          />
        )}

        {chart === 'table' ? (
          <>
            <h3 className="card-title" style={{ marginTop: 'var(--sp-22)', fontSize: 'var(--fs-14)' }}>
              Day by day
            </h3>
            <SeriesTable series={result.series} decimals={metric.decimals} unit={metric.unit} timezone={timezone} />
          </>
        ) : null}

        {/* Provenance, on every view. analytics.md: "A chart exported without
            its n and window is the main way a misleading figure escapes into a
            slide deck." Nothing here is exportable yet, but the same argument
            applies to a coach reading a number off a screen in a meeting. */}
        <p className="cap" style={{ marginTop: 'var(--sp-14)' }}>
          {result.athletesInScope} athlete{result.athletesInScope === 1 ? '' : 's'} ·{' '}
          {range.days} day{range.days === 1 ? '' : 's'} to {formatDate(range.to, timezone)} ·{' '}
          {result.daysWithData} day{result.daysWithData === 1 ? '' : 's'} with data
          {result.suppressedCount > 0
            ? ` · ${result.suppressedCount} athlete${result.suppressedCount === 1 ? '' : 's'} suppressed for insufficient history`
            : ''}
          .
        </p>
      </section>

      <p className="cap">
        Cross-metric correlation, scatter and heatmap views, and saved or shared views are not
        built yet.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------------ *
 * Result renderers. Local to this file on purpose: they are two tables of one
 * screen's own result type, not a component another screen would reach for.
 * ------------------------------------------------------------------------ */

function AthleteTable({
  rows,
  metricLabel,
  unit,
  decimals,
  aggregateLabel,
  timezone,
}: {
  rows: readonly {
    athlete_id: string;
    first_name: string;
    last_name: string;
    value: number | null;
    latest: number | null;
    latest_date: string | null;
    days_with_data: number;
    z: number | null;
    suppressed: boolean;
  }[];
  metricLabel: string;
  unit: string;
  decimals: number;
  aggregateLabel: string;
  timezone: string;
}) {
  if (rows.length === 0) return <p className="cap">No athletes in scope.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <caption className="visually-hidden">{metricLabel} by athlete — the numbers behind the bar chart</caption>
        <thead>
          <tr>
            <th scope="col">Athlete</th>
            <th scope="col" className="r">
              {aggregateLabel}
            </th>
            <th scope="col" className="r">
              Latest
            </th>
            <th scope="col" className="r">
              Days
            </th>
            <th scope="col" className="r">
              z
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.athlete_id}>
              <td className="nm">
                {r.first_name} {r.last_name}
              </td>
              <td className="r num">
                {/* Suppressed is a stated absence, never a blank cell that
                    could be mistaken for a zero or a rendering failure. */}
                {r.suppressed ? (
                  <span className="cap">not enough history</span>
                ) : (
                  <>
                    {formatNumber(r.value, decimals)}
                    {r.value !== null ? unit : ''}
                  </>
                )}
              </td>
              <td className="r num">
                {formatNumber(r.latest, decimals)}
                {r.latest !== null ? unit : ''}
                {r.latest_date ? (
                  <span className="cap" style={{ marginLeft: 'var(--sp-6)' }}>
                    {formatDate(r.latest_date, timezone)}
                  </span>
                ) : null}
              </td>
              <td className="r num">{r.days_with_data}</td>
              <td className="r num">
                {/* z against the athlete's OWN band. |z| >= 1.5 is the same
                    outlier line the wellness preset has always used; below the
                    10-observation guard z is null and stays blank rather than
                    being drawn as 0. */}
                {r.z === null ? (
                  BLANK
                ) : Math.abs(r.z) >= 1.5 ? (
                  <span className="pill pill-warn">{formatNumber(r.z, 1)}</span>
                ) : (
                  formatNumber(r.z, 1)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeriesTable({
  series,
  decimals,
  unit,
  timezone,
}: {
  series: readonly Band[];
  decimals: number;
  unit: string;
  timezone: string;
}) {
  // Newest first: the table is read to answer "what happened lately", the
  // opposite of the chart, which is read left to right for shape.
  const rows = [...series].reverse();
  return (
    <div style={{ overflowX: 'auto', maxHeight: 420 }}>
      <table className="tbl">
        <caption className="visually-hidden">Day by day — the numbers behind the trend chart</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" className="r">
              Value
            </th>
            <th scope="col" className="r">
              Own 28-day mean
            </th>
            <th scope="col" className="r">
              &plusmn;1 SD
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.date}>
              <td className="num">{formatDate(b.date, timezone)}</td>
              <td className="r num">
                {b.value === null ? (
                  <span className="cap">no entry</span>
                ) : (
                  <>
                    {formatNumber(b.value, decimals)}
                    {unit}
                  </>
                )}
              </td>
              <td className="r num">{formatNumber(b.mean, decimals)}</td>
              <td className="r num">{formatNumber(b.sd, decimals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The trend chart's vertical axis.
 *
 * A metric with a BOUNDED scale (readiness 0–100, the 1-to-5 wellness scales,
 * ACWR's 0–2.5 display range) keeps its declared axis WHILE THE DATA FITS
 * INSIDE IT, so the same metric over two different windows is visually
 * comparable — the whole reason to look at a trend. A metric with no natural
 * ceiling (training load in AU, resting heart rate in bpm) has no honest fixed
 * axis at all, so one is derived from the data, padded, and given evenly
 * spaced ticks.
 *
 * ═══ WHY "WHILE THE DATA FITS INSIDE IT" IS LOAD-BEARING ══════════════════
 *
 * This function used to return the declared axis unconditionally, and that was
 * a correctness bug, not a presentational one. WellnessChart clamps every value
 * it draws to [min, max] — the dot, the mean path and both band edges — so an
 * athlete on a return-to-play ramp at ACWR 3.4 got a dot welded to the 2.50
 * gridline and a flat clamped band above it, while the chart's own "today's
 * number" text printed the raw 3.40 beside it. The spike ACWR exists to reveal
 * rendered as a plateau, and the plateau looked like a real ceiling.
 *
 * 2.5 is not a ceiling. `lib/acwr.ts` is explicit that 0.8–1.5 is a DISPLAY
 * CONVENTION and that the ratio itself is unbounded; the same is true of every
 * other declared axis here in its own way (a ±1SD band on a 1-to-5 scale
 * reaches below 1, and `sleep_hours`' 0–12 is a plausible range, not a limit).
 *
 * It also made the two visualisations of one query contradict each other.
 * AnalyticsBarChart derives its own maximum from the data (`dataMax`) and never
 * clamps, so the same athlete read 3.4 as a bar and 2.5 as a line — which
 * breaks the promise stated in `lib/queries/analytics.ts`'s own header that the
 * renderings are "three readings of the same answer" that cannot disagree.
 *
 * So a declared axis is a FLOOR on the axis, never a cap on the data: when a
 * value or a band edge falls outside it the axis is extended to hold it, and
 * the declared ticks that survive are kept so the 0.8 and 1.5 band gridlines
 * do not vanish the moment the axis grows. Nothing is ever clamped away.
 *
 * `extended` is returned so the caller can SAY the axis moved. A reader who
 * has learnt what an ACWR chart's gridlines look like must not be quietly
 * handed a differently-scaled one.
 *
 * The band's own extents (mean ± 1 SD) are part of the extent in both branches,
 * not just the daily values — for exactly the same clamping reason.
 */
function lineAxis(
  declared: readonly [number, number] | null,
  declaredTicks: readonly number[] | null,
  series: readonly Band[],
  decimals: number,
): { min: number; max: number; ticks: number[]; extended: boolean } {
  const values: number[] = [];
  for (const b of series) {
    if (b.value !== null) values.push(b.value);
    if (b.mean !== null && b.sd !== null) values.push(b.mean + b.sd, b.mean - b.sd);
  }

  if (declared) {
    const fallbackTicks = [...(declaredTicks ?? [declared[0], declared[1]])];
    if (values.length === 0) {
      return { min: declared[0], max: declared[1], ticks: fallbackTicks, extended: false };
    }

    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const below = lo < declared[0];
    const above = hi > declared[1];
    if (!below && !above) {
      // The normal case, and the one worth protecting: the declared axis is
      // returned untouched, so two windows of the same metric are read against
      // identical gridlines.
      return { min: declared[0], max: declared[1], ticks: fallbackTicks, extended: false };
    }

    const pad = axisPad(lo, hi);
    // A declared axis that starts at 0 does so because the metric cannot be
    // negative — readiness, a 1-to-5 scale and a ratio of two loads all floor
    // there — so the axis is not pushed below it. Every metric in METRICS is in
    // that shape today, but the check is on the declared bound rather than
    // assumed. A band edge that arithmetic puts below such a floor is the one
    // remaining thing WellnessChart legitimately clamps: it is an impossible
    // value, not a real reading being hidden.
    const min = below ? (declared[0] >= 0 ? Math.max(0, lo - pad) : lo - pad) : declared[0];
    const max = above ? hi + pad : declared[1];

    // `below`/`above` say the data escaped the declared range; this says the
    // AXIS actually moved. They differ exactly when the escape was into
    // impossible territory and got floored back — and captioning "widened to
    // 0–100" on an axis that is still 0–100 would be its own small lie.
    if (min === declared[0] && max === declared[1]) {
      return { min, max, ticks: fallbackTicks, extended: false };
    }

    // Keep every declared tick that is still on the axis — for ACWR that is
    // 0.8 and 1.5, the whole descriptive band — and add the new extremes so
    // the reader can see how far past the usual range this went.
    const ticks = dedupeTicks([min, ...fallbackTicks.filter((t) => t > min && t < max), max], decimals);
    return { min, max, ticks, extended: true };
  }

  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1], extended: false };

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = axisPad(lo, hi);
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  const ticks = [0, 1, 2, 3, 4].map((i) => Number((min + ((max - min) * i) / 4).toFixed(decimals)));
  return { min, max, ticks, extended: false };
}

/** A flat series would give a zero-height axis and divide by zero in the
 *  chart's own y(); give it a nominal window around the value instead. */
function axisPad(lo: number, hi: number): number {
  return hi === lo ? Math.max(1, Math.abs(hi) * 0.1) : (hi - lo) * 0.1;
}

/** Round to the metric's own precision and drop the duplicates that rounding
 *  creates, so two gridlines never print the same number on top of each other.
 *  WellnessChart keys its gridlines on the tick value, so a duplicate would
 *  also be a duplicate React key. */
function dedupeTicks(ticks: readonly number[], decimals: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of ticks) {
    const rounded = Number(t.toFixed(decimals));
    if (seen.has(rounded)) continue;
    seen.add(rounded);
    out.push(rounded);
  }
  return out.sort((a, b) => a - b);
}
