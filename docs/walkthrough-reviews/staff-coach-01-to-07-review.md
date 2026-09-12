# Persona review — STAFF-COACH-01, -02, -05 (with -05a) and -07

**Persona.** A head coach at a semi-pro rugby club. Not the admin; sets nothing
up; opens Fydr before a session, after it, and pitch-side on a phone.

**Account.** Mark Iremonger, `m.iremonger@ashcomberfc.example` — a plain coach
(one role) on scratch, signed in by magic link in its own Chrome profile (CDP
port 9502). Jane Pemberton (sport scientist, port 9500) rendered the same
routes for the identity check.

**Reviewed 2026-09-12** at **1280×900 and 375×812**. Read-only: nothing
created, edited or published. **First real use of the phone shell built this
morning (`af09c17`)** — the bottom bar and More sheet are measured here on
every screen.

**Method for "identical".** The four routes were fingerprinted for both
accounts at both widths — `<h1>`, every `<h2>`, the eyebrow, every visible
control (tag, text, href, disabled), the count and text of every leaf node,
page height — and diffed. "Identical" below means the diff was empty apart
from what is named.

---

## STAFF-COACH-01 — Read the dashboard

**Identical, verified.** 122 leaves, 25 controls, 1,602px at desktop and
3,005px at phone, for both accounts; no control differs. The coach reads the
same dashboard as the sport scientist because the dashboard reads nothing the
coach cannot: every threshold, flag and compliance figure on it is within
`THRESHOLD_EDIT` / `FLAG_EDIT_ANY_DOMAIN` / `REPORT_ACCESS`.

**Phone shell, first use.** Sidebar `display: none`; title bar 64px
"Dashboard · Whole squad"; bar Dashboard / Squad / Schedule / **Flags** / More
at 58px, Dashboard `aria-current`; More sheet Reports, Nutrition, Gym
programme, Leaderboard, Settings, Log out at 52px — **Analytics absent for the
coach, correctly**, and that is the only row the two accounts' sheets differ
by. The dashboard heading sits at 152px and the first card at 470px.

**Remaining sub-44 on this screen at 375:** "Compliance ›" (`.tiny`) 19px — the
generic floor did not reach it (§0au).

## STAFF-COACH-02 — Browse the squad and filter by group

**Identical minus one control.** "Add athlete" (`/squad/new`) is absent for
the coach — `SETTINGS_ADMIN` — and `/squad/new` typed directly lands on
`/squad` with no message. Otherwise 167 vs 168 leaves, the same 38 controls,
the same heights (1,793 / 2,431 vs 2,437 at phone). The group filter, the
roster and the athlete links are the sport scientist's.

**Phone.** The athlete-name links measure **43px** (19px text + 12px padding
each side, pulled back by a −12px margin; `elementFromPoint` hits across the
full 43) — the shell's floor missed by one pixel on the one control a coach
taps most. The page still scrolls sideways at 375 (§0ap, roster table) — the
coach's pitch-side screen is one of the three.

## STAFF-COACH-05 / -05a — Open an athlete's profile (James Barnes, injured)

**Identical minus one section and three controls.** The "Subject access
request" section (`SETTINGS_ADMIN` / medic) and its "Generate subject access
pack →" are absent — correctly. The **Body weight** section is present with
its values, and its three controls — "+ Log weigh-in", "Set target range",
"Edit entries" — are rendered `disabled` with `aria-disabled` and a `title`
naming who may: "Logging a weigh-in belongs to the sport scientist, the medic,
the S&C and the nutritionist." / "Setting a body-mass target range belongs to
the sport scientist and the nutritionist." / "Editing a weigh-in belongs to
…". Page 2,944px vs 3,117 at desktop.

**05a holds.** The Injury section reads "Rehab · Right shoulder · No contact ·
No scrummaging · Running 80% volume · Gym lower modified · Expected return
Tue 15 Sept" — status, restrictions, return; the words "diagnosis" and
"mechanism" appear nowhere on the page. `/injuries/{id}` for the same injury
opens with an `i` banner: "This is what coaching staff see. Diagnosis,
clinical notes and treatment plan are medical only and are not shown here, by
design." **That banner is the right pattern** — the boundary stated where it
applies, not a blank.

**The three disabled buttons carry their reason where a phone cannot read
it.** A `disabled` button receives no hover, focus or tap, so the `title` is
unreachable on touch; the coach sees three greyed controls and no reason. Same
class as §0ap's leaderboard chips (§0av).

**"+ Log injury" is present for the coach** (37px at phone) — and it should
be: §3.2 gives "New injury" to all four non-nutritionist roles and 0068's
`injuries_staff_insert` matches. But the `/injuries` board hides "+ Injury"
from the same coach (SS-28). Two doors, one shown and one hidden, for one
permission (§0av, design).

## STAFF-COACH-07 — Read the week's schedule

**Identical, verified.** 126 leaves, 32 controls, 2,617 / 3,224px, no
difference at either width. The coach holds `SESSION_EDIT`, so Edit mode, the
toolbar, publish and discard are all theirs — the flows SS-08 to -15 inherit
here without change.

**Phone.** The controls the shell's floor did not reach: the five group chips
at **39px** (`<button>`s here, not `.rhead-chip`), the Read / Edit segment at
**31px**, the "Week plan" `<span>` and "Today" link at 40px, the week arrows
`‹` `›` at **32×32**. On the one screen a coach uses pitch-side in Edit mode,
the mode switch is the smallest control on it (§0au).

---

## What the coach cannot reach — measured, not inferred

| Route | Lands on | What the coach sees |
|---|---|---|
| `/analytics` | `/dashboard?e=no-analytics` | the dashboard; no message rendered for the `e` |
| `/analytics/build` | **opens** | an in-page refusal: "Not part of this role — Analytics is named-athlete performance data. Admin manages the club and does not read athlete performance data — see 01-roles-and-permissions.md (superseded) §1." No data, no selects. **The copy is about the admin and cites a superseded internal document; the reader is a coach** (§0av). |
| `/settings/audit`, `/retention`, `/users`, `/users/bulk-invite`, `/imports` | `/settings` | the hub, **no message** — the bounce is silent (§0av) |
| `/settings/subject-access` | `/settings?e=no-sar-access` | the hub; the `e` is the only one of the six that is carried |
| `/squad/new` | `/squad` | the roster, silently |
| `/programmes/new` | `/programmes` | the programme list; "View full detail →" as documented |
| `/platform/sign-in-probes` | `/dashboard` | silently |
| `/injuries`, `/injuries/{id}`, `/injuries/new`, `/team-allocation`, `/rehab-groups`, `/reports/injuries` | **open** | clinical content withheld with an explanatory banner on the detail; rehab groups read-only with its own note |
| `/settings/groups`, `/thresholds`, `/exports`, `/notifications`, `/programmes/exercises` | open | as their gates say |

---

## Summary for design

1. **The 44px floor on the built shell misses a set of control classes** on
   these four screens — group chips 39, Read/Edit 31, week arrows 32, `.tiny`
   links 19, "Acknowledge" 29, roster names 43, "Edit" 33. *(Defect, §0au;
   phone only; shell follow-up, one list.)*
2. **Disabled controls whose only reason is a `title`** — the Body weight
   trio on the profile. *(Defect, §0av.)*
3. **A refusal page addressed to the wrong role** — `/analytics/build`.
   *(Defect, §0av, copy.)*
4. **Silent bounces** from five settings-admin routes to a bare `/settings`
   while the sixth carries `?e=`. *(Design, §0av.)*
5. **One permission, two doors** — "+ Log injury" shown on the profile,
   "+ Injury" hidden on the board, for the same coach. *(Design, §0av.)*
6. **Right and worth keeping:** the injury detail's "This is what coaching
   staff see" banner; the More sheet dropping Analytics rather than greying it;
   the clinical boundary holding at the database (0063) with the page saying
   so.
7. **Deliberate boundaries, left alone:** no Add athlete, no SAR section, no
   Analytics, weigh-ins not the coach's (`WEIGH_IN_EDIT`); the two-factor
   banner on Settings is prompted, not enforced (O-323).

## Claims checked

| Claim | Verdict |
|---|---|
| 01, 02, 05, 07 "identical to the sport scientist" | **Identical** by fingerprint at both widths, minus: Add athlete (02); the SAR section and three role-disabled controls (05). |
| Sidebar "eight rows — everything except Analytics" | **Correct**, and the More sheet matches. |
| 05a: no diagnosis or mechanism for the coach | **Correct** — measured on an injured athlete; the detail page states the boundary. |
| "Cannot reach: `/analytics/build`" | **Reaches a refusal page**, not a redirect; corrected. |
| "`/injuries` and `/reports/injuries` open" | **Correct**, all five injury routes and the report. |
| "`/squad/new` — SETTINGS_ADMIN" | **Correct**, silent redirect. |
