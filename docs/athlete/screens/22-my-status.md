# 22. My status

**PATTERN-S3 C2, built 14 September 2026** against
`docs/designs/PATTERN-S3-final/` (the notes beat the prompt; the Step 1
answers are in `docs/overnight-records-2026-09-13.md`). The screen the told
card on Today (C1) opens, and the only place an athlete reads their own
return-to-play stage (C3).

## 1. Where it sits

`/me/status`, under Me. Not a tab. Two doors: **See what it means** on the
"Your status changed" card at the top of Today while a staff-set row is unread
(`01-today.md` §3, item 3a), and the standing **My status** row on Me
(`12-me.md`). The availability card on Today also ends in **What this means
for you ›** whenever the athlete is not fully available.

## 2. Who reaches it and when

Any signed-in athlete, any time — from Me, from the "Your status changed"
card, and since 16 September 2026 from Today's availability line ("Modified ·
…"), which is the one availability control Today keeps: the availability card
and the diagnosis card left Today for this screen that day (Isabella's
overnight queue, 1.1). **Opening it is the one act the screen performs**: if the availability row in force has not been read
(`availability.athlete_seen_at` is null) the page calls
`mark_availability_seen()` (migration 0122; the athlete's own open row, once,
idempotent) and the told card on Today goes and does not return for that row.
The read requires nothing of the athlete beyond arriving.

## 3. What you see

Three cards in the order the questions are asked, answers as sentences, no
pills and no judgement words (`lib/statusScreen.ts` holds every sentence):

1. **Can I train today?** — "Yes." / "Yes, with limits." / "Not today." /
   "Not known yet." with one line under it: "Nothing is restricting you.",
   "What you can and cannot do is listed below.", "You are unavailable
   because of {an injury / illness / a personal reason / …}" (the reason
   category in words, never a diagnosis), or "The club has not set your
   availability. Until they do, nothing is restricting you." Then the
   owner line: "{Status} · set by {name}, {role} · {when}" and the staff note
   in quotes if one was written.
2. **What can I do and not do** — the restrictions as rows, one each, 44px,
   after `lib/restrictions.ts` has stripped any protocol, stage or diagnosis
   word (D1 holds here as everywhere). When no restriction is recorded but
   the club wrote a note (the coach-visible one, "describe the restriction,
   not the injury"), the note is the row. Sentences instead of rows when there
   is neither: "Everything. No restriction is recorded.", "Nothing with the
   squad while you are unavailable.", "No restriction is recorded.", or
   "Not known yet."
3. **When am I back** — "Expected back {date}." with "The medic updates this
   as you go. It is an expectation, not a promise."; "The expected date has
   passed." with the date and "The medic has not set a new one yet."; "No
   date yet." with "The medic has not set an expected return."; "You are
   back." with "Cleared on {date}." after an injury has closed with an actual
   return and the athlete is available; or "You are not away." Under it, the
   **academy slot** — a place, not a policy: "If the club sets different
   return rules for academy athletes, they appear here. None are recorded."
   No club setting for academy return rules exists; the line makes no claim
   about age and states no rule.

Then, only when the medic has opened a protocol against the linked injury
(`injury_protocols`, migration 0123): **Return to play** — "{n} stages in the
club's protocol. The criteria for each live in the protocol; the
physiotherapist moves you on." and the ladder, one 44px rung per stage,
numbered and carrying a state word — **Done**, **Now**, **Next**, **Later** —
never a name (the club's protocol document holds the names and the criteria;
the product does not restate them). After the injury has closed every rung
reads **Cleared**. No protocol, no card.

Then, only while an injury is linked to the row in force: **For you and your
medical team** — the body area and side (the athlete always reads their own,
whatever the club's coach setting), the recovery stage word, "Since {date}.",
and the diagnosis and mechanism through `InjuryClinical` when recorded and
the athlete is 18 or over (migration 0093's age gate holds; under 18 the block
says only that no diagnosis or mechanism has been recorded for them to read).

Missing values are words on every card — "Not known yet.", "No date yet.",
"No restriction is recorded." — never a blank or a zero. One emphasised card
per screen: none here; the emphasis is the told card's, on Today.

## 4. What the athlete enters here

Nothing. There is no form and no control other than the layout's Back, the
"← Me" line and the links in the text.

## 5. Every number shown

| Metric ID | Label | Source | Window | When missing |
|---|---|---|---|---|
| MET-013 | The status word in the owner line | `availability.status`, the row in force | Now | "Not known yet." |
| None | Expected back {date} | `injuries.expected_return` through `injuries_staff` | Now | "No date yet." |
| None | Stage {n} of {total} | `injury_protocols.current_stage`, `.total_stages` | Now | The card is absent |
| None | Cleared on {date} | The most recent closed injury's `actual_return` | Now | "You are not away." |

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Back | Under the title (the layout's one back control, 15 September 2026, mobile queue #3 — the page's own "← Me" is gone) | The previous page | history | nothing | no | when there is no previous page |

Arriving marks the row seen (§2). That is the screen's only write.

## 7. Offline and sync

Server-rendered on each open. Offline, the shell's last render stands; the
seen mark is not queued (a read receipt that arrives late is still true).

## 8. Notifications

None from this screen. The told card on Today is the notification (C1);
push for a status change is PATTERN-S11's.

## 9. Permissions

The athlete's own rows only: `availability_self_select`,
`injuries_self_select` (through `injuries_staff`, which returns the
athlete's own body area and side unmasked), `injury_protocols_self_select`,
`injury_stage_events_self_select`, `injury_clinical_athlete_view` (age-gated).
`mark_availability_seen` is SECURITY DEFINER and touches only
`auth_athlete_id()`'s open row. Nothing here reaches a coach: the stage is
read by the medic on the injury record and by the athlete here, nowhere else.

## 10. States

Nothing set (no availability row) · Available · Modified with rows · Modified
without rows · Unavailable with a reason · Unavailable without a reason ·
Expected return ahead · Expected return passed · No date · Cleared after an
injury · Protocol open at stage n · Protocol with the injury closed (Cleared)
· Linked injury with clinical detail · Linked injury, under 18 · No linked
injury.

## 11. Accessibility and device

Every card is a labelled `section`; the rows and rungs are 44px; the ladder's
state words are text, the number's fill is redundant; no colour carries
meaning alone. Phone width first; the staff shell never renders it.

## 12. Open issues

- Stage names and criteria: the board assumed a bare counter and that is
  what 0123 stores. If a club wants named stages, that is a schema decision
  (`docs/decisions-required.md`).
- Academy return rules: no setting exists; the slot states that. Open
  question 9 on the board.
