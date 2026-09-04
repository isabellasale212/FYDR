# 26. Injury record

## 1. Page name and URL

**Injury**, at `/injuries/[injuryId]`.

One injury. **This is the screen where the medical boundary is most visible**: a
coach and a medic open the same address and see materially different pages.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Body area, side, onset, status, expected return, actual return, how it happened, and availability | Nothing on the clinical record | **Diagnosis, mechanism, severity, tissue type, imaging, referral, clinical notes, treatment plan** | Base | Route guard, then the database refuses the clinical table |
| Coach | Yes | Same | Nothing | The same eight | Base | Same |
| Medic | Yes | All of the above **and the full clinical record** | Create and edit the clinical record. Set availability. **Cannot delete the injury** | None | Base | The clinical form appears only for a medic, and the database allows only a medic |
| S&C | Yes | Same as coach | Nothing | The same eight | Base | **NOT BUILT** |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing here. An athlete sees their own injury minus the clinical notes, in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**An injury is never deleted.** It is closed. Deletion exists only for the audited
erasure process, which is not a physio action
(`supabase/migrations/0005_injuries_and_availability.sql:43`).

---

## 3. How you get here

- An injury row on the injuries list.
- An injury named on the injury and availability report.
- An athlete's profile, where their injury is linked.

---

## 4. What you see

**Everyone sees**: the athlete, the body area and side, when it started, the
status, the expected return date, and how it happened.

**Everyone sees the availability control**, because deciding whether someone can
train is a separate act from recording what is wrong with them.

**Only a medic sees the clinical record**: diagnosis, mechanism, severity, tissue
type, imaging, referral, clinical notes and treatment plan, with a form to record
them.

**A coach is not told that a clinical record exists.** Its absence is silent,
which is correct: telling a coach "there is a diagnosis you cannot see" is itself
a disclosure.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| None | Days since onset | How long this has been going on | Since the onset date | Cannot be blank: onset is required |
| None | Days to expected return | How long until they are due back | To the expected date | Blank where no date has been set, which is an ordinary state early on |
| MET-013 | Availability | Whether they can train and play | Now | Unknown |

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Set availability | Availability card | Records a new status with reason and restrictions | Stays here | A new availability record; the previous one is closed | Medic, and coach today | Form submission | Should be limited under the agreed model |
| Record clinical detail | Clinical card | Creates or updates the clinical record | Stays here | Writes to the clinical table | **Medic only, enforced by the database** | Form submission | **The whole card is absent for anyone else** |
| Close the injury | Status control | Marks it closed with an actual return date | Stays here | Updates the injury | Medic, and coach today | Form submission | Hidden once closed |
| Injuries breadcrumb | Header | Back to the list | `/injuries` | Nothing | Any staff today | None | Never |

**There is no delete.** By design.

---

## 7. How this page is built, in plain English

Built on the server.

**The clinical record is requested only when the reader is a medic.** If a coach's
page asked for it anyway the database would return nothing rather than an error,
and an empty clinical panel would render, which looks like a broken page even
though nothing crossed the boundary. So the check happens before the request
(`src/lib/queries/injuries.ts:195`).

The protection that actually matters is the database rule, which allows the
medical role and nobody else, for reading and writing alike
(`supabase/migrations/0012_rls_policies.sql:696`).

---

## 8. States

**Loading.** Renders when ready.

**Not found.** The not found page.

**No clinical record yet.** For a medic, an empty form to fill in. For everyone
else, nothing at all.

**Closed.** Shown with its actual return date, still readable.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected. **The nutritionist should be refused
and currently is not.**

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **No role gate.** Decision D-01.
- **Coaches can currently set availability and close an injury.** Whether the
  agreed model intends that, or whether availability is a medical decision only,
  is **decision D-35**. The seed data describes the physio as "the only person who
  can set availability or read clinical notes"
  (`supabase/seed.sql:90`), which the code does not enforce.
