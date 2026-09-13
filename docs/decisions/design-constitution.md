# The Fydr design constitution

**Extracted 13 September 2026 from the design programme handover. These rules
came out of individual pattern boards and were then applied everywhere. They
matter more than any single screen, and they are enforced in the code.**

A new screen applies these rules. A screen that cannot is a finding worth
reporting, not a licence to improvise.

## Language and honesty

- **Missing is not zero.** A value that does not exist reads as words: "Not
  submitted", "Not logged", "Not rated", "Not recorded", "Not known". Never 0,
  never 0%, never a bare dash where a reader could take it for a score.
- **Every count carries its denominator.** "24 of 30 athletes", "6 of 12 sets ·
  2 waiting to send", "n = 24 of 28 days".
- **Exclusions are stated in a full sentence**, including "Nobody is excluded"
  when that is true.
- **"Not in this period" is never written as "never".** If data exists outside
  the chosen window, the empty state names the most recent record and its date
  and offers to widen the window. Only when nothing exists at all does the copy
  say so, and then it adds that the record is not broken.
- **No judgement words.** Screens state measurement, direction and sample.
  Nothing says "at risk", "fatigued" or "improving".
- **Deviation is information, not an error.** An athlete lifting more than
  prescribed, or a trend moving down, is shown neutrally. Warn and bad tones
  are reserved for genuine states, never for magnitude.

## Privacy and roles

- **Only the medic sees diagnosis and mechanism.** Every other role sees
  availability status, restrictions and expected return.
- **A restriction line never names a diagnosis or a protocol.** "Return to play
  protocol, stage 3 of 6" names a concussion by implication, so it exists only
  inside the medic's clinical record. Everywhere else the same athlete reads
  "No contact, no collision drills". Enforced at every query read by
  `lib/restrictions.ts`, for every viewer.
- **Withheld is not the same as read-only.** A panel a role cannot see is
  absent: no heading, no placeholder, no lock icon, and no count that changes
  shape because something is missing. A panel a role can see but not edit keeps
  its content and names its owner: "Read-only · set by medical staff · Ruth
  Callaghan · Fri 11 Sept".
- **The free-text field that leaves the clinical circle carries the rule.** The
  medic's coach-visible note says: "Coach visible. Describe the restriction,
  not the injury. Do not name a diagnosis or a protocol."
- **The coach does not see body mass at all**, the section as well as the
  controls. Decided 12 September 2026.
- **Role gates must hold at the database**, not only in the UI. Learned twice
  the hard way: the last-admin guard, and the GPS tier gate.
- **Body site and side are not coach-visible.** A club setting, defaulting to
  off. A body area plus a restriction line is a diagnosis in two pieces.
  Decided by Isabella, 13 September 2026, closing PATTERN-S3 C8.

## Interaction

- **44px minimum on a phone**, for every control, including a text link that is
  the only action.
- **No value is available on hover alone.** Staff read these screens on a
  tablet and a phone. Anything that would live only in a tooltip becomes a
  column, a caption or a report.
- **One emphasised card per screen. One haloed primary per view.**
- **Disabled is for a control you could have used**, never for one that was
  never yours. A blocked control uses `BlockedButton`: `aria-disabled`, the
  reason on tap or focus, never a `title`.
- **Success is the screen changing**, not a toast. A status line appears only
  when the change happened while the user was not looking at the thing that
  changed. When the user pressed the button and the screen already answered,
  nothing else appears.

## Data integrity

- **Entries are immutable where the domain says so.** Wellness and RPE cannot
  be changed by the athlete. Nutrition can be corrected once. Gym sets can be
  corrected from history. Corrections create revisions; nothing is overwritten,
  and a correction is visible afterwards.
- **A logged set keeps the prescription it was logged against.** Editing a gym
  programme never rewrites history. Migration 0111.
- **Expected attendees are distinct athletes**, never the sum of group sizes,
  because athletes belong to more than one group.
- **A report's definition sentence sits above its numbers**, and travels into
  the print view and the export header.
- **Suppression below five athletes with data:** rankings, shading and charts
  go, the figure stays.

## How a design is allowed to be wrong

- **A design may not invent data.** Anything a design needs that the database
  may not hold goes in "Open against code" rather than being drawn as if it
  exists.
- **A design states what it cannot verify.** A board saying "this is a
  proposal, not an observation" is a question for the code, not settled design.
- **Measure, do not infer.** Read the rendered DOM, not the stylesheet. At
  least three walkthrough claims were wrong when measured.
- **Test with single-role users.** Seed accounts holding every role hid what a
  real coach can see, twice.
