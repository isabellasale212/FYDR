# 34. Programme

## 1. Page name and URL

**Programme**, at `/programmes/[programmeId]`.

One programme: its blocks, its sessions, its exercises, and who is on it.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | View, edit, assign athletes | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| Medic | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| S&C | Yes | Everything | View, edit, assign | None | Base | **NOT BUILT** |
| Nutritionist | Yes | Everything | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| Athlete | **No** | Nothing here | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/programmes/[programmeId]/page.tsx:25`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A programme's name in the list.
- An athlete's gym page, following their assignment.

## 4. What you see

**A bodyweight exercise says what it logs, in words** (PATTERN-S5, 12 September
2026): with the load basis set to none, the load slot reads "logs reps only" as a plain
value — no disabled input on the row. The row says which numbers this screen owns.

A header with the programme's name. Its blocks, each a time bounded phase. Within
each block, the sessions, and within each session the exercises with sets, reps,
load basis, tempo and rest. Then the athletes assigned.

**Where an exercise is prescribed as a percentage**, the basis is shown rather
than a single weight, because the real weight differs per athlete.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-030 | The load against an exercise | Either a fixed weight, or a percentage that resolves per athlete | Current | An athlete without the linked test result is marked unresolvable |
| MET-029 | The best lift behind a percentage | The athlete's best for the linked test | All time | Blank, and the weight becomes unresolvable |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Edit blocks, sessions, exercises | The body | Changes the programme | Stays here | Updates the programme | S&C and sport scientist | Form submission | **Not built** |
| Assign an athlete | Athletes panel | Puts them on the programme | Stays here | Creates an assignment | S&C and sport scientist | Form submission | **Not built** |
| Override for one athlete | An exercise | Exempts, substitutes, changes volume, caps load, or adds a note | Stays here | Writes an override | S&C and sport scientist | Form submission | **Not built** |
| An athlete's name | Athletes panel | Opens their view of this programme | `/programmes/[programmeId]/athlete/[athleteId]` | Nothing | Any staff | None | Never |

**The five override kinds are the mechanism that lets one programme serve a
squad**: exempt, substitute, volume, load cap and note. Each is named on screen
rather than silently changing what the athlete sees.

## 7. How this page is built, in plain English

Built on the server. Blocks, sessions, exercises, overrides and assignments are
read together.

Editing runs in the browser. **Changes are not versioned**, so editing a programme
mid-block changes it for everyone on it immediately.

## 8. States

**Not found.** The not found page. **No athletes assigned.** Says so. **No
blocks.** An empty programme is a valid draft. **Error.** Surfaces as an error.
**Offline.** Not handled.

## 9. Open issues

- **Every role can edit.** Decision D-04.
- **Editing takes effect immediately for every assigned athlete**, with no
  versioning and no warning. **Decision D-37**: warn when editing a programme with
  athletes currently assigned, naming how many.
