/* PATTERN-S4 C6 (2026-09-13): the phone schedule is day-first — the
 * dashboard's week strip, then the selected day as a list. These are the
 * day view's sentences; the component draws, this file says. */
import { formatDate, mdLabel } from '@/lib/format';

/** Today when the week holds it, else the week's first day. */
export function phoneDayDefault(days: readonly string[], today: string, focus?: string | null): string {
  /* 16 Sept 2026 (2.1): a day asked for in the address (?date=, the day
     stepper crossing a week) opens on that day; else today; else Monday. */
  if (focus && days.includes(focus)) return focus;
  return days.includes(today) ? today : (days[0] ?? today);
}

/** The day stepper's neighbour (16 Sept 2026, 2.1: the phone shows the DAY
 *  only): the date a step before or after, and whether it is inside the
 *  loaded week — inside is a state change, outside is a navigation to
 *  that week. */
export function dayStep(days: readonly string[], day: string, dir: -1 | 1): { date: string; inWeek: boolean } {
  const i = days.indexOf(day);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < days.length) return { date: days[j]!, inWeek: true };
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dir);
  return { date: d.toISOString().slice(0, 10), inWeek: false };
}

/** "MD-2 · 1 session · 80 minutes"; an empty day is "Nothing scheduled". */
export function dayHeadMeta(o: { mdOffset: number | null; sessions: number; minutes: number }): string {
  if (o.sessions === 0) return 'Nothing scheduled';
  const md = mdLabel(o.mdOffset);
  return [md, `${o.sessions} session${o.sessions === 1 ? '' : 's'}`, `${o.minutes} minutes`].filter(Boolean).join(' · ');
}

/** "Main pitch · 80 min · Backs and Forwards · 27 expected" — the row's
 *  second line. No group is staff only (the panel's own rule). */
export function rowMeta(o: { location: string | null; mins: number; groupNames: readonly string[]; expected: number }): string {
  const who = o.groupNames.length === 0 ? 'Staff only' : `${o.groupNames.join(' and ')} · ${o.expected} expected`;
  return `${o.location ?? 'Location not set'} · ${o.mins} min · ${who}`;
}

/** The first session on a later day of the week — "Fri 11 Sept · Captain's
 *  run · 10:00" — or null when nothing follows. */
export function nextSessionLine(
  sessions: readonly { id: string; dow: string; start: number; title?: string }[],
  day: string,
  timezone: string,
): { id: string; text: string } | null {
  const later = sessions.filter((s) => s.dow > day).sort((a, b) => a.dow.localeCompare(b.dow) || a.start - b.start);
  const next = later[0];
  if (!next) return null;
  const h = Math.floor(next.start);
  const m = Math.round((next.start - h) * 60);
  const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { id: next.id, text: `${formatDate(next.dow, timezone)} · ${next.title ?? 'Session'} · ${clock}` };
}
