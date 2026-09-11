# Persona review — STAFF-SS-26 to -33

**Persona.** The sport scientist as the club's Fydr admin: publishing a board,
reading the analytics, checking the injury list before a session, and the
administrative half of the job — settings, the audit log, an export, a printout.

**Reviewed 2026-09-11** at **1280×800 and 375×812** as Jane Pemberton,
read-only — no board created or unpublished, no export generated, no import,
threshold, retention run or SAR touched. §0af's stacked sidebar applies to every
phone number below.

---

## STAFF-SS-26 — Publish and manage leaderboards

**Measured.** `/manage`: one board card ("Total session load · Whole squad ·
all time · Published"), "+ New leaderboard", a link back to "the testing wall".
**Fits one desktop screen** (800px); 1,223 at phone. `/new`: six numbered
steps, every choice a chip with `aria-pressed` — eleven eligible metrics, four
ineligible rendered `disabled` under "Tap one below to see why"; Total / Mean /
Best in window; Whole squad / One group; Last 28 days / This season / All
time; Staff only / Published to athletes; Name; Save. The board: "Download
CSV", "Print PDF" (a PDF route), "Board actions" — Unpublish, Delete board —
and the ranking, "n = 27 athletes".

**The tap that cannot land.** The ineligible row invites a tap to see the
reason and the buttons are `disabled`, so no click ever fires and the reason
never appears — at either width (§0ap). The form's other five steps are the
clearest form in the staff app: one question per step, one row of chips each,
and the pressed state carried on every chip.

**The gate claims were wrong** — the board page is open to every staff role;
corrected in the document.

## STAFF-SS-27 — Analytics

**Measured.** Four fixed boards — Training load, Wellness, Gym volume,
Acute:chronic ratio — each a Metric and a Window `<select>` (30px tall at
phone), one athlete against the population, "Compare two". 903px at desktop,
**2,323 at phone**. `/analytics/build` exists with no link to it, by the page's
own decision.

**For the persona this is the analytics screen she would build herself** —
one athlete against the squad, four questions, no builder to learn. Nothing to
raise beyond the selects in the sweep.

## STAFF-SS-28 — Injuries

**Measured.** "Print", "Team allocation →", "Rehab groups →" (19px `.tiny`
links), six injury rows. **Fits one desktop screen**; 1,493 at phone. No
"+ Injury", no "PROBLEM REPORTS" — the document's coach column holds for the
sport scientist too. **Nothing to raise**; the document was already right.

## STAFF-SS-29 — Settings hub

**Measured.** Eight sections — Plan, Integrations, Profile, Photo, Edit
profile, Club details, Password and sign-in, Two-factor authentication — with
the Light/Dark segment above and the settings list below — **3,772px at desktop,
5,089 at phone**, the list at the bottom of both. The document had six
in a different order; corrected. The plan switch is a preview cookie, as its
own copy says.

**The Log out row.** A `.set-list-row` like every other row on the list —
same layout, same pointer cursor across 742×71px — and the only thing that
submits is the "›", **4.8px wide** (§0ap). Clicking the words does nothing.
Both widths; not a 44px matter.

**"Your role requires two-factor authentication" — Status: Not enrolled**, and
Jane is signed in. This is the recorded boundary (prompted, not enforced,
pending the RLS `aal` follow-up) and not a new finding; noted so it is not
re-raised.

## STAFF-SS-30 — Settings sub-screens

**Measured at both widths**, inventories in the document. Three gate claims
corrected from the `require*` calls (exports is `REPORT_ACCESS`; the
subject-access list admits the medic as well as the admin; the groups list is
open to all staff). **Horizontal scroll at 375** on Subject access (433px) and
Data retention (491px): a `table.tbl` with no overflow container (§0ap — and
the board in SS-26 by 8px). Retention's "Preview" was not pressed.

## STAFF-SS-31 — Filter the audit log

**Measured.** Twelve type chips plus "All" — the distinct entity types in the
log, not a fixed list — From/To dates (last 30 days), Staff member, Athlete,
Search, "Apply filters", "Show all time", "Clear filters", "Next →". **6,287px
at phone.** No quick-range chips (the document had them here; they are on
Exports). **No session or schedule type** — nothing to filter on because
nothing is written (§0al); a consequence, not a second defect.

## STAFF-SS-32 — Generate an export

**Measured.** Six domain checkboxes all on, the group filter as "who" ("Whole
squad · 30 athletes in scope"), From/To with Last 7 / 30 / 90 days, "Generate".
1,281 at desktop, 2,293 at phone. **The intro says "Coach access" to the
sport scientist** (§0ap, low). "Generate" was not pressed.

## STAFF-SS-33 — Print a screen

**From source, not exercised.** `PrintButton` → `window.print()` on the
dashboard, `/injuries`, `/reports/testing` and the testing detail; the print
block hides the sidebar, buttons, `.btn-*` links and every `<form>`. The
board's "Print PDF" is a different thing (a PDF route). Nothing to raise.

---

## Summary for design

1. **The ineligible-metric reason is unreachable** — the tap the copy asks for
   cannot fire on a disabled button. *(Defect, §0ap; the choice between a
   reachable tap and an inline reason is SS-26's brief.)*
2. **Log out on the hub is a 5px target dressed as a row.** *(Defect, §0ap;
   both widths.)*
3. **Two settings tables and the board ranking scroll the page sideways at
   375.** *(Defect, §0ap; phone only.)*
4. **"Coach access" for a sport scientist.** *(Defect, §0ap, low.)*
5. **Sub-44 controls** — breadcrumb links 13px, `.tiny` links 19px, "the
   template" 15px, selects 30px, Light/Dark 36px, plan switch 30px,
   integration state buttons 41px, "Open team allocation →" 37px, reorder
   arrows 22px — added to the STAFF-SHELL sweep table.
6. **Long pages** — audit 6,287 and the hub 5,089 at phone (2,564 and 3,772 at
   desktop), retention 4,210, analytics 2,323, exports 2,293. *(Design;
   STAFF-SHELL for the phone part; SS-29 and SS-31 for the rest.)*
7. Deliberate boundaries, left alone: MFA prompted not enforced (O-323); the
   analytics builder with no entry point; the audit type row derived from the
   log; no "+ Injury" for this role.
8. Right and worth keeping: the six-step builder with one row of pressed chips
   per question; the four fixed analytics boards; the manage page stating the
   three publishing rules; exports reading the scope back in the heading.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| 26: `/leaderboards/{id}` "checks both `LEADERBOARD_EDIT` and `CLINICAL_ONLY`, refuses otherwise" | **Wrong** — `requireStaff()` only; the constants shape the content. Corrected. |
| 26: gate `LEADERBOARD_EDIT` on manage and new | **New only** (redirects to manage); manage is open. Corrected. |
| 26: control inventory "not extracted" | **Extracted**, both widths; in the document. |
| 26: "Tap one below to see why" | **Dead** — `disabled` buttons never click. §0ap. |
| 27: `/analytics/build` "is the builder" | **Exists, unlinked**, by the page's own decision. Corrected. |
| 27: other roles refused | **Redirect `/dashboard?e=no-analytics`** from source; not testable as SS. |
| 28: coach column applies to the sport scientist | **Correct** — measured. |
| 29: six sections in the stated order | **Eight**, different order; "Edit profile" and "Two-factor authentication" were missing. Corrected. |
| 29: Integrations "Connected / Locked / Open" | **Connected and Open** seen; Locked not observable on the Premium preview. |
| 29: Logo "Upload / Replace / Remove" | **Upload** only with no logo set; conditional, kept. |
| 30b: Exports gate "—" | **`REPORT_ACCESS`** via `requireReportAccess()`. Corrected. |
| 30c: `GROUP_EDIT` (+`SESSION_EDIT`) on the list | **List is open**; `/new` redirects; the constants show controls. Corrected. |
| 30g: list `SETTINGS_ADMIN`, review `CLINICAL_ONLY` | **List admits admin or medic**; review medic alone. Corrected. |
| 30h: `THRESHOLD_EDIT` | **Correct**, refused in page rather than by redirect. Noted. |
| 31: "quick-range chips" | **None on the audit log**; date inputs instead. Corrected. |
| 31: "← Previous / Next →" | **Next only on page 1.** Noted. |
| 31: one chip per action type | **Per entity type present in the log**, derived. Corrected. |
| 32: "choose a quick range chip, press Generate" | **Correct but incomplete** — six domain checkboxes and the group filter come first. Corrected. |
| 32: intro copy | **"Coach access"** for the sport scientist. §0ap. |
| 33: Print on "the dashboard, the testing screens and other report surfaces" | **Dashboard, `/injuries`, `/reports/testing`, testing detail** — from source. Corrected. |
| 33: `@media print` stylesheet exists | **Correct**; what it hides recorded. |
