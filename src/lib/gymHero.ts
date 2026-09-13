/* ATH-ADULT-12 C5 (2026-09-13): My data's gym hero — "Back squat best 102.5
 * kg, up 5 kg this block". The comparison window is the screen's own period
 * rather than a programme block (blocks carry no dates the athlete sees;
 * the period is the window the whole tab already reads to), and the line
 * says which: "up 5 kg on your best before Mon 17 Aug". MET-040's rule for
 * a best (the heaviest working set, ties on reps), twice — inside the
 * period and before it. Pure. */
import { formatDate } from '@/lib/format';

export type HeroBest = { load_kg: number; reps: number; entry_date: string };

export function formatKg(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace(/\.0$/, '')} kg`;
}

/** Which lift the hero is about: the one with the most working sets in the
 *  period; a tie goes to the heavier best. */
export function pickMainLift<T extends { sets: number; best: HeroBest }>(byExercise: ReadonlyMap<string, T>): string | null {
  let pick: string | null = null;
  let pickRow: T | null = null;
  for (const [id, row] of byExercise) {
    if (pickRow === null || row.sets > pickRow.sets || (row.sets === pickRow.sets && row.best.load_kg > pickRow.best.load_kg)) {
      pick = id;
      pickRow = row;
    }
  }
  return pick;
}

export function gymHeroLine(
  o: { name: string; best: HeroBest; prior: HeroBest | null; from: string },
  timezone: string,
): { value: string; label: string; delta: string } {
  const value = formatKg(o.best.load_kg);
  const label = `${o.name} best · × ${o.best.reps} · ${formatDate(o.best.entry_date, timezone)}`;
  const before = `your best before ${formatDate(o.from, timezone)}`;
  let delta: string;
  if (!o.prior) delta = `no earlier best to compare — the first ${o.name} logged`;
  else {
    const diff = Math.round((o.best.load_kg - o.prior.load_kg) * 100) / 100;
    if (diff > 0) delta = `up ${formatKg(diff)} on ${before}`;
    else if (diff < 0) delta = `down ${formatKg(-diff)} on ${before}`;
    else if (o.best.reps > o.prior.reps) delta = `same load, ${o.best.reps - o.prior.reps} more rep${o.best.reps - o.prior.reps === 1 ? '' : 's'} than ${before}`;
    else delta = `equal to ${before}`;
  }
  return { value, label, delta };
}
