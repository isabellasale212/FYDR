# 27. New injury record

## 1. Page name and URL

**New injury record**, at `/injuries/new`.

Records that an athlete has picked something up.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The left column | Create an injury | The clinical column and the availability block | Base | `requireInjuryAccess`, then the form's own split |
| Coach | Yes | The left column, without the site while the club's setting is off (C8) | Create an injury | The clinical column, the availability block, and body area / side unless `coach_sees_injury_site` | Base | Same |
| Medic | Yes | Both columns | Create an injury, set its availability, record diagnosis, mechanism and severity | None | Base | Same; `availability_medical_insert` and `clinical_medical_only` at the database |
| S&C | Yes | The left column | Create an injury | The clinical column and the availability block | Base | Same |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | `requireInjuryAccess` |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Corrected 14 September 2026.** This table used to say the page was medical
only and that a coach could not record an injury. The gate has been
`requireInjuryAccess` (the four injury roles, `INJURY_ACCESS`) since the
five-role model, and the athlete profile offers "+ Log injury" to all four —
the code is the fact. What is medical only is inside the form.

---

**Verified access, from the code (14 September 2026).** `requireInjuryAccess()` in `src/app/(staff)/injuries/new/page.tsx` — the four injury roles; a nutritionist is refused. Above it sits the middleware and beneath it row level security: `injuries_staff_insert` for the record, `availability_medical_insert` and `clinical_medical_only` for the two writes only a medic's form offers.

## 3. How you get here

- The New injury control on the injuries list.
- A direct link, optionally naming the athlete.

---

## 4. What you see

**One form, two columns, split by permission, not by importance** (PATTERN-S3
C9, built 14 September 2026; the board's own grid, `minmax(0, 1fr)` each).

**The left column, what every injury role writes and a coach reads:** which
athlete; when it started; body area and side (absent for a coach while the
club's coach-sees-site setting is off — a coach who cannot read the site is not
asked to write it, and the record carries "other" until medical staff record
where); where it happened; **availability** — three full-width status buttons,
Available / Modified / Unavailable, with the restriction chips and their
"Coach visible. Describe the restriction, not the injury." hint once a status
other than Available is chosen, and "Leave it unset and {athlete}'s current
status stands" — **for medical staff only**, because injury-linked
availability is medical staff's write at the database; every other role reads
a well in its place: "Availability for an injury is set by medical staff from
this record. Until they do, {athlete}'s current status stands."; expected
return, if known.

**The right column, medical staff and the athlete only:** diagnosis,
mechanism, severity, and the well — "Saving works with this column empty: the
record is created and the availability you set lands now. Add the diagnosis on
the record when you have it. Nothing in this column is ever shown to coaching
staff." Absent, not locked, for everyone else.

**On a phone** the columns stack and the left column is the pitch-side form:
the fields at the 44px floor, the three status buttons full-width, the save
button saying what saving does.

**The save button says what it does:** "Log the injury", or "Log the injury and
set Unavailable" when a status is chosen — and a status change names its
audience before it lands (C4), the same step the availability form takes.

---

## 5. Every number on this page

None. This screen records an event.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Athlete chooser | Top | Names who is injured | Stays here | Nothing until submitted | Any staff today | None | Never |
| Body area and side | Middle | Records where | Stays here | Nothing until submitted | Same | None | Never |
| Onset date | Middle | Records when it started | Stays here | Nothing until submitted | Same | None | Never |
| How it happened | Middle | Training, match or elsewhere | Stays here | Nothing until submitted | Same | None | Never |
| Expected return | Lower | Records when they are due back | Stays here | Nothing until submitted | Same | None | Never |
| Availability and restrictions | Left column | Sets the athlete's injury-linked status with the record | Stays here | Nothing until submitted | **Medic** | The audience step before the save | Absent for every other role; restrictions absent until a status other than Available is chosen |
| Diagnosis, mechanism, severity | Right column | Records the clinical start of the record | Stays here | Nothing until submitted | **Medic** | None | Absent for every other role |
| **Log the injury** / **Log the injury and set {status}** | Foot | Writes the injury, then its availability, then its clinical row, in that order | The injury's own page | **Creates one injury record**; with a status, one availability row linked to it; with any clinical field, one `injury_clinical` row | The four injury roles; the second and third writes the medic's | With a status, the audience step ("Confirm and update"); otherwise the form is the confirmation | Disabled while saving, and after a partial save until the record is opened |
| Cancel | Foot | Abandons | Back to the list | Nothing | Same | None | Never |

**Creating an injury does not by itself make the athlete unavailable.** Medical
staff may set the availability with the record from this form; anyone else's
save leaves the athlete's current status standing until medical staff set it on
the record. The two are still separate facts: an athlete can have a recorded
injury and still train.

**A partial save is said, not hidden.** The three writes are sequential; if the
availability or the clinical row fails after the injury row landed, the form
stays with "The injury was recorded, but availability was not set (…). Open the
record to finish it there." — never a navigation away from an error nobody has
read.

---

## 7. How this page is built, in plain English

The page is built on the server, which supplies the roster. The form runs in the
browser and submits to the server.

Two rules the database enforces regardless of the form: the actual return cannot
be before the onset, and the expected return cannot be before the onset
(`supabase/migrations/0005_injuries_and_availability.sql:48`).

---

## 8. States

**Loading.** Renders immediately.

**Saving.** The button is disabled and says so.

**Error.** The form stays, filled in, with a sentence.

**No permission.** Currently any staff member reaches it.

**Wrong tier.** Not applicable.

**Offline.** The connection sentence rather than a hang.

---

## 9. Open issues

- **The board draws availability and restrictions on the coach's pitch-side
  form** ("the four that change what anyone else sees"); the database gives
  injury-linked availability to medical staff alone, so the built form follows
  the rule and the sheet carries the question (PATTERN-S3 C9's row).
