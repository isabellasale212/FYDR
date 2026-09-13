/* PATTERN-S6 C6 (2026-09-13): "A failed live write undoes itself and says
 * where … The notice names both times and the count affected." In this
 * schedule the write is the publish (edits are held — S4 D1 declined), so a
 * failed write is one session whose publish was refused. The sentence is
 * pure; the workspace keeps the change held and draws the two positions. */
import { formatDate } from '@/lib/format';

export type FailedWriteKind = 'edit' | 'add' | 'remove';

export type FailedWrite = {
  kind: FailedWriteKind;
  title: string;
  /** What the athletes still have (null for a session that never landed). */
  was: { dow: string; start: number } | null;
  /** What was tried (null for a removal). */
  tried: { dow: string; start: number } | null;
  athletes: number;
  /** The humanised refusal the helper returned. */
  error: string;
};

function clock(decimalHour: number): string {
  const total = Math.round(decimalHour * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function when(p: { dow: string; start: number }, timezone: string): string {
  return `${formatDate(p.dow, timezone)} · ${clock(p.start)}`;
}

export function failedWriteLine(f: FailedWrite, timezone: string): string {
  const who = f.athletes === 0 ? 'staff only' : `${f.athletes} athlete${f.athletes === 1 ? '' : 's'} affected`;
  const reason = f.error.replace(/[.\s]+$/, '');
  let where: string;
  if (f.kind === 'add' && f.tried) {
    where = `The athletes have nothing at ${when(f.tried, timezone)} yet`;
  } else if (f.kind === 'remove' && f.was) {
    where = `The athletes still have ${when(f.was, timezone)}`;
  } else if (f.was && f.tried) {
    const sameDay = f.was.dow === f.tried.dow;
    where = `The athletes still have ${when(f.was, timezone)}; you tried ${sameDay ? clock(f.tried.start) : when(f.tried, timezone)}`;
  } else {
    where = 'The athletes still have the session as it was';
  }
  return `${f.title} did not save — ${reason}. ${where} · ${who}.`;
}
