'use client';

import { useState } from 'react';

const DOMAINS = ['Nutrition', 'Wellness', 'Gym'] as const;

/* PLAYER-PROFILE-SPEC.md §4 and §11: single-select, default none active.
 * §11 spells out exactly how far this goes in this pass: "Switching one
 * changes only chip styling in the prototype; in production it should swap
 * the profile into that domain's detail view." That's the spec's own
 * explicit scope line, not a cut this build is making unilaterally — three
 * new domain-scoped detail views is a second feature, not a chip. */
export function DomainChips() {
  const [active, setActive] = useState<(typeof DOMAINS)[number] | null>(null);

  return (
    <div className="pp-domain-chips" role="group" aria-label="Domain filter">
      {DOMAINS.map((domain) => (
        <button
          key={domain}
          type="button"
          className="squad-chip"
          aria-pressed={active === domain}
          onClick={() => setActive((current) => (current === domain ? null : domain))}
        >
          {domain}
        </button>
      ))}
    </div>
  );
}
