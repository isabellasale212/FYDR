'use client';

import { useState } from 'react';
import Link from 'next/link';

type Props = {
  athleteId: string;
  /** Real active programme, if any — Gym only has somewhere real to go
   *  when one exists; see this file's own header for what happens without
   *  one. */
  gymProgrammeId: string | null;
};

/* PLAYER-PROFILE-SPEC.md §4 and §11 originally shipped these as pure
 * styling toggles: "Switching one changes only chip styling in the
 * prototype; in production it should swap the profile into that domain's
 * detail view." That line is the spec's own stated scope for THAT pass, not
 * a permanent cut — a coach reviewing the live app found exactly this ("make
 * sure the nutrition, wellness, gym... buttons are clickable"), so this is
 * that production step, done the way the rest of this page already does
 * "expand vs navigate": whichever is faster, per domain.
 *
 *   - Nutrition anchors to #pp-nutrition-title. The real content (targets,
 *     macros) is already two cards below on this exact page — sending a
 *     coach to the squad-wide /nutrition workspace to see one athlete's
 *     numbers would be slower, not faster.
 *   - Wellness anchors to #pp-wellness-title (ACWR + wellness rating,
 *     added to that section below). No dedicated per-athlete wellness
 *     history page exists anywhere in this app — this on-page section is
 *     the real, whole answer, not a placeholder for a missing one.
 *   - Gym navigates to /programmes/[id]/athlete/[athleteId] — a real,
 *     already-shipped per-athlete programme view (screens/programme-
 *     builder.md's "Tailor" tab) — when this athlete has an active
 *     programme. Without one there is nothing real to show or link to;
 *     rather than invent a destination, the chip stays visibly disabled
 *     with a title explaining why, an honest empty state instead of a dead
 *     click. */
export function DomainChips({ athleteId, gymProgrammeId }: Props) {
  const [active, setActive] = useState<'Nutrition' | 'Wellness' | 'Gym' | null>(null);

  function scrollTo(id: string, domain: 'Nutrition' | 'Wellness') {
    setActive(domain);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="pp-domain-chips" role="group" aria-label="Jump to domain detail">
      <button type="button" className="squad-chip" aria-pressed={active === 'Nutrition'} onClick={() => scrollTo('pp-nutrition-title', 'Nutrition')}>
        Nutrition
      </button>
      <button type="button" className="squad-chip" aria-pressed={active === 'Wellness'} onClick={() => scrollTo('pp-wellness-title', 'Wellness')}>
        Wellness
      </button>
      {gymProgrammeId ? (
        <Link href={`/programmes/${gymProgrammeId}/athlete/${athleteId}`} className="squad-chip">
          Gym
        </Link>
      ) : (
        <button type="button" className="squad-chip" disabled aria-disabled="true" title="No active gym programme assigned to this athlete.">
          Gym
        </button>
      )}
    </div>
  );
}
