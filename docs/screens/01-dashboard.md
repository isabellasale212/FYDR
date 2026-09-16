# 01. Dashboard

## 1. Page name and URL

**Dashboard**, at `/dashboard`.

The landing screen for every staff member except one who holds only the
nutritionist role. It answers one question: who needs me this morning.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything on the page | Nothing. This page only links onward | None | Base. The week load card needs Premium, see section 8 | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Everything | Nothing | Clinical detail is not on this page at all | Base | Same guard |
| Medic | Yes | Everything | Nothing | None | Base | Same guard |
| S&C | Yes | The S&C version (§4, STAFF-SS-01 C2 role versions, 13 September 2026): the attention card and "Need you" counting load and weigh-in readings only, Gym today, Weigh-ins, Available; no week strip | Nothing | Wellness and compliance flags are not counted on this page (they are on `/flags`) | Base | Same guard; the version from the server-side claims, `lib/dashboardVersion.ts` |
| Nutritionist | Yes | The nutritionist version (§4, 13 September 2026): the matchday lead card with its three counts and no names; the attention card and "Need you" counting the nutrition domain; Weigh-ins; the Today timeline and Outstanding entries. No week strip | Nothing | The lead card's named lists and the Available tile (the board's choice — "a nutritionist does not pick a team"; the censored availability view itself is theirs since migration 0074) | Base | Same guard; `lib/dashboardVersion.ts` — a nutritionist who also holds a wider role reads that role's version |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, `src/lib/supabase/middleware.ts:84`, then the page guard, then the database |

**A user with the right role but the wrong tier** sees the page in full except
the Week load card. What that card shows on the Base package is undecided,
decision D-23.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/dashboard/page.tsx:139`; a **coach or medical** check at `src/app/(staff)/dashboard/page.tsx:151`, which renders a named refusal rather than redirecting. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Signing in, for anyone holding coach, medic, S&C or sport scientist.
- The first item in the left sidebar.
- The Fydr wordmark at the top of the sidebar.
- Any link that says Dashboard.

A person holding **only** the nutritionist role does not land here. Where they
land is undecided and is raised in section 9.

---

## 4. What you see

Top to bottom.

**The top bar** carries the group filter and the date. Choosing a group narrows
every number on the page at once, and the choice follows you to every other
screen.

**The matchday lead card** first — the one emphasised card on the page
(STAFF-SS-01 C2, 13 September 2026; the readiness card that sat in the right
column, moved to the top and restated). Eyebrow "Ready for Saturday"; the
fixture as the title, "v Colthorne RFC · Sat 12 Sept, 15:00 · home"; then the
denominator, said: "27 of 30 have a current status · 3 not recorded · MD in 5
days · Whole squad" — an athlete with no status is counted in none of the three
and named as not recorded, never folded into available. Three counts, **Full /
Doubtful / Ruled out**, each opening the squad. Then the two named lists as
tone-family cards (A1's treatment), one athlete a row with the status word and
the restriction line — "Modified · running and gym only, no contact" — which is
what a session is planned against; a ruled-out athlete with no restriction line
reads "Unavailable · not available for selection". **The reason only for the
medic** (data rule 6, literally): the lists read "Doubtful · 4, with reason",
and under each name the medic sees the diagnosis from the clinical record
(`injury_clinical`, medic-only under RLS — the page never calls that read for
another role) beneath the eyebrow "Medical · visible to medical staff", or for a
non-clinical absence the category and the note — "Academic — away on placement
until Mon 14 Sept" — without the label. No other role sees any reason, clinical
or not (the availability reason category is readable by every staff role at the
database, access-matrix §4.1, so hiding it here is a display rule, not a
permission). The card's tail keeps the week load so far (MET-015), the flags
affecting selection and the sessions left to run — one line, each opening its
page. **With no fixture inside 14 days the card is absent, not empty**: the week
card takes the emphasis and says why — "No match in the next 14 days · Next
fixture Sat 5 Sept v Marleigh · 47 days" — and the two never appear together.
For the nutritionist the card keeps its counts and drops the named lists (§4,
role versions). The Named ring (MET-014) is gone: Full + Doubtful is the named
count and the three numbers say it.

**The week strip** next, then the headline tiles, then Needs attention — the
board's ten-second read in order: the matchday question, the week, the cards,
the panel. **On a heavy morning the strip yields** (13 September 2026): with
five or more athletes needing attention (the panel's own cut) the six-day strip
is not drawn and the panel takes the space — the only element on the page that
gives way, because the week is one sidebar row away while the five names are
not. It never yields while it is the lead (no match inside 14 days), and it is
absent for the S&C and the nutritionist regardless (§4, role versions). Each
session in a day's column is its coloured dot, its title and **its type as a
word** — "Lower A · Gym" — since 15 September 2026 (the accessibility sweep's
Class 3.1): the dot's hue alone carried the type, and a title does not say gym or
testing. The dot stays; the word is the second channel. **At phone width the
strip is the day, not the week** (15 September 2026, mobile queue #12): below
768px the head reads "Today" (or the selected day's name) and only the selected
day's column is drawn — its label, MD, duration and sessions — the other five
and the week's session count hidden by the width gate; the six links are still
in the page, and a tablet held upright sees the day too
(`docs/access-matrix.md` §8). The group filter chips stand down for the title
bar's dropdown at the same width (#14).

**Two tabs for the coach — Overview and Match** (16 September 2026, Isabella's
overnight queue 3.4), under the title in the schedule's view-tab idiom. Match
(`/dashboard/match`) is the week's team selection — the same board, teams and
draft/published allocations as `/injuries/team-allocation`, moved off Manage
groups — for selecting on match days; the coach allocates and publishes, and
the tab is drawn for the coach only (any other role opening the address reads
the board; hidden, enforcement after Friday). **Everyone can see the
dashboard** — verified 16 September for all five roles. The group filter is a
dropdown in the top right (3.5).

**Five headline tiles** — for the sport scientist, the coach and
the medic. **The S&C and the nutritionist read their own versions** (STAFF-SS-01
C2 role versions, 13 September 2026, from the board's frame 7; the rule is
`lib/dashboardVersion.ts`, resolved from the server-side claims, and roles add
up — an S&C who is also a coach reads the full dashboard):

- **S&C — four tiles**: Need you (counting load and weigh-in readings only:
  GPS, session RPE, gym and testing flags, and the nutrition domain, where the
  body-mass rule raises (MET-043, 14 September 2026) — "load and weigh-in
  readings only ›"), **Gym today** ("9 of 24
  logged · Lower A · 16:00": athletes in scope with a gym session log dated
  today, over those expected at today's scheduled gym session; with several the
  first by time is named; with none, "— · No gym session today" and anyone who
  logged regardless is still counted, never 0 of 0), **Weigh-ins** ("24 of 30 ·
  6 not submitted this morning": `body_composition` rows measured today over
  the squad in scope), Available. The attention panel counts the same load
  domains, and so does the phone bar's Flags badge. The week strip gives way —
  "the week is one sidebar row away, the five names are not".
- **Nutritionist — two tiles**: Need you (the nutrition domain, the one they
  may act on) and Weigh-ins. No week strip. The matchday lead card draws with
  its three counts and **no named lists** — the board's own choice ("a
  nutritionist does not pick a team"); the censored availability view is theirs
  to read since migration 0074 (6 September 2026), so this is a design rule,
  not a permission. No Available tile. At v1 no threshold raises a nutrition or
  body-mass flag, so their attention card reads "No open flags right now" until
  one exists — on the decision sheet.

- **Need you.** How many athletes have something that wants attention today.
  Clicking it goes to the flags for that day.
- **Wellness in.** What share of today's expected check-ins have arrived.
  Clicking it expands to name who has not submitted, rather than sending you to
  another page to find out.
- **Available.** The squad's availability as a fraction, with modified and out
  counts beneath. Clicking it expands to name them, each with their reason and,
  since 15 September 2026 (Class 3.3), the word **Modified** or **Out** on the
  row — the dot's colour no longer carries which is which alone.
- **Open flags.** How many alerts are unresolved. Clicking it goes to the flags
  screen.
- **To matchday.** How many days to the next fixture, and who it is against.
  Clicking it opens that fixture.

**Needs attention.** The ranked list of athletes who need a conversation, each
with a one line reason. This is the page. Everything else is the packaging.
Each collapsed row carries its severity as the glyph-and-word pill (High,
Medium, Low) beside how long it has gone unreviewed, since 15 September 2026
(Class 3.4) — the row's coloured left edge stays, but it no longer carries the
severity alone until the row is opened.
The panel's headline counts **athletes** — "5 athletes" over "need attention ·
12 open flags · 3 not yet reviewed by anyone" — and, when the list is cut,
"top 5 of 8 athletes" (on a phone, "· top 5 of 8 shown" on the same line)
(STAFF-SS-01 A3, 12 September 2026). The phone bar's Flags slot carries the same number as a
badge (C3), read for the active group filter on every staff page. The panel closes
with "Thresholds set by Jane Pemberton · 24 Aug · Change ›" (C2): the most recently
changed active threshold's `updated_at` and the person who created it — one stored
date everywhere; "the club defaults" for a rule with no creator; "Change ›" only for
a role in `THRESHOLD_EDIT`. With no open flags the line still stands under "No open
flags right now — none above a club threshold.".

**Today.** What is scheduled, in time order, or a line saying nothing is.

**Ready for Saturday** is the lead card above (13 September 2026) — the
selection picture for the next fixture when it is within **14 days**
(`FIXTURE_RANGE_DAYS`, STAFF-SS-01 D3, 12 September 2026). Further out, the week
card leads and the "To matchday" tile still counts to the real next fixture.

**Outstanding entries.** What has not been submitted yet, by kind, with a link to
the compliance report. When the club does not collect session RPE
(`organisations.collects_rpe`, Settings › Club, migration 0118, 13 September 2026)
the "RPE, yesterday" track keeps its label and carries a sentence instead of a
bar — "This club does not collect session RPE, so the RPE track has nothing to
show. A sport scientist can switch it on in Settings › Club." — never "0 of 0"
(`docs/decisions/absence-rule.md`).

---

**Phone width, 16 September 2026 (the evening queue).** The Compliance › link
on Outstanding entries and the Open athlete report button on a flag are not
drawn below 768px (2.2: nothing at phone width leads to a desktop-only notice);
the thresholds provenance line, the availability tile's "injury status set by
medical…" foot and the nutrition track's "missing it is not non-compliance"
are the desktop's (2.3: the figure stays, the sentence goes); the Weigh-ins
tile is a figure, not a link, for a role whose `/nutrition` is a notice there.
**The medic's Current injuries card (2.8)** sits at the top of the dashboard
at phone width — directly below the lead card, above the tiles (Isabella's
note after the second walkthrough; it was first placed below the day's
timetable, which is mid-page there): every athlete with an open injury who is
expected at one of the day's sessions (`fetchInjuredInDay` — the day's
participants crossed with the open injuries), the site as the medic reads it,
since when, expected return, and the first session they are in; "No injured
player in today's sessions." otherwise. Additive, the medic's alone
(`CLINICAL_ONLY`).

**A passed session recedes in ink, not in a fade (16 September 2026).** The
timeline's passed card sat at opacity 0.72, which put every word in it at
2.85–4.05:1 once a session had passed — a failure on any training afternoon.
The fade is gone: the state is the `--tick` border, the word "passed" beside
the clock, the name in `--muted` and the card's secondary inks in
`--unavailable` (the ink that clears 4.5 on every flat ground in both themes,
`tokens.css` 15 September). The clock column's "planned" / "passed" words moved
off `--faint` (3.98 on `--bg`) for the same reason.

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-012 | Wellness in | Share of expected check-ins received | Today | Empty, never 0 percent, when nobody was expected |
| MET-013 | Fit and available, Doubtful, Ruled out | The three way availability split | Right now | An athlete with no availability record is counted in none of the three |
| MET-014 | ~~Named~~ Retired 16 September 2026 — Full + Doubtful on the lead card is the named count; the registry entry is marked retired and the identifier is not reused | — | — |
| MET-015 | Week load so far | Squad running this week against a normal week | Monday to today | Empty when no earlier week has GPS data |
| MET-016 | Open flags | Unresolved alerts | Now | Zero is a real answer here |
| MET-001 | Readiness, inside the attention rows | How ready an athlete says they feel | The day quoted | Blank |

Formulas are in `docs/metrics.md`. They are not repeated here.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Top bar | Narrows every number on the page | Stays here, with the group in the address | Nothing. A cookie remembers your choice | Any staff | None | Never |
| Need you tile | Tile strip | Opens the flags for that day | `/flags?date=` | Nothing | Any staff | None | Never |
| Wellness in tile | Tile strip | Expands in place to name who is missing — longest run of missed expected mornings first, each row "Not submitted · N mornings in a row · last entry {date}" (or "no entry in the last 90 days"); a rest day neither counts nor breaks a run; never 0 or 0% (STAFF-SS-01 A4, 12 September 2026). The tile is a button that says which state it is in — "Closed · opens a list" / "Open · showing the list", the words `aria-expanded` announces, with a ▸ / ▾ glyph that swaps rather than rotates; closed it is a `--surf2` well, open it is the surface with an accent ring (STAFF-SS-01 A2, 12 September 2026). The Available tile is the same | Stays here | Nothing | Any staff | None | Never |
| Available tile | Tile strip | Expands in place to name who is modified or out, each with a reason | Stays here | Nothing | Any staff | None | Never |
| Open flags tile | Tile strip | Opens the flags screen | `/flags` | Nothing | Any staff | None | Never |
| To matchday tile | Tile strip | Opens the next fixture | `/schedule/fixtures/[id]` | Nothing | Any staff | None | Falls back to `/schedule` when no fixture is booked |
| Gym today tile | Tile strip (S&C version only) | Opens the schedule | `/schedule` | Nothing | S&C | None | Absent for every other version |
| Weigh-ins tile | Tile strip (S&C and nutritionist versions) | Opens the nutrition page, where body mass is logged | `/nutrition` | Nothing | S&C, nutritionist | None | Absent for the full dashboard |
| An attention row | Needs attention | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff | None | Never |
| Full, Doubtful, Ruled out counts | The lead card | Open the squad | `/squad` | Nothing | Any staff | None | The card is absent with no fixture inside 14 days |
| An athlete row in Doubtful / Ruled out | The lead card's two tone-family lists (the warn / bad fill and border the athlete's own availability line uses — STAFF-SS-01 A1, 12 September 2026; one athlete a row since 13 September) | Opens that athlete | `/squad/[athleteId]` | Nothing | Any staff but the nutritionist | None | As above |
| Flags affecting selection | The lead card's tail | Opens the flags screen | `/flags` | Nothing | Any staff but the nutritionist | None | As above |
| Sessions left to run | The lead card's tail | Opens the schedule | `/schedule` | Nothing | Any staff but the nutritionist | None | As above |
| Compliance link | Outstanding entries | Opens the compliance report | `/reports/compliance` | Nothing | Coach or medic today | None | Never |
| Print | Top bar | Opens the availability board as a PDF in a new tab (`/dashboard/pdf?open=1`): the four counts and the athletes not fully available with the line every role reads; counts only for the nutritionist. Printing is done from the viewer — two steps (PATTERN-S7 C4, 14 September 2026: one renderer, the PDF; no print stylesheet). Recorded as an export | A new tab | An export audit row | Any staff | None | Never |

**Nothing on this page writes anything.** It is a reading screen. That is worth
stating because it means no confirmation step is needed anywhere on it.

---

## 7. How this page is built, in plain English

The page is built on the server before it reaches the browser. Six questions are
asked of the database at the same time rather than one after another: the group
list, the headline figures, the week strip, today's timeline, the readiness
picture, and the outstanding entries.

**Today is not always the real today.** The page works out the most recent date
that actually has data behind it and uses that, rather than going blank as real
time moves past the point the club's data reaches. Sessions that have passed are
judged against the real clock, not against an end of day stand in.

Two small parts run in the browser rather than on the server: the two tiles that
expand in place, and the group filter chips. Everything else is fixed by the time
the page arrives.

The group filter lives in the address, not in hidden state, so a filtered
dashboard can be sent to a colleague and they will see the same thing.

---

## 8. States

**Loading.** The page renders when its data is ready. There is no partial state.

**Empty.** Each region says so in words, and the three that can be empty on a
quiet day follow the one grammar (PATTERN-S6 C8, 13 September 2026;
`lib/dashboardEmpty.ts`): what is empty, why, what would fill it, the nearest
thing on record, "Nothing is missing", one action.

- The day timeline: "Nothing scheduled for Tue 15 Sep. Nothing is missing — no
  session is published for this day. The next session on record is Thu 17 Sep,
  Team run. A session appears here the moment it is published on the schedule."
  with one action — "Show Thu 17 Sep" when that day is inside the week strip,
  "Open the schedule for Thu 1 Oct" when it is not; with nothing ahead, the most
  recent day behind; with nothing on record at all, "Open the schedule". Never
  "for this filter": the group filter narrows who is expected at a session, it
  never removes a session from the day.
- A session card with nobody flagged: "No flag against any of the 14 athletes
  expected. Nothing is missing." ("was raised" once the session has passed);
  with nobody expected under a filter, "Nobody in Forwards is expected at this
  session. Nothing is missing — the filter is what is empty."
- The flags panel: "No open flag on any of the 27 athletes in the squad — none
  above a club threshold. Nothing is missing.", with the scope's own words under
  a filter.

Nobody carrying a restriction and no fixture scheduled are said in words as
before.

**Error.** A failed query surfaces as an error rather than an empty region, so a
broken read is never mistaken for a quiet day.

**No permission.** An athlete is redirected before the page is built. A
nutritionist-only user is redirected too, which is an open issue, see section 9.

**Wrong tier.** Undecided for the Week load card. Decision D-23.

**Offline.** Not handled. This is a server rendered page and it does not load at
all without a connection.

---

## 9. Open issues

- ~~**The nutritionist restriction is not built.**~~ Overtaken: migration 0074
  (6 September 2026) gives the nutritionist the censored injury and availability
  view — status, restrictions, expected return, never a diagnosis — so there is
  no availability restriction to build on this page. The role versions (§4, 13
  September 2026) draw them the lead card's counts without names and no
  Available tile, the board's own choice. D-01 is closed by 0074.
- **Where a nutritionist-only user lands is undefined.** The landing rule sends a
  staff member without squad access to Settings. With five roles that rule needs
  rewriting. Decision D-07.
- **What the Week load card shows on the Base package is undefined.** It is built
  entirely from GPS, which is Premium. Decision D-23.
- **UNVERIFIED: whether the attention list has its own limit.** Files searched:
  `src/app/(staff)/dashboard/page.tsx`, `src/lib/queries/flags.ts`.
