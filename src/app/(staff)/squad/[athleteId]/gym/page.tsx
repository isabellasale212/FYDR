import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PeriodSelector } from '@/components/PeriodSelector/PeriodSelector';
import { PositionalContext } from '@/components/PositionalContext/PositionalContext';
import { AthleteDomainDenied, ViewOnlyNotice } from '@/components/AthleteDomainShell/AthleteDomainShell';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { loadAthleteDomainContext } from '@/lib/athleteDomain.server';
import { addDays, daysBetween, enumLabel, formatDate, formatNumber } from '@/lib/format';
import { resolveRange, type RangeKey } from '@/lib/period';
import { fetchLatestBodyMassForAthletes } from '@/lib/queries/bodyComposition';
import {
  fetchActiveOverridesForAthlete,
  fetchAthleteProgrammeAssignments,
  fetchBestSetLoadsForAthletes,
  fetchEarliestGymSessionDate,
  fetchExerciseNames,
  fetchGymSessionStatsForAthletes,
  fetchProgrammeDetail,
  fetchProgrammeExerciseIndex,
  fetchRecentGymSessions,
  type AthleteAssignment,
  type GymAthleteStats,
} from '@/lib/queries/programmes';
import {
  POSITIONAL_MIN_N,
  positionalScopeLine,
  resolvePositionalUnit,
  summarisePositional,
  type PositionalBand,
} from '@/lib/queries/positionalContext';

export const metadata = { title: 'Gym · Fydr' };

/* ===========================================================================
 * /squad/[athleteId]/gym — one athlete's gym work, VIEW ONLY.
 *
 * The profile's Gym chip used to go straight to
 * /programmes/[id]/athlete/[athleteId] when an active programme existed, and to
 * be visibly disabled when one did not. That was the honest answer at the time
 * — there was no per-athlete gym page to send anyone to — but it answered a
 * narrower question than the client asked: the programme view shows what he is
 * PRESCRIBED, and says nothing about what he has actually LIFTED. This page is
 * both, plus the positional comparison, and the prescription view is now one
 * link away from it rather than in its place.
 *
 * VIEW ONLY, per "dont allow editing of gym, nutrition, or wellness in players
 * profile just make it veiwable and only editable by the staff incharge". The
 * link-out is the programme builder, and WHO owns that edit is not one answer:
 *
 *   a gym programme    the COACH authors it
 *   a rehab programme  MEDICAL authors it
 *
 * That split is real and enforced in the database, not a UI nicety —
 * /programmes/[id]/athlete/[athleteId] computes exactly
 * `(isCoach && type !== 'rehab') || (isMedical && type === 'rehab')`, and
 * migration 0022's programme_assignments policies enforce the same. So this
 * page names the owner of the specific programme in front of the reader rather
 * than saying "a coach" and being wrong half the time in a rehab squad.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE FIXES ON THE WAY PAST
 * ---------------------------------------------------------------------------
 *
 * GROUP-ASSIGNED PROGRAMMES WERE INVISIBLE. queries/playerProfile.ts builds its
 * programme banner from programme_assignments with `.eq('athlete_id', ...)`
 * alone, so an athlete whose gym programme was assigned to Forwards rather than
 * to him by name showed NO programme on his profile — and the Gym chip was
 * therefore rendered disabled, with a tooltip saying he had no active gym
 * programme, for an athlete who had one. fetchAthleteProgrammeAssignments does
 * the union (see its own header). The profile banner is left as it is: fixing
 * it is a change to a shipped screen and belongs in its own change, but it is
 * real and it is written down here.
 *
 * SUSPENDED IS NOT ABSENT. CLAUDE.md §6's rehab exception suspends a gym
 * assignment rather than cancelling it (migration 0050). Filtering to active
 * would tell a coach an athlete in rehab has no gym programme at all, when the
 * true answer — "suspended, because he is on rehab" — is the one they need.
 *
 * ---------------------------------------------------------------------------
 * THE POSITIONAL COMPARISON: 'group', AND WHAT IT DELIBERATELY DOES NOT SHOW
 * ---------------------------------------------------------------------------
 *
 * Same grouping queries/trainingReport.ts's "vs unit" lens already uses — the
 * coach-defined `positional` group — so "vs unit" means one thing on the
 * training report and on this page.
 *
 * THREE CARDS, THREE QUESTIONS.
 *
 *   WORKLOAD    sessions completed, mean session volume, mean session RPE —
 *               how much work, how heavy, how hard it felt.
 *   STRENGTH    the heaviest working set he logged for each lift, per lift.
 *   RELATIVE    the same set divided by his body mass, per lift.
 *
 * THE STRENGTH CARDS REVERSE A DECISION THIS FILE USED TO RECORD. The shipped
 * version of this page (commit 87b0587) argued in this comment that a strength
 * comparison could only be "a ranking of named team-mates by how much they
 * lift", citing migration 0016. That was wrong twice over — 0016 bars wellness
 * and body composition by name and for reasons that do not reach a squat
 * number, and the band-and-marker shape the other three rows already use was
 * available all along. queries/positionalContext.ts's header now carries the
 * correction in full. The comparison is what the client asked for and it is
 * built here, through the same summarisePositional and the same
 * PositionalContext, with no second mechanism and no peer name anywhere.
 *
 * PER LIFT, NEVER "STRENGTH". A coach wants the squat, the bench and the trap
 * bar, and an aggregate across them is close to meaningless — a heavy squat and
 * a light press average to a number describing nobody. Rows are the exercises
 * HE logged in this window, so this is his page answering about his lifts, and a
 * lift too thin in the unit suppresses ITS OWN ROW rather than the panel.
 *
 * NOT A 1RM, AND NOT AN ESTIMATE OF ONE. See fetchBestSetLoadsForAthletes's
 * header: the 1RM path exists in the schema and is empty in every seeded org,
 * and estimating one off a submaximal set is open question O-389, answered by
 * omission in migration 0043. The screen says so rather than implying a maximum.
 * ======================================================================== */

/** `day` disabled with its reason. Every figure here is a count or a mean over
 *  a block of training, and one day is one session at most. */
const GYM_PERIODS: readonly RangeKey[] = ['week', 'month', 'season', 'year', 'all'];
const GYM_PERIOD_REASONS: Partial<Record<RangeKey, string>> = {
  day: 'these are counts and means over a block of training, and one day is one session',
};

/** The session table's row cap. fetchRecentGymSessions caps in the DATABASE on
 *  a descending order (its own header explains why a cap, not paging, is right
 *  for a list nobody scrolls) and this asks for one more than it shows, so a
 *  full page means "there are more" and the caption can say so rather than
 *  quietly ending. The POSITIONAL card does not use this read and is not capped
 *  — it pages, because a mean over a truncated set is wrong rather than short. */
const SESSION_ROWS = 40;

/** How far back a weigh-in may sit and still be a legitimate divisor for a lift
 *  logged inside the selected period.
 *
 *  A ratio is only as current as its denominator: a mass measured two seasons
 *  ago behind a set lifted last week renders a figure that looks precise and is
 *  wrong, and nothing on the bar would say so. Six months is the loosest bound
 *  that is still defensible for a squad weighing in on any routine at all —
 *  Ashcombe's own weigh-ins run fortnightly — and an athlete with nothing inside
 *  it gets NO ratio rather than a stale one. The row states its own n, so a lift
 *  whose unit is thin on weigh-ins is visibly thin rather than quietly averaged
 *  over whoever happened to stand on the scales. */
const BODY_MASS_LOOKBACK_DAYS = 180;

function assignmentOwner(a: AthleteAssignment): string {
  return a.programmeType === 'rehab' ? 'medical staff' : 'the coach who authors it';
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AthleteGymPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  const ctx = await loadAthleteDomainContext(athleteId, sp, { allowed: GYM_PERIODS });
  if (ctx.denied) return <AthleteDomainDenied orgName={ctx.orgName} domain="Gym" />;

  const { db, orgId, timezone, today, athlete, groups, groupIds, season, periodKey, coercedFrom, expressed } = ctx;

  const earliest = await fetchEarliestGymSessionDate(db, orgId);
  const range = resolveRange(periodKey, today, season?.starts_on ?? null, earliest);

  const [unit, assignments, sessions] = await Promise.all([
    resolvePositionalUnit(db, orgId, athleteId, { source: 'group', groupIds }),
    fetchAthleteProgrammeAssignments(db, orgId, athleteId),
    fetchRecentGymSessions(db, athleteId, range.from, range.to, SESSION_ROWS + 1),
  ]);

  const truncated = sessions.length > SESSION_ROWS;
  const visibleSessions = truncated ? sessions.slice(0, SESSION_ROWS) : sessions;

  /* The primary assignment — active first, most recent start next
   * (fetchAthleteProgrammeAssignments sorts it that way), so this is "the thing
   * he is on now" and everything else on the card is context beneath it. It is
   * also what the view-only link points at, which is why it is picked here once
   * rather than at each use site. */
  const primary = assignments[0] ?? null;

  /* Tailoring for this athlete, on the primary programme only. Two round trips
   * to get there (detail → session ids → prescribed-exercise ids) because
   * exercise_overrides keys off programme_exercise_id and nothing in the schema
   * joins an override to a programme directly. Same path
   * /programmes/[id]/athlete/[athleteId] already takes. */
  const detail = primary ? await fetchProgrammeDetail(db, orgId, primary.programmeId) : null;
  const sessionIds = (detail?.blocks ?? []).flatMap((b) => b.sessions.map((s) => s.id));
  const exerciseIndex = sessionIds.length > 0 ? await fetchProgrammeExerciseIndex(db, sessionIds) : [];
  const overrides =
    exerciseIndex.length > 0
      ? await fetchActiveOverridesForAthlete(db, orgId, exerciseIndex.map((e) => e.id), athleteId)
      : [];

  const peerStats =
    unit && unit.athleteIds.length > 0
      ? await fetchGymSessionStatsForAthletes(db, orgId, unit.athleteIds, { from: range.from, to: range.to })
      : new Map<string, GymAthleteStats>();

  /* MISSING MEANS ZERO FOR A COUNT, AND MEANS NOTHING FOR A MEAN. The
   * distinction is the difference between a right number and a flattering one.
   *
   * fetchGymSessionStatsForAthletes only creates an entry for an athlete who
   * logged at least one session, so seeding the count map from the stats alone
   * would compute "sessions completed" over the athletes who trained rather
   * than over the unit. In a unit of twelve where six trained, the median would
   * read as though everybody trained — and an athlete who did nothing would
   * render an em dash on this row while the Sessions logged card directly above
   * said "0 completed". Somebody who did no gym work did zero sessions; that is
   * a real, known value and it belongs in the denominator.
   *
   * Volume and RPE are the opposite case and are deliberately NOT seeded: an
   * athlete with no completed session has no mean session volume. Zero would
   * assert he lifted nothing when the truth is that nothing was measured, and
   * it would drag the unit's median toward the floor. Each row states its own n
   * so the difference is visible rather than implied. */
  const sessionCounts = new Map<string, number>(unit ? unit.athleteIds.map((id) => [id, 0]) : []);
  const meanVolumes = new Map<string, number>();
  const meanRpes = new Map<string, number>();
  for (const [id, s] of peerStats) {
    sessionCounts.set(id, s.sessions);
    if (s.meanVolumeKg !== null) meanVolumes.set(id, s.meanVolumeKg);
    if (s.meanRpe !== null) meanRpes.set(id, s.meanRpe);
  }

  const bands: PositionalBand[] = unit
    ? [
        summarisePositional(athleteId, sessionCounts, {
          key: 'sessions',
          label: 'Sessions completed',
          unit: '',
          decimals: 0,
        }),
        summarisePositional(athleteId, meanVolumes, {
          key: 'volume',
          label: 'Mean session volume',
          unit: ' kg',
          decimals: 0,
        }),
        summarisePositional(athleteId, meanRpes, {
          key: 'rpe',
          label: 'Mean session RPE',
          unit: ' of 10',
          decimals: 1,
        }),
      ]
    : [];

  /* ---------------------------------------------------------------------
   * STRENGTH, PER LIFT
   * ---------------------------------------------------------------------
   *
   * TWO PASSES, AND THE FIRST ONE IS WHAT KEEPS THE SECOND HONEST IN SIZE.
   * Pass one reads only HIM, which answers "which lifts is this page even
   * about" — the exercises he logged a working set for inside the period. Pass
   * two reads the unit, narrowed to exactly those exercises. Without that
   * narrowing, `all` over a full positional unit pulls every set of every
   * exercise the club has ever logged (gym_set_logs is the largest athlete-data
   * table here) to answer a question about four barbell movements.
   *
   * ROWS ARE HIS LIFTS, NOT THE UNIT'S. A squat he never performed has no
   * personal number to mark against the band, and a row that is all band and no
   * marker is the unit's business rather than his. If he logged nothing loaded
   * in the window there are no rows and the card says so.
   *
   * HIS OWN VALUE COMES OUT OF THE PEER MAP, NOT OUT OF PASS ONE, even though
   * pass one has it. That is deliberate: summarisePositional derives BOTH the
   * marker and n from the one map it is given, so folding his value in when the
   * group filter has excluded him would inflate n by one and drop his number
   * into the band he is being compared against. When he is outside the filter
   * his marker is absent and the card's intro says why — the same behaviour the
   * three workload rows above already have, for the same reason. */
  const subjectBests = unit
    ? ((await fetchBestSetLoadsForAthletes(db, orgId, [athleteId], { from: range.from, to: range.to })).get(
        athleteId,
      ) ?? new Map<string, number>())
    : new Map<string, number>();
  const strengthExerciseIds = [...subjectBests.keys()];

  const strengthComparable = unit !== null && unit.athleteIds.length > 0 && strengthExerciseIds.length > 0;
  let peerBests = new Map<string, Map<string, number>>();
  let exerciseNames = new Map<string, string>();
  if (unit && strengthComparable) {
    const [bests, names] = await Promise.all([
      fetchBestSetLoadsForAthletes(
        db,
        orgId,
        unit.athleteIds,
        { from: range.from, to: range.to },
        { exerciseIds: strengthExerciseIds },
      ),
      fetchExerciseNames(db, orgId, strengthExerciseIds),
    ]);
    peerBests = bests;
    exerciseNames = names;
  }

  /* Mass for the DIVISOR only, and only for the peer set the band is drawn
   * over. Read as at the END of the selected period rather than as at today, so
   * a ratio on a season-long window is the mass that actually stood behind
   * those lifts — and floored at BODY_MASS_LOOKBACK_DAYS before the window
   * opens, so a lift at the start of a long window still has a weigh-in it can
   * legitimately reach back to. */
  const bodyMass =
    unit && strengthComparable
      ? await fetchLatestBodyMassForAthletes(db, orgId, unit.athleteIds, {
          since: addDays(range.from, -BODY_MASS_LOOKBACK_DAYS),
          asOf: range.to,
        })
      : new Map<string, number>();

  /* Alphabetical, not by peer count or by load. The row order must not move
   * when a team-mate logs a set: a coach comparing this page against last
   * week's is reading the same list in the same places.
   *
   * Gated on strengthComparable rather than on strengthExerciseIds alone: with
   * an empty peer set (a unit of one, or a filter that leaves nobody in scope)
   * every row would be a name with no marker and no band, which reads as broken
   * data rather than as an absent comparison. The card's own empty state says
   * it properly. */
  const strengthRows = strengthComparable
    ? strengthExerciseIds
        .map((id) => ({ id, name: exerciseNames.get(id) ?? 'Retired exercise' }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const loadBands: PositionalBand[] = strengthRows.map((ex) => {
    const values = new Map<string, number>();
    for (const [id, byExercise] of peerBests) {
      const best = byExercise.get(ex.id);
      if (best !== undefined) values.set(id, best);
    }
    return summarisePositional(athleteId, values, {
      key: `load-${ex.id}`,
      label: ex.name,
      unit: ' kg',
      decimals: 0,
    });
  });

  const relativeBands: PositionalBand[] = strengthRows.map((ex) => {
    const values = new Map<string, number>();
    for (const [id, byExercise] of peerBests) {
      const best = byExercise.get(ex.id);
      const mass = bodyMass.get(id);
      if (best !== undefined && mass !== undefined && mass > 0) values.set(id, best / mass);
    }
    return summarisePositional(athleteId, values, {
      key: `rel-${ex.id}`,
      label: ex.name,
      // "1.42×" — the intro says what it is a multiple of. Spelling it out per
      // figure makes the band line ("middle half 1.30×–1.55×") unreadable.
      unit: '×',
      decimals: 2,
    });
  });

  /* No weigh-in anywhere in the peer set means there is no divisor to draw
   * with, and four rows of em dashes would say that badly. The card states the
   * absence and where the missing data is entered instead. */
  const anyMassOnFile = relativeBands.some((b) => b.n > 0);

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
          <h1>Gym</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <GroupFilter groups={groups} selected={groupIds} />
          <PeriodSelector
            value={periodKey}
            allowed={GYM_PERIODS}
            reasons={GYM_PERIOD_REASONS}
            season={season}
            sticky={expressed && coercedFrom === null}
            ariaLabel="Period for the session history and the positional comparisons"
          />
        </div>
      </div>

      <p className="cap" style={{ margin: '0 0 12px' }}>
        {range.label} ({range.days} day{range.days === 1 ? '' : 's'}, {formatDate(range.from, timezone)} to{' '}
        {formatDate(range.to, timezone)}) applies to the session history and to the three positional
        comparisons, including which lifts appear and what counts as a best set. The programme and its
        tailoring are what is prescribed <b>now</b> and are not windowed.
        {range.clipped ? ' Clipped to the two-year maximum this app reads in one window.' : ''}
        {coercedFrom !== null
          ? ` "${coercedFrom}" is not available on this screen, so ${range.label.toLowerCase()} is shown instead.`
          : ''}
      </p>

      <div className="pp-col">
        <ViewOnlyNotice
          what={primary ? `“${primary.name}”` : 'Gym programmes'}
          owner={primary ? assignmentOwner(primary) : 'a coach, or by medical for a rehab programme'}
          href={primary ? `/programmes/${primary.programmeId}` : '/programmes'}
          linkLabel={primary ? 'Open the programme builder' : 'Open gym programmes'}
          note={
            primary
              ? `A gym programme is authored by a coach and a rehab programme by medical — the database enforces that split, not just the screen. Per-athlete tailoring (a substitution, a load change, an exemption) is made on the athlete view of the programme, linked below; nothing on this page changes anything.`
              : 'Nothing is assigned to this athlete yet, directly or through one of his groups.'
          }
        />

        <section className="card pp-card" aria-labelledby="g-prog-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="g-prog-title" style={{ margin: 0 }}>
              Programme
            </h2>
            <span className="mono s">
              {assignments.length} assignment{assignments.length === 1 ? '' : 's'} on record
            </span>
          </div>
          {assignments.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="No gym programme assigned"
              body={`${athlete.first_name} is not on a programme by name and is not in a group that has one. Assign one from Gym programmes.`}
            />
          ) : (
            assignments.map((a) => {
              const weeksElapsed = Math.floor(daysBetween(a.startsOn, today) / 7) + 1;
              const weekNow =
                a.durationWeeks !== null
                  ? Math.min(Math.max(weeksElapsed, 1), a.durationWeeks)
                  : Math.max(weeksElapsed, 1);
              return (
                <div className="pc-row" key={a.assignmentId}>
                  <div className="pc-row-top">
                    <span className="pc-row-name">
                      {a.name}{' '}
                      <span className={a.status === 'active' ? 'pill pill-good' : 'pill pill-neutral'}>
                        {enumLabel(a.status)}
                      </span>
                    </span>
                    <span className="mono pc-row-value">
                      {a.durationWeeks !== null ? `week ${weekNow} of ${a.durationWeeks}` : `week ${weekNow}`}
                    </span>
                  </div>
                  <div className="pc-row-bottom">
                    <span className="pc-row-band">
                      {enumLabel(a.programmeType)} · assigned{' '}
                      {a.via.kind === 'group'
                        ? `through the ${a.via.groupName ?? 'group'} group`
                        : 'to him directly'}
                      {a.goal ? ` · ${a.goal}` : ''}
                      {a.status === 'suspended'
                        ? ' — suspended while he is on a rehab programme, not cancelled'
                        : ''}
                    </span>
                    <span className="mono pc-row-meta">
                      from {formatDate(a.startsOn, timezone)}
                      {a.endsOn ? ` to ${formatDate(a.endsOn, timezone)}` : ''}
                    </span>
                  </div>
                  <p style={{ margin: '8px 0 0' }}>
                    <Link href={`/programmes/${a.programmeId}/athlete/${athleteId}`} className="pp-link">
                      What this resolves to for {athlete.first_name} &rsaquo;
                    </Link>
                  </p>
                </div>
              );
            })
          )}
        </section>

        <section className="card pp-card" aria-labelledby="g-tailor-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="g-tailor-title" style={{ margin: 0 }}>
              Tailoring
            </h2>
            <span className="mono s">
              {primary ? primary.name : 'no programme'} · {overrides.length} active
            </span>
          </div>
          {overrides.length === 0 ? (
            <p className="cap" style={{ marginTop: 8 }}>
              {primary
                ? `No exercise is substituted, re-loaded or exempted for ${athlete.first_name} on this programme — he is doing it as written.`
                : 'Tailoring is per programme, and nothing is assigned.'}
            </p>
          ) : (
            overrides.map((o) => (
              <div className="pc-row" key={o.id}>
                <div className="pc-row-top">
                  <span className="pc-row-name">{o.exercise_name}</span>
                  <span className="mono pc-row-value">{enumLabel(o.override_type)}</span>
                </div>
                <div className="pc-row-bottom">
                  <span className="pc-row-band">
                    {o.session_name}
                    {o.reason ? ` — ${o.reason}` : ''}
                  </span>
                  <span className="mono pc-row-meta">
                    {o.expires_at ? `until ${formatDate(o.expires_at, timezone)}` : 'no end date'}
                  </span>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card pp-card" aria-labelledby="g-sessions-title">
          <div className="pp-card-head">
            <h2 className="card-title" id="g-sessions-title" style={{ margin: 0 }}>
              Sessions logged
            </h2>
            <span className="mono s">
              {visibleSessions.length}
              {truncated ? '+' : ''} completed in {range.label.toLowerCase()}
            </span>
          </div>
          <p className="pc-intro">
            What he actually did, as he logged it. Completed sessions only &mdash; a session left in
            progress is not work done and is not counted.
          </p>
          {visibleSessions.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="No completed sessions in this window"
              body="Nothing was logged and completed between these dates. Widen the period, or check whether he is logging in the app at all."
            />
          ) : (
            visibleSessions.map((s) => (
              <div className="pc-row" key={s.id}>
                <div className="pc-row-top">
                  <span className="pc-row-name">{s.session_name ?? 'Gym session'}</span>
                  <span className="mono pc-row-value">
                    {s.total_volume_kg !== null ? `${formatNumber(s.total_volume_kg, 0)} kg` : '—'}
                  </span>
                </div>
                <div className="pc-row-bottom">
                  <span className="pc-row-band">
                    {s.set_count} set{s.set_count === 1 ? '' : 's'}
                    {s.session_rpe !== null ? ` · RPE ${formatNumber(s.session_rpe, 1)}` : ''}
                  </span>
                  <span className="mono pc-row-meta">{formatDate(s.entry_date, timezone)}</span>
                </div>
              </div>
            ))
          )}
          {truncated ? (
            <p className="cap" style={{ marginTop: 10 }}>
              Showing the {SESSION_ROWS} most recent of more than that in this window. The positional
              comparisons below are not capped &mdash; they read every session in the window, because a
              mean over a truncated set is a wrong number rather than a short list, and a best set found
              in the most recent forty is not the best set.
            </p>
          ) : null}
        </section>

        {unit ? (
          <PositionalContext
            title="Workload, compared with his position"
            titleId="g-positional-title"
            scopeLine={positionalScopeLine(unit, groups, groupIds)}
            intro={`How much gym work he has done this period against the spread across ${unit.name} — the same positional unit the training report benchmarks load against. Volume is the mean per completed session, not a total, so an athlete who trained twice is not compared with one who trained twenty. The bar is the unit's middle half and its median, the dot is him; nobody is named or ranked.${unit.subjectIncluded ? '' : ' He is outside the current group filter, so the band is his unit without him.'}`}
            rows={bands}
          />
        ) : (
          <section className="card pp-card" aria-labelledby="g-nopos-title">
            <h2 className="card-title" id="g-nopos-title">
              Compared with his position
            </h2>
            <EmptyState
              headingLevel={3}
              title="No positional unit on record"
              body={`${athlete.first_name} is not a member of any positional group, so there is no set of players in his position to compare against. Positional groups are managed in Settings › Groups; a group with type "positional" is what this comparison reads.`}
            />
          </section>
        )}

        {unit ? (
          <>
            {loadBands.length > 0 ? (
              <PositionalContext
                title="Strength, compared with his position"
                titleId="g-strength-title"
                scopeLine={positionalScopeLine(unit, groups, groupIds)}
                intro={`The heaviest single working set he logged for each lift in this period, against the spread across ${unit.name}. Warm-ups and any set logged without a load or without a completed repetition are excluded. This is load moved, not a one-rep max: two players' best sets can sit at different repetitions, and Fydr does not estimate a maximum from a submaximal set — a tested 1RM belongs in Testing, linked to the exercise there. Rows are the lifts he actually performed in this window; a lift too thin in the unit withholds its own median and keeps the rest.${unit.subjectIncluded ? '' : ' He is outside the current group filter, so the band is his unit without him.'}`}
                rows={loadBands}
              />
            ) : (
              <section className="card pp-card" aria-labelledby="g-nostrength-title">
                <h2 className="card-title" id="g-nostrength-title">
                  Strength, compared with his position
                </h2>
                <EmptyState
                  headingLevel={3}
                  title="No loaded set to compare"
                  body={
                    strengthExerciseIds.length === 0
                      ? `${athlete.first_name} logged no working set carrying a load in this window — bodyweight and warm-up sets are not a strength figure. Widen the period, or check what he is actually logging in the app.`
                      : `He logged loaded sets, but no player in ${unit.name} is in scope after the group filter, so there is nothing to compare them against. Clear or widen the filter.`
                  }
                />
              </section>
            )}

            {anyMassOnFile ? (
              <PositionalContext
                title="Relative strength, compared with his position"
                titleId="g-relative-title"
                scopeLine={positionalScopeLine(unit, groups, groupIds)}
                intro={`The same best set, divided by body mass — the comparison that separates a prop from a wing inside one unit, where the absolute figure above mostly separates the heavy from the light. Body mass is the divisor and nothing else: no player's mass is shown here, no peer is named, and the row is withheld unless ${POSITIONAL_MIN_N} players in the unit have both a logged set and a recent weigh-in, which is why a unit that does not weigh in regularly will see fewer bands here than above. Mass is each player's latest reading on or before the end of this period and no more than ${BODY_MASS_LOOKBACK_DAYS} days before it starts; a lift with no weigh-in behind it gets no ratio rather than a stale one.`}
                rows={relativeBands}
              />
            ) : loadBands.length > 0 ? (
              <section className="card pp-card" aria-labelledby="g-norel-title">
                <h2 className="card-title" id="g-norel-title">
                  Relative strength, compared with his position
                </h2>
                <EmptyState
                  headingLevel={3}
                  title="No weigh-in to divide by"
                  body={`Nobody in ${unit.name} who is in scope has a body mass recorded within ${BODY_MASS_LOOKBACK_DAYS} days of this period, so there is no divisor and no ratio to draw. Weigh-ins are recorded against each athlete under Body composition; once the unit has them, this card compares load per kilogram without showing anyone's mass.`}
                />
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
