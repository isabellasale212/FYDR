import Link from 'next/link';
import { PositionalContext } from '@/components/PositionalContext/PositionalContext';
import { AthleteDomainDenied } from '@/components/AthleteDomainShell/AthleteDomainShell';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { loadAthleteDomainContext } from '@/lib/athleteDomain.server';
import { enumLabel, formatDate, formatNumber, mdLabel } from '@/lib/format';
import { massState } from '@/lib/nutritionRules';
import { resolveRange, type RangeKey } from '@/lib/period';
import {
  fetchBodyCompositionEntries,
  fetchBodyCompositionForAthletes,
  fetchEarliestBodyCompositionDate,
  type BodyCompositionEntry,
} from '@/lib/queries/bodyComposition';
import { fetchTargetRangeHistory } from '@/lib/queries/bodyMassTargetRange';
import { fetchRecentCheckins } from '@/lib/queries/nutrition';
import { fetchTargets, resolveTargetForDate } from '@/lib/queries/nutritionTargets';
import {
  positionalScopeLine,
  resolvePositionalUnit,
  summarisePositional,
  type PositionalBand,
} from '@/lib/queries/positionalContext';

export const metadata = { title: 'Nutrition · Fydr' };

/* ===========================================================================
 * /squad/[athleteId]/nutrition — one athlete's nutrition, VIEW ONLY.
 *
 * The client asked for the profile's Nutrition chip to open "a new page with
 * just that info in it", then: "dont allow editing of gym, nutrition, or
 * wellness in players profile just make it veiwable and only editable by the
 * staff incharge". So there is no stepper, no form and no save button here;
 * there is one link to /nutrition, which is where a target is authored and
 * where it has always been authored.
 *
 * The profile's own Nutrition card already said "View only — plans are managed
 * by the nutritionist" and already linked to /nutrition. This page is that card
 * with the rest of the athlete's nutrition picture around it, not a new
 * permission model.
 *
 * ---------------------------------------------------------------------------
 * CLAUDE.md RULE 8 SHAPES WHAT THIS PAGE CAN EVEN BE
 * ---------------------------------------------------------------------------
 *
 * "Athletes do not log nutrition daily. Nutrition is guidance: targets, meal
 * ideas, and training-day fuelling. There is no daily nutrition entry, no
 * per-meal macros, and no nutrition compliance domain." So there is no
 * intake-versus-target chart on this page, and there never will be — not as a
 * cut, but because the column does not and will not exist. What is real:
 *
 *   the resolved target for today   resolve_nutrition_targets (migration 0019)
 *   the plan rows behind it         nutrition_targets, athlete/group/org scoped
 *   body mass                       body_composition, and the staff target
 *                                   range (migration 0060)
 *   the weekly check-in             nutrition_checkins — rule 8's ONE stated
 *                                   exception: one question, once a week,
 *                                   three answers. A missed week is NOT
 *                                   non-compliance and this page does not
 *                                   render it as one.
 *
 * ---------------------------------------------------------------------------
 * THE STAFF TARGET RANGE IS ON THIS PAGE, AND THAT IS A DELIBERATE CALL
 * ---------------------------------------------------------------------------
 *
 * body_mass_target_ranges (migration 0060) carries four binding client rules,
 * of which the second is "the athlete NEVER sees this". This route is under
 * (staff), reached only through the coach/medical gate in
 * lib/athleteDomain.server.ts, and the table itself has no athlete select
 * policy at all — two independent layers, which is the point: a rule only one
 * layer enforces is one refactor from gone.
 *
 * Read against the fourth rule too ("never leaderboarded"): the positional card
 * below aggregates BODY MASS, not the target range. Nobody's target bounds are
 * pooled, medianed or compared. The target range appears exactly once, for this
 * athlete, on their own card.
 *
 * ---------------------------------------------------------------------------
 * THE POSITIONAL COMPARISON USES POSITION_TO_UNIT, NOT THE GROUP
 * ---------------------------------------------------------------------------
 *
 * The other two domain pages use the coach-defined `positional` group; this one
 * uses lib/nutritionRules.ts's POSITION_TO_UNIT (Front row, Second row, Back
 * row, Half backs, Centres, Back three). The argument is specific to nutrition
 * and is why "use whichever fits" was the right instruction rather than "pick
 * one":
 *
 *   Energy and protein targets are computed FROM BODY MASS (computeTargets),
 *   and body mass is precisely what separates a prop from an openside INSIDE
 *   "Forwards". A Forwards median for kilograms blends 120 kg tightheads with
 *   95 kg back-rowers and describes neither. A front-row median is the number a
 *   nutritionist actually reaches for.
 *
 *   It is also already the nutrition domain's own taxonomy — NUTRITION-SPEC's
 *   group rows are these six units and the /nutrition workspace groups by them,
 *   so this page and that one mean the same thing by "Front row".
 *
 * Its limit is honest and handled: POSITION_TO_UNIT reads free text from
 * athletes.position and maps anything it does not recognise to 'Other'.
 * resolvePositionalUnit treats 'Other' as "no unit" rather than as a seventh
 * one, and this page says so instead of drawing a median across a catch-all.
 * ======================================================================== */

/** `day` disabled with its reason. The trend and the check-in history are the
 *  two panels the control drives and both are series; a single day is one
 *  weigh-in at most and no check-in at all (a check-in is weekly). */
const NUTRITION_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];

/** Body mass is watched for drift over MONTHS. DEFAULT_RANGE (28 days) is right
 *  for most screens and wrong here for the same reason squad/[athleteId] states
 *  at length: at 28 days a coach opening this page sees a near-flat line
 *  through three or four weigh-ins, which is accurate and useless. `season`
 *  degrades to DEFAULT_RANGE on its own when the club has no season row —
 *  clampPeriod's fallback is DEFAULT_RANGE and PeriodSelector renders "This
 *  season" absent rather than disabled. */
const NUTRITION_DEFAULT_PERIOD: RangeKey = 'season';

const CHECKIN_ANSWER_CLASS: Record<string, string> = {
  yes: 'pill pill-good',
  roughly: 'pill pill-warn',
  no: 'pill pill-neutral',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AthleteNutritionPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const ctx = await loadAthleteDomainContext(athleteId, sp, {
    allowed: NUTRITION_PERIODS,
    screenDefault: NUTRITION_DEFAULT_PERIOD,
  });
  if (ctx.denied) return <AthleteDomainDenied orgName={ctx.orgName} domain="Nutrition" />;

  const { db, orgId, timezone, today, athlete, groups, groupIds, season, periodKey } = ctx;

  const earliest = await fetchEarliestBodyCompositionDate(db, orgId);
  const range = resolveRange(periodKey, today, season?.starts_on ?? null, earliest);

  const [unit, resolved, allTargets, ownHistory, targetRanges, checkins, memberships] = await Promise.all([
    resolvePositionalUnit(db, orgId, athleteId, { source: 'position', groupIds }),
    resolveTargetForDate(db, athleteId, today),
    fetchTargets(db, orgId, timezone),
    /* The athlete's own weigh-ins, whole history, unwindowed — deliberately
     * the SAME function and therefore the same headline number the player
     * profile's Body weight card shows. Two screens about one athlete's mass
     * that disagree about what they weigh is worse than either being narrow. */
    fetchBodyCompositionEntries(db, orgId, athleteId),
    fetchTargetRangeHistory(db, orgId, athleteId),
    fetchRecentCheckins(db, athleteId, range.from, range.to),
    /* This athlete's live group ids. Read by ID rather than matched on
     * athlete.group_names against the groups list: two groups in one club can
     * legally share a name (nothing in the schema forbids it), and a
     * name-matched join would then attribute another group's nutrition plan to
     * this athlete — a wrong number on screen, silently. */
    db
      .from('group_memberships')
      .select('group_id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .is('removed_at', null),
  ]);
  if (memberships.error) throw new Error(memberships.error.message);

  const liveRange = targetRanges.find((r) => r.effective_to === null) ?? null;
  const latestOwn = ownHistory.find((e) => e.body_mass_kg !== null) ?? null;
  const latestKg = latestOwn?.body_mass_kg ?? null;
  const targetState =
    liveRange && latestKg !== null
      ? massState(latestKg, { low: liveRange.target_low_kg, high: liveRange.target_high_kg })
      : null;

  /* The plan rows that actually reach this athlete: their own, their groups', and
   * the org default. Filtered here rather than in the query because fetchTargets
   * is the /nutrition workspace's squad-wide read and narrowing it there would
   * break that screen — and because the interesting thing to SHOW is that three
   * scopes exist and which one won, which needs all three in hand. */
  const athleteGroupIds = new Set((memberships.data ?? []).map((m) => m.group_id));
  const applicable = allTargets.filter(
    (t) => t.athlete_id === athleteId || (t.group_id !== null && athleteGroupIds.has(t.group_id)) || t.org_default,
  );

  /* ---- The positional comparison ------------------------------------------
   *
   * Peer body mass is PAGED (fetchBodyCompositionForAthletes already is, and
   * says why in its own header): a positional unit over a window that reaches
   * MAX_WINDOW_DAYS is tens of thousands of rows, and PostgREST would have
   * returned a silent first 1000.
   *
   * Peer targets are NOT paged, and that is a proof rather than an oversight:
   * resolve_nutrition_targets is asked for ONE date, so it returns at most one
   * row per athlete in the unit — tens of rows, three orders of magnitude below
   * the 1000-row ceiling. If this is ever widened to a date RANGE it becomes
   * athletes × days and must page. */
  const peerIds = unit ? unit.athleteIds : [];
  const [peerMassHistory, peerTargetRows] = await Promise.all([
    peerIds.length > 0
      ? fetchBodyCompositionForAthletes(db, orgId, peerIds, range.from)
      : Promise.resolve(new Map<string, BodyCompositionEntry[]>()),
    peerIds.length > 0
      ? db.rpc('resolve_nutrition_targets', { p_athlete_ids: peerIds, p_from: today, p_to: today })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (peerTargetRows.error) throw new Error(peerTargetRows.error.message);

  /* fetchBodyCompositionForAthletes returns newest-first (its own header says
   * so and the /nutrition workspace depends on it), so the first reading with a
   * mass is the latest one INSIDE the window. That is a different figure from
   * the headline above, and the card says which is which — the headline is their
   * true latest weigh-in, this is the latest one in the selected period, so the
   * comparison is like-for-like across the unit instead of pitting one
   * athlete's fresh reading against another's from last season. */
  const massInWindow = new Map<string, number>();
  for (const [id, entries] of peerMassHistory) {
    const withMass = entries.find((e) => e.body_mass_kg !== null);
    if (withMass?.body_mass_kg != null) massInWindow.set(id, withMass.body_mass_kg);
  }

  type TargetRow = { athlete_id: string | null; energy_kcal: number | null; protein_g: number | null };
  const peerTargets = new Map<string, TargetRow>();
  for (const r of (peerTargetRows.data ?? []) as unknown as TargetRow[]) {
    if (r.athlete_id) peerTargets.set(r.athlete_id, r);
  }

  const energyByAthlete = new Map<string, number>();
  const energyPerKg = new Map<string, number>();
  const proteinPerKg = new Map<string, number>();
  for (const id of peerIds) {
    const t = peerTargets.get(id);
    const kg = massInWindow.get(id);
    if (t?.energy_kcal != null) energyByAthlete.set(id, t.energy_kcal);
    // Per-kilogram figures need BOTH halves. An athlete with a target and no
    // weigh-in contributes to the absolute row and not to the per-kg ones,
    // which is why each row states its own n rather than the card stating one.
    if (t?.energy_kcal != null && kg != null && kg > 0) energyPerKg.set(id, t.energy_kcal / kg);
    if (t?.protein_g != null && kg != null && kg > 0) proteinPerKg.set(id, t.protein_g / kg);
  }

  const bands: PositionalBand[] = unit
    ? [
        summarisePositional(athleteId, massInWindow, {
          key: 'mass',
          label: 'Body mass',
          unit: ' kg',
          decimals: 1,
        }),
        summarisePositional(athleteId, energyByAthlete, {
          key: 'kcal',
          label: 'Energy target',
          unit: ' kcal',
          decimals: 0,
        }),
        summarisePositional(athleteId, energyPerKg, {
          key: 'kcalkg',
          label: 'Energy per kg',
          unit: ' kcal/kg',
          decimals: 1,
        }),
        summarisePositional(athleteId, proteinPerKg, {
          key: 'protkg',
          label: 'Protein per kg',
          unit: ' g/kg',
          decimals: 2,
        }),
      ]
    : [];

  const macro = (v: number | null | undefined, decimals = 0) =>
    v === null || v === undefined ? '—' : formatNumber(v, decimals);

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
          <h1>Nutrition</h1>
        </div>
      </div>

      {/* The scope sentence is gone with the controls that made it necessary —
          nothing on this screen is selectable any more, so there is no
          discrepancy between what was asked for and what is shown. A CLIPPED
          window is still a real difference between the label and the data, so
          that one line survives. */}
      {range.clipped ? (
        <p className="cap" style={{ margin: '0 0 12px' }}>
          {range.label} is clipped to the two-year maximum this app reads in one window.
        </p>
      ) : null}

      <div className="pp-col">

        <section className="card pp-card" aria-labelledby="n-today-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="n-today-title" style={{ margin: 0 }}>
              Targets in force today
            </h2>
            <span className="num s">
              {resolved
                ? `${enumLabel(resolved.source_scope)} plan${
                    resolved.md_specific && resolved.md_offset !== null
                      ? ` · ${mdLabel(resolved.md_offset) ?? ''}`
                      : ' · any day'
                  }`
                : 'no plan resolves for today'}
            </span>
          </div>
          {resolved ? (
            <>
              <div className="pp-macro-tiles" style={{ marginTop: 12 }}>
                {[
                  { label: 'kcal', value: macro(resolved.energy_kcal) },
                  { label: 'protein g', value: macro(resolved.protein_g) },
                  { label: 'carbs g', value: macro(resolved.carbs_g) },
                  { label: 'fat g', value: macro(resolved.fat_g) },
                  { label: 'fluid ml', value: macro(resolved.fluid_ml) },
                ].map((tile) => (
                  <div className="pp-macro-tile" key={tile.label}>
                    <p className="num pp-macro-value" style={{ margin: 0 }}>
                      {tile.value}
                    </p>
                    <p className="pp-macro-label" style={{ margin: 0 }}>
                      {tile.label}
                    </p>
                  </div>
                ))}
              </div>
              
            </>
          ) : (
            <EmptyState
              headingLevel={3}
              title="No plan resolves for today"
              body={`Nothing athlete-specific, nothing for ${athlete.first_name}'s groups, and no club default is in force for today's date. Targets are set in the nutrition workspace.`}
            />
          )}
        </section>

        <section className="card pp-card" aria-labelledby="n-plans-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="n-plans-title" style={{ margin: 0 }}>
              Every plan that reaches them
            </h2>
            <span className="num s">
              {applicable.length} live row{applicable.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="pc-intro">
            The three scopes, in the order the resolver reads them. Seeing all three is the point &mdash;
            it is the only way to tell whether they are on a plan written for them or on the club default.
          </p>
          {applicable.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="No live plans"
              body="No athlete, group or club-default target is currently in force. Nothing has been retired — nothing has been written."
            />
          ) : (
            applicable.map((t) => (
              <div className="pc-row" key={t.id}>
                <div className="pc-row-top">
                  <span className="pc-row-name">
                    {t.athlete_id
                      ? `${athlete.first_name} ${athlete.last_name}`
                      : (t.group_name ?? 'Club default')}
                  </span>
                  <span className="num pc-row-value">{macro(t.energy_kcal)} kcal</span>
                </div>
                <div className="pc-row-bottom">
                  <span className="pc-row-band">
                    {t.athlete_id ? 'athlete' : t.group_id ? 'group' : 'club default'} ·{' '}
                    {t.md_offset !== null ? (mdLabel(t.md_offset) ?? 'any day') : 'any day'} · P{' '}
                    {macro(t.protein_g)} · C {macro(t.carbs_g)} · F {macro(t.fat_g)}
                    {t.reason ? ` — ${t.reason}` : ''}
                  </span>
                  <span className="num pc-row-meta">
                    from {formatDate(t.effective_from, timezone)}
                    {t.effective_to ? ` to ${formatDate(t.effective_to, timezone)}` : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card pp-card" aria-labelledby="n-mass-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="n-mass-title" style={{ margin: 0 }}>
              Body mass
            </h2>
            <span className="num s">
              {latestOwn ? `last weighed ${formatDate(latestOwn.measured_on, timezone)}` : 'no weigh-in on record'}
            </span>
          </div>
          <p className="pp-weight-value num" style={{ margin: '6px 0 0' }}>
            {latestKg !== null ? formatNumber(latestKg, 1) : '—'}
            <span className="u"> kg</span>
          </p>

          {/* The staff-set target range (migration 0060). Named as staff's in
            * words every time, and never shown to an athlete — this route is
            * (staff) and the table has no athlete select policy, two
            * independent layers. */}
          {liveRange ? (
            <>
              <p className="pp-weight-note">
                Staff target{' '}
                <span className="num">
                  {liveRange.target_low_kg.toFixed(1)}&ndash;{liveRange.target_high_kg.toFixed(1)} kg
                </span>
                {targetState ? (
                  <>
                    {' · '}
                    <span
                      className={`pill ${
                        targetState === 'in_range' ? 'pill-good' : targetState === 'above' ? 'pill-warn' : 'pill-bad'
                      }`}
                    >
                      {targetState === 'in_range' ? 'On target' : targetState === 'above' ? 'Above target' : 'Below target'}
                    </span>
                  </>
                ) : null}
              </p>
              {liveRange.rationale ? (
                <p className="pp-weight-note" style={{ marginTop: 2 }}>
                  {liveRange.rationale}
                </p>
              ) : null}
              <p className="cap" style={{ marginTop: 6 }}>
                Set by {liveRange.set_by_name ?? 'a member of staff'} on{' '}
                {formatDate(liveRange.effective_from, timezone)}. Staff-only &mdash;{' '}
                {athlete.first_name} never sees this range in their own app, and it is never ranked
                against anybody else&apos;s. Changed in the nutrition workspace, not here.
              </p>
            </>
          ) : (
            <p className="pp-weight-note">No staff target range set.</p>
          )}
        </section>

        <section className="card pp-card" aria-labelledby="n-checkin-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="n-checkin-title" style={{ margin: 0 }}>
              Weekly check-in
            </h2>
            <span className="num s">
              {checkins.length} answered in {range.label.toLowerCase()}
            </span>
          </div>
          <p className="pc-intro">
            One question, once a week, three answers &mdash; the only nutrition entry this product asks
            an athlete for. A missed week is not non-compliance and is not counted as one.
          </p>
          {checkins.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="No check-ins in this window"
              body="Nothing was answered between these dates. That is a gap in the record, not a judgement about how they ate."
            />
          ) : (
            checkins.map((c) => (
              <div className="pc-row" key={c.id}>
                <div className="pc-row-top">
                  <span className="pc-row-name">week of {formatDate(c.week_start, timezone)}</span>
                  <span className={CHECKIN_ANSWER_CLASS[c.answer] ?? 'pill pill-neutral'}>
                    {enumLabel(c.answer)}
                  </span>
                </div>
                {c.note ? (
                  <div className="pc-row-bottom">
                    <span className="pc-row-band">{c.note}</span>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>

        {unit ? (
          <PositionalContext
            title="Compared with their position"
            titleId="n-positional-title"
            scopeLine={positionalScopeLine(unit, groups, groupIds)}
            rows={bands}
          />
        ) : (
          <section className="card pp-card" aria-labelledby="n-nopos-title">
            <h2 className="card-title" id="n-nopos-title">
              Compared with their position
            </h2>
            <EmptyState
              headingLevel={3}
              title="No positional unit for this position"
              body={
                athlete.position
                  ? `"${athlete.position}" is not one of the rugby positions this app maps onto a positional unit, so it falls to "Other" — and a median across everyone whose position was not recognised is not a comparison to people in their position. Correct the position on the player profile, or use the Wellness or Gym page, which compare against the coach-defined positional group instead.`
                  : `No position is recorded for ${athlete.first_name}, so there is no unit to compare against. Position is edited on the player profile.`
              }
            />
          </section>
        )}
      </div>
    </>
  );
}
