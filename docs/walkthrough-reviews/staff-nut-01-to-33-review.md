# Persona review — Section E, the nutritionist (STAFF-NUT-01 to -33)

**Persona.** The club nutritionist: the plans, the targets, the meal library and the
weigh-ins are theirs; almost everything else on the nav is somebody else's.

**Account.** Sana Mirza, `s.mirza@ashcomberfc.example` — nutritionist only, on scratch (port
9503). Jane Pemberton's stored fingerprints for the identity check. **Reviewed 2026-09-12**
at **1280×900 and 375×812**, read-only.

**Method.** Fourteen routes fingerprinted and diffed; sixteen more reached to measure the
"cannot reach" list.

---

## Identical, verified

| Flow | Route | Result |
|---|---|---|
| NUT-01 | `/dashboard` | identical (124 leaves — the evening's A1/A2/A4 build) |
| NUT-02 | `/squad` | identical minus "Add athlete" |
| NUT-23 | `/nutrition`, `/nutrition/new` | **identical to the sport scientist's — 531 leaves, 63 controls**; "Manual target", "New plan", "Assign", the steppers, "Food library" and "+ Meal" all live. This is the one screen the role owns outright, and it is the sport scientist's screen unchanged. |
| NUT-33 | Print | identical control |
| — | `/leaderboards`, `/leaderboards/manage` | identical (520 / 8 leaves) — the manage page's "+ New leaderboard" bounces this role too (§0az) |
| — | `/reports/compliance`, `/reports/injuries` | identical (31 / 112 leaves) — the censored injuries report for a fourth non-medic role |

## Differs, measured

**NUT-05 — the profile.** Eight panels: no Availability, no SAR; the header "Edit" and the
five "Correct check-in" buttons blocked with a reason (`BlockedButton`); "View plan" /
"View full detail ›" on the programme (no `PROGRAMME_AUTHOR`); no "+ Log injury"; the
Body-weight trio live (`WEIGH_IN_EDIT`). **Two corrections to the document:** the
**Injury panel renders** for the nutritionist — the censored four facts ("Rehab · Right
shoulder · No contact … · Expected return Tue 15 Sept"), by the 2026-09-06 decision
(migration 0074) that reversed D-01 — and **the "Gym" tab link is still offered** in the
profile header while `/squad/{id}/gym` refuses this role in place: "Not part of this role.
An athlete's gym detail is named performance and wellness data. Admin manages the club
and does not read athlete performance data — see 01-roles-and-permissions.md (superseded)
§1." — a dead tab, and the same wrong-role copy as `/analytics/build` (§0av).

**NUT-07 — the schedule.** Read-only, as documented: no Read/Edit segment, no toolbar, no
banner actions; "Read only. The schedule is authored by the sport scientist and the coach."
(117 leaves, 23 controls vs 126 / 32.) `/timetable` opens (0076).

**NUT-29 — the hub.** Seven sections, five rows — Thresholds (→ in-page refusal, and it
reads "0 active" to this role), Password and two-factor, Groups (the read list), Notifications,
Log out; no Exports (`REPORT_ACCESS`), no admin rows. The Integrations links bounce. **And
`/settings/notifications` renders "Nothing to configure"** for this role — a row on the hub
that opens an empty page (§0av, with the Thresholds row).

## The "cannot reach" list, measured

| Route | Document | Measured |
|---|---|---|
| `/reports/squad`, `/athlete`, `/testing`, `/training` | redirect to `/settings?e=no-report-access` | **`/reports?e=no-report-access`** with an `i` banner: "Some reports below aren't open to your role. The ones tha…" — better than the document says (the hub, with the two that open). Corrected. |
| `/settings/exports` | — | `/settings?e=no-report-access` ✓ |
| `/injuries`, `/injuries/{id}`, `/injuries/new` | closed | `/dashboard`, silently ✓ |
| `/analytics` | closed | `/dashboard?e=no-analytics` ✓ |
| scheduling | closed | `/schedule` read-only ✓; **`/timetable` opens** (0076) — corrected |
| programme authoring | closed | `/programmes/new` → `/programmes` ✓; the list opens read-only |
| leaderboard publishing | closed | `/leaderboards/new` → `/manage` ✓ (which offers the link back, §0az) |
| settings administration | closed | `/settings/subject-access` → `?e=no-sar-access`; `/settings/thresholds` in-page refusal; **`/settings/groups` opens** (read) — corrected |

**At the database** (01–05 medic review, same day): the nutritionist's session reads zero
rows from every clinical table and the censored `injuries` row — the role model holds.

---

## Summary for design

1. **The widest gap between what this role can navigate to and what it can do, measured:**
   Reports (2 of 6), Gym programme (view), Leaderboard (view + a dead "+ New"), Schedule
   (read-only), Settings (5 rows, two of them dead, one empty), the profile's Gym tab
   (refusal). The document's own warning — "the most likely source of a 'why is this
   button missing' question" — is right, and the answer is the sidebar and the More sheet
   showing eight rows to a role with two working screens. *(Design; the STAFF-SHELL brief's
   role slot already varies the bar — Nutrition is this role's slot — and the sheet could
   vary the rest.)*
2. **A dead Gym tab on every athlete's profile for this role**, with wrong-role copy behind
   it. *(Defect, §0av.)*
3. **"Nothing to configure" as a hub destination.** *(Design, §0av.)*
4. Right and worth keeping: `/reports` as a hub that computes what the role may open and
   says so; the nutrition screen itself, which is the sport scientist's without change.
5. Boundaries: no injuries routes, no availability, no bio edit, no corrections, no
   programme authoring, no leaderboard publishing, no admin — all measured; the censored
   Injury panel by decision.

## Claims checked

| Claim | Verdict |
|---|---|
| NUT-01, 02, 23, 33 identical | **Identical** (02 minus Add athlete). |
| NUT-05 "no injury access … no gym panel" | **The censored Injury panel renders** (0074); the **Gym tab link renders and refuses**. Corrected. |
| NUT-07 read-only, and says so | **Correct.** |
| Four reports redirect to `/settings?e=no-report-access` | **To `/reports?e=no-report-access`** with a banner. Corrected. |
| "All scheduling … all settings administration" closed | `/timetable` and `/settings/groups` **open** (read). Corrected. |
