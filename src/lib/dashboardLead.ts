/* STAFF-SS-01 C2 — the matchday lead card's sentences (2026-09-13). The
 * board: "The matchday card is the one emphasised card. The lead keeps
 * 'Ready for {matchday}' with doubtful and ruled out." and data rule 6
 * applied literally — status and restriction for everyone; the reason only
 * for the medic, and a non-clinical reason (Academic, personal, work)
 * without the "Medical · visible to medical staff" label.
 *
 * Pure: the page reads, this file says. scripts/test-dashboard-lead-card.ts
 * exercises every branch with rows. */
import { bodyAreaPhrase, enumLabel, formatDate, formatTime } from '@/lib/format';

/** "v Colthorne RFC · Sat 12 Sept, 15:00 · home" — kick-off in club time;
 *  the venue only when one is recorded. */
export function leadTitle(
  fixture: { opponent: string; kickoffAt: string; homeAway: string | null },
  timezone: string,
): string {
  const when = `${formatDate(fixture.kickoffAt, timezone)}, ${formatTime(fixture.kickoffAt, timezone)}`;
  return `v ${fixture.opponent} · ${when}${fixture.homeAway ? ` · ${fixture.homeAway}` : ''}`;
}

/** "27 of 30 have a current status · 3 not recorded · MD in 5 days". The
 *  board's answer to its own open question 9: an athlete with no status is
 *  counted in none of the three and SAID, never folded into "available". */
export function leadSubLine(o: { withStatus: number; squadTotal: number; daysOut: number | null }): string {
  const md =
    o.daysOut === null ? null : o.daysOut === 0 ? 'matchday' : o.daysOut === 1 ? 'MD tomorrow' : `MD in ${o.daysOut} days`;
  if (o.squadTotal === 0) return ['No athletes in this filter', md].filter(Boolean).join(' · ');
  const notRecorded = o.squadTotal - o.withStatus;
  return [
    `${o.withStatus} of ${o.squadTotal} have a current status`,
    notRecorded > 0 ? `${notRecorded} not recorded` : null,
    md,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Modified · running and gym only, no contact" — the status word and the
 *  restriction line, which is what a session is planned against. Never the
 *  reason: that is the medic's line below. */
export function restrictionStatusLine(status: 'modified' | 'unavailable', restrictions: readonly string[]): string {
  const word = enumLabel(status);
  if (restrictions.length > 0) return `${word} · ${restrictions.join(', ')}`;
  return status === 'unavailable' ? `${word} · not available for selection` : `${word} · no restriction recorded`;
}

/** The medic's one reason line per name. `clinical` says whether it sits
 *  under the "Medical · visible to medical staff" eyebrow: an injury's line
 *  always does (even "no diagnosis recorded" is a clinical fact); a
 *  non-clinical category never does. */
export function selectionReasonLine(o: {
  reason: string | null;
  note: string | null;
  diagnosis: string | null;
  bodyArea: string | null;
  side: string | null;
}): { text: string; clinical: boolean } {
  if (o.reason === 'injury' || o.diagnosis) {
    if (o.diagnosis) return { text: o.diagnosis, clinical: true };
    const site = o.bodyArea ? bodyAreaPhrase({ body_area: o.bodyArea, side: o.side }) : null;
    return { text: site ? `${site} · no diagnosis recorded` : 'No diagnosis recorded', clinical: true };
  }
  if (!o.reason) return { text: 'No reason recorded', clinical: false };
  return { text: `${enumLabel(o.reason)}${o.note ? ` — ${o.note}` : ''}`, clinical: false };
}
