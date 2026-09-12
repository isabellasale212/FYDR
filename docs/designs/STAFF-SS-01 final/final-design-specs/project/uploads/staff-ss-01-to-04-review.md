# Persona review — STAFF-SS-01 to -04

**Persona.** An experienced sport scientist at a semi-pro rugby club who is also
the club's Fydr admin — at a desk on Monday morning, and on a phone at the side
of the pitch on Thursday.

**Reviewed 2026-09-11** at **1280×800 and 375×812**, signed in as **Jane
Pemberton** (`j.pemberton@ashcomberfc.example`, Ashcombe's only sport scientist)
via a magic link — no password typed. Conor Moroney's scratch state untouched.

**What was and was not exercised.** SS-01 and SS-02 measured in full; a group
filter was applied and cleared (a cookie, restored). SS-03 and SS-04 measured
without submitting — both create real records, SS-04 a real auth user. The
invite disclosure was opened and closed.

---

## The finding that frames every staff screen on a phone

**Below 768px the sidebar is not a rail — it stacks full-width above the
content, 640px tall.** Measured at 375: the Dashboard heading at y=728, its
first content section at **y=2209**, page 3,426px. Squad overview's heading at
y=737. A sport scientist pitch-side opens any screen on nine navigation rows
and "Log out" before a word of content. `base.css` records the stacking as
intended; the 64px rail that exists between 768 and 1023 simply does not carry
below. **§0af** — one design decision for the shell, not per flow. Every
phone-width number below should be read with that block above it.

---

## STAFF-SS-01 — Read the dashboard

**Measured.** "Dashboard" / "Today" / **"Ready for Saturday"** (a matchday is
in range — v Colthorne RFC) / "Outstanding entries". Sidebar 236px at desktop,
nine rows as documented. "✓ Whole squad" chip. Three collapsed summary cards
with `aria-expanded="false"` — "72 open flags · 5 high priority", "Wellness in
0% · 0 of 30 today", "Available 20 / 27 · 4 modified, 3 …" — which are what the
document calls the "Expand/Collapse toggles". A six-day strip Mon 7 → Sat 12
with MD-n labels and session names. "Compliance ›".

**The persona's first question is answered at the top:** who is out, who is
doubtful, when is the match. "Doubtful — Adam Selby (Injury) · return …",
"Ruled out — Alex Grant (Academic); …". That is the right first screen for the
role.

**The document's control list is right in substance and wrong in form** — it
names "Expand"/"Collapse" toggles; the controls are the summary cards
themselves, with the stat as the button's text. Recorded.

**"Wellness in 0% · 0 of 30 today"** is a seed-timing artefact (reviewed at
night; the seed's morning entries are dated August, §0f), not a finding.

## STAFF-SS-02 — Browse the squad and filter by group

**Measured and exercised.** "Squad overview", **"30 athletes in the squad"**,
"Add athlete" (`.btn-primary`, 50px) → `/squad/new`, "Manage groups"
(`.btn-ghost`, 44px), five chips at 44px (Whole squad, Backs, Forwards, Rehab,
Academy), 30 athlete links. Selecting Forwards: "15 athletes in the selected
groups", 15 links, "Clear filter" appears, cookie `fydr-group-filter` set.
Cleared: back to 30, chip "✓ Whole squad".

**Athlete-name links are 15px at desktop, 34px at phone.** The one control on
this screen a coach taps most, thirty times over, under the floor at the width
they tap it. **§0af.**

**The document listed "Clear filter" unconditionally**; it appears only while a
group is selected. Corrected.

## STAFF-SS-03 — Add an athlete

**Measured, not submitted.** All six fields exactly as documented — ids, types,
labels — with `method="post"`, "Save" (46px) and "Cancel" (44px, a button).
Field heights 44–46. One undocumented hint under the email field, and it is
good: *"Leave blank to add them to the roster with no app access. You can
invite them later from their profile."* Now recorded.

**One documented branch is unreachable from this form.** The document says an
empty date of birth makes the athlete a minor and "this is not warned about on
this form". The field is `required` and the form is not `noValidate` — the
browser refuses the submit. The rule itself is real (`athlete_is_minor()` is
TRUE for a null, failing safe) and matters for athletes created by other
paths; it cannot happen here. **Corrected**, and a good outcome: the form is
safer than the document said.

## STAFF-SS-04 — Invite a person and hand over their link

**Measured, not submitted.** `/settings/users`: "Users", "37 users · 9 staff ·
29 athlete accounts · 1 athlete record with no account", "Bulk invite athletes
→", one row per user with six inline role toggles and "Deactivate". **The invite
form is behind "+ Invite people"** — a button with no `aria-expanded` — and was
not visible on load; the document goes straight to "fill the invite form".
Opened: the intro as documented, "Full name" and "Email" (both required), and
**"Roles" — six `aria-pressed` toggles at 44px** under "Roles are additive —
tick everything that applies." The route refuses zero roles ("Tick at least one
role."). Submit is "Create account". All corrected into the document.

**The page is 6,015px at desktop and 14,301px at phone** — 37 users × six role
buttons. Admin surfaces are allowed to be long; this one has no search, no
filter and no grouping, and at phone width the row an admin wants is a
scroll-hunt through 17 screens. Design finding.

### The role-gate finding — reported to Isabella directly, §0ae

Jane is Ashcombe's only sport scientist. On her own row, **"Deactivate" is
disabled; the "Sport scientist" toggle is not.** The guard that stops the last
admin removing their own role lives in `setUserRoles`, which runs **in the
browser**. At the database, `user_roles_admin_delete` lets any sport scientist
delete any role row in the org, including their own, and no trigger checks the
count. A club can lock itself out with one console call, and nobody in the app
can grant the role back. Filed at security priority with the trigger that
fixes it.

---

## Summary for design

1. **The staff shell on a phone** — the sidebar stacks 640px above every
   screen. *(§0af — one decision for the shell.)*
2. **`/settings/users` at 37 users** has no search or filter and runs 17
   phone screens. *(SS-04 — design.)*
3. **Athlete-name links 15/34px**; **"Log out" 17px**; **"+ Invite people"
   without `aria-expanded`**; **"tick" copy on toggle buttons**. *(§0af —
   defects.)*
4. **The last-admin guard is client-only.** *(§0ae — security, to Isabella.)*
5. Right and worth keeping: the dashboard's first screen answering the
   selection question; the count line changing with the filter; the email-field
   hint on Add athlete; "Roles are additive"; and `required` on date of birth,
   which is safer than the document knew.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Nine-row sidebar, plan link, "Log out" on every screen | **Sidebar and Log out correct**; plan link **not found** on any of the four screens |
| Group filter: "Whole squad" ✓, one chip per group, "Clear filter"; a cookie | **Correct**, except "Clear filter" is conditional. Corrected. |
| SS-01: "Ready for {matchday}" when in range | **Correct** — "Ready for Saturday" |
| SS-01: "Expand"/"Collapse" toggles | **Wrong form** — the summary cards are the toggles. Recorded. |
| SS-01: empty-state copy | **Not observed** — data present |
| SS-02: count line, both variants | **Correct**, both measured |
| SS-02: buttons, chips, per-athlete links | **Correct**; sizes recorded |
| SS-03: six fields, ids, types, labels | **Correct** |
| **SS-03: empty dob → minor, not warned on this form** | **Unreachable — dob is `required`.** Corrected. |
| SS-03: "Saving…", confirmation screen, "Back to the squad" | **Not verified** — not submitted |
| **SS-04: "`/settings/users` → the invite form"** | **Incomplete** — behind "+ Invite people". Corrected. |
| SS-04: intro copy | **Correct**, verbatim |
| SS-04: fields | **Now recorded** — Full name, Email, six role toggles, at least one required |
| SS-04: both end-state variants and the caption | **Copy present in `UserManagementPanel`**; not observed (not submitted) |
| SS-04: reserved-domain refusal | **Correct** in source (`unsendableReason`, §07 earlier); not exercised |
