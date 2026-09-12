# Athlete profile — per-role, per-panel inventory (for STAFF-SS-02-05 C4 / B3, C1 / B1, C3 / B2)

**Measured 2026-09-12** on scratch at 1280×900, one single-role account per role, on two
athletes: **James Barnes** (`…0002`, injured — Rehab, Modified, a full clinical record) and
**Dan Okonkwo** (`…0001`, no current injury). Method: render `/squad/{id}` as each account,
list every `<h2>` panel with its visible controls and their disabled state, and diff.

| Role | Account | Roles held |
|---|---|---|
| Sport scientist | Jane Pemberton `j.pemberton@` | `sport_scientist` (the admin) |
| Coach | Mark Iremonger `m.iremonger@` | `coach` |
| Medic | Ruth Callaghan `r.callaghan@` | `medic` |
| S&C | Owen Hartnell `o.hartnell@` | `strength_conditioning` |
| Nutritionist | Sana Mirza `s.mirza@` | `nutritionist` |

## The matrix — injured athlete (James Barnes)

**Present** = the panel renders. **absent** = no heading, no lock, no count (the shape C4
asks for). Controls are listed as rendered; *[disabled]* = rendered with `disabled` and a
`title` reason (§0av). The header block is the part above the first panel.

| Panel | Sport scientist | Coach | Medic | S&C | Nutritionist |
|---|---|---|---|---|---|
| **Header** — name, position, pill, restriction line, Nutrition / Wellness / Gym tabs, "Change plan", "‹ Squad", "Edit" (bio) | all; Edit live | all; Edit live | all; Edit live | all; **Edit [disabled]** | all; **Edit [disabled]** |
| **Athleticism** (tests, bests) | present, no controls | same | same | same | same |
| **S&C history log** | present, no controls | same | same | same | same |
| **Injury** | present — status · body area · restrictions · expected return; no controls | same | present **with the clinical record** — onset, diagnosis, mechanism, severity, tissue, imaging, treatment plan; "Edit" and "Manage injury & programme →" | same as coach | same as coach (decided 2026-09-06, migration 0074: the nutritionist reads the censored view; `/injuries/*` routes still refuse them) |
| **Availability** (the write form: Available / Modified / Unavailable, reason, note, "Update availability") | present | present | present | **absent** | **absent** |
| **Flags** | present — "Thresholds ›", Acknowledge, + Add note per flag, "Show acknowledged" | same | same | same | present — "Thresholds ›" and "Show acknowledged" only (no Acknowledge / Add note on non-nutrition flags) |
| **Goals** | present — "Edit ›" → `/programmes/{id}` | same, same label | same, same label | same | same |
| **Nutrition plan** (kcal, protein, carbs, fat) | present — "Edit" → `/nutrition` | same, same label | same, same label | same | same |
| **Body weight** | present — + Log weigh-in, Set target range, Edit entries | present — **all three [disabled]** | present, live | present, live | present, live |
| **Entries and corrections** | present — "Correct check-in" per row, live | live | live | **[disabled] ×5** | **[disabled] ×5** |
| **Subject access request** — "Generate subject access pack →" | present | **absent** | **absent** | **absent** | **absent** |
| Page height | 3,117 | 2,944 | 3,378 | 2,698 | 2,608 |

**Uninjured athlete (Dan Okonkwo):** the same matrix with the Injury panel reading "No
current restrictions. This is not the same as being cleared." for every role (69 characters,
no clinical words even for the medic), one "Correct check-in" row, and no "Show
acknowledged". Heights 2,762 / 2,590 / 2,590 / 2,375 / 2,284.

## What this settles for C4 / B3 (panels by role, withheld panels absent)

- **Two panels are already absent-by-role**, in the shape C4 wants: **Availability** (the
  write form) for S&C and nutritionist, **Subject access request** for everyone but the
  admin.
- **Three panels are present-but-disabled instead of absent or read-only:** Body weight for
  the coach (three disabled buttons — and now decided away entirely: the coach does not see
  the section, Q27 / C9); Entries and corrections for S&C and nutritionist (five disabled
  "Correct check-in" buttons with a `title`); the header "Edit" for S&C and nutritionist.
  These are the rows where "a panel a role cannot see is absent — no heading, lock or
  count" has to decide between *absent* (Body weight for the coach, decided) and *read-only
  with an owner line* (corrections for S&C/nutritionist are read-only *data* — the entries
  themselves are theirs to see; the write is not).
- **Two labels say "Edit" to roles that cannot:** the Goals panel's "Edit ›" and the
  Nutrition plan's "Edit" carry the same label for all five roles and lead to pages that
  refuse or read-only for the coach, medic, S&C (`PROGRAMME_EDIT`, `NUTRITION_EDIT`). The
  programme page itself already varies its link ("View full detail →" vs "Edit this
  programme →"); the profile panel does not. Filed on §0av.
- **The Injury panel is one panel with two bodies**, not two panels: the medic's carries the
  clinical record and two controls; every other role's carries the four censored facts.
  C1 / B1's status header can therefore be the same for all five roles (status · restriction
  line · expected return are readable by all five); only the medic's header may name a
  diagnosis, and by the 0063 boundary it should not — the diagnosis belongs in the panel.
- **Panel order today is the same for every role** (Athleticism → S&C history log → Injury →
  Availability → Flags → Goals → Nutrition plan → Body weight → Entries and corrections →
  SAR). C4's "ordered by role from one library" has no per-role order to preserve; it
  starts from this one list minus the absent rows.
- **Counts for C3 / B2 (the jump bar's "panel 1 of N"):** sport scientist 10, coach 9 (8
  once Body weight goes), medic 9, S&C 8, nutritionist 8 — on an injured athlete; the same
  on an uninjured one.

## Role-gate notes, checked against the code

- Body weight for the coach: **decided 2026-09-12 (Q27) — hidden, section and buttons**;
  measured today as present-with-disabled-buttons, so C9 is the change.
- The nutritionist reading the censored Injury panel is **a recorded decision** (migration
  0074, 2026-09-06, reversing D-01), not an exposure: `injury_clinical` stays medic-only at
  the database and no clinical word appears on any non-medic render (checked by regex on
  every panel, both athletes).
- The S&C's disabled corrections match `ENTRY_CORRECTION` (sport scientist, coach, medic);
  the nutritionist's Flags controls match `NUTRITIONIST_FLAG_DOMAIN`; the header "Edit"
  matches `ATHLETE_BIO_EDIT`. Nothing rendered for a role that its constant does not name.
