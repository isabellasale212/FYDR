# Persona review — STAFF-MEDIC-19, -24, -28 and -30g

**Persona.** The club physio: the injury board before training, an injury's own page after
it, the rehab programme they author, and the one subject-access review only they can do.

**Account.** Ruth Callaghan (medic only), port 9503; Jane Pemberton for the comparison;
the coach's fingerprints from the coach section for the three-way reads. **Reviewed
2026-09-12** at **1280×900 and 375×812**. One write was attempted on purpose and refused
by the database (the group reorder, below); nothing else written.

---

## STAFF-MEDIC-19 — The injuries report

**Identical in structure** to the sport scientist's (114 vs 112 leaves — the browser's
period; 22 controls each). The medic's page carries the same censored rows; the medic's
**PDF** adds a "MEDICAL IN CONFIDENCE" banner and a body-area count and nothing clinical
(see the 01–05 review's export table). The report is censored by construction for every
role — `injury_clinical` is never selected — and the medic is no exception.

## STAFF-MEDIC-24 — Rehab programmes

**As documented, and the label is the tell:** on `/programmes` the medic's detail link for
"In-Season max" (a standard programme) reads **"View full detail →"** where the sport
scientist's reads "Edit this programme →"; for "Return to running" (rehab) the medic's reads
**"Edit this programme →"** (`REHAB_PROGRAMME`). `/programmes/new` opens for the medic and
says "This will be a rehab programme" (`PROGRAMME_AUTHOR`). Identical otherwise (34 leaves,
9 controls).

## STAFF-MEDIC-28 — The injury board

**Differs on three of five screens, as documented, now measured:**

- `/injuries`: the medic's board is 59 leaves to the sport scientist's 29 — "+ Injury",
  and a **"Problem reports (4)"** section with the athletes' own words and, per report,
  "+ Note", "Close" and (where open) "Acknowledge". 1,392px / 1,967 at phone.
- `/injuries/{James Barnes}`: 94 leaves to 12 — the clinical record, a **Timeline**
  section, and the availability write set (Available / Modified / Unavailable, the
  restriction chips "no contact", "no sprinting", "no loading", "upper body only", "no pitch
  work", the note field with its coach-visible hint). 2,134px / 2,450 at phone.
- `/injuries/rehab-groups`: the medic has "Set phase" / "Remove" (`REHAB_ALLOCATION`) —
  20 controls, as the sport scientist.
- `/injuries/new`: identical, 73 leaves — the non-clinical create form for every role.
- `/injuries/team-allocation`: **read-only for the medic** (85 leaves, 9 controls; the
  sport scientist's 233 with the eight "Allocate to…" selects) — `SESSION_EDIT`'s, stated on
  the page. The document's 2026-09-10 correction stands: the route opens, the allocation
  does not.

## STAFF-MEDIC-30g — Review a subject-access request

`/settings/subject-access/{id}/review` **opens for the medic** ("James Barnes · Every c…")
and **refuses the sport scientist** (`/settings/subject-access?e=no-sar-access`) — measured
on the one request on scratch (released, 8 Aug). The list itself (`/settings/subject-access`)
is the same 14-leaf page for both; with the only request released it carries **no link to
the review** for either role — the entry point to this flow, when a request is pending, was
not observable on scratch.

---

## The medic's "cannot reach" list, measured, with three corrections

| Route | Document | Measured |
|---|---|---|
| `/analytics` | cannot reach | `/dashboard?e=no-analytics` ✓ |
| `/schedule/new`, planner | cannot reach | `/schedule`, read-only ✓ |
| **`/timetable`** | cannot reach (`SESSION_EDIT`) | **opens** — the 2026-09-06 decision (migration 0076) opened it to every role; the document is stale. Corrected. |
| **`/settings/groups`** | cannot reach (`GROUP_EDIT`) | **opens** — the list is `requireStaff()`; "+ New group" and "Open team allocation →" absent. **But the reorder arrows render, enabled, and a press is a silent no-op** — see §0az. Corrected. |
| `/settings/thresholds` | cannot reach | **renders an in-page refusal** ("Not part of this role. Setting the rules that raise flags belongs…") — no redirect. Refined. |
| `/settings/imports`, `/settings/audit`, `/users`, `/retention` | cannot reach | `/settings`, silently (§0av's bounce) ✓ |
| `/leaderboards/new` | publishing — cannot | `/leaderboards/manage` ✓ — **but `/leaderboards/manage` opens and offers "+ New leaderboard"**, which bounces the medic back (§0az). The board page gives the medic **"Suppress an athlete"** (the medical suppression, 0016) and no Board actions — correct. |
| Nutrition authoring; the meal library | cannot | `/nutrition` opens (view); **"+ Meal" renders disabled with no reason** (§0az); "Food library" present. |

**The gate holds at the database in every case probed** (the clinical tables, 01–05
review; the group reorder, below). What the UI gets wrong is the offer: three controls the
medic can see and press that the database then refuses without a word.

**§0az, measured as the medic:** pressing "Move Backs down" on `/settings/groups` sends two
UPDATEs that `groups_staff_update` (0078: sport scientist, coach) filters to zero rows;
PostgREST returns no error; `moveGroup` checks `.error` only; the component calls
`onSuccess` and refreshes; the order is unchanged (`Backs:1 | Forwards:2` in the table
before and after) and nothing is said.

---

## Summary for design

1. **Three controls offered to the medic that go nowhere**: the group reorder arrows
   (silent no-op), "+ New leaderboard" (bounces), "+ Meal" (disabled, reasonless). *(Defect,
   §0az; the reorder one is the worst — a control that reports success and does nothing.)*
2. **The review entry point is invisible on a released request** — the list carries no
   link for anyone; whether a pending request shows one was not observable. *(Design
   question for SS-30g; note.)*
3. **The injury's own page is the medic's working surface** (2,450px at phone with the
   clinical record, timeline and the availability write set) — PATTERN-S3 C2/C3 (the status
   screen and the stage ladder) are its redesign; nothing filed here beyond the inventory.
4. Right and worth keeping: the "Problem reports" section on the board (the athlete's own
   words, medic-only, database-enforced); the detail link label as the tell on programmes;
   the team-allocation read-only note.
5. Boundaries verified: rehab programme authoring yes, standard programme no; allocation no;
   SAR review medic-only and admin-refused.

## Claims checked

| Claim | Verdict |
|---|---|
| 19: all five roles open the report; the medic uniquely gets clinical content | Opens for all; **the medic's page and PDF carry no clinical content either** — a banner and a body-area count. Corrected in wording (the review, not the section). |
| 24: rehab authorable, standard read-only, the label is the tell | **Correct**, measured. |
| 28: "+ Injury", "Problem reports" medic-only; ~815 vs ~1,778 characters | **Correct** (29 vs 59 leaves); team allocation read-only for the medic. |
| 30g: review is `CLINICAL_ONLY`; neither role completes alone | **Correct** — medic opens, admin refused. |
| Cannot reach: `/timetable`, `/settings/groups` | **Both open** — corrected. |
