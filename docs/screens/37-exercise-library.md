# 37. Exercise library

## 1. Page name and URL

**Exercise library**, at `/programmes/exercises`.

Every exercise the club can put in a programme, and which test measures each one's
one repetition maximum.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The library | View, create, edit | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The library | **View only** | None | Base | **NOT BUILT.** Decision D-04 |
| Medic | Yes | The library | **View only** | None | Base | **NOT BUILT** |
| S&C | Yes | The library | View, create, edit | None | Base | **NOT BUILT** |
| Nutritionist | Yes | The library | **View only** | None | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/programmes/exercises/page.tsx:22`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A link from the programme list.

## 4. What you see

The exercises, each with its name, category, primary muscle, equipment, coaching
cues, and **the test that measures its one repetition maximum** where one is
linked.

## 5. Every number on this page

None directly. **The link recorded here is what makes MET-030 possible**: without
it, an exercise prescribed as a percentage has nothing to be a percentage of, and
every athlete's weight for it is unresolvable.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Add an exercise | Header | Creates one | Stays here | Writes an exercise | S&C and sport scientist | Form submission | **Not built** |
| Weight step | The create form, beside Primary muscle (the slot the design drew as an inert Unit picker) | Chooses what the athlete's weight stepper moves by for this movement: 0.5 / 1 / 1.25 (microloaded bar) / 2 (dumbbells) / 2.5 (a plate a side, the default) / 5 (plate-loaded machine) kg | Stays here | `exercises.weight_step_kg` (migration 0108, ATH-ADULT-09 C3, 12 September 2026) | S&C and sport scientist | With the form | Never. Existing exercises keep 2.5 — there is no edit form for a library row yet |
| Edit an exercise | A row | Changes it | Stays here | Updates the exercise | Same | Form submission | **Not built** |
| **Link a test** | An exercise | Names the test that measures its one repetition maximum | Stays here | Sets the link | Same | Form submission | **Not built** |

**Linking a test is the highest leverage action on this screen.** Setting it turns
every percentage prescription of that exercise, for every athlete on every
programme, from unresolvable into a real weight.

## 7. How this page is built, in plain English

Built on the server. Editing runs in the browser.

## 8. States

**Empty.** A club with no exercises sees an empty state. **No test linked.**
Shown as an absence, because it has a real consequence downstream. **Offline.**
Not handled.

## 9. Open issues

- **Every role can edit the library.** Decision D-04.
- **This screen has no entry in the previous specification set.** This file is its
  first specification.
- **UNVERIFIED: whether an exercise in use by a programme can be deleted**, and
  what happens to that programme if so. Files searched:
  `src/lib/queries/programmes.ts`.
