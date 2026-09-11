# Today

## 1. Where it sits

Tab 1 of 4. Route `/today`. File `src/app/(athlete)/today/page.tsx`, 452 lines.
The landing screen after sign in.

## 2. Who reaches it and when

Every athlete, every time they open the app. Base package: there is no tier gate
anywhere in the athlete shell. Guarded by `requireAthlete()`, so a staff member
who is not also an athlete is redirected to `/dashboard`.

## 3. What you see

Top to bottom on a phone, in the order the page actually renders them
(`today/page.tsx`, reordered 11 September 2026 for ATH-ADULT-02 — the to-do
list is now the first thing under the greeting, because 561px of an 812px
screen used to pass before the first actionable row):

1. **What day it is and the greeting** — the date line with the matchday
   label for the week (`mdLabel`, `mdExplainer`), then "Morning, {name}".
   No avatar (removed 12 September 2026, ATH-ADULT-02 follow-up): the tab
   bar's Me is the way to the profile.
2. **One line, only when something is wrong**: "Modified · …" or
   "Unavailable · …" — the status and what you may do, linking down to the
   full card (item 7). Nothing here when you are available. Its fill is the
   tone mixed into the card surface, the same rule as the card, so it reads
   amber or red on the blue ground rather than grey.
3. **This week**, the seven-day strip, compact: each day's initial, its
   number (today filled) and its MD label, coloured by session type. On the
   ground, not in a card (moved up from item 5 on 12 September 2026 so the
   shape of the week is read before the list; To do's first row stays inside
   an 812px screen, measured at 367px).
4. **What you owe**, as a to-do list. This is the screen's real job. Always
   rendered: with nothing outstanding the slot holds one row reading "You're
   up to date" and the count reads "None left".
5. **What is on today**, the sessions from the schedule — each with its start,
   place, and whether it has finished, is under way, or starts within two
   hours, in club time.
6. **What the club is working towards**, the next fixture
   (`fetchNextFixture`), in its own card — absent when no fixture is scheduled.
7. **Whether you are available, and what you may do today**
   (`AvailabilityBanner`). Always present, on every load, whatever the status.
8. **Your own diagnosis, if there is one** (`InjuryClinical`). Often absent.
9. **Team this week**, only when a rehab team allocation exists.

Every card on this screen — and on every athlete screen — has 9px corners
(`--r-toggle`, Isabella's decision of 11 September 2026); staff cards keep
18px.

The "Something not right?" row is not on this screen; the report route is
reached from Me.

**The to-do rows.** Each is a name, one line and a chevron — no domain tiles.
"Wellness · 45 sec" (the 45-second entry of `00-product-overview.md` §198 and
`08-notifications.md`); "Rate {session name} · Today HH:MM" or "· Yesterday"
(the session's end time, club-local; no duration is claimed for a rating,
since none is specified); "Weekly nutrition check-in · about 10 sec"
(`08-notifications.md`, "three answers, under 10 seconds").

**When a session's rating is owed.** From thirty minutes after the session
ends until the end of the following day in club time — `lib/rpeDue.ts`, the
one rule the row and the rating screen both read. A row therefore never opens
a screen that refuses it; after the window the row is gone and the screen
says "This session can no longer be rated." Two ratings owed are listed oldest
first.

**The availability card, item 7, in detail**, because it is the part of this
screen an athlete reads when something is wrong:

- The tone-family card: fill, border and every word from one family — amber
  for Modified, red for Unavailable, the plain card for Available. The status
  word alone — **Available**, **Modified** or **Unavailable** — with the reason
  category as a chip beside it when not available.
- Then what they may do. `Available` reads "Everything is on." and nothing
  further. Otherwise the restrictions, joined with a middle dot; or the reason
  category if there are no restrictions; or "No restriction recorded."
- Then the staff note, if one was written.
- Then **the injury line**: body area with the side folded in, the recovery
  stage, and the expected return date — "Right shoulder · Rehab · Expected
  return Tue 15 Sept". See §5 for when each part appears.
- Then "Everything else is on. Speak to medical staff."

Everything from the note downwards appears **only when the status is not
`available`**. A cleared athlete sees the status word and "Everything is on."
and nothing else, so a stale note or a healed injury cannot contradict it.

**The diagnosis block, item 7**, is a separate component and deliberately not
part of the card: availability is a squad fact a coach also sees, a diagnosis
is clinical and only this athlete and the medical staff see it. It shows
`Diagnosis` and `How it happened`, each only if recorded, closing with
"Recorded by your medical staff. Speak to them about anything here." It renders
nothing at all — no heading, no placeholder — when there is no clinical record,
no linked injury, or the athlete is under 18, and it never explains which of
those applies. Saying "this is withheld from you" would tell a minor that the
withheld thing exists, which is what the age gate in migration 0093 prevents.

**Above the fold: the to-do list.** Everything else can be scrolled to. Measured
11 September 2026 at 375×812: "To do" at 137px, the first row at 163px.

## 4. What the athlete enters here

**Nothing.** Today is a dispatcher, not a form. Each to-do item carries its own
destination (`today/page.tsx:123`) and the entry happens on the screen it opens.

## 5. Every number shown

| Metric ID | Label on screen | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-014 | The MD label, for example MD-2 | How many days until the next match | The week | No fixture, no label |
| MET-024 | Session times and durations | What is scheduled today | Today | "Nothing scheduled" |
| None | The status word: Available / Modified / Unavailable | `availability.status`, the row currently in force | Now | No row at all reads as Available |
| None | The restrictions, joined with a middle dot | `availability.restrictions` | Now | Falls back to the reason category, then "No restriction recorded." |
| None | Body area and side, e.g. "Right shoulder" | `injuries.body_area` and `.side`, via `bodyAreaPhrase` | Now | Line absent when the availability row names no injury |
| None | The recovery stage: Open / Rehab / Return to play | `injuries.status` | Now | Line absent, as above |
| None | "Expected return Tue 15 Sept" | `injuries.expected_return` | Now | **Absent when the date has passed**, as well as when there is none |
| None | Diagnosis | `injury_clinical_athlete_view.diagnosis` | Now | Block absent |
| None | How it happened | `injury_clinical_athlete_view.mechanism` | Now | Block absent |

Formulas live in `docs/metrics.md`.

**Why nine of these say "None" in the Metric ID column**, added 8 September
2026: they are not registry metrics and have no MET IDs. The registry covers
quantities that both apps compute and compare — MET-013 is the closest, and it
is the STAFF squad availability split, a count across a roster, not an
athlete's own status. Nothing here is computed: each value is a column read
straight out and rendered. Inventing IDs for them would put nine entries in a
parity registry with nothing on the other side to be in parity with.

**Two behaviours in that table are easy to misread as bugs**, so they are
stated here rather than left to be rediscovered:

- **A past expected-return date is suppressed on this screen, deliberately**
  (`upcomingDate`, `src/lib/format.ts`). On 8 September 2026 all six open
  injuries carried a date between 9 and 31 days in the past — seeded relative
  to `current_date` a month earlier — so no athlete saw a return date at all.
  That was the data ageing, not this screen misbehaving; both databases were
  corrected the same day. A date a month gone is not information, and on a
  concussion it reads as pressure to be back already.
- **The staff injury card shows the same date unconditionally**, past or not
  (`InjuryCard.tsx`), and that asymmetry is the point: the club needs to see
  that its own record is stale, because they are the only ones who can fix it.
  The person who stops being told is the one who cannot act on it.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A to-do item | The list | Opens the entry screen for that item | `/check-in`, `/rpe/[id]`, `/nutrition-check-in`, `/gym/[id]` | nothing | no | the item is not owed |
| Report a problem | Below the list | Opens the problem form | `/report-problem` | nothing | no | never |
| Tab bar | Fixed, bottom | Switches tab | the tab | nothing | no | never |

**Gestures.** UNVERIFIED: no pull to refresh, swipe or long press found.

## 7. Offline and sync

Today shows what is owed and stores nothing itself. The entries it dispatches to are saved on the phone first and sent when there is signal
(`src/lib/outbox.ts`). Its own header states the rule: an athlete standing in a
gym with no bars must never be shown a network error for something they have
already done.

- **Queued in `localStorage`**, one key per domain.
- **Retried on the next load** of the app.
- **If the app is closed before sync completes**, the entry is still in the queue
  and goes on the next open.

**UNVERIFIED: what the athlete sees while an entry is queued**, and what happens
if the same day is submitted twice from two devices. Looked in
`src/lib/outbox.ts` and the screen's own component.

## 8. Notifications

`docs/09-security-and-compliance.md:507` names `athlete.wellness.nudge` and
`athlete.rpe.nudge` and caps them: one per entry, one per day, three per rolling
week, stopping after three consecutive missed days, and no guilt or streak
language. **Tighter limits are specified for under 18s and NOT BUILT.**

**UNVERIFIED: the exact copy, the send time, the timezone, and which screen each
opens.** DECISION 12.

## 9. Permissions

None required. Push notification permission would be required by whatever sends
the nudges above, and that could not be located.

## 10. States

Loading, empty (nothing owed and nothing scheduled), error, offline, no squad,
first run with no history. **UNVERIFIED: which of these are distinctly designed.**

## 11. Accessibility and device

Stage A0 recorded the decision to translate this section for a web app rather
than drop it.

- **Text scaling.** UNVERIFIED: no test at 200 percent browser zoom.
- **Screen reader.** UNVERIFIED per element.
- **Supported browsers.** UNVERIFIED: no browser support policy found.
- **Thumb reach.** The primary action sits at the bottom of the screen on the
  entry forms, which is the reachable third on a phone.

## 12. Open issues

- **UNVERIFIED:** notification copy and timing. DECISION 12.
- **RESOLVED 8 September 2026:** whether Today tells an athlete they are
  unavailable. DECISION 8. **It always has** — `AvailabilityBanner` has rendered
  on every load of this screen since before this specification was written, with
  the status word, the restrictions and the staff note. The earlier UNVERIFIED
  mark, and a report that stated the athlete "finds out they cannot train from a
  person", both came from grepping the route folder for a table name; the query
  lives in `src/lib/queries/availability.ts` and the screen reaches it by import.
  Tier 1, the same day, added the injury, the recovery stage and the expected
  return date on top; Tier 2 added the diagnosis and mechanism behind an age
  gate. Documented in §3 and §5 above.
- Deep links to Today survive sign out; eight other athlete screens do not.
  DECISION 1.
