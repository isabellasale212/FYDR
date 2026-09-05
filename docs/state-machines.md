# State machines

Every record in Fydr that moves through a set of named states, what those states
are, and which moves are allowed.

**Why this exists.** Before it, the transitions were described in whichever screen
happened to perform them, and nothing said what the full set was. Writing the
screen specifications without it produced two mistakes: a fixture was described as
deletable when the action does not exist, and an injury as deletable when it can
only be closed.

**Read this before adding a status to any screen**, and before writing a
specification that says a record "moves to" anything.

**Jargon, expanded once.** An *enum* is a fixed list of allowed values held in the
database: a column of that type can hold nothing else. A *transition* is a move
from one value to another. *Unreachable* means a value exists in the list and no
screen in the app can produce it.

---

## The finding that came out of writing this

**Fydr has 15 state machines and four of their states cannot be reached from any
screen.** Two flag states and two user states exist in the database and nothing in
the interface produces them. In the user case this is deliberate and documented;
in the flag case it appears not to be.

A state nobody can reach is not harmless. It appears in filters, it appears in
exports, and anyone reading the schema reasonably assumes the app uses it.

---

## 1. Injury status

**Values.** `open`, `rehab`, `return_to_play`, `closed`
(`supabase/migrations/0001_extensions_and_enums.sql:157`).

**Transitions: any to any.** The medical form offers all four as a plain dropdown
with no ordering enforced anywhere
(`src/components/InjuryMedicalForm/InjuryMedicalForm.tsx:22`). An injury can go
from open straight to closed, or from closed back to open.

**Whether that is right is a product question**, not a defect. Injuries do
relapse, and a physio correcting a mis-set status should not have to walk it
through two intermediate states. It is recorded here so the freedom is a decision
rather than an accident.

**There is no delete.** An injury is closed, never removed. Deletion exists only
for the audited erasure process, which is not a physio action
(`supabase/migrations/0005_injuries_and_availability.sql:43`).

**Two dates are constrained by the database regardless of status.** The actual
return cannot precede the onset, and neither can the expected return
(`supabase/migrations/0005_injuries_and_availability.sql:48`).

**Who may change it.** Medic, and today also coach. Whether that is right is
decision D-35.

---

## 2. Availability status

**Values.** `available`, `modified`, `unavailable`
(`supabase/migrations/0001_extensions_and_enums.sql:163`).

**Plus a fourth condition that is not a state.** An athlete with **no availability
record at all** reads as **unknown** (`src/lib/queries/availability.ts:151`).
Unknown is the absence of a row, not a value in the list.

**This distinction is load bearing and easy to lose.** Unknown means nobody has
assessed this athlete, which is an action for somebody. Available means somebody
has, and they are fit. A screen that folds unknown into available is telling a
coach the squad has been assessed when it has not. The injury report gets this
right and counts unknown separately; the dashboard's availability split leaves
unknown out of all three counts, which is also correct but for a different
reason.

**Transitions: any to any**, and they are not edits. Setting availability
**closes the current record and opens a new one**, so an athlete has a history
rather than a current value. Nothing is overwritten.

**Who may change it.** Coach, medic and sport scientist today. The seed data
describes the physio as "the only person who can set availability"
(`supabase/seed.sql:90`), which the code does not enforce. Decision D-35.

---

## 3. Fixture status

**Values.** `scheduled`, `played`, `postponed`, `cancelled`
(`supabase/migrations/0001_extensions_and_enums.sql:107`).

**Transitions.** The screen offers three moves from wherever a fixture currently
sits: postpone, cancel, and mark as played
(`src/components/FixtureActions/FixtureActions.tsx:14`).

**There is no delete, deliberately.** A fixture anchors the matchday label on
every session around it. Deleting one either takes the week's training with it or
leaves a week labelled against a match that no longer exists, and no rule was
agreed for which, so the action was left out rather than guessed at
(`src/components/FixtureActions/FixtureActions.tsx:20`).

**The consequence a coach will meet.** A fixture entered on the wrong date cannot
be removed, only cancelled, and a cancelled fixture stays on the schedule.
Decision D-29.

---

## 4. Session status

**Values.** `planned`, `completed`, `cancelled`
(`supabase/migrations/0001_extensions_and_enums.sql:113`).

**Cancel and reinstate are symmetric and immediate.** Cancelling fires straight
away with no confirmation, because it is reversible
(`src/components/SessionActions/SessionActions.tsx:17`).

**Delete is a different act and is refused in two cases**, each with its own
sentence:

- *This session has recorded data. Cancel it instead.* Deleting would take
  submitted ratings and attendance with it
  (`src/lib/queries/schedule.ts:1294`).
- *This session is in the past. Cancel it instead of deleting it.* A week that
  happened is a record, not a plan (`:1297`).

**Four further tables also block a delete, and their refusal has no wording.** GPS
records, injuries, test results and compliance expectations all reference a
session without cascading, so the database refuses. Nothing translates that into
a sentence, so the coach sees a generic error. Decision D-27.

---

## 5. Flag status

**Values. Seven of them:** `raised`, `notified`, `acknowledged`, `actioned`,
`monitoring`, `resolved`, `dismissed`
(`supabase/migrations/0001_extensions_and_enums.sql:190`).

**Only four count as open**: raised, notified, acknowledged and monitoring
(`src/lib/queries/flags.ts:102`). Every "open flags" figure in the app counts
those four.

**Two of the seven are unreachable.** Neither `actioned` nor `resolved` appears
anywhere in the application source. The flag card offers exactly two actions,
acknowledge and dismiss (`src/components/FlagCard/FlagCard.tsx:45`), and there is
no other path.

**This matters more than it sounds.** `resolved` is the word a coach would expect
for "dealt with", and it is the one they cannot produce. Dismissing is what they
get instead, which reads as "this was not worth acting on" rather than "this was
acted on". **Decision D-44.**

**Escalation is not a state.** A flag is escalated when 24 hours have passed since
it was raised without acknowledgement (`src/lib/queries/flags.ts:108`). It is
computed, not stored, so nothing has to move it back.

---

## 6. Team allocation status

**Values.** `draft`, `published`, `withdrawn`
(`supabase/migrations/0001_extensions_and_enums.sql:120`).

**Publishing is the consequential move.** It discloses a whole week's selection to
every athlete at once. Withdrawn exists, so a publication can be retracted, but
**the athletes have already seen it**: withdrawing removes the record, not the
knowledge.

**The only warning is the draft count in the button's own label**
(`src/components/PublishWeekButton/PublishWeekButton.tsx:33`). Decision D-36.

---

## 7. Subject access request status

**Values.** `pending_review`, `reviewed`, `released`. Held as a constrained text
column rather than an enum
(`supabase/migrations/0032_subject_access_pack.sql:57`).

**The order is enforced by the process, not by the column.** A request cannot
sensibly be released before a medic has reviewed the clinical part, which is why
two roles are involved: the sport scientist administers, the medic reviews.

**Released is terminal in the way that matters.** The data has left.

---

## 8. User status

**Values.** `invited`, `active`, `suspended`, `deactivated`
(`supabase/migrations/0001_extensions_and_enums.sql:73`).

**Two of the four are unreachable, and the code says so plainly.** Only `active`
and `deactivated` can be written (`src/lib/queries/userManagement.ts:218`).
`invited` needs "a real acceptance flow" that does not exist, and `suspended` is
not reachable either (`src/lib/status.ts:56`).

**An account created through the app starts life `active`, not `invited`**
(`src/lib/queries/userManagement.ts:31`), which is consistent with bulk invite
marking email addresses confirmed at creation and handing out a temporary
password.

**This is a documented cut rather than an oversight**, and it connects to
decision D-38: if invitations become links the athlete acts on, `invited` becomes
the state they sit in until they do, and the acceptance flow is what makes it
reachable.

**Deactivating a user disables role editing** rather than removing their roles
(`src/components/UserDetailPanel/UserDetailPanel.tsx:182`), so reactivating
restores exactly what they had.

---

## 9. Athlete status

**Values.** `active`, `injured_long_term`, `left_club`
(`supabase/migrations/0001_extensions_and_enums.sql:81`).

**The roster excludes `left_club` and soft deleted athletes**
(`src/lib/queries/squad.ts:96`), so a departed player disappears from every
multi-athlete screen without their records being destroyed.

**`injured_long_term` is separate from availability** and does not replace it. An
athlete can be long term injured and still have an availability record saying
modified. **UNVERIFIED: which screens read this status rather than availability.**
Files searched: `src/lib/queries/squad.ts`, `src/lib/queries/availability.ts`.

---

## 10. Attendance status

**Values.** `full`, `modified`, `absent`, `excused`
(`supabase/migrations/0001_extensions_and_enums.sql:115`).

**Only `full` and `modified` count as attended**
(`supabase/migrations/0016_leaderboards.sql:397`). An athlete who trained with a
restriction counts as present; one who was excused does not.

**`excused` and `absent` are counted the same way by every figure in the app**,
which loses the distinction the enum draws. Whether a coach wants excused absences
separated in compliance is worth asking. **UNVERIFIED whether any screen
distinguishes them.**

---

## 11. Programme statuses

Three related machines, all in `supabase/migrations/0021_programmes.sql`.

**Programme status** (`:65`). `draft`, `active`, `archived`.

**Assignment status** (`:67`). `active`, `suspended`, `completed`, `cancelled`.
This is one athlete's relationship to one programme, and several may exist. The
athlete's gym screen shows the active one, most recently started first.

**Gym log status** (`:68`). `in_progress`, `complete`, `abandoned`. An
`in_progress` log is a session an athlete started and has not finished, which is
an ordinary state rather than an error.

**Programmes are not versioned and change history is deliberately not recorded**
(`src/lib/queries/programmes.ts:22`). Editing an active programme changes it for
every assigned athlete at once. Decision D-37.

---

## 12. Problem report status

**Values.** `open`, `acknowledged`, `closed`
(`supabase/migrations/0040_problem_reports.sql:58`).

**This is the queue only a medic can work**, and nothing in the sidebar links to
it. Decision D-34.

An open problem report is an athlete saying something is wrong that nobody has yet
turned into an injury record or dismissed. **It is the one queue in Fydr where
`open` means somebody is waiting.**

---

## 13. Three enums that are classifications, not states

Listed so nobody writes transition logic for them.

**Injury severity** (`minor`, `moderate`, `severe`) is a medical judgement
recorded on the clinical record, visible to medics only.

**Fixture importance** (`friendly`, `normal`, `key`, `cup_final`) weights a match
in load planning and is set when the fixture is created.

**Occurrence context** (`training`, `match`, `gym`, `other`, `unknown`) records
where an injury happened. `unknown` is a legitimate answer, not a missing one.

---

## What to check before adding a status to a screen

Four questions, each of which caught a real error while this was written:

1. **Does the action exist?** Fixtures have no delete. Injuries have no delete.
2. **Is the target state reachable?** Two flag states and two user states are not.
3. **Does the database allow the transition, or will it refuse?** Four tables
   block a session delete with no useful message.
4. **Is this a state or a classification?** Severity, importance and context never
   move.

---

## Open items

- **Decision D-44**, new: two flag states are unreachable, including the one a
  coach would most expect.
- **UNVERIFIED:** which screens read `athlete_status` rather than availability.
- **UNVERIFIED:** whether any screen distinguishes `absent` from `excused`.
