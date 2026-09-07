# Nutrition guidance

## 1. Where it sits

Reached from Programme. Route `/programme/nutrition`. File 138 lines.

## 2. Who reaches it and when

Any athlete. **A player looking for what to eat has to know it lives behind a tab
called Gym.** DECISION 2.

## 3. What you see

Targets, and real meals from the club's own meal library (`meal_library`,
migration 0051, athlete read added by migration 0054). **The athlete browses the
same real meals the nutritionist authored**, not a separate athlete copy.

## 4. What the athlete enters here

**Nothing, and that is a product rule rather than a gap.** The file states it:
read only, `CLAUDE.md` rule 8, no logging, no per meal macro entry, **no submit
action anywhere on this screen**.

The whole nutrition commitment for an athlete is the weekly one tap check in.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-031 | Protein | Daily target | Current | empty |
| MET-032 | Carbs | Daily target | Current | empty |
| MET-033 | Fat | Daily target | Current | empty |
| MET-034 | Energy | Daily target | Current | empty |
| MET-035 | Fluid | Daily target | Current | empty |
| MET-036 | Your range | Body mass target range | Current | empty |

**These recompute on every weigh in**, against the nutritionist's set rate and the
athlete's latest weight, rather than staying fixed to the weight at assignment.
Past targets keep the weight they were calculated against, so history is not
rewritten.

**MET-036 carries a visibility rule.** The staff screen says the athlete never
sees this range in their own app and it is never ranked. **UNVERIFIED whether
that is still true given this screen reads `body_mass_kg`.** Worth checking: it
is the one place a documented visibility promise and a screen's imports appear to
disagree.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A meal | The library | Shows it | stays | nothing | no | library empty |

**There is no action that writes anything.**

## 7. Offline and sync

Read only.

## 8. Notifications

None found.

## 9. Permissions

None.

## 10. States

Loading, no targets set, empty meal library, error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy.

## 12. Open issues

- **UNVERIFIED and worth resolving:** MET-036's stated visibility rule against
  this screen's use of body mass.
- **DECISION 2:** the tab it lives behind.
