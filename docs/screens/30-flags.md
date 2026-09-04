# 30. Flags

## 1. Page name and URL

**Flags**, at `/flags`.

Every automatic alert the club's own rules have raised, and the place they are
acknowledged, noted and dismissed.

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every flag | Acknowledge, note, dismiss | None | Base | Route guard, then a coach or medic check at `src/app/(staff)/flags/page.tsx:33` |
| Coach | Yes | Every flag | Acknowledge, note, dismiss | None | Base | Same |
| Medic | Yes | Every flag, **and medical detail where a flag carries it** | Acknowledge, note, dismiss | None | Base | Same, plus a medical check at `:122` |
| S&C | Yes | Every flag | Acknowledge, note, dismiss | Medical detail | Base | **NOT BUILT** |
| Nutritionist | Yes | Flags **except** those whose domain is injury or availability | Acknowledge, note, dismiss the rest | Injury and availability flags entirely | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**A staff member who is neither coach nor medic already sees a named refusal**
here, unlike most screens. This is one of the few places a role check exists
beyond the staff guard.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/flags/page.tsx:21`; a **coach or medical** check at `src/app/(staff)/flags/page.tsx:33`, which renders a named refusal rather than redirecting. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The **Need you** and **Open flags** tiles on the dashboard.
- The **Flags affecting selection** row on the dashboard's readiness card.
- A direct link, optionally carrying a date.

**Not in the sidebar**, deliberately: the previous specification records that
Flags has no sidebar row and is reached from the dashboard.

## 4. What you see

A header with the group filter and the date. Then flag cards, grouped by state,
each naming the athlete, what was observed against what was expected, and when it
was raised.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| MET-016 | The open count | Unresolved alerts | Now | Zero is a good outcome |
| MET-001 | Readiness, on a wellness flag | How ready the athlete said they felt | The day | Blank |
| MET-003 | Sleep hours, on a sleep flag | Hours slept | The day | Blank |
| MET-010 | The ratio, on a load flag | This week against a typical week | 7 over 28 days | Withheld below 21 days with data |

**The observed against expected sentence is the point of a flag card.** A number
on its own does not tell a coach whether to act; the same number against that
athlete's own norm does.

**A flag is escalated after 24 hours unacknowledged.** Nothing explains why 24.
Decision D-12.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Group filter chips | Header | Narrows to a group | Stays here | Nothing | Coach or medic | None | Never |
| Date | Header | Changes the day | Stays here, date in the address | Nothing | Same | None | Never |
| **Acknowledge** | A flag card | Marks it seen. The card moves immediately, before the server has replied | Stays here | Sets the flag acknowledged, with a note if one was written | Coach or medic | **None. Instant and optimistic** | Hidden once acknowledged |
| **Add a note** | A flag card | Records a note **without** acknowledging | Stays here | Writes a note against the flag | Coach or medic | None | Never |
| **Dismiss** | A flag card | Closes the flag | Stays here | Sets the flag dismissed | Coach or medic | Yes | Hidden once closed |
| An athlete's name | A flag card | Opens that athlete | `/squad/[athleteId]` | Nothing | Same | None | Never |

**Why noting and acknowledging are separate.** A coach may want to record what
they think about a flag they are not ready to close. Before the standalone note
existed, the only way to write one was to acknowledge at the same time, which
forced two decisions into one button
(`src/components/FlagCard/FlagCard.tsx:78`).

**Acknowledging is optimistic**: the card moves at once and the write follows. If
the write fails the card returns and says so.

## 7. How this page is built, in plain English

Built on the server, then handed to the browser so the cards can respond
immediately.

Flags come from the club's own thresholds table, not from constants in the app.
Any statement of the form "a flag is raised above X" must read X from that table.

## 8. States

**No flags.** Says so, as a good outcome. **Filtered to nothing.** Says which
group scope produced it. **Error.** Surfaces as an error. **A failed acknowledge**
returns the card rather than silently losing it. **No permission.** A named
refusal. **Wrong tier.** Not applicable. **Offline.** Acknowledging offline fails
with the connection sentence rather than appearing to succeed.

## 9. Open issues

- **The nutritionist should not see injury or availability flags.** Decision D-01.
- **The 24 hour escalation is unexplained and not club configurable.** Decision
  D-12.
- **UNVERIFIED: whether a dismissed flag can be reopened**, and by whom. Files
  searched: `src/lib/queries/flags.ts`, `src/components/FlagCard/FlagCard.tsx`.
