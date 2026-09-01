import { addDays, todayIso } from '@/lib/format';
import { fetchGroupAthleteIds, type Db } from './groups';

/* LEADERBOARD-SPEC.md's "testing wall" — the real content of the bare /leaderboards
 * route now. This is a different feature from lib/queries/leaderboards.ts (the real,
 * staff-configured, consent-gated, single-metric board system that real opted-in
 * athletes see at /me/leaderboards and /my-data/boards — moved to /leaderboards/manage,
 * untouched in substance). This file is staff-only, read-only, no opt-out, and never
 * reaches an athlete: it ranks real test_definitions/test_results (plus two real
 * wellness/compliance metrics under a "Habits" family) inside a positional unit,
 * because a hooker who is 24th in the squad on sprint speed might be the fastest
 * front row you have.
 *
 * Real deviations from the spec's literal 12-board mock, documented here because this
 * is where each one is decided, not just in the commit message:
 *
 *   - CUT: "Max velocity", "Squat 1RM", "Bench 1RM" (3 of the spec's 12 boards). These
 *     are not real test_definitions rows, there is no 1RM-estimation formula anywhere
 *     in this codebase (O-389, docs/11-open-questions.md, still open), and
 *     test_results.value is always staff_entered, never derived from another test. The
 *     spec's own mock derives these four boards mathematically from the other seven so
 *     one athlete profile stays internally consistent — inventing that formula here
 *     would mean fabricating athlete performance numbers on a platform whose whole
 *     point is being a record of truth. Dropping from 12 boards to 9 (7 real tests +
 *     2 real Habits metrics) is a real, honest number, not a compromise.
 *   - REFRAMED: "Improvement" compares each athlete's latest is_best result against
 *     their EARLIEST real is_best result for that board, not a literal "12 months" —
 *     every test's real result history here spans about 8 weeks (2026-06-16 to
 *     2026-08-10), so a 12-month comparison would be comparing against rows that don't
 *     exist. Column sub-lines and captions say "vs earliest on file" and state the real
 *     window instead of the spec's literal "12 mo" text.
 *   - PLACEHOLDER, documented: per-board typical error (protocol noise floor) and
 *     forward/back standards. No real column backs either — test_definitions has no
 *     swc_value (O-387, documented in screens/testing.md but never added to migration
 *     0024) and there is no norms-by-position table anywhere in the schema. BOARD_META
 *     below carries the spec's own literal METRICS constants for the seven boards that
 *     survive the cut, plus two new, equally-placeholder Habits constants (14-day
 *     streak, 90% compliance) — the same kind of documented threshold constant the
 *     spec's own table already is, never mistaken for measured athlete data.
 *   - REAL, NEW: "Habits" (wellness streak, compliance %) is a genuinely computable
 *     domain, not fabricated — see fetchLeaderboardWall's own wellness/compliance
 *     block below for the real query. Compliance % reuses the same
 *     expected-vs-submitted shape src/lib/queries/compliance.ts and dashboard.ts
 *     already use elsewhere in this app, not a new pattern.
 *   - REAL, NEW: the six-unit positional mapping (POSITION_TO_UNIT below) is a real,
 *     explicit, documented lookup from the real free-text athletes.position values
 *     onto the spec's six rugby units — categorising real values, not inventing data.
 */

/** The GPS family's rolling window. Four weeks is the design's own figure and
 *  is the usual block length a coach reasons in; it is also long enough that a
 *  single missed session does not swing an athlete's mean. */
const GPS_WINDOW_DAYS = 28;

export const UNITS = ['Front row', 'Second row', 'Back row', 'Half backs', 'Centres', 'Back three'] as const;
export type Unit = (typeof UNITS)[number];

export const BANDS = ['U20', '20 to 24', '25 to 29', '30 plus'] as const;
export type Band = (typeof BANDS)[number];

/** Real athletes.position values (confirmed live, 28/28 athletes, 11 distinct values)
 *  mapped onto the spec's six rugby units. Mechanical and unambiguous — every value
 *  the org actually uses maps to exactly one unit. Front row 6 · Second row 4 ·
 *  Back row 5 · Half backs 4 · Centres 4 · Back three 5, all confirmed ≥ 3 live. */
const POSITION_TO_UNIT: Record<string, number> = {
  'Loosehead prop': 0,
  Hooker: 0,
  'Tighthead prop': 0,
  Lock: 1,
  Flanker: 2,
  'Number 8': 2,
  'Scrum-half': 3,
  'Fly-half': 3,
  Centre: 4,
  Wing: 5,
  'Full-back': 5,
};

function unitIndexForPosition(position: string | null): number | null {
  if (!position) return null;
  return POSITION_TO_UNIT[position] ?? null;
}

function bandIndexForAge(age: number | null): number | null {
  if (age === null) return null;
  if (age < 20) return 0;
  if (age <= 24) return 1;
  if (age <= 29) return 2;
  return 3;
}

function ageOn(dob: string | null, asOf: string): number | null {
  if (!dob) return null;
  const born = new Date(`${dob}T12:00:00Z`);
  const now = new Date(`${asOf}T12:00:00Z`);
  if (Number.isNaN(born.getTime()) || Number.isNaN(now.getTime())) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

export type BoardFamily = 'Speed & power' | 'Endurance' | 'Strength' | 'GPS' | 'Habits';

export type WallBoard = {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  decimals: number;
  family: BoardFamily;
  /** Forwards / backs standard for this board, or null when no real norm exists
   *  for it. GPS boards are null: gps_records carries real measurements but this
   *  schema has no norms-by-position table for them (the same gap O-387 records
   *  for tests), and a made-up GPS standard would be indistinguishable on screen
   *  from a measured one. A null standard means the board ranks and tints
   *  normally and is simply not scored in the Standard lens. */
  standardFwd: number | null;
  standardBack: number | null;
  typicalError: number;
  gainable: boolean;
};

/** Family, typical error and forward/back standard per board. See this file's header
 *  for why these are documented placeholders, not measured or real-schema values.
 *  Keyed on the real test_definitions.name so the rest of the object (unit, decimals,
 *  higher_is_better) always comes from the live row, never restated here. */
const BOARD_META: Record<
  string,
  { family: BoardFamily; standardFwd: number; standardBack: number; typicalError: number }
> = {
  '10m sprint': { family: 'Speed & power', standardFwd: 1.95, standardBack: 1.74, typicalError: 0.02 },
  '40m sprint': { family: 'Speed & power', standardFwd: 5.75, standardBack: 5.25, typicalError: 0.04 },
  'CMJ height': { family: 'Speed & power', standardFwd: 32, standardBack: 40, typicalError: 1 },
  'Broad jump': { family: 'Speed & power', standardFwd: 225, standardBack: 250, typicalError: 4 },
  'Bronco test': { family: 'Endurance', standardFwd: 335, standardBack: 305, typicalError: 2.0 },
  'Yo-Yo IR1': { family: 'Endurance', standardFwd: 1600, standardBack: 1920, typicalError: 40 },
  'IMTP peak force': { family: 'Strength', standardFwd: 4000, standardBack: 3700, typicalError: 60 },
};

/** Fixed sort order matching the spec's own family grouping: Speed & power, then
 *  Endurance, then Strength, then Habits. */
const BOARD_ORDER = ['10m sprint', '40m sprint', 'CMJ height', 'Broad jump', 'Bronco test', 'Yo-Yo IR1', 'IMTP peak force'];

export type WallAthleteValue = {
  current: number | null;
  currentDate: string | null;
  first: number | null;
  sessionCount: number;
  /** Every real session's value, oldest first, for the movers' sparkline —
   *  LEADERBOARD-SPEC.md §4's own y-inversion formula, drawn from however many real
   *  sessions actually exist rather than a fabricated fixed eight. Empty for the two
   *  Habits boards, which aren't a session series. */
  sessions: number[];
};

export type WallAthlete = {
  id: string;
  name: string; // "Surname, First"
  position: string | null;
  unitIndex: number | null;
  age: number | null;
  bandIndex: number | null;
  values: Record<string, WallAthleteValue>;
};

export type WallData = {
  boards: WallBoard[];
  athletes: WallAthlete[];
  asOf: string;
};

const NO_VALUE: WallAthleteValue = { current: null, currentDate: null, first: null, sessionCount: 0, sessions: [] };

async function inOrEmpty<T>(
  ids: readonly string[],
  run: (chunk: readonly string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const { data, error } = await run(ids);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The one function the wall turns on. Real facts only: test_definitions/test_results
 *  for the seven real, populated tests, plus a real wellness-streak/compliance
 *  computation for the two Habits boards. The group filter narrows the athlete pool
 *  BEFORE anything is ranked — unlike the board-detail page's rank-then-hide approach
 *  (necessary there because compute_leaderboard persists a squad-wide position), the
 *  wall computes every rank fresh from raw values on every request, so re-ranking
 *  inside the filtered pool is exactly what LEADERBOARD-SPEC.md §2 asks for: "Filtering
 *  to Forwards re-ranks every board inside that pool... It is not a view filter." */
export async function fetchLeaderboardWall(
  db: Db,
  orgId: string,
  timezone: string,
  groupIds: readonly string[],
): Promise<WallData> {
  const asOf = todayIso(timezone);

  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db
    .from('athletes')
    .select('id, first_name, last_name, position, date_of_birth')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club');
  if (scope) athleteQuery = athleteQuery.in('id', scope);
  const { data: athleteRows, error: athleteErr } = await athleteQuery;
  if (athleteErr) throw new Error(athleteErr.message);

  const athleteIds = (athleteRows ?? []).map((a) => a.id);

  const [defs, results, wellness, expectations, gpsRows] = await Promise.all([
    (async () => {
      const { data, error } = await db
        .from('test_definitions')
        .select('id, name, unit, higher_is_better, decimal_places')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .eq('leaderboard_eligible', true)
        .order('sort_order');
      if (error) throw new Error(error.message);
      return data ?? [];
    })(),
    inOrEmpty(athleteIds, (chunk) =>
      db
        .from('test_results')
        .select('athlete_id, test_definition_id, test_date, value')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .eq('is_best', true)
        .in('athlete_id', [...chunk]),
    ),
    inOrEmpty(athleteIds, (chunk) =>
      db.from('wellness_entries_current').select('athlete_id, entry_date').eq('org_id', orgId).in('athlete_id', [...chunk]),
    ),
    inOrEmpty(athleteIds, (chunk) =>
      db
        .from('compliance_expectations')
        .select('athlete_id, expectation_date')
        .eq('org_id', orgId)
        .eq('domain', 'wellness')
        .eq('is_required', true)
        .in('athlete_id', [...chunk]),
    ),
    /* The GPS family's rolling four-week window, which is what the design's own
     * footer states ("Rolling 4-week mean per athlete, Catapult Openfield").
     * Chunked by athlete like every read above it. Bounded by the window, so
     * unlike the analytics reads this one cannot grow without limit — a squad's
     * four weeks of sessions is tens of rows per athlete. */
    inOrEmpty(athleteIds, (chunk) =>
      db
        .from('gps_records')
        .select(
          'athlete_id, duration_s, total_distance_m, running_distance_m, high_speed_distance_m, sprint_distance_m, high_intensity_efforts, max_speed_ms, accelerations, decelerations, player_load, impacts',
        )
        .eq('org_id', orgId)
        .gte('record_date', addDays(asOf, -GPS_WINDOW_DAYS))
        .lte('record_date', asOf)
        .in('athlete_id', [...chunk]),
    ),
  ]);

  // Real test boards: family/standard/typicalError from BOARD_META (documented
  // placeholders, see header), everything else from the live test_definitions row.
  const testBoards: WallBoard[] = BOARD_ORDER.map((name): WallBoard | null => {
    const def = defs.find((d) => d.name === name);
    const meta = BOARD_META[name];
    if (!def || !meta) return null;
    return {
      key: def.id,
      label: def.name,
      unit: def.unit,
      lowerIsBetter: !def.higher_is_better,
      decimals: def.decimal_places,
      family: meta.family,
      standardFwd: meta.standardFwd,
      standardBack: meta.standardBack,
      typicalError: meta.typicalError,
      gainable: true,
    };
  }).filter((b): b is WallBoard => b !== null);

  /* THE GPS FAMILY. "Fydr Leaderboard.dc.html" ranks sixteen GPS boards; these
   * are the fourteen that map onto a real gps_records column, plus the four
   * per-minute normalisations that divide one real column by another
   * (duration_s). Normalising a measurement by the time it was measured over is
   * arithmetic on real data, not invention — which is the line this file's
   * header draws, and it is why the design's other two boards are absent:
   *
   *   - "Explosive distance" and "RHIE bouts" have no column anywhere in this
   *     schema. The design mock computes them (`td*0.11 + hsr*0.28`,
   *     `hie/5.2`) so its own numbers hang together, which is the right thing
   *     for a mock and the wrong thing here: those formulas are not a
   *     measurement of anything, and on this screen they would sit in the same
   *     row, in the same type, as fourteen figures that are.
   *   - "% of max V" is genuinely computable, and is left out for a different
   *     reason: it is squad-relative, and every other tint on this wall is a
   *     rank inside the positional unit. Two different reference frames in one
   *     table is how a coach misreads it.
   *
   * Aggregation is the rolling four-week MEAN per athlete, which is what the
   * design's own footer states. Mean rather than best because these are
   * workload volumes, not personal bests: the biggest single session an athlete
   * ever had says less about them than their typical week does.
   *
   * gainable: false on every GPS board. Improvement needs a noise floor to
   * separate a real gain from session-to-session variation, and no per-metric
   * typical error exists for GPS any more than it does for tests (O-387).
   * Session-to-session GPS variation is large, so "improved" without one would
   * mostly report weather and opposition. */
  /** The gps_records columns these boards read. A type rather than a runtime
   *  list: nothing iterates it, it exists to keep `from` below honest — a board
   *  that names a column this table does not have will not compile. */
  type GpsColumn =
    | 'total_distance_m'
    | 'running_distance_m'
    | 'high_speed_distance_m'
    | 'sprint_distance_m'
    | 'high_intensity_efforts'
    | 'max_speed_ms'
    | 'accelerations'
    | 'decelerations'
    | 'player_load'
    | 'impacts';

  type GpsBoardDef = {
    key: string;
    label: string;
    unit: string;
    decimals: number;
    from: GpsColumn;
    /* How the window collapses to one number:
     *   mean — the typical session. Volumes and effort counts.
     *   rate — sum(value) / sum(minutes) over the window, NOT the mean of each
     *          session's rate: a mean of ratios weights a ten-minute cameo the
     *          same as an eighty-minute match, which is how a bench player ends
     *          up top of Distance/min.
     *   best — the peak. Only max velocity, and migration 0056 says why in its
     *          own comment: "Max speed is the one metric here that is a peak
     *          rather than a volume: totalling or meaning it across sessions
     *          answers nothing." */
    agg: 'mean' | 'rate' | 'best';
  };

  const GPS_BOARD_DEFS: GpsBoardDef[] = [
    { key: 'gps.td', label: 'Total distance', unit: 'm', decimals: 0, from: 'total_distance_m', agg: 'mean' },
    { key: 'gps.tdMin', label: 'Distance/min', unit: 'm/min', decimals: 1, from: 'total_distance_m', agg: 'rate' },
    { key: 'gps.run', label: 'Running distance', unit: 'm', decimals: 0, from: 'running_distance_m', agg: 'mean' },
    { key: 'gps.hsr', label: 'HSR', unit: 'm', decimals: 0, from: 'high_speed_distance_m', agg: 'mean' },
    { key: 'gps.hsrMin', label: 'HSR/min', unit: 'm/min', decimals: 1, from: 'high_speed_distance_m', agg: 'rate' },
    { key: 'gps.sprint', label: 'Sprint distance', unit: 'm', decimals: 0, from: 'sprint_distance_m', agg: 'mean' },
    { key: 'gps.maxv', label: 'Max velocity', unit: 'm/s', decimals: 1, from: 'max_speed_ms', agg: 'best' },
    { key: 'gps.hie', label: 'HIE', unit: '', decimals: 0, from: 'high_intensity_efforts', agg: 'mean' },
    { key: 'gps.hieMin', label: 'HIE/min', unit: '/min', decimals: 2, from: 'high_intensity_efforts', agg: 'rate' },
    { key: 'gps.acc', label: 'Accels', unit: '', decimals: 0, from: 'accelerations', agg: 'mean' },
    { key: 'gps.dec', label: 'Decels', unit: '', decimals: 0, from: 'decelerations', agg: 'mean' },
    { key: 'gps.pl', label: 'Player load', unit: 'AU', decimals: 0, from: 'player_load', agg: 'mean' },
    { key: 'gps.plMin', label: 'Load/min', unit: 'AU/min', decimals: 2, from: 'player_load', agg: 'rate' },
    { key: 'gps.impacts', label: 'Impacts', unit: '', decimals: 0, from: 'impacts', agg: 'mean' },
  ];

  const gpsBoards: WallBoard[] = GPS_BOARD_DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    unit: d.unit,
    // Every one of these is "more is better" except none — max velocity, volumes
    // and effort counts all read upward. No GPS board here is lower-is-better.
    lowerIsBetter: false,
    decimals: d.decimals,
    family: 'GPS' as const,
    standardFwd: null,
    standardBack: null,
    typicalError: 0,
    gainable: false,
  }));

  const habitBoards: WallBoard[] = [
    {
      key: 'streak',
      label: 'Wellness streak',
      unit: 'days',
      lowerIsBetter: false,
      decimals: 0,
      family: 'Habits',
      standardFwd: 14,
      standardBack: 14,
      typicalError: 0,
      gainable: false,
    },
    {
      key: 'comp',
      label: 'Compliance',
      unit: '%',
      lowerIsBetter: false,
      decimals: 0,
      family: 'Habits',
      standardFwd: 90,
      standardBack: 90,
      typicalError: 0,
      gainable: false,
    },
  ];

  const boards = [...testBoards, ...gpsBoards, ...habitBoards];

  // Best-of-three per session is already the mark_best_attempt trigger's job
  // (is_best=true within one athlete/test/date). "First" and "current" here are
  // the earliest and latest of those real sessions per athlete per test.
  const sessionsByPair = new Map<string, { date: string; value: number }[]>();
  for (const r of results) {
    const k = `${r.athlete_id}|${r.test_definition_id}`;
    const list = sessionsByPair.get(k) ?? [];
    list.push({ date: r.test_date, value: r.value });
    sessionsByPair.set(k, list);
  }
  for (const list of sessionsByPair.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const wellnessByAthlete = new Map<string, Set<string>>();
  for (const w of wellness) {
    if (!w.athlete_id || !w.entry_date) continue;
    const s = wellnessByAthlete.get(w.athlete_id) ?? new Set<string>();
    s.add(w.entry_date);
    wellnessByAthlete.set(w.athlete_id, s);
  }

  const expByAthlete = new Map<string, string[]>();
  for (const e of expectations) {
    const list = expByAthlete.get(e.athlete_id) ?? [];
    list.push(e.expectation_date);
    expByAthlete.set(e.athlete_id, list);
  }
  for (const list of expByAthlete.values()) list.sort();

  /** Real wellness streak: walk backward from this athlete's most recent expected
   *  wellness day (not necessarily today — compliance_expectations is generated on a
   *  rolling basis and may lag "today" by a few days, a real fixture-data property, not
   *  a bug to paper over), counting consecutive expected days that were actually
   *  submitted. A day with no expectation on file is skipped, not counted as a miss —
   *  the same "expected vs submitted" semantics compliance.ts already uses, just
   *  walked backward instead of summed for one day. */
  function streakAndCompliance(athleteId: string): { streak: number; compliancePct: number | null } {
    const expected = expByAthlete.get(athleteId) ?? [];
    if (expected.length === 0) return { streak: 0, compliancePct: null };
    const submitted = wellnessByAthlete.get(athleteId) ?? new Set<string>();

    let met = 0;
    for (const d of expected) if (submitted.has(d)) met += 1;
    const compliancePct = Math.round((100 * met) / expected.length);

    let streak = 0;
    for (let i = expected.length - 1; i >= 0; i -= 1) {
      if (submitted.has(expected[i]!)) streak += 1;
      else break;
    }
    return { streak, compliancePct };
  }

  /* Collapse the window to one number per athlete per GPS board. Sessions with a
   * null value for a column contribute nothing to that board rather than zero —
   * a device that did not record player load must not drag an athlete's mean
   * down (this file's own "a missing entry is never zero" rule, which the design
   * system states as data rule 1). An athlete with no GPS session in the window
   * gets no value at all and renders as a dash, exactly like a missing test. */
  const gpsByAthlete = new Map<string, Record<string, number>>();
  {
    const perAthlete = new Map<string, typeof gpsRows>();
    for (const g of gpsRows) {
      const list = perAthlete.get(g.athlete_id) ?? [];
      list.push(g);
      perAthlete.set(g.athlete_id, list);
    }
    for (const [athleteId, rows] of perAthlete) {
      const out: Record<string, number> = {};
      for (const d of GPS_BOARD_DEFS) {
        const vals: number[] = [];
        let sumValue = 0;
        let sumMinutes = 0;
        for (const row of rows) {
          const raw = row[d.from];
          if (raw === null || raw === undefined) continue;
          const v = Number(raw);
          if (!Number.isFinite(v)) continue;
          vals.push(v);
          if (d.agg === 'rate') {
            const secs = row.duration_s;
            if (secs === null || secs === undefined || secs <= 0) continue;
            sumValue += v;
            sumMinutes += secs / 60;
          }
        }
        if (d.agg === 'rate') {
          if (sumMinutes > 0) out[d.key] = sumValue / sumMinutes;
        } else if (d.agg === 'best') {
          if (vals.length > 0) out[d.key] = Math.max(...vals);
        } else if (vals.length > 0) {
          out[d.key] = vals.reduce((x, y) => x + y, 0) / vals.length;
        }
      }
      gpsByAthlete.set(athleteId, out);
    }
  }

  const athletes: WallAthlete[] = (athleteRows ?? []).map((a) => {
    const age = ageOn(a.date_of_birth, asOf);
    const values: Record<string, WallAthleteValue> = {};

    for (const board of testBoards) {
      const sessions = sessionsByPair.get(`${a.id}|${board.key}`) ?? [];
      if (sessions.length === 0) {
        values[board.key] = NO_VALUE;
        continue;
      }
      const latest = sessions[sessions.length - 1]!;
      values[board.key] = {
        current: latest.value,
        currentDate: latest.date,
        first: sessions.length >= 2 ? sessions[0]!.value : null,
        sessionCount: sessions.length,
        sessions: sessions.map((s) => s.value),
      };
    }

    /* GPS boards carry no session series and no first-vs-latest comparison:
     * `sessions` drives the movers' sparkline and `first` drives Improvement,
     * and both are meaningless for a rolling window aggregate — the number IS
     * the window, not a point in a series. gainable: false on these boards
     * means nothing reads them. */
    const gpsValues = gpsByAthlete.get(a.id);
    for (const d of GPS_BOARD_DEFS) {
      const v = gpsValues?.[d.key];
      values[d.key] =
        v === undefined
          ? NO_VALUE
          : { current: v, currentDate: null, first: null, sessionCount: 0, sessions: [] };
    }

    const { streak, compliancePct } = streakAndCompliance(a.id);
    // A real 0-day streak (expected data exists, most recent expected day was missed)
    // is a real value and renders as 0, not a dash. Only "no expectation on file for
    // this athlete at all" (e.g. not yet onboarded to wellness) excludes them from the
    // board, the same as "no test result" does for the seven testing boards.
    values.streak = {
      current: expByAthlete.has(a.id) ? streak : null,
      currentDate: null,
      first: null,
      sessionCount: 0,
      sessions: [],
    };
    values.comp = { current: compliancePct, currentDate: null, first: null, sessionCount: 0, sessions: [] };

    return {
      id: a.id,
      name: `${a.last_name}, ${a.first_name}`,
      position: a.position,
      unitIndex: unitIndexForPosition(a.position),
      age,
      bandIndex: bandIndexForAge(age),
      values,
    };
  });

  return { boards, athletes, asOf };
}
