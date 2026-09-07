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
| MET-031 to MET-035 | Nutrition targets | Read on this screen from `protein_g`, `energy_kcal`, `fluid_ml` | Current | empty |

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

Loading, **no programme assigned**, error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

- **DECISION 2:** nutrition guidance lives behind a tab called Gym.
