# 59. New threshold

## 1. Page name and URL

**New threshold**, at `/settings/thresholds/new`.

Creates a rule that raises a flag.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | **No today.** Yes in the agreed model | Nothing today | Nothing today | The whole page | Base | `src/app/(staff)/settings/thresholds/new/page.tsx:10` |
| Coach | Yes | The form | Create a threshold | None | Base | Same line |
| Medic | **No** | Nothing | Nothing | The whole page | Base | Same line |
| S&C | **No** | Nothing | Nothing | The whole page | Base | Same line |
| Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same line |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

**This is the most tightly gated screen in the app: coach, and nobody else.**
Under the agreed model the sport scientist must be added.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/thresholds/new/page.tsx:9`; a **coach** check at `src/app/(staff)/settings/thresholds/new/page.tsx:10`, which redirects. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The New threshold control on the thresholds screen.

## 4. What you see

Which measure to watch, the rule, whether it compares against an absolute cutoff
or the athlete's own baseline, and which roles to notify.

## 5. Every number on this page

None displayed. The cutoff entered here becomes the rule that raises flags for
that measure.

**An absolute rule and a baseline rule are different things.** An absolute rule
fires above or below a fixed number regardless of the athlete. A baseline rule
fires relative to that athlete's own history. The choice is the most consequential
one on this form.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Measure chooser | Top | Picks what to watch | Stays here | Nothing until submitted | Coach | None | Never |
| Rule and cutoff | Middle | Sets when it fires | Stays here | Nothing until submitted | Coach | None | Never |
| Baseline or absolute | Middle | Decides what the cutoff is measured against | Stays here | Nothing until submitted | Coach | None | Never |
| Notify roles | Lower | Chooses who is told | Stays here | Nothing until submitted | Coach | None | Never |
| **Create** | Foot | Writes the threshold | Back to Thresholds | Creates a rule that will begin raising flags | Coach | The form is the confirmation | Disabled while saving |

**A new threshold starts firing immediately** against data that already exists.
Creating a strict rule on a squad with months of history can raise a great many
flags at once.

## 7. How this page is built, in plain English

Built on the server; the form runs in the browser.

## 8. States

**Saving.** Disabled and says so. **Error.** The form stays. **Offline.** The
connection sentence.

## 9. Open issues

- **The sport scientist cannot create a threshold.** Part of decision D-07.
- **Partly resolved.** A separate flag engine evaluates rules
  (`src/lib/queries/thresholds.ts:191`), and a club with no thresholds raises no
  flags at all, which is decision D-39. **UNVERIFIED: whether the engine evaluates
  only new data or sweeps existing rows**, which decides whether creating a rule is
  quiet or raises a great many flags at once. Files searched:
  `src/lib/queries/thresholds.ts`, `supabase/migrations/0052*.sql`. This is the one
  question the verification pass could not close.
