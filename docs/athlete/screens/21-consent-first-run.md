# 21. Consent and first run

**PATTERN-S9, built 13–14 September 2026** against
`docs/designs/PATTERN-S9-final/` (the notes beat the prompt; the Step 1
answers and the builder's own answer to the declined state are in
`docs/overnight-records-2026-09-13.md`). Six artboards, two named rows.
**Every LEGAL- placeholder is undrafted and drawn as the placeholder pattern;
the flow ships built and gated, not complete, until a solicitor replaces them.**

## 1. Where it sits

`/consent/staff` (artboard 2), `/consent/decide` (3A), `/consent/declined`
(3B, and where a withdrawal lands), `/consent/guardian` (4A), and the public
`/guardian/[token]` (4B, a web page with no account). The tab bar is absent on
`/consent/*`: the first run is a sequence ("Step 2 of 3", "Step 3 of 3") and
every tab would only send an undecided athlete back into it.

The invite arrival (artboard 1) is `18-password-reset.md`'s "The invite
arrival"; the first check-in (artboard 5) is `02-morning-check-in.md`'s
first-run card; install teaching (artboard 6) is `14-notification-settings.md`.

## 2. Who reaches it and when

**The gate** (`requireAthlete`, migration 0120): an athlete with no decision
recorded — `consent_given_at`, `consent_declined_at` and `consent_withdrawn_at`
all null — is sent to `/consent/staff` from every athlete page except the
flow's own. A minor is sent there until the guardian link has been sent once;
after that the app opens with the entry forms locked (4A: "not locked out of
the app, only out of the entry forms"). Declined and withdrawn open the app
the same way. The five states are `lib/consentState.ts`'s: `in_data`,
`undecided`, `guardian_pending`, `declined`, `withdrawn`; the database computes
`in_data` (the performance decision given, not declined, not withdrawn) and
every denominator reads it.

## 3. What you see

**Artboard 2, `/consent/staff` — Who sees what you enter.** Eyebrow "Step 2 of
3 · nothing decided yet". "N people at the club have a staff account. What each
one sees is set by their role in the club, not by who they get on with." One
card per role present at the club, naming the people who hold it (the club's
own active accounts, read for the athlete's own club), each with **Sees** and
**Does not see**; the coach card leads with the boundary. Then **You**, the
fifth role. Then the one emphasised card, "Two things that are already true":
submitted check-ins and ratings are immutable (ADR-005 — no UPDATE policy; a
correction is a new revision row) and a day not answered stays empty and is
counted over how many were asked. "N of N roles listed". "Read the choice"
(56px) → 3A, or → 4A for a minor.

**Every line is a boundary enforced in the product today** (`lib/staffVisibility.ts`
records what each rests on). **One claim on the board is not true today and is
not made:** the coach card's "no body site and no side". A coach sees the body
area and side of an open injury on the injuries list, the availability line and
the injury report (`INJURY_ACCESS` admits the coach to the limited view, which
carries them). The card says the coach sees "the body area of an open injury";
Isabella's decision (13 September 2026) makes site and side a club setting
defaulting to off, built with the injury cluster (PATTERN-S3), after which the
card takes the board's wording. Reported as drift.

**Artboard 3A, `/consent/decide` — Two kinds of data.** Eyebrow "Step 3 of 3 ·
your choice". Two blocks, each a card: **Block 1 · Performance data** (What ·
Who · Why; `LEGAL-3A`) and **Block 2 · Health and injury data** (What · Who;
`LEGAL-3B`). Then, in the flow after the blocks (not a sticky footer, which
would cover the blocks it is about on a phone): "**Saying no does not affect
selection.**" with the caption that makes it honest — "Your club states this.
Fydr records your choice and cannot enforce what a coach does with it." —
`LEGAL-3C`, the two equal actions **"I agree to both blocks"** then **"I do not
agree"** (both `--tap-commit` 56px, full width, `--surf` with the 1px accent
line and the accent label, in that source order, **zero haloed primaries**),
"You can change this whenever you like, in Settings › Your data. Version
{stored version}, recorded with the date and time you choose." and `LEGAL-3D`.
One tap answers both blocks tonight; the columns are separate so a separate
health answer can land without a migration. The stored version is
`placeholder:LEGAL-3A+3B:2026-09-13` until LEGAL-3D is drafted. A minor never
sees this screen.

**Artboard 3B, `/consent/declined` — You said no.** A state of the screen, not
a toast. Eyebrow "Your data · recorded {date and time}". "Your account stays.
You are still in the squad, and the club can still tell you where to be." Three
cards: **What the club sees** (your name on the squad list with "no data
consent" and the date; no entries, no readiness — cells read an em dash, never
a zero; squad figures count you out of the denominator, 24 of 30 → 24 of 29,
and the caption says one athlete is excluded), **What you see** (no check-in,
no rating; schedule, programme, messages and profile as normal), **Nothing you
entered before today is kept** (`LEGAL-3E`; "You had no entries, so there is
nothing to delete. If you had, this card would say how many and what happens
to them."). A "Settings › Your data" row, then "Go to Today" (56px). After a
withdrawal the same screen reads "You withdrew" and the retention card says
entries submitted before withdrawing are left as they are pending LEGAL-3E.

**Artboard 4A, `/consent/guardian` — A guardian answers this one.** For an
athlete under 18 on the club's record. A minor's "Read the choice" on
artboard 2 is a form post that sends the guardian the link (an act, not a
side effect of opening a page) and lands here. Eyebrow "Step 3 of 3 · waiting
on a guardian"; "Sent {date, time} · no answer yet"; the guardian's name and
**masked** address from the club's record (`b***@***.com`), never asked for
("The club holds them as your guardian contact. They have a link to the same
two blocks you have just read — the same words, nothing extra."); **What you
can do meanwhile** (not locked out; all four forms closed "because filling one
in is the thing being agreed to"); **Your own say** with `LEGAL-4A`; "1 of 1
guardian contacted"; **Send the link again** (56px, a form post — the earlier
link still works until it expires); **"This is not my guardian — tell the
club"** (a 44px row to `/report-problem?about=guardian` with the message
started — a person, not a screen); "Fydr does not ask you for their address,
and does not ask you for your date of birth. Both come from the club's
record." No date of birth is shown or requested. With no guardian recorded the
screen says so and nothing can be sent. Once the guardian answers, the athlete
lands on Today (agreed) or the declined screen.

**Artboard 4B, `/guardian/[token]` — the guardian, on the emailed link.** A
web page with no account, outside both shells, reading and writing through
`guardian_request_by_token` and `guardian_decide` alone (anon-callable; the
token's sha256 is what is stored; seven-day expiry; single use). The wordmark,
"No account needed", "{Club} · link expires {date}", "For {guardian}, about
{first name}", "{first name} is under 18 on the club's record, so this decision
is yours. {first name} has read the same two blocks." — under 18 and nothing
more precise. The two blocks condensed, each with `LEGAL-3A` / `LEGAL-3B` shown
**by reference** ("same wording as the athlete screen") so a reviewer can
confirm the strings match; **What {first name} sees of your answer** (your
name, your decision and the date; not this page); the sentence "Saying no does
not affect selection." with "The club states this; Fydr records the answer."
and `LEGAL-3C`; the same two equal 56px choices, zero haloed primaries; the
version line and `LEGAL-3D`. The answer lands on the athlete's own columns as
the guardian's — `parental_consent_method = guardian_link`, no staff member
recorded — with an audit row carrying no actor and the guardian's name. After
answering the page reads "You agreed." / "You said no." with the recorded time;
an expired link says so and records nothing; an unrecognised token says so.
The email (`lib/email/templates.ts` `guardianConsentEmail`) is plain words
with no legal wording; the link is never shown to the athlete or to staff.

**The staff side (not drawn; needed).** On the athlete profile, for an athlete
under 18, a **Guardian** card: the guardian the club holds (full name and
address — staff, not the athlete), the decision's state and how it was taken
("answered by the guardian on the link" / "recorded from the club
registration form" / "recorded in person" …), and for the sport scientist
three form posts to `/squad/[id]/guardian`: save the guardian, send (or
re-send) the link, and **record a decision the guardian gave offline** with its
method — the other route Isabella kept, one value of `parental_consent_method`
each, `parental_consent_recorded_by` naming the staff member. Every action is
audited (`athlete.guardian_recorded`, `guardian_consent.requested`,
`guardian_consent.email_sent` / `_not_sent`,
`guardian_consent.recorded_offline_agreed` / `_declined`).

**What a decision changes, athlete side.** Out of data (declined, withdrawn,
guardian outstanding), Today's To do reads "Closed" with one row in the
athlete's own words ("You said no — … Settings › Your data" / "Waiting on
your guardian — …") instead of the check-in and rating rows, and the four
entry forms — the morning check-in, the session rating, gym logging and the
weekly nutrition check-in (finding 3: all four, because each is the athlete
entering data about themselves) — open as "Not open" with the state's sentence
and the way to change it (`components/EntryLocked`). The database refuses the
row anyway (0120's restrictive insert policies); the screen says so before a
tap.

**What a decision changes, staff side.** The squad list keeps every athlete
and shows the state and its date under the name ("no data consent · Mon 14
Sept", "guardian consent outstanding", "not yet decided", "data consent
withdrawn · date"); the profile header carries the same line and "no new
entries are recorded; every figure below reads what was recorded before". The
data denominators — the compliance report's athlete list, the training load
report, the testing report, analytics, the positional context, the leaderboard
wall, the export builder, the dashboard's weigh-ins — read `in_data`, and the
compliance figure's exclusions sentence names who is out and why: "3 athletes
are not counted, having no data consent in force (1 declined, 1 waiting on a
guardian, 1 not yet decided)." The expectation generator writes nothing for an
athlete not in data. Availability, the injury roster, the schedule's expected
attendees and the roster count are operational facts and keep everyone.

## 4. What the athlete enters here

| Field | As worded | Type | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Send them the link / Send the link again (4A) | the button | one tap | `request_guardian_consent` — a minor with a guardian recorded | "The link could not be sent" / "no guardian contact recorded" | a `guardian_consent_requests` row (the hash, the expiry) and audit rows | — | The guardian (the email), staff (the profile card) |
| The decision | "I agree to both blocks" / "I do not agree" | one tap | `record_data_consent(decision, version)` — the only path onto the columns from an athlete session; a minor is refused ("a guardian answers this one") | "That did not save. Nothing was recorded — try again." | `consent_given_at` or `consent_declined_at` + `consent_version`, the same on the health record, `parental_consent_method = not_required`, an audit row (`consent.agreed` / `consent.declined`, by athlete) | Yes — Settings › Your data (the withdrawal row) | The club: the state and its date on the squad list, the profile, the audit trail |

## 5. Every number shown

| Metric ID | Label on screen | Meaning | Window | When missing |
|---|---|---|---|---|
| None | "N people at the club have a staff account" | Active staff accounts at the athlete's club | Now | "Nobody at the club has a staff account yet." |
| None | "N of N roles listed" | Roles present plus the athlete — structural, never a figure about the data | Now | — |
| None | "24 of 30 → 24 of 29" (3B) | Illustrative of the denominator rule; the real figures are the reports' | — | — |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Read the choice | 2, footer, 56px | Opens the decision | `/consent/decide`, or `/consent/guardian` for a minor | nothing | no | never |
| I agree to both blocks | 3A, 56px | Records both blocks as given | `/check-in?first=1` (artboard 5) | the columns and an audit row | no — the caption is the confirmation | never on 3A |
| I do not agree | 3A, 56px | Records both blocks as declined | `/consent/declined` | the columns and an audit row | no | never on 3A |
| Settings › Your data | 3B, a row | Opens the withdrawal row | `/me/data-consent` | nothing | no | never |
| Go to Today | 3B, 56px | Leaves the state screen | `/today` | nothing | no | never |

## 7. Offline and sync

The decision is a server write (a form post to `/consent/decide/record`);
offline it fails and the screen says so with nothing recorded. It is not
queued: a consent decision held in an outbox is a decision the athlete cannot
see the state of.

## 8. Notifications

None. A decline sends the club nothing but the state on the squad list and the
audit row (finding 1: the decline is visible by name — the solicitor's question
beside LEGAL-3C).

## 9. Permissions

`record_data_consent` and `withdraw_data_consent` act on the caller's own
athlete row only; the self-update column guard refuses every consent, guardian
and parental column from an athlete session. Staff read the state through the
squad list, the profile and the audit log; no staff control changes it (a
guardian's decision recorded offline is the sport scientist's, on the profile —
artboard 4).

## 10. States

Undecided (the gate), agreed (the check-in), declined (3B), withdrawn (3B's
other wording), guardian outstanding (4A), error ("That did not save"), a minor
reaching 3A by URL (sent to 4A).

## 11. Accessibility and device

Both choices 56px; every other control 44px. The placeholder blocks are
`role="note"` with the reference in their accessible name. No hover-only
value. Verified at 375px and 1440px.

## 12. Open issues

- `LEGAL-1A`, `3A`, `3B`, `3C`, `3D`, `3E`, `3F`, `4A` undrafted.
- The coach card's body-site line, above, until the club setting lands.
- Finding 1: the decline is visible to the coach by name — for the solicitor.
- Whether wellness (sleep, soreness, mood) is Article 9 data — the solicitor's,
  beside LEGAL-3B; today it is performance data, block 1.
- The seed backfill of the performance record for linked synthetic athletes
  (0120) — on the decision sheet.
