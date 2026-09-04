# 13. New week template

## 1. Page name and URL

**New week template**, at `/schedule/planner/new`.

Defines a week shape that can be applied to any week.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a template | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The form | Create a template | None | Base | Same |
| Medic | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| S&C | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-06 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

## 3. How you get here

- The create control on the week templates screen.

---

## 4. What you see

**A name for the template**, which is how it will be recognised when applying it.

**The week's shape**: for each day, what activity happens, at what time, and for
how long. A day may hold several activities or none.

**Save and Cancel.**

---

## 5. Every number on this page

None. Times and lengths here are inputs, not calculated figures.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Name | Top | Names the template | Stays here | Nothing until saved | Coach and sport scientist | None | Never |
| The day and activity controls | Middle | Build the week's shape | Stays here | Nothing until saved | Same | None | Never |
| **Save** | Foot | Writes the template | Back to the template list | Creates one template | Coach and sport scientist | The form is the confirmation | Disabled while saving |
| Cancel | Foot | Abandons the form | Back to the list | Nothing | Same | None. Unsaved input is lost | Never |

**Saving a template creates no sessions.** It records a shape. Sessions appear
only when the template is applied, on screen 15.

---

## 7. How this page is built, in plain English

The page is built on the server and the form runs in the browser.

The saved shape carries a version number, so a later change to how shapes are
stored can be recognised rather than misread.

---

## 8. States

**Loading.** Renders immediately.

**Saving.** The button is disabled and says so.

**Error.** The form stays, filled in, with a sentence.

**No permission.** Currently any staff member reaches it.

**Wrong tier.** Not applicable.

**Offline.** The connection sentence rather than a hang.

---

## 9. Open issues

- **Every staff role can create a template.** Decision D-06.
- **UNVERIFIED: whether a template carries group assignments**, so that applying
  it also sets who is expected at each session. The previous specification listed
  this as an unanswered product question rather than a built behaviour. Files
  searched: `src/lib/queries/weekTemplates.ts`.
