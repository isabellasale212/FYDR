# 56. New group

## 1. Page name and URL

**New group**, at `/settings/groups/new`.

Creates a squad group and chooses who is in it.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a group | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The form | Create a group | None | Base | Same |
| Medic, S&C, Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/groups/new/page.tsx:8`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The New group control on the groups screen.

## 4. What you see

A name, and the squad with a way to choose members.

## 5. Every number on this page

None beyond a count of who has been chosen.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Name | Top | Names the group | Stays here | Nothing until submitted | Coach and sport scientist | None | Never |
| Member chooser | Body | Picks who is in it | Stays here | Nothing until submitted | Same | None | Never |
| **Create** | Foot | Writes the group and its membership | Back to Groups | Creates a group and its member rows | Same | The form is the confirmation | Disabled while saving |
| Cancel | Foot | Abandons | Back to Groups | Nothing | Same | None | Never |

**A new group appears in the filter on every screen at once.** It is not scoped to
where it was made.

## 7. How this page is built, in plain English

Built on the server; the form runs in the browser.

## 8. States

**Saving.** Disabled and says so. **Error.** The form stays. **Offline.** The
connection sentence.

## 9. Open issues

- **Every staff role can create a group.**
