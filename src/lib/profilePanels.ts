/** The athlete profile's panel order, by role. STAFF-SS-02-05 C4, ruled
 *  2026-09-13 (batch B5): one order, one exception — the sport scientist's
 *  order for every role, Body weight raised above Flags for the S&C and the
 *  nutritionist. The order is the board's own "All panels" sheet (frame 12,
 *  "Flags · panel 1 of 10"), the only complete statement of it; the ACWR and
 *  wellness card, which the build has and the board folds into the header,
 *  sits directly after Athleticism — the two dial cards together.
 *
 *  A panel a role cannot see is absent, not locked: the page decides presence,
 *  this file decides sequence. Roles add up, as on the dashboard: an S&C who
 *  is also a coach reads the base order, the exception is for the two roles
 *  on their own.
 *
 *  Layout follows the sequence rather than the other way round. Panels that
 *  fit a column fill the two-column grid column-first (the first half down the
 *  left, the rest down the right), so "above" means above on a desktop as well
 *  as on a phone, and a phone — one column — reads the list straight through.
 *  The two wide panels (Entries and corrections, the subject access request)
 *  stand full-width where the sequence puts them, and the grid breaks around
 *  them.
 *
 *  RULED 15 September 2026 (Isabella, decision-batch-2026-09-15-pm.md #1):
 *  column-first stands, the ACWR card stays its own card, and **Entries and
 *  corrections returns to the foot of the page** — built fourth and
 *  full-width it broke the two-column grid through the middle of the page,
 *  and the order was ruled to fix what a person reads first, not to force a
 *  full-width band mid-page; the original reason for putting it last — the
 *  last thing a coach sees is their own tool — still holds. It sits before
 *  the subject access request, the other full-width panel, which stays last. */

import type { AppRole } from '@/lib/types/database';
import { hasAnyRole } from '@/lib/access';

/* FOUR PANELS LEFT THE PROFILE on 16 September 2026 (Isabella's overnight
 * queue, 3.1 — the screen Isabella will spend most of Friday on):
 *   - 'nutrition' (the plan card) lives behind the Nutrition button;
 *   - 'entries' (entries and corrections) lives behind the Wellness button;
 *   - 'scLog' (the S&C history log) lives behind the Gym button;
 *   - 'availability' (the absence form) is "Edit availability" on the name
 *     card, beside Change plan, expanding in place.
 * The ACWR and wellness-rating card ('acwr') STAYS in view, by name. One
 * panel joined: 'medicalRecord', the medic's own record area — every injury with
 * the clinical fields that already exist and are already withheld from
 * every other role (docs/access-matrix.md §4.1). */
export type ProfilePanelKey = 'flags' | 'athleticism' | 'acwr' | 'bodyWeight' | 'injury' | 'medicalRecord' | 'goals' | 'sar';

/** The sport scientist's order, the board's frame 12 less the four panels
 *  above; the medical record directly after the injury card it extends. */
export const SPORT_SCIENTIST_PANEL_ORDER: readonly ProfilePanelKey[] = ['flags', 'athleticism', 'acwr', 'bodyWeight', 'injury', 'medicalRecord', 'goals', 'sar'];

/** Wide tables; half a grid column would force a horizontal scroll or a
 *  truncated history. The medical record is a table of every injury. */
export const FULL_WIDTH_PANELS: readonly ProfilePanelKey[] = ['medicalRecord', 'sar'];

const BASE_ORDER_ROLES: readonly AppRole[] = ['sport_scientist', 'coach', 'medic'];
const RAISED_BODY_WEIGHT_ROLES: readonly AppRole[] = ['strength_conditioning', 'nutritionist'];

export function profilePanelOrder(roles: readonly AppRole[]): ProfilePanelKey[] {
  const raise = !hasAnyRole(roles, BASE_ORDER_ROLES) && hasAnyRole(roles, RAISED_BODY_WEIGHT_ROLES);
  if (!raise) return [...SPORT_SCIENTIST_PANEL_ORDER];
  return ['bodyWeight', ...SPORT_SCIENTIST_PANEL_ORDER.filter((key) => key !== 'bodyWeight')];
}

export type ProfilePanelSegment =
  | { kind: 'grid'; left: ProfilePanelKey[]; right: ProfilePanelKey[] }
  | { kind: 'full'; key: ProfilePanelKey };

/** The panel that HEADS THE RIGHT COLUMN (Isabella, 16 September 2026, the
 *  evening queue, 3.2: "move the ACWR and wellness card to the top right,
 *  above the body weight card in the right column"). A run splits at this
 *  panel rather than at its half, so the ACWR card is the first thing in the
 *  right column on a desktop and Body weight follows it. The sequence is
 *  unchanged — a phone, one column, still reads flags, athleticism, ACWR,
 *  body weight… straight through — only where the desktop's second column
 *  starts moved. When the panel is absent, or first in its run, the split
 *  is the half it always was. */
export const RIGHT_COLUMN_HEAD: ProfilePanelKey = 'acwr';

/** The sequence as the page lays it out: runs of column panels become a grid
 *  filled column-first, each full-width panel its own segment. Only the panels
 *  `present` says this viewer has. */
export function profilePanelSegments(
  ordered: readonly ProfilePanelKey[],
  present: (key: ProfilePanelKey) => boolean,
): ProfilePanelSegment[] {
  const segments: ProfilePanelSegment[] = [];
  let run: ProfilePanelKey[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const head = run.indexOf(RIGHT_COLUMN_HEAD);
    const split = head > 0 ? head : Math.ceil(run.length / 2);
    segments.push({ kind: 'grid', left: run.slice(0, split), right: run.slice(split) });
    run = [];
  };
  for (const key of ordered) {
    if (!present(key)) continue;
    if (FULL_WIDTH_PANELS.includes(key)) {
      flush();
      segments.push({ kind: 'full', key });
    } else {
      run.push(key);
    }
  }
  flush();
  return segments;
}
