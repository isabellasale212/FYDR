# Privacy and my data

## 1. Where it sits

Reached from Me. Route `/me/privacy`. Route-map screen 43. Built 13 September
2026 (PATTERN-S8 C10): the athlete side of subject access, on the same pattern
as the staff queue at `/settings/subject-access`.

## 2. Who reaches it and when

Every athlete. Usually once — when they want to know what the club holds about
them or how to get a copy — and again while a request for their data is open,
to see where it stands.

## 3. What you see

Three cards, in plain English:

**A copy of your data.** When no request concerns the athlete: "No request for a
copy of your data is open. You are entitled to one at any time — here is how."
When one does (read from their own `sar_requests` rows, migration 0114): one
sentence per request, in the same words the staff queue uses — "A request for a
copy of your data was opened on Sun 13 Sept by Jane Pemberton. It is due by Tue
13 Oct (30 days left). Waiting on the medic to review the clinical notes." or "A
copy of your data was released on Sat 8 Aug, from a request opened on Sat 8 Aug
by Jane Pemberton. Ask the person who opened it if you have not received it."
Then the four steps to ask (`SAR_HOW_TO_ASK`): ask the club in any form; they
open the request, which starts the one-month clock; a medic reviews clinical
notes first, and a note can be withheld only under the serious-harm test; the
sport scientist releases the pack and every release is audited. Then: "UK GDPR
Article 15, the right of access. The club has one month from the day you ask."

**Who sees what.** Five sentences from `docs/athlete/visibility.md`: wellness,
ratings, gym sets and test results are read by coaching, S&C, medical and
nutrition staff; body mass by the S&C coach, the nutritionist and the medic, not
the coach; diagnosis, mechanism and clinical notes by the medic alone; teammates
see a leaderboard name only where the athlete opted in; every medical read,
export and release is audited.

**What the club holds about you.** The pack's own manifest (`SAR_CATEGORIES`,
`src/lib/subjectAccess/manifest.ts`) — the category, where it comes from, and how
long it is kept — so the list the athlete reads is the list the pack is made
from.

## 4. What the athlete enters here

Nothing. The page writes nothing. The athlete asks the club out of band (the
self-export was removed 13 September 2026 by Isabella's decision); the club
opens the request.

## 5. Every number shown

The days left on an open request ("30 days left", "due today", "3 days
overdue"), from `sarDueWords` — the same function the staff queue uses.

## 6. Every thing you can act on

| Element | Where | What happens | Goes to | Writes | Confirmation | Hidden when |
|---|---|---|---|---|---|---|
| ← Me | Top | Back | `/me` | nothing | no | never |

## 7. Offline and sync

A read; renders from the server. Offline, the shell's connection sentence.

## 8. Notifications

None. When a request is released the club hands the pack over; nothing is sent.

## 9. Permissions

`sar_requests_athlete_select` (migration 0114): an athlete reads a request whose
`athlete_id` is their own, in their own org. No insert, no update;
`sar_clinical_reviews` stays closed to them (pgTAP 700).

## 10. States

**No request** — the first card says so and still teaches how to ask. **One or
more requests** — one sentence each, newest first. **Error** — surfaces as an
error.

## 11. Accessibility and device

Three cards, one column, nothing scrolls sideways at 375. Headings are the
cards' labels (`aria-labelledby`). Every number is in a sentence, never a bare
digit.
