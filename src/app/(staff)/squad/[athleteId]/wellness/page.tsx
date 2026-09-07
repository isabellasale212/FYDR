import Link from 'next/link';
import { Pill } from '@/components/Pill/Pill';
import { PositionalContext } from '@/components/PositionalContext/PositionalContext';
import { WellnessChart } from '@/components/WellnessChart/WellnessChart';
import { AthleteDomainDenied } from '@/components/AthleteDomainShell/AthleteDomainShell';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { loadAthleteDomainContext } from '@/lib/athleteDomain.server';
import { addDays, formatNumber } from '@/lib/format';
import { resolveRange, type RangeKey } from '@/lib/period';
import { availabilityStatus } from '@/lib/status';
import { mean, readiness } from '@/lib/stats';
import { fetchEarliestEntryDate } from '@/lib/queries/analytics';
import { fetchWellnessByAthlete, fetchWellnessForAthletes, wellnessSeries, type WellnessEntry } from '@/lib/queries/wellness';
import {
  positionalScopeLine,
  resolvePositionalUnit,
  summarisePositional,
  type PositionalBand,
} from '@/lib/queries/positionalContext';

export const metadata = { title: 'Wellness · Fydr' };

/* ===========================================================================
 * /squad/[athleteId]/wellness — one athlete's wellness, VIEW ONLY.
 *
 * The client asked for the three chips on the player profile to open "a new
 * page with just that info in it", then clarified: "dont allow editing of gym,
 * nutrition, or wellness in players profile just make it veiwable and only
 * editable by the staff incharge". So this page has no edit affordance of any
 * kind and links to the one audited place a wellness entry is corrected.
 *
 * That clarification did NOT remove the EntryCorrectionPanel from the player
 * profile, and this page is the reason the two are not in conflict: coach and
 * medical ARE "the staff in charge" of a wellness correction (migration 0058
 * narrowed revise_wellness_entry to exactly those two roles), so the edit still
 * exists, in one owned place, and this page points at it instead of growing a
 * second one. CLAUDE.md rule 6 is the other half: a wellness entry is immutable
 * once submitted and a correction writes a new revision row. There is no
 * version of "edit it here" that is compatible with that; there is only
 * "correct it, audibly, over there".
 *
 * ---------------------------------------------------------------------------
 * RULE 3 — WHAT IS DELIBERATELY NOT ON THIS PAGE
 * ---------------------------------------------------------------------------
 *
 * Medical data is separately gated: coaching staff see AVAILABILITY STATUS
 * only, never diagnosis (CLAUDE.md §2 rule 3, docs/09-security-and-compliance).
 * This page is reachable by coach and by medical and renders identically to
 * both, which is only safe because it carries nothing clinical to gate:
 *
 *   SHOWN     the availability pill — a status word, which is exactly what
 *             rule 3 says a coach may see.
 *   NOT SHOWN injury body area, side, status, expected return, or any injury
 *             record at all. The player profile shows those (to coach and
 *             medical alike, which is its own standing question); this page
 *             does not need them to answer "how have they been reporting", so it
 *             does not carry them and does not have to gate them.
 *   NOT SHOWN soreness_areas. The column is real and the athlete's own app
 *             collects it, but nothing staff-side in this codebase has ever
 *             rendered it, and a body-map of where an athlete hurts is the
 *             closest thing in wellness_entries to a clinical observation.
 *             Introducing it on a coach-readable page would be a rule-3
 *             decision, taken quietly, on a page whose brief is "just make it
 *             viewable". The five 1-5 scales ARE shown, because a coach
 *             already reads every one of them on the profile's correction
 *             panel — this page is not widening what a coach can see, only
 *             where they can see it.
 *
 * ---------------------------------------------------------------------------
 * THE POSITIONAL COMPARISON: 'group', NOT THE SIX-UNIT POSITION MAP
 * ---------------------------------------------------------------------------
 *
 * queries/positionalContext.ts's header carries the full argument. In one line:
 * position has no mechanism by which it should change how well you slept, so
 * splitting Forwards into Front row / Second row / Back row buys nothing here
 * and costs the only thing that matters — n. Wellness is the self-reported
 * health data supabase/migrations/0016_leaderboards.sql refuses to rank
 * ("publishes a health disclosure and rewards over-reporting"), and the widest
 * honest peer set is the safest one.
 *
 * AND IT IS A BAND, NOT A LIST. No named team-mate appears on this page in any
 * form. A "who is most sore in the squad" table is the exact artefact 0016 was
 * written to prevent, and building it on a player profile rather than on
 * /leaderboards would be routing around that decision rather than disagreeing
 * with it in the open.
 * ======================================================================== */

/** `day` is offered and DISABLED with its reason, per this codebase's own rule
 *  (docs/screens/analytics.md: "Illegal combinations are disabled with the
 *  reason, not hidden"). Every number on this page is a mean or a rolling band
 *  over a window; one day gives each of them a single observation, and the
 *  positional median would be computed over whoever happened to submit today. */
const WELLNESS_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];

/** The trailing baseline the readiness band is drawn against — "is this normal
 *  for them". FIXED at 14 days regardless of the selected period, matching
 *  queries/playerProfile.ts's WELLNESS_ROLLING_WINDOW exactly: the window being
 *  VIEWED widens, the window a day is JUDGED against does not, or "steady"
 *  would mean something different at every period. */
const ROLLING_WINDOW = 14;

/** The five 1-5 scales plus sleep hours, in the order the athlete's own entry
 *  form asks them. `higherIsBetter` is not a field here on purpose — this page
 *  draws spreads, not judgements (see PositionalContext.tsx) — but every scale
 *  in this schema runs 5 = best including soreness (migration 0010,
 *  wellness_compute_readiness), so the reader needs telling once and not per
 *  row. */
const SCALES = [
  { key: 'sleep_hours' as const, label: 'Sleep', unit: ' h', decimals: 1 },
  { key: 'sleep_quality' as const, label: 'Sleep quality', unit: ' of 5', decimals: 1 },
  { key: 'fatigue' as const, label: 'Fatigue', unit: ' of 5', decimals: 1 },
  { key: 'soreness' as const, label: 'Soreness', unit: ' of 5', decimals: 1 },
  { key: 'stress' as const, label: 'Stress', unit: ' of 5', decimals: 1 },
  { key: 'mood' as const, label: 'Mood', unit: ' of 5', decimals: 1 },
];

/** Every calendar date in the window, inclusive. `entry_date` is a `date`
 *  column, so these are plain YYYY-MM-DD strings compared as such and never
 *  pushed through dateInTz — CLAUDE.md rule 5 governs instants, and a calendar
 *  date is not one. */
function datesIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** An athlete's mean for one metric over the window. Null — never zero — when
 *  they submitted nothing: a zero would read as "they reported the worst possible
 *  score every day", which is the opposite of "they reported nothing". */
function meanOf(entries: readonly WellnessEntry[], metric: 'readiness' | (typeof SCALES)[number]['key']): number | null {
  const values = entries
    .map((e) => (metric === 'readiness' ? (e.readiness_score ?? readiness(e)) : e[metric]))
    .filter((v): v is number => typeof v === 'number');
  return mean(values);
}

/** The readiness axis. Fixed 0-100 rather than scaled to the data, because
 *  readiness IS a 0-100 score (lib/stats.ts's readiness()) and an auto-scaled
 *  axis would make a squad-average week and a terrible week look identical. */
const READINESS_TICKS = [0, 25, 50, 75, 100];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AthleteWellnessPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const ctx = await loadAthleteDomainContext(athleteId, sp, { allowed: WELLNESS_PERIODS });
  if (ctx.denied) return <AthleteDomainDenied orgName={ctx.orgName} domain="Wellness" />;

  const { db, orgId, timezone, today, athlete, groups, groupIds, season, periodKey } = ctx;

  const earliest = await fetchEarliestEntryDate(db, orgId, 'wellness');
  const range = resolveRange(periodKey, today, season?.starts_on ?? null, earliest);

  /* The unit is resolved BEFORE the peer read, so the peer read is already
   * scoped to (positional unit ∩ group filter ∩ live squad) and there is no
   * moment at which this page holds wellness rows for athletes it is not
   * entitled to aggregate. */
  const unit = await resolvePositionalUnit(db, orgId, athleteId, { source: 'group', groupIds });

  /* The athlete's own entries reach back an extra ROLLING_WINDOW days so the
   * baseline is already established on the FIRST day of the visible window —
   * without the lead-in, the ribbon would be missing for the first two weeks of
   * every period and a coach would read that as "no baseline exists" rather
   * than "the chart started here". Peers get the visible window only: their
   * numbers are period means, not bands, so the lead-in would silently widen
   * the comparison past the window the caption names. */
  const [ownEntries, peerEntries] = await Promise.all([
    fetchWellnessByAthlete(db, athleteId, { from: addDays(range.from, -ROLLING_WINDOW), to: range.to }),
    unit && unit.athleteIds.length > 0
      ? fetchWellnessForAthletes(db, unit.athleteIds, { from: range.from, to: range.to })
      : Promise.resolve<WellnessEntry[]>([]),
  ]);

  const visible = ownEntries.filter((e) => e.entry_date !== null && e.entry_date >= range.from);
  const dates = datesIn(addDays(range.from, -ROLLING_WINDOW), range.to);
  const fullSeries = wellnessSeries(ownEntries, dates, 'readiness', ROLLING_WINDOW);
  const chartSeries = fullSeries.filter((p) => p.date >= range.from);

  const submitted = visible.length;
  const latest = visible[visible.length - 1] ?? null;
  const latestReadiness = latest ? (latest.readiness_score ?? readiness(latest)) : null;

  // Per-athlete means over the window, keyed by athlete — the only shape the
  // positional summariser accepts, and deliberately the only shape this page
  // ever builds from peer data (no names, no ids paired with a rendered value).
  const peerByAthlete = new Map<string, WellnessEntry[]>();
  for (const e of peerEntries) {
    if (!e.athlete_id) continue;
    const list = peerByAthlete.get(e.athlete_id) ?? [];
    list.push(e);
    peerByAthlete.set(e.athlete_id, list);
  }
  function peerMeans(metric: 'readiness' | (typeof SCALES)[number]['key']): Map<string, number> {
    const out = new Map<string, number>();
    for (const [id, entries] of peerByAthlete) {
      const m = meanOf(entries, metric);
      if (m !== null) out.set(id, m);
    }
    return out;
  }

  const bands: PositionalBand[] = unit
    ? [
        summarisePositional(athleteId, peerMeans('readiness'), {
          key: 'readiness',
          label: 'Readiness',
          unit: ' of 100',
          decimals: 0,
        }),
        ...SCALES.map((s) =>
          summarisePositional(athleteId, peerMeans(s.key), {
            key: s.key,
            label: s.label,
            unit: s.unit,
            decimals: s.decimals,
          }),
        ),
      ]
    : [];

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/squad">Squad overview</Link> ·{' '}
            <Link href={`/squad/${athleteId}`}>
              {athlete.first_name} {athlete.last_name}
            </Link>
          </p>
          <h1>Wellness</h1>
        </div>
      </div>

      {/* The control is page-wide here and genuinely means it — unlike the
        * player profile, every panel below follows it except the 14-day
        * baseline, which is a BASELINE and not a view window. Said out loud
        * rather than left for a coach to infer from a ribbon that did not
        * move. */}
      {/* The scope sentence goes with the control that made it necessary. A
          CLIPPED window still means the label and the data differ, so it stays. */}
      {range.clipped ? (
        <p className="cap" style={{ margin: '0 0 12px' }}>
          {range.label} is clipped to the two-year maximum this app reads in one window.
        </p>
      ) : null}

      <div className="pp-col">


        <section className="card pp-card" aria-labelledby="w-summary-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="w-summary-title" style={{ margin: 0 }}>
              Readiness
            </h2>
            <span className="num s">
              {submitted} of {range.days} day{range.days === 1 ? '' : 's'} submitted
            </span>
          </div>

          {/* Availability status ONLY. Rule 3: a coach sees the status word,
            * never the diagnosis behind it, and this page carries no injury
            * record at all so there is nothing here to gate. */}
          <p className="pp-goal-line" style={{ marginTop: 10 }}>
            <span className="pp-goal-label">Availability:</span>{' '}
            <Pill status={availabilityStatus(athlete.availability?.status ?? null)} />
            <span className="cap" style={{ marginInlineStart: 8 }}>
              status only &mdash; clinical detail is medical&apos;s, not this page&apos;s
            </span>
          </p>

          <div className="pp-macro-tiles" style={{ marginTop: 12 }}>
            <div className="pp-macro-tile">
              <p className="num pp-macro-value" style={{ margin: 0 }}>
                {latestReadiness !== null ? Math.round(latestReadiness) : '—'}
              </p>
              <p className="pp-macro-label" style={{ margin: 0 }}>
                latest
              </p>
            </div>
            <div className="pp-macro-tile">
              <p className="num pp-macro-value" style={{ margin: 0 }}>
                {meanOf(visible, 'readiness') !== null ? Math.round(meanOf(visible, 'readiness') as number) : '—'}
              </p>
              <p className="pp-macro-label" style={{ margin: 0 }}>
                mean, this period
              </p>
            </div>
            <div className="pp-macro-tile">
              <p className="num pp-macro-value" style={{ margin: 0 }}>
                {range.days > 0 ? Math.round((submitted / range.days) * 100) : 0}%
              </p>
              <p className="pp-macro-label" style={{ margin: 0 }}>
                submitted
              </p>
            </div>
          </div>

          {/* WellnessChart, not a second sparkline written for this page. It
            * already does everything this chart needs and one thing a fork
            * would have got wrong: it SPLITS THE VALUE LINE AT EVERY MISSING
            * DAY rather than interpolating across it, because a missing entry
            * and a bad entry are different facts. It is a plain server-rendered
            * SVG with no client JS and no chart library, so mounting it on a
            * staff route costs nothing — the athlete's own My Data screen is
            * simply its first caller, not its owner. The one consequence worth
            * naming: this chart is shared, so a change made for one audience
            * lands on the other. */}
          {submitted === 0 ? (
            <EmptyState
              headingLevel={3}
              title="Nothing submitted in this window"
              body="An empty chart with axes on it looks like a chart that failed. There are no entries between these dates — widen the period, or check the compliance screen for whether any were expected."
            />
          ) : (
            <>
              <div style={{ marginTop: 12 }}>
                <WellnessChart
                  series={chartSeries}
                  timezone={timezone}
                  min={0}
                  max={100}
                  ticks={READINESS_TICKS}
                  title={`Readiness for ${athlete.first_name} ${athlete.last_name}, ${range.label.toLowerCase()}`}
                />
              </div>
              {/* Inside the branch, not below it: a legend for a chart that was
                * not drawn describes something the reader cannot see and reads
                * as a rendering failure. */}
              <p className="cap" style={{ marginTop: 6 }}>
                A day with no entry is a gap, never a zero. The shaded area and dashed line are their
                own {ROLLING_WINDOW}-day mean &plusmn; 1 SD &mdash; what is normal for them &mdash;
                drawn only where there are enough observations to have one.
              </p>
            </>
          )}
        </section>

        <section className="card pp-card" aria-labelledby="w-scales-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="w-scales-title" style={{ margin: 0 }}>
              What they reported
            </h2>
            <span className="num s">means over {range.label.toLowerCase()}</span>
          </div>
          <p className="pc-intro">
            Every scale runs <b>5 is the best</b>, soreness included &mdash; a high soreness score means
            less sore, not more. Same convention as the athlete&apos;s own form and as
            wellness_compute_readiness.
          </p>
          {submitted === 0 ? (
            <EmptyState
              headingLevel={3}
              title="Nothing submitted in this window"
              body="No wellness entries were submitted between these dates, so there is nothing to average. Widen the period, or check the compliance screen for whether entries were expected."
            />
          ) : (
            SCALES.map((s) => {
              const m = meanOf(visible, s.key);
              return (
                <div className="pc-row" key={s.key}>
                  <div className="pc-row-top">
                    <span className="pc-row-name">{s.label}</span>
                    <span className="num pc-row-value">
                      {m !== null ? `${formatNumber(m, s.decimals)}${s.unit}` : '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {unit ? (
          <PositionalContext
            title="Compared with their position"
            titleId="w-positional-title"
            scopeLine={positionalScopeLine(unit, groups, groupIds)}
            rows={bands}
          />
        ) : (
          <section className="card pp-card" aria-labelledby="w-nopos-title">
            <h2 className="card-title" id="w-nopos-title">
              Compared with their position
            </h2>
            <EmptyState
              headingLevel={3}
              title="No positional unit on record"
              body={`${athlete.first_name} is not a member of any positional group, so there is no set of players in their position to compare against. Positional groups are managed in Settings › Groups; a group with type "positional" is what this comparison reads.`}
            />
          </section>
        )}
      </div>
    </>
  );
}
