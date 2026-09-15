# Programme

## 1. Where it sits

Tab 3 of 4, **labelled Gym in the tab bar**. Route `/programme`. File 210 lines.

## 2. Who reaches it and when

Any athlete with a programme assigned.

## 3. What you see

The assigned programme, its blocks, and the sessions within them. Nutrition
guidance is reached from here.

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
| MET-031 to MET-035 | Nutrition targets | Read on this screen from `protein_g`, `energy_kcal`, `fluid_ml`; under them a provenance line — "The club default target, the same for everyone on it." / "Your group's target." / "Set for you." — with "Not scaled to your weight — no weigh-in on record." when there is none (PATTERN-S5 C7, Isabella, 13 September 2026) | Current | empty |

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

- **DECISION 2:** nutrition guidance lives behind a tab called Gym.
