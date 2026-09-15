/* STAFF-SS-02-05 C1 — the status header's sentences (2026-09-13). The
 * board's rule 1: "Every profile opens with the same status header. Name,
 * position, group, availability status and restrictions, in the dashboard's
 * words and tones. It is the one emphasised card on the screen and absorbs
 * the development-plan bar and the bio row." Pure; the page reads, this
 * file says. scripts/test-profile-status-header.ts exercises it with rows. */
import { enumLabel, formatDate } from '@/lib/format';

/** "Flanker · #7 · Forwards, Rehab" — the sub line under the name. A missing
 *  part is said, not skipped, so the line always has the same three parts. */
export function headerSubLine(o: { position: string | null; squadNumber: number | null; groupNames: readonly string[] }): string {
  /* Groups only since 16 Sept 2026 (Isabella's overnight queue, 3.1: "remove
     the repeated text in the player information card — it restates what is
     already shown, for example the position, twice"). Position and jersey
     are the detail row's; this line is what the row does not carry. */
  void o.position;
  void o.squadNumber;
  return o.groupNames.length > 0 ? o.groupNames.join(', ') : 'No group';
}

/** The restriction line: what a coach acts on (the board's rule 7 — never a
 *  protocol, never a diagnosis; the restriction strings are the availability
 *  row's own), then the expected return when the linked injury has one. An
 *  absence reads its category and the coach-visible note. "Not recorded"
 *  says what it means for the counts. Available draws nothing. */
export function headerRestrictionLine(
  o: {
    status: string;
    restrictions: readonly string[];
    reason: string | null;
    note: string | null;
    expectedReturn: string | null;
  },
  timezone: string,
): string | null {
  if (o.status === 'available') return null;
  if (o.status === 'unknown') return 'No restriction recorded. Not counted as available and not counted as out.';
  const back = o.expectedReturn ? ` Expected return to full training ${formatDate(o.expectedReturn, timezone)}.` : '';
  /* The coach-visible note travels with the restrictions: it is the one
     free-text field written for exactly this line. */
  const note = o.note ? ` ${o.note.replace(/[.\s]+$/, '')}.` : '';
  if (o.restrictions.length > 0) return `${o.restrictions.map(enumLabel).join(' · ')}.${note}${back}`;
  if (o.reason) return `${enumLabel(o.reason)}${o.note ? ` — ${o.note}` : ''}${back}`;
  return `No reason recorded${back}`;
}

/** "Set by medical staff · Ruth Callaghan · Fri 11 Sept" — who owns the
 *  current row (the board's rule 4, on the header). An injury-linked row is
 *  the medic's (availability_medical_*); any other row the coaching staff's
 *  (the coach's and the sport scientist's non-injury path, 0042/0068). With
 *  no row at all: the board's own words. */
export function headerOwnerLine(
  o: { status: string; injuryLinked: boolean; setByName: string | null; setOn: string | null },
  timezone: string,
): string {
  if (o.status === 'unknown') return 'Set by medical staff · nothing recorded';
  const who = o.injuryLinked ? 'Set by medical staff' : 'Set by coaching staff';
  return [who, o.setByName, o.setOn ? formatDate(o.setOn, timezone) : null].filter(Boolean).join(' · ');
}

/** "Development plan · In-Season max · week 2 of 4 · ends Tue 29 Sept" —
 *  the plan bar's three facts as one line inside the header. */
export function planLine(
  programme: { name: string; weekNow: number | null; weekTotal: number | null; endsOn: string | null } | null,
  timezone: string,
): string {
  if (!programme) return 'Development plan · none assigned';
  /* programme-dates.md (0132): an unmapped assignment has no week to count
     and no end; the line says so instead of inventing week 1. */
  const week =
    programme.weekNow === null
      ? 'no start date set'
      : programme.weekTotal !== null
        ? `week ${programme.weekNow} of ${programme.weekTotal}`
        : `week ${programme.weekNow}`;
  return ['Development plan', programme.name, week, programme.endsOn ? `ends ${formatDate(programme.endsOn, timezone)}` : null]
    .filter(Boolean)
    .join(' · ');
}
