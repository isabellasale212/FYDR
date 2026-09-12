# Persona review — ATH-ADULT-13, Open one gym session from history

**Persona.** An athlete checking what they actually lifted last Thursday.

**Reviewed 2026-09-10** at **375×812** as a real athlete (Conor Moroney) on a
**completed** session, `2b4c7071…`, Thu 13 Aug.

---

## The measured screen

| Element | Detail |
|---|---|
| `h1` | **"Thu 13 Aug"** — the date is the heading |
| Summary line | "6 sets logged · session RPE 5.8 · 4050 kg total" |
| Section | "Sets", with a `visually-hidden` caption "Sets logged in this session" |
| Table | `# / EXERCISE / REPS / LOAD / ACTIONS`, six rows |
| Per row | a **"Correct"** button |
| Navigation | a **"Back"** button *and* a **"Back to gym history"** link (→ `/my-data?tab=gym`) |

**Page 909px** on an 812 viewport — just over one screen.

---

## The findings

### 1. Two back affordances, undocumented

The screen carries both the shared `BackButton` and a "Back to gym history"
link. They are not redundant in principle — browser-history back versus a fixed
destination — but they are adjacent, similarly worded, and only one states where
it goes. The walkthrough listed only the link. **Corrected.**

### 2. Correction is available on a finished session — and this is what makes
the no-reopen decision work

Six set rows, six "Correct" buttons, on a session whose `status` is `complete`.
`revise_gym_set_log` has no session-status guard; `revise_gym_session_log`
directly beneath it is explicitly "a COMPLETE session only". So a finished
session is fully correctable at set level without ever being reopened.
**Recorded as a deliberate boundary**, and now documented.

### 3. The summary line is the best thing on the screen

"6 sets logged · session RPE 5.8 · 4050 kg total" answers the question that
brought the athlete here before they read the table.

---

## 1–5, briefly

**Taps:** one to arrive, one per correction. Nothing redundant.

**Copy:** the date as `h1` is right — it is what the athlete is looking for. A
real `<caption>` for the table, visually hidden, is better than most of the app.

**Mistakes:** nothing destructive; corrections are revisions (ATH-ADULT-11).

**Inference:** volume is computed rather than asked for.

**Clarity:** a correction updates the row in place with no acknowledgement, and
— per **§0v** — nothing marks the session or the day as corrected afterwards.

---

## Summary for design

1. **Two back affordances**, adjacent and similarly worded.
2. **A correction leaves no visible trace** on this screen (**§0v**).
3. Right and worth keeping: the date as heading, the summary line, the hidden
   table caption, and correction remaining available after completion.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Session date as heading | **Correct** — "Thu 13 Aug" |
| "Sets" section | **Correct** |
| "Back to gym history" → `/my-data?tab=gym` | **Correct** |
| "Correct" button per set row | **Correct** — six of six, on a complete session |
| Stays on `/my-data/gym/{id}` | **Correct** |
| — | **Undocumented:** a second "Back" button, and the summary line. **Corrected.** |
