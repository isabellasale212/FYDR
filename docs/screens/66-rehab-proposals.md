# 66. Rehab proposals

## 1. Page name and URL

**Rehab proposals**, at `/programmes/proposals`.

Every gym block an S&C has proposed against an open injury, with where each
stands — **Proposed**, **Approved**, **Returned** — in one list the S&C and the
medic both read. PATTERN-S3 C6, built 14 September 2026, migration 0124.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| S&C | Yes | Every proposal in the club, its state, who decided and when, and the return reason in full | Nothing here (they propose from the programme's assign screen) | None | Base | `requireStaff()`, then `INJURY_PROGRAMME_PROPOSER` or `CLINICAL_ONLY` at the page; RLS on `programme_assignments` |
| Medic | Yes | The same list | **Approve, or return with a reason** | None | Base | The decide form renders for the medic only; `decide_proposal` refuses everyone else (42501) |
| Sport scientist | **No** — refused with the denied screen | Nothing | Nothing | The whole page | Base | The page's role check, logged through `refuse` |
| Coach | **No** | Nothing | Nothing | The whole page | Base | Same |
| Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** | Nothing. An approved block reaches them as their programme | Nothing | The whole page | n/a | Middleware, then guard, then database |

## 3. How you get here

- **Rehab proposals** in the header of Gym programme (`/programmes`), for the
  S&C and the medic only.
- After deciding, the page returns here with `?p=approved` or `?p=returned`.

## 4. What you see

The eyebrow "Gym programme · Rehab proposals", the title, and one sentence:
gym work proposed by the S&C against an open injury reaches the athlete only
when the physiotherapist approves it; a returned one carries the reason here,
in full, so the next draft answers it.

**The list** (`TableShell`, newest first, count "{n} proposals · {a} proposed,
{b} approved, {c} returned"): one row per proposal — the athlete (linking to
the injury record), the programme, who proposed it and when, the state as a
pill (Proposed ◐ accent, Approved ✓ good, Returned ↩ warn — the three existing
pill families, the board's own words), and the decision: "Waiting on the
physiotherapist", or who decided and when, with **the return reason under it
in full** on a returned row. For the medic a proposed row carries the decide
form in its last cell: **Approve** as the one primary, a reason field, and
**Return with the reason** as the secondary beneath it — the shape of the
row says which decision is routine without disabling the other.

**Approved is the board's word for the row that stores `active`.** Approval
assigns: the same row is the athlete's programme from that moment. A returned
row stays as the record; the S&C answers it by proposing again from the
assign screen, which writes a new row.

**Empty:** "No proposals" with where a proposal comes from.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | {n} proposals · {a} proposed, {b} approved, {c} returned | The list's own counts | All time | "No proposals" |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Approve | A proposed row | The block goes live for the athlete | Stays here, `?p=approved` | `decide_proposal(id, 'approve', '')`: status `active`, `decided_by`, `decided_at`; a `programme_signed_off` timeline event; an audit row `proposal.approved` | **Medic only, enforced by the database** | One press | Absent once decided, and for every other role |
| Return with the reason | A proposed row, under the reason field | The block comes back to the S&C with the reason on the row | Stays here, `?p=returned` | `decide_proposal(id, 'return', reason)`: status `returned`, the reason, who and when; the reason as a medic-only `note` timeline event; an audit row `proposal.returned` | **Medic only** | The reason is required: an empty one is refused with "Not saved: say why it is coming back — the S&C reads the reason here." | Same |
| The athlete's name | Each row | Opens the injury the proposal is against | `/injuries/[injuryId]` | Nothing | As that page | None | Never |

**The same function serves the injury record.** Sign off and Request changes
on `/injuries/[injuryId]` (`docs/screens/26-injury-record.md`) call
`decide_proposal` too, so the two screens cannot disagree about what a
decision is or leave a row half-decided.

## 7. How this page is built, in plain English

`src/app/(staff)/programmes/proposals/page.tsx` reads
`lib/queries/proposals.ts` (`programme_assignments` where `injury_id` is set
and the status is proposed, active or returned, with the programme and the
athlete's name), resolves the proposer's and decider's names from `users`, and
posts decisions to `/programmes/proposals/[assignmentId]/decide`, which calls
the function and redirects back with the outcome word. Nothing on the page
writes to the table directly.

## 8. States

Empty · Proposed rows only · A mix · Just decided (`?p=approved` /
`?p=returned`) · Refused (`?p=reason_required`, `?p=not_a_proposal`,
`?p=refused`, `?p=failed`, each in words) · Denied screen for the other roles.

## 9. Open issues

- The S&C's own edit of a returned draft: 0080's policy lets an S&C update
  their own proposed assignment; a returned one is left as the record and the
  S&C proposes again. If in-place revision is wanted, that is a policy change
  (`programme_assignments_update`) and a spec change here.
