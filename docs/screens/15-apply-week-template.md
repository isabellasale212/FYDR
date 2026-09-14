# 15. Apply a week template

## 1. Page name and URL

**Apply a week template**, at `/schedule/planner/apply`.

Turns a saved week shape into real sessions on a chosen week. **This is the only
screen in the planner that writes to the schedule**, and it can create a week's
worth of sessions in one action, so it deserves reading carefully.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The chooser and the preview | Create a week of sessions | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The chooser and the preview | Create a week of sessions | None | Base | Same |
| Medic | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| S&C | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/schedule/planner/apply/page.tsx:19`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Apply template on the schedule toolbar.
- From a template.

---

## 4. What you see

**Which template** is being applied.

**Which week** it is being applied to.

**What will happen**, before anything is written: the day-by-day table, and
under it the consequence in one sentence — "This will remove 3 sessions
already in this week and add 7 from the template." — with what stays named
after it.

**Apply.** Pressing it opens B11's dialog (PATTERN-S4 C7, ruled 13 September
2026, built 14 September), which carries the same consequence sentence before
its two buttons: **Replace the week** and **Keep the week as it is**. It is the
one confirmation in the planner, and it earns its keep because the removal is
a soft delete nobody can undo from a screen.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| None | The count of sessions to be created | How many sessions this will add | The chosen week | Zero when the template is empty |

That count is a plain count of what is about to be written, not a metric.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Choose a template | Top | Selects the shape to apply | Stays here | Nothing | Coach and sport scientist | None | Never |
| Choose a week | Top | Selects the week to apply it to | Stays here | Nothing | Same | None | Never |
| **Apply template** | Foot | Opens the dialog | Stays here | Nothing | Coach and sport scientist | — | Disabled while applying, after a successful apply, and when the template would change nothing |
| **Replace the week** | The dialog | Replaces the week | Stays here, with the result and a link to the schedule | **Removes every session in the week without recorded data and creates every session in the template.** The largest single write in the schedule area | Coach and sport scientist | The dialog itself: the consequence sentence sits above the button | — |
| Keep the week as it is | The dialog | Closes it | Stays here | Nothing | Same | None | Never |

**Applying replaces the week** (PATTERN-S4 C7). Every session already in the
week is **soft deleted** — marked as removed, not erased — and the template's
sessions are created. Two things stay, because removing them would destroy
something: a session with recorded attendance or ratings (the same rule that
makes a rated session read-only), and the fixture's own match session, which
the week is built around; a template's own MD-0 match is not created on a day
that already has the fixture's, so applying never doubles the match. The
three ways to apply this screen used to offer (add alongside, replace planned,
fill gaps) are gone. If the template would change nothing, it refuses and says
so. The result reports both numbers, created and removed.

**What it does not do is detect that somebody else changed the week while you were
looking at it.** The design called for the write to be refused in that case; that
was cut because nothing else in this app works that way
(`src/lib/queries/weekTemplates.ts:12`).

**It does not immediately regenerate compliance expectations.** The design's own
confirmation wording promises that expectations will be regenerated. The generator
exists and runs nightly, so a newly applied week's expectations land on the next
nightly run rather than at once (`src/lib/queries/weekTemplates.ts:22`).

**What this means for a coach in practice.** Apply a template on Sunday evening
and the compliance figures for that week may read as though nothing is expected
until the following day. Raised as **decision D-30**.

---

## 7. How this page is built, in plain English

Built on the server, with the applying itself done by a direct write from the
browser, checked again by the server and by the database. There is no separate
background job.

Sessions are created from the template's shape at the club's local times.

---

## 8. States

**Loading.** Renders when ready.

**No templates saved.** The screen says so and points at creating one.

**Applying.** The button is disabled and says so, so a week cannot be applied
twice by a double press.

**Error.** A sentence, with the choices left as they were.

**No permission.** Currently any staff member reaches it.

**Wrong tier.** Not applicable.

**Offline.** The connection sentence rather than a hang.

**Partly applied.** The sessions themselves are written in one batch, so they
either all appear or none do. Deciding who is expected at them is a second write,
and if that one fails the screen says so in those terms: *Sessions created, but
rostering failed*, followed by what went wrong. A coach is told they have a week
of sessions with nobody attached, which is recoverable, rather than being left to
discover it.

---

## 9. Open issues

- **Every staff role can apply a template.** Decision D-06.
- **Compliance expectations lag by up to a day.** Decision D-30.
- **No conflict detection.** Two people applying templates to the same week at the
  same time will both succeed, and the week will hold both. Recorded rather than
  raised, because the same is true of every other write in the app.
- **Resolved, and the behaviour is sound.** The sessions are written in a single
  batch, so a week is never half created. Rostering is a second write, and its
  failure is reported in plain words rather than hidden. Recorded here so the
  question is not re-opened.
- **Replacing sessions is a soft delete**, so an applied template that overwrote
  the wrong week has not destroyed anything. **UNVERIFIED: whether any screen
  offers a way to restore them.** Files searched:
  `src/lib/queries/weekTemplates.ts`, `src/app/(staff)/schedule/planner/apply/page.tsx`.
