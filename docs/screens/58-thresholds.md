# 58. Thresholds

## 1. Page name and URL

**Thresholds**, at `/settings/thresholds`.

The club's own rules for when a flag is raised. **This is where "the app flagged
him" actually comes from.**

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every threshold | View, create, edit, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Every threshold | View, create, edit, delete | None | Base | Same. **Creating is coach only**, at `src/app/(staff)/settings/thresholds/new/page.tsx:10` |
| Medic | Yes | Every threshold | **View only** | None | Base | Creating already refuses them |
| S&C | Yes | Every threshold | **View only** in the agreed model | None | Base | **NOT BUILT** for editing |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

**The screen is labelled Coach only**, and creating a threshold enforces that:
even a medic is sent back.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/thresholds/page.tsx:14`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Thresholds link in Settings.

## 4. What you see

Every threshold with the measure it watches, the rule, and **which roles get
notified when it fires**.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| Various | The measure each rule watches | Any metric in the registry | As the rule sets | A rule on a measure with no data never fires |

**This screen is the authority on flag cutoffs, not the app's code.** Anywhere
Fydr shows a band around a number, such as the 0.8 to 1.5 drawn around the acute
to chronic ratio, that band is a display convention. **The rule that actually
raises a flag is here.** The two can differ and nothing reconciles them.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A threshold | The list | Opens it for editing | Stays here | Updates the threshold, keeping a revision | Coach and sport scientist | Form submission | **Not built** for view only roles |
| New threshold | Header | Opens the create screen | `/settings/thresholds/new` | Nothing | **Coach only today** | None | Refuses a medic |
| Notify roles | A threshold | Chooses who is told when it fires | Stays here | Updates the threshold | Coach and sport scientist | Form submission | **Not built** |

**Thresholds are versioned, not overwritten.** Changing a rule keeps what it used
to be, so a flag raised last month can still be understood against the rule that
raised it.

**The notify roles list uses the four role names the code has.** When the role
model changes, every threshold's notification list needs remapping. Part of
decision D-07.

## 7. How this page is built, in plain English

Built on the server. Editing runs in the browser.

## 8. States

**No thresholds.** No flags will ever be raised. This is a real and quiet failure
mode: an empty thresholds list looks the same as a well behaved squad.
**Error.** Surfaces as an error. **Offline.** Not handled.

## 9. Open issues

- **An empty thresholds list is indistinguishable from a quiet squad.**
  **Decision D-39**: say on the dashboard when no thresholds are configured, so a
  club does not conclude nothing is wrong when nothing is watching.
- **The notify roles lists need remapping when admin is removed.** Decision D-07.
