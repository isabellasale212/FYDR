# 33. Gym programme

## 1. Page name and URL

**Gym programme**, at `/programmes`.

Every programme the club has, and who is on each.

**This is the S&C's own screen.**

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every programme | View, create, edit, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Every programme | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| Medic | Yes | Every programme | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| S&C | Yes | Every programme | View, create, edit, delete | None | Base | **NOT BUILT** |
| Nutritionist | Yes | Every programme | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| Athlete | **No** | Nothing here. Athletes see their own programme in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/programmes/page.tsx:92`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Gym programme, the sixth item in the sidebar.
- A link from an athlete's gym page.

## 4. What you see

A header with the group filter. Then the programmes, each with its name, its
blocks, and how many athletes are assigned. Where an exercise has been overridden
for an individual, the override is named rather than silently applied.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-030 | Prescribed weights, where shown | What an athlete should lift, from their own best | Current | **Marked unresolvable**, never guessed |
| None | Athletes assigned | How many are on this programme | Now | Zero says so |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows the list | Stays here | Nothing | Any staff today | None | Never |
| New programme | Header | Opens the builder | `/programmes/new` | Nothing | S&C and sport scientist | None | Should be hidden from view only roles. **Not built** |
| Exercise library | Header | Opens the library | `/programmes/exercises` | Nothing | Any staff today | None | Never |
| A programme's name | The list | Opens it | `/programmes/[programmeId]` | Nothing | Any staff | None | Never |

## 7. How this page is built, in plain English

Built on the server. Programmes, their blocks and their assignments are read
together.

**Programme change history is deliberately not recorded**
(`src/lib/queries/programmes.ts:22`). A programme shows what it is now, not what
it was.

## 8. States

**No programmes.** An empty state. **Error.** Surfaces as an error. **No
permission.** Athletes redirected. **Wrong tier.** Not applicable. **Offline.**
Not handled.

## 9. Open issues

- **Every role can edit programmes.** Decision D-04.
- **No change history**, so a programme edited mid-block cannot be compared with
  what an athlete actually trained. Recorded as a documented cut, not raised.
