# 12. Week templates

## 1. Page name and URL

**Week templates**, at `/schedule/planner`.

Saved week shapes. Define what a normal week looks like once, then put it onto
any week rather than rebuilding it session by session.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every template | View, create, edit, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Every template | View, create, edit, delete | None | Base | Same |
| Medic | Yes | Every template | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| S&C | Yes | Every template | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | Yes | Every template | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/schedule/planner/page.tsx:20`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Apply template control on the schedule toolbar.
- A direct link.

**This screen is not in the sidebar.** It is reached through the schedule, which
is correct, because a template has no meaning except in relation to a week.

---

## 4. What you see

**A header** naming the screen, with a way back to the schedule.

**The list of saved templates**, each with its name and the shape it holds.

**A control to create a new one.**

A club with no templates sees an empty state rather than a blank page.

---

## 5. Every number on this page

None. This screen lists saved shapes and displays no calculated figures.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| A template's name | The list | Opens that template | `/schedule/planner/[templateId]` | Nothing | Any staff | None | Never |
| New week template | Header or list | Opens the create screen | `/schedule/planner/new` | Nothing | Coach and sport scientist | None | Should be hidden for view only roles. **Not built** |
| Schedule breadcrumb | Header | Back to the week | `/schedule` | Nothing | Any staff | None | Never |

---

## 7. How this page is built, in plain English

Built on the server. It reads the club's saved templates and nothing else.

**One thing worth knowing about how templates are stored.** A template records a
week's *shape*, not a week's sessions: which days carry what kind of activity, at
what time, for how long. Applying it creates real sessions from that shape. The
stored shape carries a version number so that a change to the shape's format does
not silently misread older templates.

---

## 8. States

**Loading.** Renders when ready.

**Empty.** A club with no templates sees an empty state explaining what a template
is for, rather than an empty list.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **Every role can create and edit templates.** Decision D-06.
- **UNVERIFIED: whether a template can be deleted, and what happens to weeks
  already built from it.** By analogy with fixtures, deletion may deliberately not
  exist. Files searched: `src/app/(staff)/schedule/planner/page.tsx`,
  `src/lib/queries/weekTemplates.ts`.
