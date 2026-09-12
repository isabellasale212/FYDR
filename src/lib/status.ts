/* The status vocabulary, from 06-design-system.md §5.2.
 *
 * Every status is a tone, a glyph and a word. A component that receives a tone
 * without a glyph is a bug: colour is always the redundant channel, because
 * roughly 8% of the male user base has a colour vision deficiency and clubs
 * print the availability board in greyscale.
 *
 * The characters here are the documented plain-text fallbacks. They are drawn
 * as text, so they survive a printer, a screen reader and a photocopy. */

import type { AvailabilityStatus, FlagSeverity, UserStatus } from '@/lib/types/database';

export type Tone = 'good' | 'warn' | 'bad' | 'accent' | 'neutral';

export type Status = {
  tone: Tone;
  glyph: string;
  label: string;
};

export const AVAILABILITY_STATUS: Record<
  AvailabilityStatus | 'unknown',
  Status
> = {
  available: { tone: 'good', glyph: '●', label: 'Available' },
  modified: { tone: 'warn', glyph: '◐', label: 'Modified' },
  unavailable: { tone: 'bad', glyph: '⊘', label: 'Unavailable' },
  /* "Not recorded", not "Not set" (STAFF-SS-02-05, 2026-09-12): no status is
     not a state of availability, and the dashboard already counts "3 not
     recorded". Neutral, never a tone. */
  unknown: { tone: 'neutral', glyph: '◌', label: 'Not recorded' },
};

export const SEVERITY_STATUS: Record<FlagSeverity, Status> = {
  low: { tone: 'accent', glyph: '▮▯▯', label: 'Low' },
  medium: { tone: 'warn', glyph: '▮▮▯', label: 'Medium' },
  high: { tone: 'bad', glyph: '▮▮▮', label: 'High' },
};

export const COMPLIANCE_STATUS = {
  complete: { tone: 'good', glyph: '✓', label: 'Complete' },
  partial: { tone: 'warn', glyph: '◑', label: 'Partial' },
  missing: { tone: 'bad', glyph: '✕', label: 'Missing' },
  waived: { tone: 'neutral', glyph: '⊖', label: 'Waived' },
  pending: { tone: 'neutral', glyph: '◌', label: 'Due' },
} satisfies Record<string, Status>;

/** Band position against the athlete's own range, §5.2 triangles. Inside the
 *  band carries no glyph at all: the value alone is the statement. */
export const BAND_STATUS = {
  above: { tone: 'bad', glyph: '⚠', label: 'Above their own band' },
  below: { tone: 'warn', glyph: '▽', label: 'Below their own band' },
  inside: { tone: 'neutral', glyph: '', label: 'Inside their own band' },
  unknown: { tone: 'neutral', glyph: '', label: 'Not enough history' },
} satisfies Record<string, Status>;

/** screens/user-management.md's own StatusPill list: "Invited, Active,
 *  Suspended, Deactivated, Declined, No account." This build only ever
 *  writes 'active' or 'deactivated' — see
 *  lib/queries/userManagement.ts's header for why 'invited' (needing a
 *  real acceptance flow) and 'suspended'/'declined' aren't reachable
 *  states here, and why "No account" isn't a users.status value at all
 *  (it's an unlinked athletes row with no matching user row, handled at
 *  the query layer, not here). Both are kept in the map anyway so the enum
 *  itself always has a rendering, not just the two states this pass reaches. */
export const USER_STATUS: Record<UserStatus, Status> = {
  active: { tone: 'good', glyph: '●', label: 'Active' },
  invited: { tone: 'accent', glyph: '◐', label: 'Invited' },
  suspended: { tone: 'warn', glyph: '◐', label: 'Suspended' },
  deactivated: { tone: 'neutral', glyph: '⊘', label: 'Deactivated' },
};

export function availabilityStatus(
  status: AvailabilityStatus | null | undefined,
): Status {
  return AVAILABILITY_STATUS[status ?? 'unknown'];
}

/** sar_requests.status, migration 0032 — a plain text check constraint,
 *  not a Postgres enum (three fixed values, one small table, not worth a
 *  new type this schema would carry forever). */
export const SAR_STATUS = {
  pending_review: { tone: 'warn', glyph: '◑', label: 'Awaiting clinical review' },
  reviewed: { tone: 'accent', glyph: '◐', label: 'Reviewed, ready to release' },
  released: { tone: 'good', glyph: '✓', label: 'Released' },
} satisfies Record<string, Status>;
