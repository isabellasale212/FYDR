# Programme

## 1. Where it sits

Tab 3 of 4, **labelled Programme in the tab bar** (Gym until 15 September 2026 —
Isabella's mobile queue #7: the tab carries nutrition as well as gym). Route
`/programme`. File 210 lines.

## 2. Who reaches it and when

Any athlete with a programme assigned.

## 3. What you see

The header names the athlete — "Dan's programme" — and **each live block is
its own titled section beneath it** (Isabella, the pre-deploy fixes,
15 September 2026, #3): the block's eyebrow (type · block · week), its name,
its dates, and its own Sessions card. Overlap is allowed by rule
(`decisions/programme-dates.md`), so a rehab block beside a lifting block
reads as two blocks, never as one programme's sessions under another's name
— which is what the screen did while it named one programme in its header
and listed every live session beneath. Nutrition guidance is reached from
here.

**TODAY'S SESSION ONLY, 16 September 2026** (Isabella's evening queue, 1.4:
"show only the gym session scheduled for today; no previous days' sessions;
the day's nutrition target stays below"). A block's card is titled **Today**
and lists the session whose `scheduled_on` (the assignment's start counted
forward, migration 0132) is today — plus a session opened or logged today
under another date, so the way back into an open session never disappears —
and nothing else. A block with nothing today says **"No session today. Next:
Upper B, Thu 17 Sept."** — the next session named by its date, as words, not
a row (the next session as a row is on `docs/after-friday.md` with a
recommendation). An undated block (no assignment start) cannot say which
session is today's and lists its sessions as before. The block's eyebrow
names the block and week the athlete is IN — today's session's, else the
next one's — not the first session's.

**Block names are free text a coach types**, with no fixed list. The screen
explains the well known periodisation phase names by exact, case insensitive
lookup. "Accumulation" is the one confirmed live in this build's data. **An
unrecognised block name gets no tooltip rather than a wrong one**, which is the
correct choice and is recorded as such in the file.

## 4. What the athlete enters here

Nothing on this screen. Logging happens on `/gym/[sessionId]`.

## 5. Every number shown

| Metric ID | Label | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-030 | Prescribed load | What to lift | Per session | says so plainly |
| MET-031 to MET-035 | Nutrition targets | Read on this screen from `protein_g`, `energy_kcal`, `fluid_ml`, drawn as four figures at `--fs-28` in two columns with the unit beside and the label under (16 September 2026, bigger numbers and less wording — the same card Today draws). The provenance line beneath them — "The club default target, the same for everyone on it." / "Your group's target." / "Set for you." / "Not scaled to your weight — no weigh-in on record." (PATTERN-S5 C7, 13 September 2026) — is gone since the evening of 16 September under the text rule (a definition sentence, category 3, removed from the athlete app) | Current | empty |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A session | The block | Opens it to log | `/gym/[sessionId]` | nothing | no | none assigned |
| Nutrition guidance | A link | Opens guidance | `/programme/nutrition` | nothing | no | UNVERIFIED |

## 7. Offline and sync

Read only. Logging is on the session screen.

## 8. Notifications

**UNVERIFIED: none found for this screen.**

## 9. Permissions

None.

## 10. States

Loading, **no programme assigned**, **a block that finished**, error.

**Dates** (Isabella, 15 September 2026, `docs/decisions/programme-dates.md`;
migration 0132). The assignment carries a start date — week 1 day 1 — and the
end falls out of the programme's length. Under the programme's name the
screen shows "From Mon 14 Sept to Sun 11 Oct" ("Starts …" before the start).
An assignment made before dates existed has none and shows no line rather
than an invented one. **When the weeks run out the assignment is over**, and
the screen says so — a card reading "In-Season max finished on Fri 28 Aug."
above whatever is still live, or with "Nothing new has been assigned yet."
when nothing is — never an empty screen with no explanation. Two live blocks
at once (a rehab block beside a lifting block) both list. Nothing here says a
session is due or was missed: each is its own piece of work.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

- **DECISION 2:** nutrition guidance lives behind a tab called Gym. **Closed 15
  September 2026: the tab is called Programme.**

## 13. Reopening a session the same day (15 September 2026)

A gym session opened today and not finished stays open until it is:
`startOrGetSessionLog` finds today's in-progress log for the programme session and
the logger resumes at the next set (Today's To do carries it as its own row). The
mobile queue's #9 added the way back in from this list: the open session's row
reads **"Under way · 2 of 13 sets · continue"** (accent ink, and the words carry
it), a session finished today reads **"Logged today"**, and tapping either opens
the same log. Finish early closes a log; a closed log takes corrections, not new
sets (migration 0110).
