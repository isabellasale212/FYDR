# Pending builder queue

Messages agreed with Isabella but NOT yet sent to the builder. Send when the
current queue reports. Delete a section once it has been sent and acknowledged.

## SENT 13 September 2026, evening (deploy 7, bf842d6)

- The two Children's Code defaults. Built, with three follow-up rulings sent
  after the report: academy means under 18 by date of birth and not group
  membership; the minor's own opt-in is removed entirely until S9's guardian
  route exists; staff alerts return to on while athlete defaults stay off.
- The RPE package: club setting, one tap on Today, 0 to 10, and the falsy-zero
  sweep first.
- The training report split: the existing GPS board becomes the GPS report
  (premium), the RPE-load report is built as the Training load report (all
  clubs) and is the seventh.
- `reportCatalogue.ts` reconciled against the catalogue addendum.
- Four small fixes: the raw role enum in the sidebar footer, the `groups` audit
  trigger with the audit batch, the medic injury CSV gap, the re-held import
  spelling.

## SENT AND SHIPPED 14 September 2026 (deploys 8 and 9)

The injury and rehab cluster, S9 consent and first run, the revoke, the tier
gate at the database, and analytics as a wholly premium destination covering all
metrics. Migrations 0119 to 0125 on production.

## STILL PENDING, in order

1. **Match participation**, with the fixture-to-match-session decision settled
   in the same brief: starters, who came on, minutes each, nothing more. The
   four seeded match sessions with a null `fixture_id` need a ruling at the same
   moment: orphans, rows to link by date, or seed data to delete.
2. **Premium contents**, once Isabella rules on the four decisions in the Step 1
   report, including the Settings plan page that is now the single place a basic
   club learns what premium contains.
3. **My data hero cards**, blocked until `metrics.md` states what "steady" means
   and the minimum sample.

---

## FIRST OF THE TWO CLOSING PASSES: design system conformance

**Added by Isabella 13 September 2026. Runs once the final build is complete and
nothing further is changing. The feature work for v1 completed 14 September.**

**ORDER CORRECTED 14 September 2026: this runs BEFORE the accessibility sweep,
not after.** The original order was wrong. After conformance, every colour on
every page is a token, so the set of text-and-background pairs to measure is
finite and small, and a contrast failure is fixed by swapping one token for
another that passes, which leaves the page conformant. Run the other way round
and you fix literal values to reach 4.5 to 1, then conformance moves those same
literals onto the nearest token "where the visible difference is imperceptible",
and an imperceptible difference can still take a pair from 4.52 to 4.47. You
would silently undo contrast fixes you had just verified, with nothing to catch
it.

**Read this first, because it looks like something that was cancelled.** On 13
September Isabella cancelled a restyle of four pages. That cancellation stands:
the LOOK of the product is settled and is not up for revision. This pass is a
different thing. It brings every page onto the design system's VALUES without
changing how anything looks: the 9px corner radius she chose, and every other
token for type, spacing, colour and hit targets. Conformance, not taste.

It runs last because conformance only holds if nothing changes after it.

> # Design system conformance pass. Whole product.
>
> Bring every page onto `src/styles/tokens.css`. This is not a redesign and not
> a relayout. The look is settled. Where a literal value already matches its
> token, replace the literal with the token. Where it does not match, replace it
> with the token anyway ONLY if the visible difference is imperceptible; if the
> change would be visible, report it and stop on that instance.
>
> **In scope:** corner radius to the 9px token, spacing steps, type sizes and
> weights, colour, hit targets, borders and shadows. Every literal hex, rgb, px
> or rem value for anything a token covers.
>
> **Out of scope, and do not touch:** layout, copy, data, queries, logic, which
> data a role sees, and the four colour meanings on the leaderboard and
> nutrition pages (rank tint, flag badges, deviation bars, neutral status text),
> which must stay distinguishable. `docs/decisions/design-constitution.md` is
> the reference.
>
> **Report before building, and stop.** Every literal value, by file and line,
> with the token it maps to, the current value, the token's value, and whether
> the difference is visible. Group by page. Flag anything with no token rather
> than inventing one.
>
> **Verify.** Before and after screenshots of every page at 1440 and 390, in
> both themes. One commit per page. Report drift: anything that could not be
> brought onto a token and why.
>
> Scratch database only. No production, no `db:push`, no Vercel.

---

## SECOND OF THE TWO CLOSING PASSES: the accessibility sweep

**Runs AFTER the design system conformance pass below. Order corrected 14
September 2026, see the note under that section for why.**

**One rule this order depends on: fix a contrast failure by swapping one token
for another that passes. NEVER by introducing a literal value.** That keeps the
page conformant after the pass that made it so. The sweep only tells the truth
about a settled app. Sweeping screens that are about to be rewritten measures
something that will not exist tomorrow.

> # Accessibility sweep. Whole product.
>
> This is not a restyle. The current look is settled and stays. Do not
> harmonise, tidy, align or improve anything visual. Three defect classes only.
> Anything else you notice, report, do not change.
>
> ## The three classes
>
> **1. Contrast below 4.5 to 1.** Every text and background pair, **in BOTH
> themes**. `tokens.css` carries light and dark, and a pair can pass in one and
> fail in the other; a sweep that measures only light reports a clean product
> that is not. Large text may use 3 to 1 where it genuinely qualifies, so state
> the size when you apply that. Fix by changing the text colour to an existing
> token that passes. If none passes, report it and stop on that instance rather
> than inventing one.
>
> **2. Tap targets under 44px.** Any interactive element on any surface. Grow
> the target; never shrink the gap to a neighbour and never overlap two targets.
> **`aria-disabled` elements are IN SCOPE.** WCAG exempts genuinely disabled
> controls, but `BlockedButton` uses `aria-disabled` with the reason on tap, so
> those are still interactive and still in the accessibility tree.
>
> **3. Colour as the only carrier of meaning.** Any state, rank, flag or status
> distinguished by colour alone. Fix by adding a label, a shape or a position.
> Do not change the colour itself.
>
> ## Method, and this part is not optional
>
> Measure computed styles from the RENDERED DOM, not the stylesheet, and measure
> contrast against the ACTUAL COMPOSITED background, since a tint over a surface
> is not the token's nominal value. Reading the stylesheet has produced wrong
> answers in this codebase twice.
>
> Run as SINGLE-ROLE users. A sweep signed in as one account misses every
> role-gated screen. Say which roles you signed in as and which screens each one
> reached.
>
> ## Two existing guards, and why they did not catch this
>
> `test:a11y-floor` and `test:nav-hit-floor` already run in `prebuild`. So the
> interesting question is not only what is failing but **why those guards missed
> it**. If they cover only some surfaces or some element types, that gap is a
> finding worth more than the individual fixes, because it is what stops the
> defects returning. Report it.
>
> ## Rules
>
> - Do not change layout, copy, data, queries, logic, or which data a role sees.
> - Do not change any colour except where a contrast failure requires it, and
>   **never in a way that collapses the four colour meanings**: rank tint, flag
>   badges, deviation bars and neutral status text must stay distinguishable
>   after the sweep. `docs/decisions/design-constitution.md` is the reference.
> - Do not introduce a new token. If one is needed, report it and wait.
> - Do not fix anything else you find. Report it in a list at the end.
> - Scratch database only. No production, no `db:push`, no Vercel.
>
> ## Step 1. Report before building. Answer and stop.
>
> Produce the full defect list before changing anything. For each defect: file,
> line, class, measured value, theme, the surface it appears on, the role that
> can reach it, and the proposed fix. Group by class, then by page. Then stop.
>
> ## Commit and verify
>
> - **One commit per class PER APP**, staff and athlete separately. One commit
>   per class across the whole product is too large to revert safely.
> - State the measured value before and after for every contrast and tap-target
>   fix, in both themes.
> - Report drift: anything you could not fix within these rules, and why.
