# Persona review — STAFF-COACH-29, -30c, -30h and -33

**Persona.** The head coach in Settings for the three things that are theirs — thresholds,
groups, notifications — and their own account.

**Account.** Mark Iremonger (coach only), port 9502; Jane Pemberton for the identity check.
**Reviewed 2026-09-12** at **1280×900 and 375×812**, read-only.

---

## STAFF-COACH-29 — Settings hub

**Differs, and more than "own profile, photo, password only".** The coach's hub has seven
sections — Plan, Integrations, Profile, Photo, Edit profile, Password and sign-in,
Two-factor authentication — and no Club details; 85 leaves to the sport scientist's 119;
2,804px to 3,772 (3,614 at phone). Measured differences:

- **Plan** renders for the coach without the Basic/Premium preview switch — the plan
  sentence and the feature lists, read-only. Fine.
- **Integrations** renders with its two state buttons, "Connected" and "Open", both linking
  to `/settings/imports` — **which bounces the coach straight back to `/settings`**
  (`GPS_IMPORT` is sport scientist alone; the redirect is silent, §0av). Two links on the
  coach's own hub that go nowhere. *(Defect, §0av.)*
- **The settings list** for the coach: Thresholds, Password and two-factor, Exports, Groups,
  Notifications, Log out — six rows; GPS imports, Users, Subject access, Data retention and
  Audit log are absent, correctly.
- **Two-factor**: "Your role requires two-factor authentication…" — prompted, not enforced
  (O-323), as for every role.
- **Log out** is the same 5px "›" submit (§0ap, open) — the coach's only way out from
  Settings on desktop besides the sidebar.

At 375: "Connected" / "Open" (`.set-row-btn`) at 41px — the shell's floor missed the
class; sweep table.

## STAFF-COACH-30c — Groups

**Identical, verified** — list (31 leaves, 12 controls, "+ New group", the reorder arrows),
`/settings/groups/new` (14 leaves, 21 controls) and a group's page (70 leaves, 20
controls). The coach holds `GROUP_EDIT` and `SESSION_EDIT`, so nothing is withheld. At
375, "Open team allocation →" (`a.btn-ghost`) measures **37px** — the generic floor rule
did not reach this anchor; sweep table.

## STAFF-COACH-30h — Thresholds

**Identical, verified** — the list (42 leaves, 13 controls: "+ New threshold", Deactivate /
Retire per rule) and `/settings/thresholds/new` (36 leaves, 21 controls). `THRESHOLD_EDIT`
is the coach's. At 375 the three "baseline" inline links on the new-threshold form are
13px (`.tiny a` on a line the floor rule did not reach); sweep table.

## STAFF-COACH-33 — Print a screen

**Identical** — `PrintButton` renders on the coach's `/dashboard`, `/injuries` and
`/reports/testing` exactly as on the sport scientist's (the injuries board fingerprint
matched, 15 controls including "Print"). Not pressed.

## Also measured, not in the document's coach list

`/settings/notifications` **differs** — the coach's catalogue is longer (41 leaves, 14
controls vs 31 / 9): `catalogueForRoles` gives the coach rows the sport scientist does not
carry. Not a finding; noted so the "identical" table is not read as complete.
`/settings/exports` is identical (`REPORT_ACCESS`).

---

## Summary for design

1. **Two dead links on the coach's hub** (Integrations → `/settings/imports` → back to
   `/settings`). *(Defect, §0av.)*
2. **The coach's hub is still a 2,804px page** for a role with six list rows and three
   sections that are theirs. *(Design; the SS-29 brief, with a coach note.)*
3. Sub-44 at 375: `.set-row-btn` 41, "Open team allocation →" 37, the "baseline" links 13
   — sweep table.
4. Right and worth keeping: the admin rows absent rather than locked; the plan section
   readable without the switch.
5. Boundaries: no Club details, no plan switch, no admin rows; 2FA prompted not enforced.

## Claims checked

| Claim | Verdict |
|---|---|
| 29: "own profile, photo, password only" | **Also** Plan (read-only), Integrations (two links that bounce), Edit profile, 2FA, and six list rows. Corrected. |
| 30c, 30h identical | **Identical** by fingerprint, both widths. |
| 33 Print | **Identical.** |
