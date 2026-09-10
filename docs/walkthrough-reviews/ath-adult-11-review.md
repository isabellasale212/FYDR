# Persona review — ATH-ADULT-11, Correct a logged gym set

**Persona.** An athlete who tapped set 2 when they meant set 1, or logged 8 reps
when they managed 5 — either mid-session, or days later looking back.

**Reviewed 2026-09-10** at **375×812** as a real athlete (Conor Moroney), both
entry points, with **one real correction performed on scratch** to verify the
end state: session `2b4c7071…` of Thu 13 Aug, Bench press set 1, reps 4 → 5.

---

## What was verified

**In the logger.** Pressing a logged set opens an inline panel headed
**"Correcting set 1"** with two number inputs — accessible names **"Reps"** (8)
and **"Load (kg)"** (100), both correctly associated by wrapping `<label>` —
plus **"Save correction"** and **"Cancel"**.

**In history.** `/my-data/gym/{id}` gives a "Correct" button per set row, opening
fields with `aria-label="Set 1 corrected reps"` and
**`"Set 1 corrected load in kg"`** (the load label was not previously recorded),
with "Save" and "Cancel".

**The write is exactly right.** After saving: the original row survives at reps 4
with `superseded_by` set; a live revision holds reps 5 with `revision_of` set;
and `audit_log` carries `gym_set_logs.correction` with
`old: {reps_completed: 4}`, `new: {reps_completed: 5}`,
`changed: ["reps_completed"]`.

**A COMPLETE session still offers correction.** Measured on a session with
`status = 'complete'`: six set rows, six "Correct" buttons. `revise_gym_set_log`
carries no session-status guard — deliberately, since
`revise_gym_session_log` directly beneath it is explicitly "a COMPLETE session
only". This is what makes the no-reopen decision workable.

---

## The finding: the panel promises something My data does not do

The panel says: *"The original is kept. My data marks the day corrected and
shows what you first reported."*

The first clause is true. The other two are not — verified after a real
correction: **no "Corrected" marker on `/my-data?tab=gym` at any period, none on
`/my-data/gym/{id}`, and the original value 4 appears nowhere in the UI.** The
set row shows 5 and nothing else.

This is the one screen whose entire job is to reassure an athlete that
correcting a number is not the same as hiding it — and it makes a specific,
checkable promise it does not keep. Filed as **§0v**, with the decision it needs:
surface the superseded value (a display change; the data is there and correct),
or reduce the copy to what actually happens.

---

## 1. How many taps, and is any step redundant?

**Three taps in the logger** — the set, the field, Save — and the previous
values arrive pre-filled, so an athlete changing one number touches one field.
Nothing redundant.

**Two entry points to one RPC** is right: mid-session and days later are
genuinely different moments, and both reach `revise_gym_set_log`.

## 2. Does any label or copy not match how this person thinks?

**"Correcting set 1" is the right heading** — it names the thing being changed,
so the panel cannot be mistaken for logging a new set.

**"Save correction" over "Save"** in the logger is a good distinction, and the
history form's plainer "Save" is defensible in a table of rows.

**The explanatory line is the problem** (above), not because it is badly written
but because it is not true.

## 3. Where is a mistake most likely, and can it be undone?

**A correction can itself be corrected** — the chain stays linear, and only the
current revision is revisable (`entry_not_revisable` otherwise). Pre-filled
values mean the likely error is a typo in a field the athlete did not intend to
touch, and the load and reps sit adjacent with no confirmation.

**Blank is "unchanged", not zero.** The form validates rather than coercing,
which is the right call — an athlete clearing a field to retype it never
silently writes a zero.

## 4. Anything they must read that the screen could infer?

No. It infers both current values.

## 5. Is there a moment where it's unclear whether something worked?

**In the history table, briefly yes.** The row updates in place with no
confirmation beyond the number changing — I first read the table as stale
because I checked it mid-refresh. An athlete correcting 4 to 5 sees a 4 become
a 5 and nothing else; there is no "saved" acknowledgement, and — because of
§0v — no "corrected" marker to confirm the app registered it as a correction
rather than an edit.

---

## Summary for design

1. **The panel's promise is not kept** — no corrected marker, no original shown.
   **§0v**, needs a decision between surfacing and rewording.
2. **A correction has no acknowledgement** beyond the number changing.
3. Right and worth keeping: pre-filled values, "Correcting set {n}" as the
   heading, blank meaning unchanged rather than zero, correction available on
   finished sessions, and a correct revision chain with a full audit row.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Panel headed "Correcting set {n}" | **Correct** |
| "Reps" and "Load (kg)" fields | **Correct**, both properly labelled |
| "Save correction" and "Cancel" | **Correct** |
| History fields `aria-label="Set {n} corrected reps"` | **Correct**; load is "Set {n} corrected load in kg" |
| Blank means unchanged, not zero | **Correct** — form validates |
| Revision written, original kept and superseded | **Correct**, verified in the database |
| Audit row with old and new values | **Correct** — `gym_set_logs.correction`, not `entry_revision.created` |
| **"My data marks that day corrected and shows what was first reported"** | **Wrong.** Neither happens for gym sets. **§0v** |
| Already-superseded sets refuse | **Not verified** — needs a second correction against a stale row |
