# 35. New programme

## 1. Page name and URL

**New programme**, at `/programmes/new`.

Creates an empty programme, ready to have blocks and sessions added.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The form | Create a programme | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT.** Decision D-04 |
| Medic | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| S&C | Yes | The form | Create a programme | None | Base | **NOT BUILT** |
| Nutritionist | **No** in the agreed model | Nothing | Nothing | The whole page | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/programmes/new/page.tsx:9`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The New programme control on the programme list.

## 4. What you see

A name, a description, and the programme's date range. Create and Cancel.

## 5. Every number on this page

None.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Name and description | Top | Names the programme | Stays here | Nothing until submitted | S&C and sport scientist | None | Never |
| Date range | Middle | Bounds the programme | Stays here | Nothing until submitted | Same | None | Never |
| **Create** | Foot | Writes the programme | Its own page, ready to build | Creates one empty programme | S&C and sport scientist | The form is the confirmation | Disabled while saving |
| Cancel | Foot | Abandons | Back to the list | Nothing | Same | None | Never |

**Creating a programme assigns nobody to it.** An empty programme affects no
athlete until blocks are added and athletes assigned.

## 7. How this page is built, in plain English

Built on the server; the form runs in the browser and submits to it.

## 8. States

**Saving.** Disabled and says so. **Error.** The form stays, filled in.
**Offline.** The connection sentence.

## 9. Open issues

- **Every staff role can create a programme.** Decision D-04.
