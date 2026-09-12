/* The gym session summary's arithmetic — ATH-ADULT-09 C6 (session complete)
 * and ATH-ADULT-10 C3 (finished early), decided 2026-09-12. Pure: the logger
 * hands over the sets it already has and the prior bests the page read, and
 * gets numbers and lines back. Registry entries MET-040 (best logged set)
 * and MET-041 (session volume) in docs/metrics.md state the rules; this
 * file is where they are computed for the athlete's own screen.
 *
 * Two rules worth restating because they are easy to get wrong:
 *
 *   A WORKING SET is non-warm-up with load > 0 and reps > 0 — the same
 *   definition fetchBestSetLoadsForAthletes uses for the coach's positional
 *   band. A zero-rep set is a failed attempt, a zero-kilogram set is
 *   bodyweight work; neither is evidence of a load lifted.
 *
 *   VOLUME counts every set that carries both a load and reps — the 0106 rule
 *   gym_session_logs_current derives total_volume_kg by — so "Total volume"
 *   here and the tonnage in My data are the same number for the same session.
 */

export type SummarySet = {
  exercise_id: string;
  set_number: number;
  reps_completed: number | null;
  load_kg: number | null;
  is_warmup?: boolean;
};

export type BestSet = { load_kg: number; reps: number };
export type PriorBest = BestSet & { entry_date: string };

/** MET-041. Σ load × reps over the sets that carry both. */
export function sessionVolumeKg(sets: readonly SummarySet[]): number {
  let total = 0;
  for (const s of sets) {
    if (s.load_kg === null || s.reps_completed === null) continue;
    total += s.load_kg * s.reps_completed;
  }
  return Math.round(total * 10) / 10;
}

function isWorking(s: SummarySet): boolean {
  return !s.is_warmup && s.load_kg !== null && s.load_kg > 0 && s.reps_completed !== null && s.reps_completed > 0;
}

/** Which of two sets is the better lift: the heavier load; at the same load,
 *  the more reps. */
export function beats(a: BestSet, b: BestSet): boolean {
  return a.load_kg > b.load_kg || (a.load_kg === b.load_kg && a.reps > b.reps);
}

/** MET-040 for one session: the best working set per exercise. */
export function bestSetsByExercise(sets: readonly SummarySet[]): Map<string, BestSet> {
  const out = new Map<string, BestSet>();
  for (const s of sets) {
    if (!isWorking(s)) continue;
    const candidate = { load_kg: s.load_kg as number, reps: s.reps_completed as number };
    const prev = out.get(s.exercise_id);
    if (prev === undefined || beats(candidate, prev)) out.set(s.exercise_id, candidate);
  }
  return out;
}

export type NewBest = { exercise_id: string; best: BestSet; prior: PriorBest };

/** The session's new bests: an exercise whose best set today beats the best
 *  logged before today. An exercise with no prior is NOT a best — a best is
 *  a comparison, and the board's line ("Best before today 100 kg × 8 ·
 *  21 Aug") is what makes the claim checkable. Ordered as the session is. */
export function newBests(
  exerciseOrder: readonly string[],
  sets: readonly SummarySet[],
  priors: ReadonlyMap<string, PriorBest>,
): NewBest[] {
  const today = bestSetsByExercise(sets);
  const out: NewBest[] = [];
  const seen = new Set<string>();
  for (const id of exerciseOrder) {
    if (seen.has(id)) continue;
    seen.add(id);
    const best = today.get(id);
    const prior = priors.get(id);
    if (best === undefined || prior === undefined) continue;
    if (beats(best, prior)) out.push({ exercise_id: id, best, prior });
  }
  return out;
}

/** "7,290" — thousands separated, up to one decimal. */
export function formatKg(n: number): string {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(n);
}

/** One exercise's sets as a line: "102.5 kg × 8, 8, 8"; a bodyweight
 *  exercise "× 10, 10"; mixed loads "100 kg × 8 · 102.5 kg × 8"; nothing
 *  logged "Not logged" — never a dash, never a zero (the board's rule). */
export function setsLine(sets: readonly SummarySet[]): string {
  const ordered = [...sets].sort((a, b) => a.set_number - b.set_number);
  if (ordered.length === 0) return 'Not logged';
  const loads = new Set(ordered.map((s) => (s.load_kg !== null && s.load_kg > 0 ? s.load_kg : 0)));
  const reps = (s: SummarySet): string => (s.reps_completed !== null ? String(s.reps_completed) : 'no reps');
  if (loads.size === 1) {
    const load = [...loads][0] ?? 0;
    const repList = ordered.map(reps).join(', ');
    return load > 0 ? `${formatKg(load)} kg × ${repList}` : `× ${repList}`;
  }
  return ordered
    .map((s) => (s.load_kg !== null && s.load_kg > 0 ? `${formatKg(s.load_kg)} kg × ${reps(s)}` : `× ${reps(s)}`))
    .join(' · ');
}

/** "52 min" between two instants, whole minutes; null when either is missing. */
export function minutesBetween(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

/** What a corrected set was: "100 kg × 8", "× 10" with no load — the
 *  strip's "Set 1 corrected · was 100 kg × 8" (ATH-ADULT-11 C2). */
export function wasLine(set: { reps_completed: number | null; load_kg: number | null }): string {
  const reps = set.reps_completed !== null ? String(set.reps_completed) : 'no reps';
  return set.load_kg !== null ? `${formatKg(set.load_kg)} kg × ${reps}` : `× ${reps}`;
}
