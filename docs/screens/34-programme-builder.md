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
load basis, tempo and rest. Then the athletes assigned — the Assigned card's
headline is the **distinct** athlete count against the squad, "15 of 30
athletes", with its arithmetic beneath: "14 in Backs and Forwards + 2 named − 1
counted twice" (PATTERN-S5 C4, 13 September 2026). Never assignment rows or
group sizes added: an athlete in two assigned groups counts once. "Nobody
assigned yet" when there is none.

**Dates live on the assignment, not the programme** (Isabella, 15 September
2026, `docs/decisions/programme-dates.md`; migration 0132). The programme is
a template — weeks and sessions, no dates. Each assignment row on the
Assigned card carries its start date, chosen by the S&C at the moment they
assign ("Starts on", defaulting to today; "Week 1, day 1 is this day", with
the last day the length gives: "4 weeks: the last day is Mon 12 Oct."). There
is no end date to set: it falls out of the start plus the programme's length
(the sum of its blocks' weeks — `programme_assignment_ends_on`,
`lib/programmeDates.ts`), so nothing can disagree with anything. A row reads
"from Mon 14 Sept to Sun 11 Oct", "· finished" once the weeks have run out,
or **"no start date"** for an assignment made before dates existed — left
unmapped rather than given an invented one, with **Set start date** for the
S&C to set it the next time they touch it; **Change date** moves a dated one.
Overlap is allowed: nothing here refuses an athlete a second live block.

**Where an exercise is prescribed as a percentage**, the basis is shown rather
than a single weight, because the real weight differs per athlete.

**Phone width, 16 September 2026 (the evening queue, 2.8).** The builder is
read-only below 768px: every control in it is an edit control, so `base.css`
hides them all through `.prog-builder[data-edit-desktop-only]` (the add-forms
open only from those buttons); Publish / Archive / Reactivate are the desktop's.
The "Gym programme" crumb is a word, not a link, at phone width (2.2: the list
is the S&C's there). Hidden, not withheld — `canEdit` and the RPCs are
unchanged; enforcement after Friday.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-030 | The load against an exercise | Either a fixed weight, or a percentage that resolves per athlete | Current | An athlete without the linked test result is marked unresolvable |
| MET-029 | The best lift behind a percentage | The athlete's best for the linked test | All time | Blank, and the weight becomes unresolvable |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Edit blocks, sessions, exercises | The body | Changes the programme | Stays here | Updates the programme | S&C and sport scientist | Form submission | **Not built** |
| Assign an athlete or a group | Assigned card, + Assign | Puts them on the programme from a chosen start date (week 1 day 1) | Stays here | Creates an assignment with `starts_on` | S&C and sport scientist (a medic for rehab) | Form submission | Hidden from everyone else |
| Set start date / Change date | Assigned card, each row | Sets week 1 day 1 for an assignment made before dates existed, or moves a dated one | Stays here | `programme_assignments.starts_on` | S&C and sport scientist (a medic for rehab) | Inline Save | Hidden from everyone else |
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
