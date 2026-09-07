import Link from 'next/link';

type Props = {
  athleteId: string;
};

/* PLAYER-PROFILE-SPEC.md §4 and §11 shipped these as pure styling toggles:
 * "Switching one changes only chip styling in the prototype; in production it
 * should swap the profile into that domain's detail view." A first pass then
 * made them do something real but LOCAL — Nutrition and Wellness scrolled to a
 * card further down this same page, and Gym linked to the programme view when
 * one existed and rendered disabled when it did not.
 *
 * The client asked for the rest of that sentence, verbatim: "on the player
 * profile when i click on the buttons nutrition, wellness and gym i should be
 * taken to a NEW PAGE with just that info in it ... there should also be a
 * comparison to other people in their position". A scroll anchor is not a new
 * page and cannot carry a positional comparison, so all three are now real
 * routes:
 *
 *   /squad/[athleteId]/nutrition
 *   /squad/[athleteId]/wellness
 *   /squad/[athleteId]/gym
 *
 * THREE THINGS THAT CHANGED WITH THAT, EACH FOR A REASON:
 *
 *  1. NO MORE `use client`, and no more useState. Every chip is a Link now, so
 *     the only thing the state did — the pressed styling on a chip that
 *     scrolled — has nothing left to describe. A client component that renders
 *     three anchors is a bundle nobody needed.
 *
 *  2. THE GYM CHIP IS NEVER DISABLED. It used to be, when the athlete had no
 *     active programme, because there was genuinely nowhere to send them. There
 *     is now: the gym page answers "what have they lifted" and "how does that
 *     compare" whether or not anything is prescribed, and says so plainly when
 *     nothing is. That also quietly fixes a real bug — the disabled state was
 *     driven by the profile's programme banner, which only ever looked at
 *     assignments made to the athlete BY NAME, so an athlete whose programme
 *     came through a group had a dead, tooltipped chip while being on a
 *     programme (see queries/programmes.ts's fetchAthleteProgrammeAssignments).
 *
 *  3. NO QUERY STRING IS CARRIED ON THESE LINKS, deliberately. The group filter
 *     and the period both fall back to their sticky cookies when a destination
 *     has no param of its own (groupFilter.server.ts, period.server.ts), so the
 *     coach's scope follows them across without this component hand-building
 *     hrefs from a fixed list of known keys — which is the exact mistake
 *     PeriodSelector.tsx's header catalogues (it happened on
 *     /reports/athlete/[athleteId], where a period change silently dropped
 *     `?groups=`; that screen has since adopted PeriodSelector and no longer
 *     does). */
export function DomainChips({ athleteId }: Props) {
  return (
    <div className="pp-domain-chips" role="group" aria-label="Open a domain detail page">
      <Link href={`/squad/${athleteId}/nutrition`} className="squad-chip">
        Nutrition
      </Link>
      <Link href={`/squad/${athleteId}/wellness`} className="squad-chip">
        Wellness
      </Link>
      <Link href={`/squad/${athleteId}/gym`} className="squad-chip">
        Gym
      </Link>
    </div>
  );
}
