> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Nutrition weekly check-in

> **Layout status**: provisional. Awaiting client design photographs.
>
> **Scope decision, 5 August 2026.** Open question O-890 is resolved. The client has
> commissioned option 2 from `nutrition-guidance.md` §9: a weekly one-tap check-in. Athletes
> still **do not log meals or macros**. Once a week they answer one question with one tap.

Screen 45 in `02-information-architecture.md` §5. Presented as a bottom sheet over Today, not
as a full screen.

Every layout decision below that would normally come from the client's designs is marked
**[Assumed, pending photographs]**. Nothing marked that way is settled.

---

## Purpose

Recover a nutrition variable without recreating the daily logging burden that O-11 removed.

One question, three answers, an optional note, closed in under 10 seconds:

> **Did you hit your protein target most days this week?**
> Yes · Roughly · No

That is the entire screen. It exists because removing nutrition logging removed nutrition as a
correlation axis, and `00-product-overview.md` claim 3 names the cross-domain join as the
durable differentiator. A weekly three-level self-report gives that axis back at roughly a
hundredth of the cost of per-meal logging.

**Be clear about what it is worth.** This is a coarse, self-reported, weekly, three-level
ordinal variable. It supports a trend and, at sufficient n, a weak association. It cannot
support "protein intake against lean mass" and nothing in this screen should be described as if
it could. `analytics.md` carries that caveat wherever the variable appears, and it is
non-dismissible there for the same reason the association caution is.

Target completion time: **under 10 seconds**, including the sheet opening. If it takes longer
than that the design has failed, because the whole argument for the feature is that it is
cheaper than the thing it replaces.

---

## Roles and access

| Role | Access |
|---|---|
| Athlete | Full, for themselves. Writes `nutrition_checkins` with `source = 'self_report'`. |
| Coach / S&C | Cannot use this screen and cannot answer on an athlete's behalf. Reads the answers on the staff nutrition surfaces and in analytics. |
| Medical | As coach. |
| Admin | No access. |

**There is no staff-entered path, unlike every other entry table.** A coach's opinion of whether
a player hit their protein target is not a self-report. Mixing the two produces a variable that
means two different things in the same column. See `04-data-model.md` §17.15.

Content does not vary by role. It varies only by whether a protein target exists for the
athlete.

---

## Entry points

| Entry point | Context carried | Landing behaviour |
|---|---|---|
| Push `athlete.nutrition.checkin` | `/athlete/today?open=nutrition_checkin&week={week_start}` | Today mounts behind, sheet opens on the question |
| Today, the optional "This week" row | `week_start` | Sheet opens. The row is present only while the window is open |
| Programme tab, Nutrition section, "Weekly check-in" row | `week_start` | Same sheet |
| My Data, nutrition tab, a past check-in, "Correct this answer" | `original_checkin_id` | Correction mode, only while that week is still inside the window |

There is no entry point for a future week, and no entry point for a week older than the window
in §"Validation rules". There is no staff entry point at all.

---

## Layout

### Athlete, mobile, 390 pt, bottom sheet

**[Assumed, pending photographs]**

```
┌────────────────────────────────────────┐
│                                        │  <- Today visible behind, dimmed
│                                        │
│ ╭──────────────────────────────────╮   │  <- sheet, radius 24 top, ~62% height
│ │              ────                │   │  <- grabber
│ │                                  │   │
│ │  WEEK 32 · 28 JUL TO 3 AUG       │   │  <- .eyebrow 11/.12em/up
│ │                                  │   │
│ │  Did you hit your protein        │   │  <- 22/28 semibold, two lines max
│ │  target most days this week?     │   │
│ │                                  │   │
│ │  Your target was 180 g a day     │   │  <- .faint, omitted when no target
│ │                                  │   │
│ │  ┌────────────────────────────┐  │   │
│ │  │  Yes                       │  │   │  <- 64 pt tall, full width, gap 12
│ │  └────────────────────────────┘  │   │
│ │  ┌────────────────────────────┐  │   │
│ │  │  Roughly                   │  │   │
│ │  └────────────────────────────┘  │   │
│ │  ┌────────────────────────────┐  │   │
│ │  │  No                        │  │   │
│ │  └────────────────────────────┘  │   │
│ │                                  │   │
│ │  Add a note (optional)        ▸  │   │  <- collapsed row, expands in place
│ │                                  │   │
│ │  [          Done             ]   │   │  <- disabled until an answer is chosen
│ │                                  │   │
│ ╰──────────────────────────────────╯   │
└────────────────────────────────────────┘
```

**Three tap targets, 64 pt tall, full width, no icons.** The whole point of the screen is that a
thumb finds an answer without aiming. Do not shrink these to fit a fourth option, and do not add
a fourth option: three levels is what the schema stores and what analytics is caveated against.

**No emoji faces, no colour coding of the three answers.** Colouring Yes green and No red tells
an athlete which answer the app wants, which is exactly the pressure that turns a self-report
into self-presentation (ADR-005 context, point 3). All three rows are neutral until selected.

**"Roughly" is the middle option and it is deliberately vague.** An athlete who hit the target
on four days out of seven should be able to answer honestly in one tap without arithmetic. A
scale with more precision than the recall supports is false precision.

### Confirmation

On submit the sheet does not stay open. It collapses to a single line on Today, "Nutrition
check-in done", for the rest of the day and then disappears. No score, no summary, no streak, no
comparison to last week, no comparison to teammates.

### Staff

None. This screen has no staff surface. Staff read the answers on `nutrition-plans.md`, on the
athlete profile nutrition tab, and in `analytics.md`.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `BottomSheet` | `06-design-system.md` §6.19 | The container. Single detent, no drag-to-resize |
| `ChoiceRow` | §6, shared with `training-entry.md`'s CR10 list | The three answers, as a radio group |
| `ExpandableRow` | §6 | The optional note |
| `SubmitBar` | §6, shared with `wellness-entry.md` | Sticky Done button with its blocked reason as the label |
| `ConfirmSheet` | §6.18 | Discard confirmation when an answer is chosen and the sheet is dismissed |
| `OfflineChip` | §6 | Queued state |
| `EmptyState` | §6.16 | The window-closed and already-answered cases |

No new components. If this screen needs a new component the screen is too big.

---

## Data requirements

| Field | Source | Transformation |
|---|---|---|
| Week label | `week_start`, `iso_year`, `iso_week` | "Week 32 · 28 Jul to 3 Aug", org timezone |
| Question text | Fixed string | Not configurable per organisation in v1. See O-973 |
| Protein target | `nutrition_targets`, resolved per `nutrition-guidance.md` | Snapshotted onto the row as `protein_target_g` and `nutrition_target_id` at submit |
| Existing answer | `nutrition_checkins` where `superseded_by is null` | Drives the already-answered state |
| Window bounds | Computed from `now()` in the org timezone | Three ISO weeks, per §"Validation rules" |

### Writes

| Action | Write | Audit |
|---|---|---|
| Submit | Insert one `nutrition_checkins` row, client-generated `id`, `source = 'self_report'` | None. Ordinary athlete self-report |
| Correct | Insert a revision row, stamp `superseded_by` on the original, in one transaction | None |

Schema and policies: `04-data-model.md` §17.15.

---

## States

| State | What the athlete sees |
|---|---|
| Default | The question, three rows, the optional note, Done disabled |
| No protein target set | The same question without the "Your target was" line. The answer is still meaningful: the guidance screen tells them what to aim at even when no number is assigned |
| Answered this week | The sheet does not open from the prompt. Reached deliberately, it shows the answer, the date given, and "Change this answer", which is a revision, not an edit |
| Window open for an earlier week | The week label carries the older dates and a banner: "This is for week 31." The week is pinned and cannot be changed on the sheet |
| Window closed | Not reachable. The Today row is gone and the deep link lands on Today with "That check-in has closed." Nothing is offered instead |
| Offline | Fully usable. Submits to the queue, `OfflineChip` shows "Saved, will sync" |
| Loading | The three rows render immediately from a fixed string. Only the target line is deferred, and it is omitted rather than skeletoned |
| Error on sync | Silent to the athlete. The queue retries. A permanent rejection surfaces in My Data, never as a push |

### Offline

The whole screen works offline and this is not a nicety. The prompt lands on a Sunday evening,
which is the time of week an athlete is least likely to be on club wifi and most likely to be
somewhere with poor signal.

Per ADR-004 and `05-architecture.md` §6:

- The `id` is generated on the client, so replaying the queue twice inserts once. The partial
  unique index in `04-data-model.md` §17.15 is the backstop if it does not.
- The payload is one enum value, an optional 280 character note, a `week_start` and two target
  snapshot columns. It is small enough that queue size is not a consideration.
- The window is evaluated **on the server at insert**, not on the client at submit. An athlete
  who answers offline on the last night of the window and syncs three days later is inside the
  window, because the window is three weeks wide and the offline gap is not.
- Nothing on this screen is cached from the server except the target line, which is already
  cached by `nutrition-guidance.md`.

---

## Interactions

| Gesture | Target | Result |
|---|---|---|
| Tap | An answer row | Selects it. `impactAsync(Light)`. Previous selection clears. Row gains `accent.bg`, a 2 pt border and a tick. Done enables |
| Tap | The selected row again | No change, no haptic. Not a toggle: an athlete cannot accidentally clear their answer |
| Tap | "Add a note" | Expands in place. Keyboard appears. Done rides above it |
| Tap | Done, no answer chosen | Disabled, no action. The label already says "Choose an answer" |
| Tap | Done, answer chosen | Local write, `notificationAsync(Success)` once, sheet dismisses |
| Tap ✕ / swipe down | With an answer chosen | `ConfirmSheet`: "Discard this answer? Nothing is saved." |
| Tap ✕ / swipe down | With nothing chosen | Dismisses immediately. No confirmation, no re-prompt, no nudge |
| Tap | The week label | Nothing. It is not a control. The week is pinned by the entry point |

There is no submit-on-tap. One tap selects, one tap confirms. A single-tap submit saves a second
and makes every mis-tap permanent on a table with no update path, which is the wrong trade on a
screen whose entries are immutable.

---

## Validation rules

| Field | Rule | Message |
|---|---|---|
| `answer` | Required. One of `yes`, `roughly`, `no` | Done disabled, labelled "Choose an answer" |
| `note` | Optional, 280 characters | Counter at 240. Truncation is never silent |
| `week_start` | Must be an ISO Monday | Not reachable from the UI. Enforced by check constraint |
| `week_start` | The ISO week just ended, or the two ISO weeks before it | Server-enforced in the insert policy. The UI never offers an out-of-window week |
| `week_start` | Never a future week | As above |
| Duplicate | One live row per `(athlete_id, week_start)` | A second submission becomes a revision, not a second row |
| `athlete_id` | Must equal the authenticated athlete | Database-enforced. There is no client path that can set it to anything else |

### The immutable-plus-revision rule

The rule that applies to every athlete entry in this product applies here unchanged.
`CLAUDE.md` rule 6, ADR-005:

- **A submitted check-in is immutable.** There is no `update` grant on `nutrition_checkins` for
  any application role.
- **A correction inserts a new row** carrying `revision_of` pointing at the original, and the
  original is stamped `superseded_by` in the same transaction. Both rows survive.
- **Reads take the live row**, `superseded_by is null and deleted_at is null`. Analytics,
  exports and the staff surfaces all go through that filter.
- **My Data shows "Edited"** against a corrected week, with the original available, per the
  same treatment as a corrected wellness entry.
- **A correction is bounded by the same three-week window.** An athlete cannot revise a week
  that has closed, for the same recall reason the window exists at all.

This matters more here than it looks. A three-level answer is the kind of thing an athlete will
change after a conversation with a coach, and a silently edited self-report is
self-presentation rather than self-report.

---

## Edge cases

1. **The athlete has no protein target.** Asked anyway, target line omitted, `protein_target_g`
   stored null. The answer is still a usable ordinal. Analytics reports the split, because a
   population where half the athletes had no target is a different population.
2. **The coach changes the protein target mid-week.** The snapshot records the target in force
   at submit. The athlete answered about a moving number and the note field is where they say
   so. This is a limitation and it is not worth more machinery.
3. **The athlete was injured and not training all week.** They still get the prompt and they can
   still answer. Eating is not conditional on training. A club that disagrees can turn the
   notification off for the athlete, and `availability` does not suppress it automatically. See
   O-974.
4. **The athlete joined the club mid-week.** Prompted normally. The partial week is theirs to
   characterise.
5. **The athlete answers on Monday morning about the week that just ended.** Normal, expected,
   and the reason the window starts at the completed week rather than the current one.
6. **The athlete opens the sheet three weeks late.** Two weeks are answerable, the third is
   closed. The closed one shows nothing and offers nothing.
7. **Two devices, same athlete, same week, both offline.** Both queue with different client ids.
   The first to reach the server wins the unique index; the second is rejected and is presented
   to the athlete in My Data as an unsynced answer they can resubmit as a revision. It is not
   silently discarded and it does not silently overwrite.
8. **The athlete taps two answers quickly.** The second wins. Selection is idempotent and there
   is no animation to interrupt.
9. **A club with a Sunday fixture.** The prompt defers, see `08-notifications.md` §3.7. The
   screen is unchanged.
10. **New year week boundary.** `iso_year` and `iso_week` are stored and checked against
    `week_start`, so week 1 of 2027 cannot be labelled week 1 of 2026. This is the specific bug
    the two extra columns exist to prevent.
11. **The athlete leaves the club mid-window.** Existing rows are retained per soft-delete
    rules. No new prompt, no new insert, because there is no live athlete row to insert against.
12. **The athlete disables the notification.** The Today row still appears while the window is
    open. Turning off a push is not a request to remove the feature, and this is the one place
    the distinction matters, because there is no other daily surface carrying it.
13. **200% dynamic type.** The three rows grow to two lines each and the sheet scrolls. Nothing
    is removed and the rows never shrink below 64 pt.
14. **The athlete writes a note about a medical matter.** The note is coach-visible and is
    labelled as such above the field. It is not a clinical field and it is not routed to
    medical. `36 Report a problem` is the route into medical and the note field says so when it
    is expanded.

---

## Performance notes

- The sheet renders from a fixed string and local state. **Zero blocking network calls on
  open.** The target line is the only server value and it is already in the guidance cache.
- Open to interactive under 100 ms from a cold push tap, which is the same budget as
  `wellness-entry.md`.
- The write is one insert. No computed columns, no triggers beyond `updated_at`, no
  materialised view refresh.
- Query keys: `qk.nutrition.checkin(athleteId, weekStart)`, `staleTime` one hour. The answer
  changes at most once a week.
- The staff-side read is a single indexed scan on `(org_id, week_start)`. It is never a
  per-athlete fan-out.

---

## Accessibility

1. **The three answers are a radio group.** Each row announces "Roughly. 2 of 3. Not selected."
   Selection announces the change.
2. **The question is the sheet's accessible name**, read on open, so a screen reader user is
   told what they are answering before they are told there are three buttons.
3. **The target line is part of the question's description**, not a separate node, so it is not
   skipped as decoration.
4. **Touch targets are 64 pt**, well above the 44 pt minimum, and they are full width. This is
   the whole design.
5. **No information by colour alone.** Selection carries a tick and a border, not a fill alone.
6. **Dynamic type to 200%**, per §"Edge cases" 13.
7. **Reduced motion**: the sheet presents without a spring, and there is no confirmation
   animation.
8. **Done announces its blocked reason**, "Choose an answer", rather than being an unlabelled
   disabled control.
9. **Nothing is time limited on screen.** There is no countdown, no auto-dismiss, and no
   pressure to answer fast, notwithstanding the 10 second target. The target is a design
   constraint on the product, not an instruction to the athlete.

---

## Compliance: a missed check-in is not non-compliance

**Decision: it does not count as non-compliance.** No `compliance_expectations` row is
generated, `compliance_domain` keeps `nutrition` unused, and the check-in never appears in
`mv_compliance_rates`, in `compliance.overall_pct`, on `squad-status.md`, or in
`staff.compliance.low`.

The argument, in order of strength:

1. **It is a self-report about behaviour, not an expected entry.** Compliance in Fydr means
   "was an expected entry actually submitted" (`CLAUDE.md` §6). A wellness entry is expected
   because a coach needs today's readiness to make today's decisions. Nobody makes a decision
   on Monday morning that depends on whether an athlete characterised last week's eating. The
   consequence of a missed check-in is one missing point in a coarse variable, which is a
   coverage figure, not a failure by the athlete.
2. **Adding it re-creates the nagging the client removed.** O-11 removed daily nutrition
   logging precisely because chasing it destroys compliance everywhere else. A nutrition
   compliance domain brings back the nudge, the digest line, the red cell on the compliance
   heatmap and the coach conversation, for a variable that is admitted to be weak. That is the
   old problem with a lower data yield.
3. **The denominator does not work.** Compliance is computed per athlete-day against
   expectations. A weekly domain either contributes one expectation against seven, which makes
   the nutrition domain almost invisible in `overall_pct`, or gets its own denominator, which
   is machinery producing a number nobody will act on. Neither is worth building.
4. **These are children as well as adults.** Confirmed, not hypothetical: O-886 was resolved on
   5 August 2026 and under-18s are in scope (`09-security-and-compliance.md` §4).
   Scoring an under-18 on whether they ate enough, weekly, in a system their coach reads, is a
   feature to be very careful with. Recording the answer is defensible. Ranking, scoring or
   chasing the answer is not.

**The counter-argument, stated fairly.** Without compliance pressure the response rate will be
low. If it settles at 40% then the variable has 40% coverage on a three-level scale, which is
close to useless, and the two days of work bought nothing.

That is a real risk and the response is measurement, not pressure. The response rate is
reported as a **coverage figure** on the analytics footer and on the staff nutrition surface,
labelled "response rate" and never "compliance", and it is attached to the squad and the week,
not held against an individual athlete. If it is persistently below roughly 50%, the correct
response is to drop the variable and say so, not to nag children into supplying it. That
decision point is **O-975**.

---

## Open questions

- **O-970**: The question is fixed to protein. Protein is the right single question for a
  strength sport and it is not the right one for every sport or every athlete. Should the
  question be configurable per organisation, and if so, does the analytics metric stay one
  metric or become one per configured question? Configurability makes the cross-club meaning of
  the variable unstable, which is the reason I have specified it fixed. Confirm.
- **O-971**: `04-data-model.md` §17.14 is referenced by `nutrition-guidance.md` for
  `nutrition_guidance` and `meal_ideas` and was never written. Pre-dates this screen. Write it
  before Phase 2 builds the guidance authoring library.
- **O-972**: Three answers or five? Five (`always`, `mostly`, `about half`, `rarely`, `never`)
  would reduce the tie problem that attenuates the correlation coefficient in `analytics.md`,
  at the cost of asking an athlete to make a distinction their recall probably does not support.
  I have specified three, matching the client's wording. Five is a schema change and an enum
  migration, so decide before Phase 2.
- **O-973**: Should the question text be organisation-configurable? Same trade as O-970 in a
  smaller form: a club that phrases it differently produces answers that are not comparable to
  another club's, which matters only if cross-club analysis is ever built. It is not, per
  `09-security-and-compliance.md` §2, so the cost is low. Fixed for v1.
- **O-974**: Should a long-term injured athlete be prompted? I have specified yes, because
  eating is not conditional on training and an injured athlete's nutrition is arguably the more
  interesting case. A club may disagree. Currently the only remedy is turning the notification
  off, which is a blunt instrument.
- **O-975**: What response rate is the floor below which the variable should be withdrawn?
  My instinct is 50% of athlete-weeks over a four-week window, measured at the pilot. Below
  that, say so and remove the axis rather than caveating a variable nobody answers.
- **O-976**: Should the athlete see their own history of answers in My Data? I have specified
  yes, as a plain list with no scoring and no trend line. A trend line on three levels is a
  chart that says more than the data does.

---

## Related documents

- Parent screen and the option this implements: `nutrition-guidance.md` §9
- Schema, indexes and policies: `04-data-model.md` §17.15
- The notification: `08-notifications.md` §2 and §3.7
- The analytics variable and its caveats: `analytics.md` §"Metrics available, by domain"
- Immutability and revisions: `docs/decisions/adr-005-immutable-entries.md`
- Offline queue: `docs/decisions/adr-004-offline-first.md`, `05-architecture.md` §6
- Why this is not compliance: `04-data-model.md` §11, `squad-status.md` O-380
- Phase and estimate: `10-roadmap.md` §5
