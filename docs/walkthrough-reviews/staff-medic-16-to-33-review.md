# Persona review — STAFF-MEDIC-16/17/18/20/21/22, -25, -29 and -33

**Persona.** The club physio reading the reports, the wall, and their own settings.

**Account.** Ruth Callaghan (medic only), port 9503; the sport scientist's fingerprints for
the comparison. **Reviewed 2026-09-12** at **1280×900 and 375×812**, read-only.

---

## STAFF-MEDIC-16/17/18/20/21/22 — Reports and exports

**Identical, verified** on all seven report routes at both widths — hub 33/33, squad
181/181, athlete list 239/239, compliance 31/31, testing 271/271, training 296/296; the
athlete report 130 vs 197 leaves is the browser's period (month vs season), the controls
match. Exports and PDFs carry no clinical content for the medic (the 01–05 review's table).
At 375 the same four reports scroll sideways for the medic as for the coach (§0ax).

## STAFF-MEDIC-25 — Explore the leaderboard wall

**Identical, verified** (520 leaves, 51 controls, 3,840 / 6,109px). The board page adds
"Suppress an athlete" for the medic — the medical suppression that 0016 keeps
indistinguishable from a self opt-out — and withholds Board actions (`LEADERBOARD_EDIT`).

## STAFF-MEDIC-29 — Settings hub

**Not "own profile only".** Seven sections (no Club details, no plan switch) and seven list
rows: **Thresholds, Password and two-factor, Exports, Groups, Notifications, Subject access
requests, Log out**; 88 leaves to the sport scientist's 119, 2,875px / 3,685 at phone. Two
rows and two links lead the medic to a refusal or a bounce: **"Thresholds"** opens the
in-page "Not part of this role" page; the Integrations **"Connected" / "Open"** links go to
`/settings/imports` and come straight back (the coach's §0av finding, now the medic's
too). "Subject access requests" is rightly the medic's (`requireSubjectAccess`). The
two-factor banner is prompted, not enforced (O-323). Document corrected; §0av widened.

`/settings/notifications` differs — the medic's catalogue (35 leaves, 12 controls) carries
rows the sport scientist's does not, including one "Push off"; `catalogueForRoles`, not a
finding.

## STAFF-MEDIC-33 — Print a screen

**Identical** — `PrintButton` on the dashboard, `/injuries` and `/reports/testing`; the
medic's injury board prints with the "Problem reports" section on the page, so the printout
carries athletes' own words: correct for the role that can read them, and worth the
"MEDICAL IN CONFIDENCE" banner the PDF route already puts on the medic's injuries PDF —
the print stylesheet has no such banner. *(Design note for SS-33; not filed.)*

---

## Summary for design

1. **Two dead rows / links on the medic's hub** — Thresholds (refusal page), Integrations
   (bounce). *(Defect, §0av — one rule: absent rows for absent permissions.)*
2. **A printed injury board from the medic carries problem reports with no confidentiality
   marking**, where the PDF has one. *(Design note; the SS-33 brief.)*
3. **Nothing medic-specific in the reports or the wall**; the SS briefs are the design
   surface.
4. Right and worth keeping: the medical suppression on the board page; the medic's SAR row.

## Claims checked

| Claim | Verdict |
|---|---|
| 16–22, 25, 33 identical | **Identical** by fingerprint. |
| 29 "own profile only" | **Seven sections, seven rows**, two of which go nowhere. Corrected. |
