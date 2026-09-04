# 31. Nutrition

## 1. Page name and URL

**Nutrition**, at `/nutrition`.

Where nutrition plans are authored: the rules per kilogram, who they apply to, and
how the squad's weights sit against their target ranges.

**This is the nutritionist's own screen.**

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | View, create, edit, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | **No** in the agreed model | Nothing. Nutrition inside a player profile stays open to them | Nothing | The whole page | Base | **NOT BUILT.** Decision D-03 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-03 |
| S&C | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-03 |
| Nutritionist | Yes | Everything | View, create, edit, delete | None | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

## 3. How you get here

- Nutrition, the fifth item in the sidebar.
- A link from an athlete's nutrition page.

## 4. What you see

A header with the group filter. Then the plans, each a rule expressed per kilogram
of body weight and scoped to the club, a group, or one athlete. Then the squad's
weights against their target ranges, with a flag on anyone drifting.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-031 | Protein | Grams a day, from a rate per kilogram | Per day | No target without a recorded weight |
| MET-032 | Carbohydrate | Grams a day, **changing with the kind of day** | Per day | As above |
| MET-033 | Fat | Grams a day | Per day | As above |
| MET-034 | Energy | Kilocalories, **derived from the three above**, never set directly | Per day | As above |
| MET-035 | Fluid | Millilitres a day | Per day | As above |
| MET-005 | Body mass | Weight in kilograms | Latest | Blank |
| MET-036 | Target range | The agreed range | As set | No band drawn |

**Two things a nutritionist must know about these numbers.**

**The three day multipliers cannot be edited.** Training is 1, match day 1.25,
rest day 0.58. You control the rate and which day applies, not the multipliers.

**Energy is capped, not set.** When a cap applies, energy will not equal the three
macronutrients beside it.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the squad | Stays here | Nothing | Any staff today | None | Never |
| Create a plan | Header | Opens the create screen | `/nutrition/new` | Nothing | Nutritionist and sport scientist | None | **Not built** |
| Edit a rule | A plan card | Changes a rate per kilogram | Stays here | Writes a new version of the rule | Nutritionist and sport scientist | Form submission | **Not built** |
| **Assign a plan** | A plan card | Applies the rule to the athletes in scope | Stays here | **Recomputes and writes every affected athlete's absolute target**, expiring the previous one | Nutritionist and sport scientist | Form submission | **Not built** |
| An athlete's name | The weight list | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff today | None | Never |

**Assigning a plan is the only thing in Fydr that recomputes a target.** A weigh-in
does not. Decision D-28.

## 7. How this page is built, in plain English

Built on the server, with the editing running in the browser.

Rules are versioned rather than overwritten, so a change does not erase what was
in force before.

Assigning resolves each athlete's own current weight, works out their absolute
targets, closes the previous target and writes a new one carrying a sentence
saying what it was computed from and at what weight.

## 8. States

**No plans.** An empty state explaining what a plan is. **An athlete with no
weight.** Skipped when assigning, and reported as skipped rather than silently
omitted. **Error.** Surfaces as an error. **No permission.** Every staff role
currently reaches it. **Wrong tier.** Not applicable. **Offline.** Not handled.

## 9. Open issues

- **Every staff role can author nutrition plans.** Decision D-03.
- **Targets do not follow weight.** Decision D-28, the most consequential open
  item in the nutrition area.
