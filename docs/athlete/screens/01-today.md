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
3a. **"Your status changed"** (`StatusToldCard`, PATTERN-S3 C1, migration
   0122, 13 September 2026) — the one emphasised card on this screen, only
   while the availability row in force was set by staff and the athlete has
   not yet opened their status screen for it (`availability.athlete_seen_at`
   is null). The status word as the title, "Set by {name}, {role} · {when}",
   and one 56px action, **See what it means**, to `/me/status`. No timer and
   no dismiss: it stays on every visit until the status screen has been
   opened once, then never returns for that row. A return to available after
   an injury is a change too and is told the same way. Decided 2026-09-12:
   the card takes the emphasis while unread.
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

**The to-do rows.** Each is a name, one line and a chevron — no domain tiles —
except the rating row, which carries the CR-10 grid in place of a chevron and
sends on one tap (§4). Its line reads "Today 20:39 · 45 min · change or add a
note", the last part a link to the rating screen for the athlete who trained
longer than scheduled or wants to say something; once sent, the line is the
receipt.
"Wellness · 45 sec" (the 45-second entry of `00-product-overview.md` §198 and
`08-notifications.md`); "Rate {session name} · Today HH:MM" or "· Yesterday"
(the session's end time, club-local; no duration is claimed for a rating,
since none is specified); "Weekly nutrition check-in · about 10 sec"
(`08-notifications.md`, "three answers, under 10 seconds").

**The gym row** (PATTERN-S6 C2, ruled 13 September 2026, built 14 September):
a gym session the athlete has opened today and not finished is a row of its
own — the session's name over "6 of 12 sets", and "· 2 waiting to send" when
this phone's outbox holds sets for it — opening the session at
`/gym/[sessionId]`. It sits after what the morning owes (Wellness, a rating)
and before the weekly check-in. The count is the logger's own: sets that have
reached the server over the session's prescribed total, resolved for this
athlete; the waiting count is read from the outbox on the phone and follows
its change event. A programme session carries no calendar date, so a session
not yet opened is not a row — Programme is where one is started; a complete
or abandoned log is not owed and is not a row either. With two open today the
earliest started is the row.

**When a session's rating is owed.** From thirty minutes after the session
ends until the end of the following day in club time — `lib/rpeDue.ts`, the
one rule the row and the rating screen both read. A row therefore never opens
a screen that refuses it; after the window the row is gone and the screen
says "This session can no longer be rated." Two ratings owed are listed oldest
first.

**When the club does not collect session RPE** (`organisations.collects_rpe`,
Settings › Club on the staff side, migration 0118, 13 September 2026): no
rating is ever owed. The database generates no `training_rpe` expectation and
Today's outstanding list carries no "Rate …" row, so the athlete is not asked;
nothing on this screen says the club is missing anything. The rating screen,
reached by an old link, says so in the athlete's own words (03-session-rating.md
§10).

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
- Then, since 13 September 2026 (PATTERN-S3 C2), the card's last line is a
  link: **What this means for you ›** to `/me/status`, the status screen that
  answers the three questions in full (`22-my-status.md`).

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

**One thing: the session rating** (Isabella, 13 September 2026, the RPE
package, change two — "The prompt is one tap, not a form. A row on Today
carrying the scale itself, no sheet."). Everything else on the list is a
dispatcher row: wellness and the nutrition check-in open their own screens.

| Field | As worded | Type and range | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| RPE | The CR-10 grid on the row — 0 Rest to 10 Maximal, the same eleven 58px cells the rating screen draws | Whole number, 0 to 10 (migration 0117) | The zod schema `TrainingEntryInput`; the duration is the session's scheduled minutes, never typed here | Nothing is sent | `training_entries.rpe`, `.duration_min` (the schedule's), `.comment` null | **No** — one tap sends; a wrong tap is corrected by the coach | staff, immediately |

**One tap sends** (`components/TodayRpeRow`). The cells are buttons, not
radios: on the rating screen a selection is not yet a submission, so arrow keys
moving a radio group are harmless; on the row a selection IS the submission, so
only Enter, Space or a tap can send. The tapped cell stays selected, the other
ten are disabled the moment it lands (the double-submit guard), and the row
becomes its own receipt: "{Session} rated 7 · Hard", then "Sent. If that is
wrong, tell your coach — they can record a correction." or, with no signal,
"Waiting to send — saved on this phone, sends when the signal is back." The
row does not disappear and nothing moves (no auto-advance); the To do count
catches up on the next visit. A waiting receipt turns into "Sent" the moment
the entry leaves the outbox, whoever sends it — the outbox announces every
write on this window (`OUTBOX_CHANGED_EVENT`, `lib/outbox.ts`) — and when
`OutboxFlusher` sends it on the signal's return the page refreshes as it
always has (PATTERN-S6 A2: the list losing its row is the answer, with the
flusher's own "1 entry sent at 22:02" line). The entry date is the session's own club-local
day, the rule the rating screen uses, so a rating from either lands on one row.

**A session with no scheduled length** (published before a duration was
required) has nothing to multiply the rating by: its row carries "Rate on the
next screen" and hands over to `/rpe/[id]`, which asks for the minutes.

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
| A to-do item | The list | Opens the entry screen for that item | `/check-in`, `/nutrition-check-in`, `/gym/[id]` | nothing | no | the item is not owed |
| A number on the rating row | The rating row's CR-10 grid | Sends the rating for that session with its scheduled minutes | stays here; the row becomes the receipt | `training_entries` (through the outbox) | **no — one tap**; the coach corrects a wrong one | the rating is not owed, or was sent |
| "change or add a note" | The rating row's line | Opens the full rating screen | `/rpe/[id]` | nothing | no | the rating was sent, or the session has no scheduled length (then the whole row hands over: "Rate on the next screen") |
| See what it means | The "Your status changed" card | Opens the status screen, which marks the row seen | `/me/status` | `availability.athlete_seen_at` (on arrival, through `mark_availability_seen`) | no | the row has been seen, or was not set by staff |
| What this means for you › | The availability card's last line | Opens the status screen | `/me/status` | nothing | no | available |
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

**What the athlete sees while an entry is queued** (PATTERN-S6, 12 September
2026): one `role="status"` line under the title, a good-tone card — "3 entries
are saved on this phone and will send when you have signal." — the sentence
`OutboxFlusher` has always used. When a flush sends, the same region reads
"3 entries sent at 12:04. Nothing is waiting." as a plain card, once, and is
absent on the next load: the count changes in place, never a toast. With
nothing waiting and nothing just sent there is no region at all. The entry forms
still return here, and the to-do list losing its row is the success — the
"Wellness submitted · queued, syncs on signal" toast that used to sit over it is
gone.

**"See what is waiting"** (PATTERN-S6 C1, 13 September 2026): under the waiting
count's sentence, the one route to the queue screen
(`19-waiting-to-send.md`, `/today/waiting`), absent with nothing waiting.

**The same day submitted twice from two devices** (§0aa): a conflict is shown
inside one `role="alert"` region — one region for every conflict on the screen,
so two arriving in one flush are announced once, not twice (PATTERN-S6 C9,
13 September 2026) — each as a notice in the bad tone — "One saved entry could not be sent:
you already have your check-in for the week of Mon 24 Aug from another tab or
device, and that one is what is showing." — with "Discard this one" (or, for a
gym set, "Use my numbers" / "Keep what is showing") as ghost controls inside
the notice and nowhere else. The queue screen and "See what is waiting" are
recorded, not built (PATTERN-S6 C1).

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
