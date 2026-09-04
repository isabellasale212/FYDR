# 14. Week template detail

## 1. Page name and URL

**Week template**, at `/schedule/planner/[templateId]`.

One saved week shape: what it contains, and where it is changed.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The template | View and edit | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The template | View and edit | None | Base | Same |
| Medic | Yes | The template | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| S&C | Yes | The template | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | Yes | The template | **View only** | None | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/schedule/planner/[templateId]/page.tsx:10`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A template's name in the week templates list.

---

## 4. What you see

**A header** with the template's name and a way back to the list.

**The week's shape**, day by day, with each activity's kind, time and length.

**The controls to change it.**

---

## 5. Every number on this page

None.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Edit the shape | The body | Changes what the template holds | Stays here | Updates the template | Coach and sport scientist | Form submission | Should be hidden for view only roles. **Not built** |
| Back to templates | Header | Returns to the list | `/schedule/planner` | Nothing | Any staff | None | Never |

**Editing a template does not change any week already built from it.** A template
is a shape used at the moment of applying; the sessions it created are ordinary
sessions with no continuing link back. This is worth stating on the screen,
because a coach may reasonably expect the opposite.

---

## 7. How this page is built, in plain English

Built on the server. It reads one template.

An address naming no template shows the not found page.

---

## 8. States

**Loading.** Renders when ready.

**Not found.** The not found page.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **Every role can edit a template.** Decision D-06.
- **UNVERIFIED: whether editing a template is version-safe** for weeks already
  applied from an older shape. The stored format carries a version number, which
  suggests the question was anticipated. Files searched:
  `src/lib/queries/weekTemplates.ts`.
