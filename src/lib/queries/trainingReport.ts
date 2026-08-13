import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchWeekMdLabels, mondayOf } from './schedule';
import { mdLabel } from '../format';

/* TRAINING-REPORT-SPEC.md, a full rebuild of the previous heat-mapped
 * board (screens/training-report.md) into the two-mode scoring model the
 * new spec describes: every session (training or match) scored as a
 * percentage of a typical session of its own type, judged against an
 * athlete's own history and their positional unit, never a raw squad rank.
 *
 * Real schema, real data, real gaps, stated once here:
 *
 *  - "A typical session of this type" needs a real way to group repeatable
 *    sessions. This schema has no session-subtype column beyond
 *    session_type ('training'|'match'|...) — real seed data's own
 *    session *titles* are what actually repeat weekly (Conditioning, Unit
 *    skills, Team run, Captain's run, each real, each recurring), so
 *    title is the grouping key for the training reference. Real, not
 *    invented: it is what the club's own scheduling already uses to mean
 *    "the same kind of session".
 *  - Match GPS did not exist anywhere in this schema before this file —
 *    seeded once, for real, documented in the (now-deleted)
 *    seed-match-gps.mjs and restated here: three real completed matches
 *    (18/25 Jul, 1 Aug) have real per-athlete GPS derived from each
 *    athlete's own real recent training rates, at a flat, single
 *    duration_s of 4800 (80 minutes) for every athlete. Nothing in this
 *    schema records who started vs who was substituted and when
 *    (team_allocations is weekly squad selection, not in-match timing),
 *    so there is no honest way to produce a first-half/second-half split
 *    for a real, named athlete — the spec's own Halves card, and every
 *    halves-dependent column elsewhere (match board's H1/H2 columns,
 *    Comparison's match Athlete-scope H2-rate), render as an explicit,
 *    labelled absence rather than invented numbers. Every other match
 *    metric this file computes IS real: whole-match totals and
 *    per-minute rates, both fully supported by one cumulative
 *    gps_records row per athlete per session.
 *  - "The reference always excludes the session being scored" (spec §5)
 *    is enforced everywhere a reference is computed below, the same rule
 *    applied consistently, not just for the headline dials.
 */

export type ReportMode = 'training' | 'match';

// ---------------------------------------------------------------------------
// Session pickers
// ---------------------------------------------------------------------------

export type TrainingSessionOption = {
  sessionId: string;
  date: string;
  title: string;
  mdOffset: number | null;
  durationMin: number | null;
  location: string | null;
};

export async function fetchTrainingSessions(db: Db, orgId: string, limit = 8): Promise<TrainingSessionOption[]> {
  const { data, error } = await db
    .from('sessions')
    .select('id, title, starts_at, md_offset, duration_min, location, gps_records!inner(id)')
    .eq('org_id', orgId)
    .eq('session_type', 'training')
    .is('deleted_at', null)
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const picked: { id: string; date: string; title: string; durationMin: number | null; location: string | null }[] = [];
  for (const s of data ?? []) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    picked.push({ id: s.id, date: s.starts_at.slice(0, 10), title: s.title, durationMin: s.duration_min, location: s.location });
    if (picked.length >= limit) break;
  }

  /* MD-n re-anchored per session's own real calendar week — same shared
   * primitive as every other view (audit blocker B2). Not in the plan's
   * named site list, found alongside it in the same file: this session
   * picker (and its selected-session header, reports/training/page.tsx)
   * rendered the raw stored md_offset directly, same bug, same fix. These
   * `limit` most recent sessions can span several different weeks, so
   * fetch each distinct week once rather than one call per session. */
  const weeks = [...new Set(picked.map((s) => mondayOf(s.date)))];
  const weekMdByWeek = await Promise.all(weeks.map((w) => fetchWeekMdLabels(db, orgId, w)));
  const weekMdLookup = new Map(weeks.map((w, i) => [w, weekMdByWeek[i]]));

  return picked.map((s) => ({
    sessionId: s.id,
    date: s.date,
    title: s.title,
    mdOffset: weekMdLookup.get(mondayOf(s.date))?.get(s.date) ?? null,
    durationMin: s.durationMin,
    location: s.location,
  }));
}

export type MatchSessionOption = {
  sessionId: string;
  date: string;
  opponent: string;
  result: string | null;
  competition: string | null;
  venue: string | null;
  homeAway: 'home' | 'away' | 'neutral' | null;
};

export async function fetchMatchSessions(db: Db, orgId: string, limit = 8): Promise<MatchSessionOption[]> {
  const { data, error } = await db
    .from('sessions')
    .select('id, starts_at, fixtures(opponent, result, competition, venue, home_away), gps_records!inner(id)')
    .eq('org_id', orgId)
    .eq('session_type', 'match')
    .is('deleted_at', null)
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: MatchSessionOption[] = [];
  for (const s of data ?? []) {
    if (seen.has(s.id) || !s.fixtures) continue;
    seen.add(s.id);
    out.push({
      sessionId: s.id,
      date: s.starts_at.slice(0, 10),
      opponent: s.fixtures.opponent,
      result: s.fixtures.result,
      competition: s.fixtures.competition,
      venue: s.fixtures.venue,
      homeAway: s.fixtures.home_away,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scoring model — spec §5
// ---------------------------------------------------------------------------

export type DialKey = 'intensity' | 'highSpeed' | 'endurance';

export type DialScore = {
  key: DialKey;
  label: string;
  value: number; // percent of typical, uncapped
  raw: number; // the actual metric value
  unit: string;
};

export type ScoreTone = { tone: 'bad' | 'warn' | 'accent' | 'accent2'; statusLabel: string };

/** spec §5's score bands, verbatim thresholds. */
export function scoreTone(pct: number): ScoreTone {
  if (pct >= 122) return { tone: 'bad', statusLabel: 'Much harder than usual' };
  if (pct >= 110) return { tone: 'warn', statusLabel: 'Harder than usual' };
  if (pct >= 92) return { tone: 'accent', statusLabel: 'A typical session' };
  if (pct >= 82) return { tone: 'accent2', statusLabel: 'Lighter than usual' };
  return { tone: 'accent2', statusLabel: 'Much lighter than usual' };
}

const OUT_HI = 112;
const OUT_LO = 88;
const GAP = 6;

/** spec §5's sessionRead(), ported verbatim including the deviation-gap
 *  guard — without it, a driver is always named even when no axis is
 *  meaningfully outside the band, which the spec calls out by name as a
 *  real defect found in review. */
export function sessionRead(scores: readonly DialScore[], kind: 'session' | 'match'): string {
  if (scores.length === 0) return `Not enough data to read this ${kind} yet.`;
  const dev = (x: DialScore) => Math.abs(x.value - 100);
  const sorted = [...scores].sort((a, b) => dev(b) - dev(a));
  const top = sorted[0]!;
  const second = sorted[1];
  const outside = scores.filter((x) => x.value >= OUT_HI || x.value <= OUT_LO);
  const word = top.value > 100 ? 'harder' : 'lighter';
  if (outside.length === 0) return `A typical ${kind}.`;
  if (outside.length === 1 && second !== undefined && dev(top) - dev(second) >= GAP) {
    return `A ${word} ${kind} than usual, and ${top.label.toLowerCase()} is what made it ${word}.`;
  }
  if (outside.length === 3) return `A ${word} ${kind} than usual on all three axes.`;
  return `A ${word} ${kind} than usual on ${outside.length} of the three axes.`;
}

// ---------------------------------------------------------------------------
// Training overview
// ---------------------------------------------------------------------------

export type TrainingOverview = {
  session: { id: string; title: string; date: string; mdOffset: number | null; durationMin: number | null; location: string | null };
  athleteCount: number;
  dials: DialScore[];
  headline: string;
  referenceLine: string;
  referenceCount: number;
};

async function fetchTypedTrainingRecords(db: Db, orgId: string, title: string, excludeSessionId: string | null) {
  let q = db
    .from('gps_records')
    .select('session_id, athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s, sessions!inner(id, title, session_type)')
    .eq('org_id', orgId)
    .eq('sessions.session_type', 'training')
    .eq('sessions.title', title);
  if (excludeSessionId) q = q.neq('session_id', excludeSessionId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function mean(xs: readonly (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length > 0 ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export async function fetchTrainingOverview(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  session: TrainingSessionOption,
): Promise<TrainingOverview | null> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let curQuery = db
    .from('gps_records')
    .select('athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
    .eq('org_id', orgId)
    .eq('session_id', session.sessionId);
  if (scope) curQuery = curQuery.in('athlete_id', scope);
  const { data: curRecords, error: curErr } = await curQuery;
  if (curErr) throw new Error(curErr.message);
  if (!curRecords || curRecords.length === 0) return null;

  const priors = await fetchTypedTrainingRecords(db, orgId, session.title, session.sessionId);
  const priorSessionIds = new Set(priors.map((p) => p.session_id));

  const refTd = mean(priors.map((p) => p.total_distance_m));
  const refHsr = mean(priors.map((p) => p.high_speed_distance_m));
  const refHiePerMin = mean(priors.filter((p) => p.duration_s).map((p) => (p.high_intensity_efforts ?? null) !== null && p.duration_s ? (p.high_intensity_efforts as number) / (p.duration_s / 60) : null));

  const curTd = mean(curRecords.map((r) => r.total_distance_m));
  const curHsr = mean(curRecords.map((r) => r.high_speed_distance_m));
  const curHiePerMin = mean(
    curRecords.filter((r) => r.duration_s).map((r) => (r.high_intensity_efforts !== null && r.duration_s ? r.high_intensity_efforts / (r.duration_s / 60) : null)),
  );

  const dials: DialScore[] = [];
  if (curHiePerMin !== null && refHiePerMin !== null && refHiePerMin > 0) {
    dials.push({ key: 'intensity', label: 'Intensity', value: Math.round((curHiePerMin / refHiePerMin) * 100), raw: curHiePerMin, unit: '/min' });
  }
  if (curHsr !== null && refHsr !== null && refHsr > 0) {
    dials.push({ key: 'highSpeed', label: 'High speed', value: Math.round((curHsr / refHsr) * 100), raw: curHsr, unit: 'm' });
  }
  if (curTd !== null && refTd !== null && refTd > 0) {
    dials.push({ key: 'endurance', label: 'Endurance', value: Math.round((curTd / refTd) * 100), raw: curTd, unit: 'm' });
  }

  const headline = dials.length === 3 ? sessionRead(dials, 'session') : 'Not enough reference sessions yet to score this one.';
  const n = priorSessionIds.size;
  const referenceLine =
    n > 0
      ? `Typical = the mean of the ${n} other ${session.title} session${n === 1 ? '' : 's'} · ${refTd !== null ? Math.round(refTd).toLocaleString() : '—'} m, ${refHsr !== null ? Math.round(refHsr).toLocaleString() : '—'} m HSR, ${refHiePerMin !== null ? refHiePerMin.toFixed(2) : '—'} HIE/min`
      : `No other ${session.title} session yet — this is the first on record.`;

  return {
    session: { id: session.sessionId, title: session.title, date: session.date, mdOffset: session.mdOffset, durationMin: session.durationMin, location: session.location },
    athleteCount: curRecords.length,
    dials,
    headline,
    referenceLine,
    referenceCount: n,
  };
}

// ---------------------------------------------------------------------------
// Match overview — whole-match only, no halves (see file header)
// ---------------------------------------------------------------------------

export type MatchOverview = {
  session: { id: string; date: string; opponent: string; result: string | null; competition: string | null; venue: string | null; homeAway: 'home' | 'away' | 'neutral' | null };
  athleteCount: number;
  dials: DialScore[];
  headline: string;
  referenceLine: string;
  referenceCount: number;
};

export async function fetchMatchOverview(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  match: MatchSessionOption,
): Promise<MatchOverview | null> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let curQuery = db
    .from('gps_records')
    .select('athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
    .eq('org_id', orgId)
    .eq('session_id', match.sessionId);
  if (scope) curQuery = curQuery.in('athlete_id', scope);
  const { data: curRecords, error: curErr } = await curQuery;
  if (curErr) throw new Error(curErr.message);
  if (!curRecords || curRecords.length === 0) return null;

  const { data: priorRaw, error: priorErr } = await db
    .from('gps_records')
    .select('session_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s, sessions!inner(session_type)')
    .eq('org_id', orgId)
    .eq('sessions.session_type', 'match')
    .neq('session_id', match.sessionId);
  if (priorErr) throw new Error(priorErr.message);
  const priors = priorRaw ?? [];
  const priorSessionIds = new Set(priors.map((p) => p.session_id));

  const perMin = (v: number | null, durationS: number | null) => (v !== null && durationS ? v / (durationS / 60) : null);

  const refTdPerMin = mean(priors.map((p) => perMin(p.total_distance_m, p.duration_s)));
  const refHsrPerMin = mean(priors.map((p) => perMin(p.high_speed_distance_m, p.duration_s)));
  const refHiePerMin = mean(priors.map((p) => perMin(p.high_intensity_efforts, p.duration_s)));

  const curTdPerMin = mean(curRecords.map((r) => perMin(r.total_distance_m, r.duration_s)));
  const curHsrPerMin = mean(curRecords.map((r) => perMin(r.high_speed_distance_m, r.duration_s)));
  const curHiePerMin = mean(curRecords.map((r) => perMin(r.high_intensity_efforts, r.duration_s)));

  const dials: DialScore[] = [];
  if (curHiePerMin !== null && refHiePerMin !== null && refHiePerMin > 0) {
    dials.push({ key: 'intensity', label: 'Intensity', value: Math.round((curHiePerMin / refHiePerMin) * 100), raw: curHiePerMin, unit: '/min' });
  }
  if (curHsrPerMin !== null && refHsrPerMin !== null && refHsrPerMin > 0) {
    dials.push({ key: 'highSpeed', label: 'High speed', value: Math.round((curHsrPerMin / refHsrPerMin) * 100), raw: curHsrPerMin, unit: 'm/min' });
  }
  if (curTdPerMin !== null && refTdPerMin !== null && refTdPerMin > 0) {
    dials.push({ key: 'endurance', label: 'Endurance', value: Math.round((curTdPerMin / refTdPerMin) * 100), raw: curTdPerMin, unit: 'm/min' });
  }

  const headline = dials.length === 3 ? sessionRead(dials, 'match') : 'Not enough other matches yet to score this one.';
  const n = priorSessionIds.size;
  const referenceLine =
    n > 0
      ? `Typical = the mean of ${n} other match${n === 1 ? '' : 'es'} · ${refTdPerMin !== null ? refTdPerMin.toFixed(1) : '—'} m/min, ${refHsrPerMin !== null ? refHsrPerMin.toFixed(1) : '—'} m/min HSR, ${refHiePerMin !== null ? refHiePerMin.toFixed(2) : '—'} HIE/min`
      : 'No other completed match on record yet.';

  return {
    session: { id: match.sessionId, date: match.date, opponent: match.opponent, result: match.result, competition: match.competition, venue: match.venue, homeAway: match.homeAway },
    athleteCount: curRecords.length,
    dials,
    headline,
    referenceLine,
    referenceCount: n,
  };
}

// ---------------------------------------------------------------------------
// Comparison card — spec §7
// ---------------------------------------------------------------------------

export type ComparisonScope = 'restOfWeek' | 'comparableSessions' | 'position' | 'athlete';

export type ComparisonColumn = { key: string; label: string };
export type ComparisonCell = { value: string; pct: number | null; isScore: boolean };
export type ComparisonRow = { id: string; label: string; sublabel: string | null; cells: ComparisonCell[]; highlighted: boolean; href: string | null };
export type ComparisonTable = { columns: ComparisonColumn[]; rows: ComparisonRow[]; caption: string };

function fmtInt(n: number | null): string {
  return n === null ? '—' : Math.round(n).toLocaleString();
}
function fmtRate(n: number | null, decimals = 2): string {
  return n === null ? '—' : n.toFixed(decimals);
}

export async function fetchRestOfWeekComparison(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  currentSessionId: string,
  currentDate: string,
): Promise<ComparisonTable> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const weekStart = mondayOf(currentDate);
  const weekEnd = new Date(`${weekStart}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  // MD-n for this row's own real calendar week, via the same shared
  // primitive the week-level views use (fetchWeekMdLabels ->
  // anchorMdOffsetsToWeek, format.ts) — not a hand-rolled re-derivation of
  // that logic, which previously could disagree with it (audit blocker
  // B2). Independent of the `sessions` query below, so fetched alongside it.
  const [{ data: sessions, error: sessErr }, weekMd] = await Promise.all([
    db
      .from('sessions')
      .select('id, title, session_type, starts_at, md_offset, fixtures(opponent)')
      .eq('org_id', orgId)
      .gte('starts_at', `${weekStart}T00:00:00Z`)
      .lte('starts_at', `${weekEndIso}T23:59:59Z`)
      .in('session_type', ['training', 'match'])
      .is('deleted_at', null)
      .order('starts_at'),
    fetchWeekMdLabels(db, orgId, weekStart),
  ]);
  if (sessErr) throw new Error(sessErr.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const recordsQuery = db
    .from('gps_records')
    .select('session_id, athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
    .eq('org_id', orgId)
    .in('session_id', sessionIds);
  const { data: records, error: recErr } = sessionIds.length > 0 ? await recordsQuery : { data: [], error: null };
  if (recErr) throw new Error(recErr.message);

  const filteredRecords = scope ? (records ?? []).filter((r) => scope.includes(r.athlete_id)) : (records ?? []);

  const bySession = new Map<string, typeof filteredRecords>();
  for (const r of filteredRecords) {
    const list = bySession.get(r.session_id ?? '') ?? [];
    list.push(r);
    bySession.set(r.session_id ?? '', list);
  }

  let weekTd = 0;
  const rows: ComparisonRow[] = (sessions ?? []).map((s) => {
    const recs = bySession.get(s.id) ?? [];
    const td = mean(recs.map((r) => r.total_distance_m));
    const hsr = mean(recs.map((r) => r.high_speed_distance_m));
    const hie = mean(recs.filter((r) => r.duration_s).map((r) => (r.high_intensity_efforts !== null && r.duration_s ? r.high_intensity_efforts / (r.duration_s / 60) : null)));
    if (td !== null) weekTd += td;
    const md = mdLabel(weekMd.get(s.starts_at.slice(0, 10)) ?? null) ?? '';
    const label = s.session_type === 'match' ? `v ${s.fixtures?.opponent ?? 'opponent'}` : s.title;
    return {
      id: s.id,
      label,
      sublabel: `${new Date(s.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${md} · ${s.starts_at ? '' : ''}`.trim(),
      cells: [
        { value: fmtInt(td) + ' m', pct: null, isScore: false },
        { value: fmtInt(hsr) + ' m', pct: null, isScore: false },
        { value: fmtRate(hie), pct: null, isScore: false },
        { value: '', pct: null, isScore: false }, // share of week, filled after totals below
      ],
      highlighted: s.id === currentSessionId,
      href: `?session=${s.id}`,
    };
  });

  // Prior weeks' totals for the "typical week" reference — every other week
  // with at least one training session on record, excluding this one.
  const { data: allSessions, error: allErr } = await db
    .from('sessions')
    .select('id, starts_at')
    .eq('org_id', orgId)
    .eq('session_type', 'training')
    .is('deleted_at', null);
  if (allErr) throw new Error(allErr.message);
  const weeksSeen = new Map<string, string[]>();
  for (const s of allSessions ?? []) {
    const wk = mondayOf(s.starts_at.slice(0, 10));
    if (wk === weekStart) continue;
    const list = weeksSeen.get(wk) ?? [];
    list.push(s.id);
    weeksSeen.set(wk, list);
  }
  const priorWeekIds = [...weeksSeen.values()];
  let priorWeekTotals: number[] = [];
  if (priorWeekIds.length > 0) {
    const flatIds = priorWeekIds.flat();
    const priorQ = db.from('gps_records').select('session_id, athlete_id, total_distance_m').eq('org_id', orgId).in('session_id', flatIds);
    const { data: priorRecs, error: priorRecErr } = await priorQ;
    if (priorRecErr) throw new Error(priorRecErr.message);
    const scoped = scope ? (priorRecs ?? []).filter((r) => scope.includes(r.athlete_id)) : (priorRecs ?? []);
    priorWeekTotals = priorWeekIds.map((ids) => {
      const recs = scoped.filter((r) => ids.includes(r.session_id ?? ''));
      const bySess = new Map<string, number[]>();
      for (const r of recs) {
        if (r.total_distance_m === null) continue;
        const list = bySess.get(r.session_id ?? '') ?? [];
        list.push(r.total_distance_m);
        bySess.set(r.session_id ?? '', list);
      }
      let total = 0;
      for (const list of bySess.values()) total += mean(list) ?? 0;
      return total;
    });
  }
  const typicalWeek = mean(priorWeekTotals);

  const rowsWithShare = rows.map((r, i) => {
    const s = (sessions ?? [])[i];
    if (!s) return r;
    const td = mean((bySession.get(s.id) ?? []).map((rr) => rr.total_distance_m));
    const share = td !== null && weekTd > 0 ? Math.round((100 * td) / weekTd) : null;
    const cells = [...r.cells];
    cells[3] = { value: share !== null ? `${share}%` : '—', pct: null, isScore: false };
    return { ...r, cells };
  });

  const weekVsTypical = typicalWeek !== null && typicalWeek > 0 ? Math.round((100 * weekTd) / typicalWeek) : null;
  const totalRow: ComparisonRow = {
    id: 'total',
    label: 'Week total',
    sublabel: `${sessions?.length ?? 0} sessions`,
    cells: [
      { value: fmtInt(weekTd) + ' m', pct: null, isScore: false },
      { value: '', pct: null, isScore: false },
      { value: '', pct: null, isScore: false },
      { value: weekVsTypical !== null ? `${weekVsTypical}%` : '—', pct: weekVsTypical, isScore: true },
    ],
    highlighted: false,
    href: null,
  };

  return {
    columns: [
      { key: 'name', label: 'Session' },
      { key: 'td', label: 'TD each' },
      { key: 'hsr', label: 'HSR each' },
      { key: 'hie', label: 'HIE/min' },
      { key: 'share', label: 'Share of week' },
    ],
    rows: [...rowsWithShare, totalRow],
    caption:
      typicalWeek !== null
        ? `Per athlete, squad mean · the last cell on the total row is the week against a typical week (${Math.round(typicalWeek).toLocaleString()} m, mean of ${priorWeekIds.length} other week${priorWeekIds.length === 1 ? '' : 's'})`
        : 'Per athlete, squad mean · no other week on record yet to compare against',
  };
}

export async function fetchComparableSessionsComparison(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  mode: ReportMode,
  currentSessionId: string,
  trainingTitle: string | null,
): Promise<ComparisonTable> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let sessionsQuery = db
    .from('sessions')
    .select('id, title, starts_at, fixtures(opponent, result), gps_records!inner(id)')
    .eq('org_id', orgId)
    .eq('session_type', mode === 'match' ? 'match' : 'training')
    .is('deleted_at', null);
  if (mode === 'training' && trainingTitle) sessionsQuery = sessionsQuery.eq('title', trainingTitle);
  const { data: sessions, error: sessErr } = await sessionsQuery.order('starts_at', { ascending: false });
  if (sessErr) throw new Error(sessErr.message);

  // gps_records!inner already excludes any session with zero records — the
  // real signal of "played and measured", not "has a fixture row". A
  // fixture can (and, for the real upcoming match in this org, does)
  // exist before a ball is kicked; a gps_records row cannot.
  const seenIds = new Set<string>();
  const relevant = (sessions ?? []).filter((s) => {
    if (seenIds.has(s.id) || (mode === 'match' && !s.fixtures)) return false;
    seenIds.add(s.id);
    return true;
  });
  const sessionIds = relevant.map((s) => s.id);
  if (sessionIds.length === 0) {
    return { columns: [], rows: [], caption: 'No comparable sessions yet.' };
  }

  const { data: records, error: recErr } = await db
    .from('gps_records')
    .select('session_id, athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
    .eq('org_id', orgId)
    .in('session_id', sessionIds);
  if (recErr) throw new Error(recErr.message);
  const scoped = scope ? (records ?? []).filter((r) => scope.includes(r.athlete_id)) : (records ?? []);

  const bySession = new Map<string, typeof scoped>();
  for (const r of scoped) {
    const list = bySession.get(r.session_id ?? '') ?? [];
    list.push(r);
    bySession.set(r.session_id ?? '', list);
  }

  // The reference for scoring every row is the mean across ALL these
  // sessions except the one that row represents — spec §7: "every other
  // row is scored from its own recorded means against the same reference."
  function statsFor(sessionId: string) {
    const recs = bySession.get(sessionId) ?? [];
    const perMinHie = mean(recs.filter((r) => r.duration_s).map((r) => (r.high_intensity_efforts !== null && r.duration_s ? r.high_intensity_efforts / (r.duration_s / 60) : null)));
    const perMinTd = mean(recs.filter((r) => r.duration_s).map((r) => (r.total_distance_m !== null && r.duration_s ? r.total_distance_m / (r.duration_s / 60) : null)));
    const perMinHsr = mean(recs.filter((r) => r.duration_s).map((r) => (r.high_speed_distance_m !== null && r.duration_s ? r.high_speed_distance_m / (r.duration_s / 60) : null)));
    return {
      td: mean(recs.map((r) => r.total_distance_m)),
      hsr: mean(recs.map((r) => r.high_speed_distance_m)),
      perMinHie,
      perMinTd,
      perMinHsr,
    };
  }

  const rows: ComparisonRow[] = relevant.map((s) => {
    const own = statsFor(s.id);
    const others = relevant.filter((o) => o.id !== s.id).map((o) => statsFor(o.id));
    const refHie = mean(others.map((o) => o.perMinHie));
    const refTd = mean(others.map((o) => (mode === 'match' ? o.perMinTd : o.td)));
    const refHsr = mean(others.map((o) => (mode === 'match' ? o.perMinHsr : o.hsr)));

    const curTd = mode === 'match' ? own.perMinTd : own.td;
    const curHsr = mode === 'match' ? own.perMinHsr : own.hsr;

    const sInt = own.perMinHie !== null && refHie !== null && refHie > 0 ? Math.round((own.perMinHie / refHie) * 100) : null;
    const sHsr = curHsr !== null && refHsr !== null && refHsr > 0 ? Math.round((curHsr / refHsr) * 100) : null;
    const sEnd = curTd !== null && refTd !== null && refTd > 0 ? Math.round((curTd / refTd) * 100) : null;

    const label = mode === 'match' ? `v ${s.fixtures?.opponent ?? 'opponent'}` : s.title;
    const sub = mode === 'match' ? (s.fixtures?.result ?? '—') : new Date(s.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    return {
      id: s.id,
      label,
      sublabel: sub,
      cells: [
        { value: sInt !== null ? `${sInt}%` : '—', pct: sInt, isScore: true },
        { value: sHsr !== null ? `${sHsr}%` : '—', pct: sHsr, isScore: true },
        { value: sEnd !== null ? `${sEnd}%` : '—', pct: sEnd, isScore: true },
      ],
      highlighted: s.id === currentSessionId,
      href: `?session=${s.id}`,
    };
  });

  return {
    columns: [
      { key: 'name', label: mode === 'match' ? 'Fixture' : 'Session' },
      { key: 'intensity', label: 'Intensity' },
      { key: 'highSpeed', label: 'High speed' },
      { key: 'endurance', label: 'Endurance' },
    ],
    rows,
    caption: `n = ${relevant.length} ${mode === 'match' ? 'fixtures' : 'sessions of this type'} on record · each row scored against the mean of the others`,
  };
}

export async function fetchPositionComparison(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  mode: ReportMode,
  currentSessionId: string,
  trainingTitle: string | null,
): Promise<ComparisonTable> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let sessionsQuery = db
    .from('sessions')
    .select('id, fixtures(id)')
    .eq('org_id', orgId)
    .eq('session_type', mode === 'match' ? 'match' : 'training')
    .is('deleted_at', null);
  if (mode === 'training' && trainingTitle) sessionsQuery = sessionsQuery.eq('title', trainingTitle);
  const { data: sessionRows, error: sessErr } = await sessionsQuery;
  if (sessErr) throw new Error(sessErr.message);
  const relevantSessionIds = (sessionRows ?? []).filter((s) => mode === 'training' || s.fixtures).map((s) => s.id);
  if (relevantSessionIds.length === 0) return { columns: [], rows: [], caption: 'No sessions of this type yet.' };

  const [recordsRes, groupsRes, membershipsRes] = await Promise.all([
    db
      .from('gps_records')
      .select('session_id, athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
      .eq('org_id', orgId)
      .in('session_id', relevantSessionIds),
    db.from('groups').select('id, name, sort_order').eq('org_id', orgId).eq('group_type', 'positional').is('deleted_at', null).order('sort_order'),
    db.from('group_memberships').select('athlete_id, group_id').eq('org_id', orgId).is('removed_at', null),
  ]);
  if (recordsRes.error) throw new Error(recordsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);

  const scoped = scope ? (recordsRes.data ?? []).filter((r) => scope.includes(r.athlete_id)) : (recordsRes.data ?? []);
  const unitByAthlete = new Map<string, string>();
  for (const m of membershipsRes.data ?? []) {
    if (!unitByAthlete.has(m.athlete_id)) unitByAthlete.set(m.athlete_id, m.group_id);
  }

  function perMin(v: number | null, d: number | null) {
    return v !== null && d ? v / (d / 60) : null;
  }

  function unitStats(unitId: string, excludeSessionId: string | null) {
    const recs = scoped.filter((r) => unitByAthlete.get(r.athlete_id) === unitId && r.session_id !== excludeSessionId);
    return {
      td: mean(recs.map((r) => (mode === 'match' ? perMin(r.total_distance_m, r.duration_s) : r.total_distance_m))),
      hsr: mean(recs.map((r) => (mode === 'match' ? perMin(r.high_speed_distance_m, r.duration_s) : r.high_speed_distance_m))),
      hie: mean(recs.map((r) => perMin(r.high_intensity_efforts, r.duration_s))),
    };
  }

  const rows: ComparisonRow[] = (groupsRes.data ?? []).map((g) => {
    const own = unitStats(g.id, null);
    const ref = unitStats(g.id, currentSessionId);
    const squadOwn = {
      td: mean(scoped.map((r) => (mode === 'match' ? perMin(r.total_distance_m, r.duration_s) : r.total_distance_m))),
    };
    const sEnd = own.td !== null && ref.td !== null && ref.td > 0 ? Math.round((own.td / ref.td) * 100) : null;
    const sHsr = own.hsr !== null && ref.hsr !== null && ref.hsr > 0 ? Math.round((own.hsr / ref.hsr) * 100) : null;
    const sInt = own.hie !== null && ref.hie !== null && ref.hie > 0 ? Math.round((own.hie / ref.hie) * 100) : null;
    const vsSquad = own.td !== null && squadOwn.td !== null && squadOwn.td > 0 ? Math.round((own.td / squadOwn.td) * 100) : null;

    return {
      id: g.id,
      label: g.name,
      sublabel: null,
      cells: [
        { value: sInt !== null ? `${sInt}%` : '—', pct: sInt, isScore: true },
        { value: sHsr !== null ? `${sHsr}%` : '—', pct: sHsr, isScore: true },
        { value: sEnd !== null ? `${sEnd}%` : '—', pct: sEnd, isScore: true },
        { value: vsSquad !== null ? `${vsSquad}%` : '—', pct: vsSquad, isScore: true },
      ],
      highlighted: false,
      href: null,
    };
  });

  return {
    columns: [
      { key: 'unit', label: 'Unit' },
      { key: 'intensity', label: 'Intensity' },
      { key: 'highSpeed', label: 'High speed' },
      { key: 'endurance', label: 'Endurance' },
      { key: 'vsSquad', label: 'vs squad' },
    ],
    rows,
    caption: 'Each unit scored against its own mean for this session type · vs squad compares the unit to the whole squad average · a unit at 100% did exactly what it normally does',
  };
}

export async function fetchAthleteComparison(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  mode: ReportMode,
  currentSessionId: string,
  trainingTitle: string | null,
): Promise<ComparisonTable> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let sessionsQuery = db
    .from('sessions')
    .select('id, fixtures(id)')
    .eq('org_id', orgId)
    .eq('session_type', mode === 'match' ? 'match' : 'training')
    .is('deleted_at', null);
  if (mode === 'training' && trainingTitle) sessionsQuery = sessionsQuery.eq('title', trainingTitle);
  const { data: sessionRows, error: sessErr } = await sessionsQuery;
  if (sessErr) throw new Error(sessErr.message);
  const relevantSessionIds = (sessionRows ?? []).filter((s) => mode === 'training' || s.fixtures).map((s) => s.id);
  if (relevantSessionIds.length === 0) return { columns: [], rows: [], caption: 'No sessions of this type yet.' };

  const [recordsRes, athletesRes, membershipsRes, groupsRes] = await Promise.all([
    db
      .from('gps_records')
      .select('session_id, athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
      .eq('org_id', orgId)
      .in('session_id', relevantSessionIds)
      .eq('session_id', currentSessionId),
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null),
    db.from('group_memberships').select('athlete_id, group_id').eq('org_id', orgId).is('removed_at', null),
    db.from('groups').select('id, name').eq('org_id', orgId).eq('group_type', 'positional').is('deleted_at', null),
  ]);
  if (recordsRes.error) throw new Error(recordsRes.error.message);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);

  const { data: histRaw, error: histErr } = await db
    .from('gps_records')
    .select('session_id, athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, duration_s')
    .eq('org_id', orgId)
    .in('session_id', relevantSessionIds);
  if (histErr) throw new Error(histErr.message);

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const unitByAthlete = new Map<string, string>();
  for (const m of membershipsRes.data ?? []) {
    if (!unitByAthlete.has(m.athlete_id)) unitByAthlete.set(m.athlete_id, m.group_id);
  }
  const groupById = new Map((groupsRes.data ?? []).map((g) => [g.id, g.name]));

  function perMin(v: number | null, d: number | null) {
    return v !== null && d ? v / (d / 60) : null;
  }

  const curScoped = scope ? (recordsRes.data ?? []).filter((r) => scope.includes(r.athlete_id)) : (recordsRes.data ?? []);

  const rows: ComparisonRow[] = curScoped
    .map((cur) => {
      const athlete = athleteById.get(cur.athlete_id);
      if (!athlete) return null;
      const own = (histRaw ?? []).filter((r) => r.athlete_id === cur.athlete_id && r.session_id !== currentSessionId);
      const unitId = unitByAthlete.get(cur.athlete_id);
      const unitPeers = (histRaw ?? []).filter((r) => r.session_id !== currentSessionId && unitByAthlete.get(r.athlete_id) === unitId);

      const curTd = mode === 'match' ? perMin(cur.total_distance_m, cur.duration_s) : cur.total_distance_m;
      const curHsr = mode === 'match' ? perMin(cur.high_speed_distance_m, cur.duration_s) : cur.high_speed_distance_m;
      const curHie = perMin(cur.high_intensity_efforts, cur.duration_s);

      const selfTd = mean(own.map((r) => (mode === 'match' ? perMin(r.total_distance_m, r.duration_s) : r.total_distance_m)));
      const selfHsr = mean(own.map((r) => (mode === 'match' ? perMin(r.high_speed_distance_m, r.duration_s) : r.high_speed_distance_m)));
      const selfHie = mean(own.map((r) => perMin(r.high_intensity_efforts, r.duration_s)));

      const unitTd = mean(unitPeers.map((r) => (mode === 'match' ? perMin(r.total_distance_m, r.duration_s) : r.total_distance_m)));

      const vsSelf =
        curTd !== null && curHsr !== null && curHie !== null && selfTd !== null && selfHsr !== null && selfHie !== null
          ? Math.round(
              (((curTd / (selfTd || 1)) * 100 + (curHsr / (selfHsr || 1)) * 100 + (curHie / (selfHie || 1)) * 100) / 3),
            )
          : null;
      const vsUnit = curTd !== null && unitTd !== null && unitTd > 0 ? Math.round((curTd / unitTd) * 100) : null;

      const row: ComparisonRow & { deviation: number } = {
        id: cur.athlete_id,
        label: `${athlete.last_name}, ${athlete.first_name}`,
        sublabel: groupById.get(unitId ?? '') ?? null,
        cells: [
          { value: vsSelf !== null ? `${vsSelf}%` : '—', pct: vsSelf, isScore: true },
          { value: vsUnit !== null ? `${vsUnit}%` : '—', pct: vsUnit, isScore: true },
        ],
        highlighted: false,
        href: `/squad/${cur.athlete_id}`,
        deviation: vsSelf !== null ? Math.abs(vsSelf - 100) : -1,
      };
      return row;
    })
    .filter((r): r is ComparisonRow & { deviation: number } => r !== null)
    .sort((a, b) => b.deviation - a.deviation);

  return {
    columns: [
      { key: 'name', label: 'Athlete' },
      { key: 'vsSelf', label: 'vs self' },
      { key: 'vsUnit', label: 'vs unit' },
    ],
    rows,
    caption: 'vs self is against the athlete’s own mean for this session type · vs unit is against their positional unit’s · sorted by deviation from self',
  };
}

// ---------------------------------------------------------------------------
// Scatter — training only, spec §8
// ---------------------------------------------------------------------------

export type ScatterPoint = {
  athleteId: string;
  name: string;
  unit: string;
  td: number;
  hsr: number;
  hie: number;
  band: 'far' | 'near' | 'mid' | 'low';
};

const BANDS_SELF = { far: 1.25, near: 1.12, low: 0.88 };
const BANDS_POSITION = { far: 1.45, near: 1.22, low: 0.78 };

function bandOf(value: number, reference: number, lens: 'self' | 'position'): 'far' | 'near' | 'mid' | 'low' {
  if (reference <= 0) return 'mid';
  const ratio = value / reference;
  const b = lens === 'self' ? BANDS_SELF : BANDS_POSITION;
  if (ratio >= b.far) return 'far';
  if (ratio >= b.near) return 'near';
  if (ratio <= b.low) return 'low';
  return 'mid';
}

export async function fetchScatterData(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  session: TrainingSessionOption,
  lens: 'self' | 'position',
): Promise<ScatterPoint[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let curQuery = db
    .from('gps_records')
    .select('athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts')
    .eq('org_id', orgId)
    .eq('session_id', session.sessionId);
  if (scope) curQuery = curQuery.in('athlete_id', scope);
  const { data: curRecords, error: curErr } = await curQuery;
  if (curErr) throw new Error(curErr.message);
  if (!curRecords || curRecords.length === 0) return [];

  const athleteIds = curRecords.map((r) => r.athlete_id);
  const [athletesRes, membershipsRes, groupsRes, histRes] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).in('id', athleteIds),
    db.from('group_memberships').select('athlete_id, group_id').eq('org_id', orgId).in('athlete_id', athleteIds).is('removed_at', null),
    db.from('groups').select('id, name').eq('org_id', orgId).eq('group_type', 'positional').is('deleted_at', null),
    db
      .from('gps_records')
      .select('athlete_id, total_distance_m, session_id, sessions!inner(session_type, title)')
      .eq('org_id', orgId)
      .eq('sessions.session_type', 'training')
      .eq('sessions.title', session.title)
      .neq('session_id', session.sessionId)
      .in('athlete_id', athleteIds),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (histRes.error) throw new Error(histRes.error.message);

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const unitByAthlete = new Map((membershipsRes.data ?? []).map((m) => [m.athlete_id, m.group_id]));
  const unitNameById = new Map((groupsRes.data ?? []).map((g) => [g.id, g.name]));

  const groupedHist = new Map<string, number[]>();
  for (const r of histRes.data ?? []) {
    if (r.total_distance_m === null) continue;
    const list = groupedHist.get(r.athlete_id) ?? [];
    list.push(r.total_distance_m);
    groupedHist.set(r.athlete_id, list);
  }

  const unitMeanTd = new Map<string, number>();
  if (lens === 'position') {
    const byUnit = new Map<string, number[]>();
    for (const r of curRecords) {
      if (r.total_distance_m === null) continue;
      const unit = unitByAthlete.get(r.athlete_id);
      if (!unit) continue;
      const list = byUnit.get(unit) ?? [];
      list.push(r.total_distance_m);
      byUnit.set(unit, list);
    }
    for (const [unit, values] of byUnit) unitMeanTd.set(unit, mean(values) ?? 0);
  }

  return curRecords
    .map((r) => {
      const athlete = athleteById.get(r.athlete_id);
      if (!athlete || r.total_distance_m === null || r.high_speed_distance_m === null || r.high_intensity_efforts === null) return null;
      const unitId = unitByAthlete.get(r.athlete_id);
      const unitName = unitNameById.get(unitId ?? '') ?? 'Unassigned';
      const reference = lens === 'self' ? (mean(groupedHist.get(r.athlete_id) ?? []) ?? r.total_distance_m) : (unitMeanTd.get(unitId ?? '') ?? r.total_distance_m);
      return {
        athleteId: r.athlete_id,
        name: `${athlete.last_name}, ${athlete.first_name}`,
        unit: unitName,
        td: r.total_distance_m,
        hsr: r.high_speed_distance_m,
        hie: r.high_intensity_efforts,
        band: bandOf(r.total_distance_m, reference, lens),
      };
    })
    .filter((p): p is ScatterPoint => p !== null);
}

// ---------------------------------------------------------------------------
// Selected athlete panel — spec §8
// ---------------------------------------------------------------------------

export type SparklinePoint = { sessionId: string; date: string; hsr: number };

export type SelectedAthletePanel = {
  athleteId: string;
  name: string;
  unit: string;
  rows: { metric: string; today: string; vsSelf: string; vsUnit: string }[];
  sparkline: SparklinePoint[];
  footnote: string;
};

export async function fetchSelectedAthletePanel(
  db: Db,
  orgId: string,
  session: TrainingSessionOption,
  athleteId: string,
): Promise<SelectedAthletePanel | null> {
  const [athleteRes, curRes, membershipRes] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).eq('id', athleteId).maybeSingle(),
    db
      .from('gps_records')
      .select('total_distance_m, high_speed_distance_m, high_intensity_efforts')
      .eq('org_id', orgId)
      .eq('session_id', session.sessionId)
      .eq('athlete_id', athleteId)
      .maybeSingle(),
    db.from('group_memberships').select('group_id, groups(name)').eq('org_id', orgId).eq('athlete_id', athleteId).is('removed_at', null).limit(1).maybeSingle(),
  ]);
  if (athleteRes.error) throw new Error(athleteRes.error.message);
  if (curRes.error) throw new Error(curRes.error.message);
  if (!athleteRes.data || !curRes.data) return null;

  const [ownHistRes, unitRes] = await Promise.all([
    db
      .from('gps_records')
      .select('session_id, record_date, total_distance_m, high_speed_distance_m, high_intensity_efforts, sessions!inner(session_type, title)')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .eq('sessions.session_type', 'training')
      .eq('sessions.title', session.title)
      .order('record_date', { ascending: false })
      .limit(30),
    membershipRes.data?.group_id
      ? db
          .from('group_memberships')
          .select('athlete_id')
          .eq('org_id', orgId)
          .eq('group_id', membershipRes.data.group_id)
          .is('removed_at', null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ownHistRes.error) throw new Error(ownHistRes.error.message);

  const ownOtherSessions = (ownHistRes.data ?? []).filter((r) => r.session_id !== session.sessionId);
  const selfTd = mean(ownOtherSessions.map((r) => r.total_distance_m));
  const selfHsr = mean(ownOtherSessions.map((r) => r.high_speed_distance_m));
  const selfHie = mean(ownOtherSessions.map((r) => r.high_intensity_efforts));

  const unitAthleteIds = (unitRes.data ?? []).map((m: { athlete_id: string }) => m.athlete_id).filter((id: string) => id !== athleteId);
  let unitTd: number | null = null;
  let unitHsr: number | null = null;
  let unitHie: number | null = null;
  if (unitAthleteIds.length > 0) {
    const { data: unitRecs, error: unitErr } = await db
      .from('gps_records')
      .select('total_distance_m, high_speed_distance_m, high_intensity_efforts, session_id')
      .eq('org_id', orgId)
      .eq('session_id', session.sessionId)
      .in('athlete_id', unitAthleteIds);
    if (unitErr) throw new Error(unitErr.message);
    unitTd = mean((unitRecs ?? []).map((r) => r.total_distance_m));
    unitHsr = mean((unitRecs ?? []).map((r) => r.high_speed_distance_m));
    unitHie = mean((unitRecs ?? []).map((r) => r.high_intensity_efforts));
  }

  const pctOf = (v: number | null, ref: number | null) => (v !== null && ref !== null && ref > 0 ? `${Math.round((v / ref) * 100)}%` : '—');

  const cur = curRes.data;
  const rows = [
    { metric: 'Total distance', today: fmtInt(cur.total_distance_m) + ' m', vsSelf: pctOf(cur.total_distance_m, selfTd), vsUnit: pctOf(cur.total_distance_m, unitTd) },
    { metric: 'High speed running', today: fmtInt(cur.high_speed_distance_m) + ' m', vsSelf: pctOf(cur.high_speed_distance_m, selfHsr), vsUnit: pctOf(cur.high_speed_distance_m, unitHsr) },
    { metric: 'High intensity efforts', today: cur.high_intensity_efforts !== null ? String(cur.high_intensity_efforts) : '—', vsSelf: pctOf(cur.high_intensity_efforts, selfHie), vsUnit: pctOf(cur.high_intensity_efforts, unitHie) },
  ];

  // 14-point sparkline: this athlete's last 14 real training sessions
  // of ANY type, not just this one's — a broader, still-real reading of
  // "history" than the scoring reference's stricter same-type rule,
  // chosen because only 4 sessions of any one title exist on record and
  // a 4-point sparkline says very little.
  const { data: sparkRaw, error: sparkErr } = await db
    .from('gps_records')
    .select('session_id, record_date, high_speed_distance_m, sessions!inner(session_type)')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .eq('sessions.session_type', 'training')
    .order('record_date', { ascending: false })
    .limit(14);
  if (sparkErr) throw new Error(sparkErr.message);
  const sparkline: SparklinePoint[] = (sparkRaw ?? [])
    .filter((r) => r.high_speed_distance_m !== null)
    .map((r) => ({ sessionId: r.session_id ?? '', date: r.record_date, hsr: r.high_speed_distance_m as number }))
    .reverse();

  const sparkMean = mean(sparkline.map((p) => p.hsr));
  const todayHsr = cur.high_speed_distance_m;
  const delta = sparkMean !== null && sparkMean > 0 && todayHsr !== null ? Math.round((100 * (todayHsr - sparkMean)) / sparkMean) : null;

  return {
    athleteId,
    name: `${athleteRes.data.last_name}, ${athleteRes.data.first_name}`,
    unit: (membershipRes.data as { groups?: { name: string } } | null)?.groups?.name ?? 'Unassigned',
    rows,
    sparkline,
    footnote:
      sparkMean !== null && todayHsr !== null
        ? `Mean ${Math.round(sparkMean).toLocaleString()} m · today ${Math.round(todayHsr).toLocaleString()} m · ${delta !== null ? (delta >= 0 ? `+${delta}` : delta) + '%' : '—'}`
        : 'Not enough history yet.',
  };
}

// ---------------------------------------------------------------------------
// Board — spec §9
// ---------------------------------------------------------------------------

export type TrainingBoardRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  group_name: string;
  group_sort: number;
  td: number | null;
  run: number | null;
  hsr: number | null;
  hie: number | null;
  maxv_kmh: number | null;
  vs_self: number | null;
  vs_unit: number | null;
};

export async function fetchTrainingBoard(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  session: TrainingSessionOption,
): Promise<{ rows: TrainingBoardRow[]; unitOrder: string[] }> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let curQuery = db
    .from('gps_records')
    .select('athlete_id, total_distance_m, running_distance_m, high_speed_distance_m, high_intensity_efforts, max_speed_ms')
    .eq('org_id', orgId)
    .eq('session_id', session.sessionId);
  if (scope) curQuery = curQuery.in('athlete_id', scope);
  const { data: curRecords, error: curErr } = await curQuery;
  if (curErr) throw new Error(curErr.message);
  if (!curRecords || curRecords.length === 0) return { rows: [], unitOrder: [] };

  const athleteIds = curRecords.map((r) => r.athlete_id);
  const [athletesRes, membershipsRes, groupsRes, histRes] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).in('id', athleteIds),
    db.from('group_memberships').select('athlete_id, group_id').eq('org_id', orgId).in('athlete_id', athleteIds).is('removed_at', null),
    db.from('groups').select('id, name, sort_order').eq('org_id', orgId).eq('group_type', 'positional').is('deleted_at', null),
    db
      .from('gps_records')
      .select('athlete_id, total_distance_m, session_id, sessions!inner(session_type, title)')
      .eq('org_id', orgId)
      .eq('sessions.session_type', 'training')
      .eq('sessions.title', session.title)
      .neq('session_id', session.sessionId)
      .in('athlete_id', athleteIds),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (histRes.error) throw new Error(histRes.error.message);

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const groupById = new Map((groupsRes.data ?? []).map((g) => [g.id, g]));
  const unitByAthlete = new Map((membershipsRes.data ?? []).map((m) => [m.athlete_id, m.group_id]));

  const selfHistByAthlete = new Map<string, number[]>();
  for (const r of histRes.data ?? []) {
    if (r.total_distance_m === null) continue;
    const list = selfHistByAthlete.get(r.athlete_id) ?? [];
    list.push(r.total_distance_m);
    selfHistByAthlete.set(r.athlete_id, list);
  }

  const byUnit = new Map<string, number[]>();
  for (const r of curRecords) {
    if (r.total_distance_m === null) continue;
    const unit = unitByAthlete.get(r.athlete_id);
    if (!unit) continue;
    const list = byUnit.get(unit) ?? [];
    list.push(r.total_distance_m);
    byUnit.set(unit, list);
  }
  const unitMean = new Map<string, number>();
  for (const [unit, values] of byUnit) unitMean.set(unit, mean(values) ?? 0);

  const rows: TrainingBoardRow[] = curRecords
    .map((r) => {
      const athlete = athleteById.get(r.athlete_id);
      if (!athlete) return null;
      const unitId = unitByAthlete.get(r.athlete_id);
      const group = unitId ? groupById.get(unitId) : null;
      const selfMean = mean(selfHistByAthlete.get(r.athlete_id) ?? []);
      const uMean = unitId ? unitMean.get(unitId) ?? null : null;
      return {
        athlete_id: r.athlete_id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        group_name: group?.name ?? 'UNASSIGNED',
        group_sort: group?.sort_order ?? 999,
        td: r.total_distance_m,
        run: r.running_distance_m,
        hsr: r.high_speed_distance_m,
        hie: r.high_intensity_efforts,
        maxv_kmh: r.max_speed_ms !== null ? Math.round(r.max_speed_ms * 3.6 * 10) / 10 : null,
        vs_self: r.total_distance_m !== null && selfMean !== null && selfMean > 0 ? Math.round((r.total_distance_m / selfMean) * 100) : null,
        vs_unit: r.total_distance_m !== null && uMean !== null && uMean > 0 ? Math.round((r.total_distance_m / uMean) * 100) : null,
      };
    })
    .filter((r): r is TrainingBoardRow => r !== null)
    .sort((a, b) => a.group_sort - b.group_sort || (b.td ?? 0) - (a.td ?? 0));

  const unitOrder = [...new Set(rows.map((r) => r.group_name))].sort((a, b) => {
    const sa = rows.find((r) => r.group_name === a)?.group_sort ?? 999;
    const sb = rows.find((r) => r.group_name === b)?.group_sort ?? 999;
    return sa - sb;
  });

  return { rows, unitOrder };
}

export type MatchBoardRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  group_name: string;
  group_sort: number;
  td: number | null;
  hsr: number | null;
  hsr_per_min: number | null;
  hie: number | null;
  maxv_kmh: number | null;
  mins: number | null;
};

/** Whole-match only — see file header. Mins, TD, HSR, HSR/min, HIE, MaxV,
 *  every one a real, honest whole-session value. No H1/H2 columns: this
 *  schema has nothing to split them from. */
export async function fetchMatchBoard(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  match: MatchSessionOption,
): Promise<{ rows: MatchBoardRow[]; unitOrder: string[] }> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let curQuery = db
    .from('gps_records')
    .select('athlete_id, total_distance_m, high_speed_distance_m, high_intensity_efforts, max_speed_ms, duration_s')
    .eq('org_id', orgId)
    .eq('session_id', match.sessionId);
  if (scope) curQuery = curQuery.in('athlete_id', scope);
  const { data: curRecords, error: curErr } = await curQuery;
  if (curErr) throw new Error(curErr.message);
  if (!curRecords || curRecords.length === 0) return { rows: [], unitOrder: [] };

  const athleteIds = curRecords.map((r) => r.athlete_id);
  const [athletesRes, membershipsRes, groupsRes] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).in('id', athleteIds),
    db.from('group_memberships').select('athlete_id, group_id').eq('org_id', orgId).in('athlete_id', athleteIds).is('removed_at', null),
    db.from('groups').select('id, name, sort_order').eq('org_id', orgId).eq('group_type', 'positional').is('deleted_at', null),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const groupById = new Map((groupsRes.data ?? []).map((g) => [g.id, g]));
  const unitByAthlete = new Map((membershipsRes.data ?? []).map((m) => [m.athlete_id, m.group_id]));

  const rows: MatchBoardRow[] = curRecords
    .map((r) => {
      const athlete = athleteById.get(r.athlete_id);
      if (!athlete) return null;
      const unitId = unitByAthlete.get(r.athlete_id);
      const group = unitId ? groupById.get(unitId) : null;
      return {
        athlete_id: r.athlete_id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        group_name: group?.name ?? 'UNASSIGNED',
        group_sort: group?.sort_order ?? 999,
        td: r.total_distance_m,
        hsr: r.high_speed_distance_m,
        hsr_per_min: r.high_speed_distance_m !== null && r.duration_s ? Math.round((r.high_speed_distance_m / (r.duration_s / 60)) * 10) / 10 : null,
        hie: r.high_intensity_efforts,
        maxv_kmh: r.max_speed_ms !== null ? Math.round(r.max_speed_ms * 3.6 * 10) / 10 : null,
        mins: r.duration_s !== null ? Math.round(r.duration_s / 60) : null,
      };
    })
    .filter((r): r is MatchBoardRow => r !== null)
    .sort((a, b) => a.group_sort - b.group_sort || (b.td ?? 0) - (a.td ?? 0));

  const unitOrder = [...new Set(rows.map((r) => r.group_name))].sort((a, b) => {
    const sa = rows.find((r) => r.group_name === a)?.group_sort ?? 999;
    const sb = rows.find((r) => r.group_name === b)?.group_sort ?? 999;
    return sa - sb;
  });

  return { rows, unitOrder };
}
