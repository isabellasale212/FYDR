/* LIFTED THIS WEEK, AGAINST THE WEEKS BEFORE — Isabella, 16 September 2026
 * (the overnight queue, 1.2: "simplify the gym data to how much was lifted
 * this week compared with previous weeks"). MET-044: a calendar week's
 * tonnage is the sum of MET-041 (session volume, load × reps over a
 * session's live sets) across the week's completed sessions, Monday-based
 * weeks in the club's own day; the current week runs to today and is said
 * to be unfinished. Pure, so the guard can hold it. */
import { formatKg } from '@/lib/gymHero';

export type WeekTonnage = {
  start: string;
  kg: number;
  sessions: number;
  partial: boolean;
};

export function weeklyTonnage(
  sessions: readonly { entry_date: string; total_volume_kg: number | null }[],
  weekStarts: readonly string[],
  mondayOf: (iso: string) => string,
): WeekTonnage[] {
  const kgByWeek = new Map<string, number>();
  const nByWeek = new Map<string, number>();
  for (const s of sessions) {
    const wk = mondayOf(s.entry_date);
    kgByWeek.set(wk, (kgByWeek.get(wk) ?? 0) + (s.total_volume_kg ?? 0));
    nByWeek.set(wk, (nByWeek.get(wk) ?? 0) + 1);
  }
  return weekStarts.map((start, i) => ({
    start,
    kg: Math.round((kgByWeek.get(start) ?? 0) * 10) / 10,
    sessions: nByWeek.get(start) ?? 0,
    partial: i === weekStarts.length - 1,
  }));
}

/** "up 1,240 kg on last week" — the direction as a word, never a colour. */
export function tonnageDeltaLine(thisKg: number, lastKg: number): string {
  if (lastKg === 0 && thisKg === 0) return 'nothing lifted this week or last';
  if (lastKg === 0) return 'nothing lifted last week to compare';
  const diff = Math.round((thisKg - lastKg) * 10) / 10;
  if (diff === 0) return 'the same as last week';
  return `${diff > 0 ? 'up' : 'down'} ${formatKg(Math.abs(diff)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} on last week`;
}

/** The change on last week as a direction and a size — the evening queue's
 *  "an increase or a decrease", no other words (16 Sept 2026). Null when
 *  there is nothing to compare. */
export function tonnageDelta(thisKg: number, lastKg: number): { dir: 'up' | 'down'; kg: number } | null {
  const diff = Math.round((thisKg - lastKg) * 10) / 10;
  if (diff === 0) return null;
  return { dir: diff > 0 ? 'up' : 'down', kg: Math.abs(diff) };
}

/** Whole kilograms with a thousands separator, for the headline. */
export function formatTonnage(kg: number): string {
  return `${Math.round(kg).toLocaleString('en-GB')} kg`;
}
