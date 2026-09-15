# Body mass as a flaggable metric: the rules behind it

**Decided 15 September 2026 by Isabella.** Settles the choices the builder
made without a rule while building migration 0128 (MET-043, metric
`body.mass_kg`), listed as the six D7 rows on
`docs/design-decisions-outstanding.md`.

These rulings change what 0128 built. 0128 is applied to scratch only, so
the change lands as a follow-up migration rather than an edit to 0128.

## 1. The day's figure is the staff weigh-in, and only the staff weigh-in

The figure an athlete types into their morning check-in
(`wellness_entries.body_mass_kg`) is **not** a source for this rule. Only
`body_composition`, the club's own weigh-in, counts.

Why: two sets of scales rarely agree, and a week of club weigh-ins followed
by a week of self-reports reads as a weight change that did not happen. That
widens the athlete's normal range and makes the rule slower to speak when
something real is happening. A weight signal that cries wolf about an
athlete losing weight is not a harmless false alarm.

Known cost, accepted: a club that never runs weigh-ins has a rule that can
never fire, and nothing tells them so. If that becomes real, the answer is
to say so on the thresholds screen, not to re-admit the check-in figure.

## 2. One weigh-in per athlete per day

The table refuses a second weigh-in for an athlete on a day that already has
one. Without this, three weigh-ins in one afternoon count as three
observations and the baseline is built from measurement noise.

No limit on how many days a club weighs. Daily weighing is fine and gives
the best baseline there is.

## 3. Correcting a weigh-in: same day to edit, a sport scientist to delete

A weigh-in can be **edited on the day it was taken** and not afterwards.

A **sport scientist can delete a weigh-in at any time**, audited like every
other correction.

Why both: same-day-only editing on its own means a weight typed as 8.5
instead of 85 and noticed the next morning can never be corrected, and that
figure then sits in the athlete's 28 day baseline for a month dragging the
average down with no way to see why. The delete is the escape hatch. Weigh-ins
are still not casually rewritten, which was the point of the restriction.

## 4. The rule speaks after four weigh-ins spanning at least 21 days

The floor is **four observations**, not the ten every other personal-baseline
default requires, **and those four must span at least 21 days**.

Why four: with the check-in figure excluded, the only source is the club's
scales. A club that weighs weekly produces four figures in a 28 day window.
Ten would keep the rule silent until late November at weekly weighing, and
silent forever at fortnightly.

Why the 21 day span: four figures taken Monday to Thursday of one week are
four readings from one phase of one training week. Without the span
condition the rule would build a normal range out of them and start
flagging on it. With it, a clustered week does not trigger the rule, it
just waits. A weekly-weighing club is unaffected.

## 5. The coach sees no body mass. The 12 September rule stands

Considered and reversed within the same session: visibility was briefly
opened to every staff role, then closed again. **The 12 September rule
stands unchanged** — the coach sees no body mass anywhere: not the profile
card, not the nutrition card, not the export columns, not the flag rows,
the threshold preview or the editor's measure. `BODY_MASS_VIEW` in
`access.ts` and access matrix §3.2 are untouched, and no code changes for
this section.

Every other staff role — medic, sport scientist, S&C, nutritionist — sees
body weight.

## 6. Who can log a weigh-in: everyone except the coach

Medic, sport scientist, S&C and nutritionist can record a weigh-in. The
coach cannot. The correction rules in §3 apply to those four roles.

## 7. The athlete sees the day's weigh-in in the athlete app

A weigh-in staff record for an athlete is shown to that athlete, for that
day, in their own app.

Why it matters after §1: the rule now fires on club weigh-ins only, so
without this an athlete could be flagged for dropping weight on a figure
they had never seen, while their own screen showed a self-reported figure
that had not moved. The first they would know of it is a nutritionist
asking about a number they cannot find. Showing them the weigh-in closes
that.

Consequence to build carefully: the athlete's Me page and the staff profile
card must not show two different numbers under one label. Where a weigh-in
exists it is the figure shown and named as the club's; where none exists
the athlete's own check-in figure is shown and named as theirs.

## 8. Staff notes are gated by the flag they hang from

A coach who cannot open a flag cannot read its notes. `flag_actions` is
gated by joining the flag rather than left open.

Why now rather than on first sighting: a note is free text with no value
column, so "down to 82kg since the Ashcombe game" is a body weight handed
to the coach through the one door the rule does not guard. The builder
recommended waiting until a note named a figure. That order is wrong for
this one — the leak is the harm, and you learn it happened by it having
happened.

Known cost: the nutrition domain today holds only the body mass rule, so
nothing else goes dark. If a nutrition-domain rule the coach should see is
added later, its notes go dark with it and the gate needs narrowing to the
metric rather than the domain.

## Unchanged from what 0128 built

- The shape stays a change over time, never an absolute value; the table
  refuses the absolute shape.
- 2 per cent below the athlete's own 28 day mean, 7 day cooldown, notifies
  the nutritionist and the S&C.
- The default rule is backfilled into every organisation that already has
  thresholds.
- The S&C's attention card counts the whole nutrition domain as its
  weigh-ins. If a second nutrition-domain metric is ever added, that scope
  narrows to the metric.
