# Pending builder queue

Messages agreed with Isabella but NOT yet sent to the builder. Send when the
current queue reports. Delete a section once it has been sent and acknowledged.

---

## URGENT, ahead of the current row: two defaults

**Agreed 13 September 2026. Send immediately, not with the next batch.** These
land in PATTERN-S8's settings and thresholds work, which is in the queue now.
Getting them right while those screens are written costs nothing; retrofitting a
default costs a migration and a data fix.

> Two defaults to get right while you are in the settings work, both from a
> Children's Code finding. Read `docs/decisions/lawful-basis-open.md` first.
>
> One. **Under-18 and academy athletes are excluded from ranked boards and from
> streak mechanics by default.** This is a rule and a query change, not a
> redesign, and it does not reopen the design freeze. Age is derivable from
> `athletes.date_of_birth`. The `leaderboard_visibility` value already exists in
> the `consent_purpose` enum from migration 0002, with
> `parental_consent_recorded_at`, `parental_consent_recorded_by` and
> `parental_consent_method` beside it, so the opt-in path exists if a guardian
> ever uses it. Default is excluded. Report first what the current behaviour is:
> does an academy athlete appear on a ranked board today without anyone opting
> them in?
>
> Two. **Reminders default off, for everybody.** Not just minors. Push on iOS
> already needs an install and an explicit permission grant, so nobody receives
> anything unasked regardless; making the stored default match that reality
> satisfies high-privacy-by-default at no cost. Check what
> `notificationPreferences` currently defaults to and report before changing it.
>
> Also add to the sheet, do not build: **no field anywhere records that a medic
> is a registered practitioner.** That gap decides whether the health care
> Article 9 condition is available, which decides the wording of the consent
> flow. Isabella's, with a solicitor.

## RPE: club setting, one tap, 0 to 10
**Agreed 13 September 2026. To be sent when the S7/S8 queue reports.**

> RPE stays. Removal was considered and rejected. Three changes, and read
> `docs/decisions/decision-batch-2026-09-13.md` for the full entry.
>
> One, RPE becomes a club setting. When it is off, every dependent surface says
> so rather than showing an empty column or a zero: training report, compliance
> figure, dashboard attention card, effort leaderboards, analytics.
>
> Two, the prompt becomes one tap on Today rather than a bottom sheet. The scale
> sits on the row itself. It is one number and the sheet is why compliance is
> hard.
>
> Three, the scale becomes 0 to 10, matching CR-10. All production data is
> synthetic so there is no back-conversion: widen the constraint, change the
> control and the labels, and record in the migration that earlier rows were
> written on a 1-to-10 scale.
>
> Before touching any of it, run a sweep for every place an RPE value is tested
> for truthiness rather than for null. Zero is falsy and zero is now a real
> rating meaning rest. Report what the sweep finds before changing it. This is
> the part most likely to introduce a silent defect.

## Also waiting to be queued

- Match participation: starters, who came on, minutes each. Nothing else.
  Decide with the fixture-to-match-session question, same root.
- The tier gate moves to the database, subject access read path as a written and
  tested exception.
- The training report split: GPS board stays as the premium training report with
  its own definition sentence; the RPE-load report is built as a seventh for
  every club. NOTE: this interacts with the RPE club setting above, so send the
  two together.

---

## LAST IN THE PROGRAMME: the accessibility sweep

**Do NOT send until three things are done: the PATTERN-S8 rows, the RPE change
and the training report split above, and S9.** The sweep only tells the truth
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

---

## ABSOLUTE LAST: design system conformance pass

**Added by Isabella 13 September 2026. Runs AFTER the accessibility sweep, and
only once the final build is complete and nothing further is changing.**

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
