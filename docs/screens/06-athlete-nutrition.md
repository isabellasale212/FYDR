# 06. Athlete nutrition

## 1. Page name and URL

**Nutrition**, at `/squad/[athleteId]/nutrition`.

One athlete's nutrition picture: what they are aiming for, what their weight is
doing against the agreed range, and how they compare with others in their
positional unit.

**This is not a food diary.** Athletes do not log meals in Fydr. Nutrition here is
guidance: targets, fuelling for the kind of day, and a weekly one tap check-in.
Anything on this screen that looks like consumption tracking is not, and a
request to add it should be raised rather than built.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | View only here. Targets are set in the Nutrition section | None | Base | `src/lib/athleteDomain.server.ts:89` then `:93` |
| Coach | Yes | Everything | View only | None | Base | Same |
| Medic | Yes | Everything | View only | None | Base | Same |
| S&C | Yes | Everything | View only | None | Base | Same |
| Nutritionist | Yes | Everything. **This is the nutritionist's own screen** | View only here | None | Base | Same |
| Athlete | **No** | Nothing here. Athletes see their own guidance in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This is the athlete domain screen every role keeps.** Nothing on it is injury
or medical information.

---

## 3. How you get here

- The Nutrition chip on the athlete's profile.
- From the Nutrition section, following a link to one athlete.

---

## 4. What you see

**A header** naming the athlete, with breadcrumbs back to the squad and the
athlete.

**A period selector** offering week, month, season, year and all, with any period
the data cannot honestly cover shown disabled and its reason given.

**Targets.** What this athlete is aiming for in a day: protein, carbohydrate,
fat, energy and fluid. Each is derived from a rate per kilogram of the athlete's
own body weight, so two athletes on the same rule see different numbers.

**Body weight against the target range.** The athlete's recent weights, drawn
against the agreed range where one is set. The range is allowed to move across a
season.

**Positional context.** The athlete's figures beside the median for their
positional unit, because a front row median is the number a nutritionist actually
wants rather than a whole squad average.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-031 | Protein | Grams of protein a day, from a rate per kilogram | Per day | No target at all without a recorded body weight |
| MET-032 | Carbohydrate | Grams a day, **changing with the kind of day**: match days 1.25 times a training day, rest days 0.58 | Per day | As above |
| MET-033 | Fat | Grams a day | Per day | As above |
| MET-034 | Energy | Kilocalories, **worked out from the three above**, never set directly | Per day | As above |
| MET-035 | Fluid | Millilitres a day | Per day | As above |
| MET-005 | Body mass | Weight in kilograms | Latest, and over the period | Blank |
| MET-036 | Target range | The agreed weight range | As set, may move across a season | No band drawn when none is set |

**One thing to expect on this screen.** When an energy cap is in force, the
energy figure will **not** equal the three macronutrients beside it. That is by
design, not an error, and the screen must be able to explain it.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Period selector | Below the header | Changes the window | Stays here, period in the address | Nothing | Any staff who can reach the page | None | A period the data cannot express is disabled with its reason |
| Squad and athlete breadcrumbs | Header | Back up | `/squad`, `/squad/[athleteId]` | Nothing | Same | None | Never |

**Nothing on this page writes anything.**

---

## 7. How this page is built, in plain English

Built on the server through the same shared loader as wellness and gym.

Targets are resolved by the database rather than the app, which matters because a
target can be set for the whole club, for a group, or for one athlete, and the
most specific wins. Doing that in one place means every screen showing a target
gets the same answer.

Retracted target ranges are excluded from what is drawn, so a range that was
withdrawn does not reappear as history.

---

## 8. States

**Loading.** Renders when ready.

**No body weight recorded.** No targets can be calculated at all, because every
one of them is a rate per kilogram. The screen says so rather than showing zeroes.

**No rule set.** The club's default applies. If there is none, no targets exist.

**No target range set.** Weights are drawn without a band.

**Error.** Surfaces as an error.

**No permission.** A named refusal headed Nutrition.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **This screen has no entry in the previous specification set.** This file is
  its first specification.
- **Resolved, and the answer changes what this screen is.** This page does not
  compute a target from a rule at all. It shows the **stored** target resolved for
  a date (`src/lib/queries/nutritionTargets.ts:221`), which was worked out from
  the rule at the moment a nutritionist last assigned the plan. The day type is
  whichever one was in force then, and it is recorded in the target's own reason
  text.
- **The stored target does not follow the athlete's weight.** Nothing recomputes
  it on a weigh-in, so this screen can show a target computed against a weight the
  athlete no longer is. The reason text names the weight it used, which is how a
  nutritionist can tell. Decision D-28.
