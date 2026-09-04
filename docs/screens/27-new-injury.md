# 27. New injury record

## 1. Page name and URL

**New injury record**, at `/injuries/new`.

Records that an athlete has picked something up.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | **No today.** Yes in the agreed model | Nothing today | Nothing today | The whole page | Base | `src/app/(staff)/injuries/new/page.tsx:13` |
| Coach | **No** | Nothing | Nothing | The whole page | Base | Same line |
| Medic | Yes | The form, limited fields only | Create an injury, then add clinical detail on the record itself | None | Base | Same line |
| S&C | **No** | Nothing | Nothing | The whole page | Base | Same line |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | Already enforced by the same line |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This screen is already medical only**, and is the one injury screen that is.
Anyone else is sent back to the injuries list
(`src/app/(staff)/injuries/new/page.tsx:13`).

**No clinical detail is captured here, by anyone, including a medic.** Creating
the record and recording the diagnosis are two acts, and the second happens on the
record itself where the medical rule applies.

**Under the agreed model the sport scientist should also reach it**, since that
role has everything. Today they cannot.

---

## 3. How you get here

- The New injury control on the injuries list.
- A direct link, optionally naming the athlete.

---

## 4. What you see

**Which athlete.**

**Body area and side.**

**When it started.**

**Where it happened**: in training, in a match, or elsewhere.

**Expected return**, if known. It can be left empty, and often should be.

**Create and Cancel.**

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
| **Create** | Foot | Writes the injury | The injury's own page | **Creates one injury record** | **Medic only today** | The form is the confirmation | Disabled while saving |
| Cancel | Foot | Abandons | Back to the list | Nothing | Same | None | Never |

**Creating an injury does not by itself make the athlete unavailable.** That is a
separate act on the record or the athlete's profile. The two are kept apart on
purpose: an athlete can have a recorded injury and still train.

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

- **The sport scientist cannot reach this screen**, although the agreed model gives
  that role everything. Part of decision D-07.
- **A coach cannot record an injury**, which is already the answer decision D-35
  proposes for the rest of the injury area. The problem reports mechanism is what a
  coach uses instead, and it routes to a medic.
