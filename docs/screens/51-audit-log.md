# 51. Audit log

## 1. Page name and URL

**Audit log**, at `/settings/audit`.

Who did what, to whose data, and when.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every entry | **Nothing. The log is read only by design** | None | Base | **Currently admin only**, `src/app/(staff)/settings/audit/page.tsx:44`. Decision D-07 |
| Coach, Medic, S&C, Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Nobody can edit or delete an audit entry**, including the sport scientist. A log
that can be edited is not a log.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/audit/page.tsx:43`; a **admin** check at `src/app/(staff)/settings/audit/page.tsx:44`, which redirects. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Audit log link in the Settings administration block.

## 4. What you see

**A refusal is a row** (PATTERN-S6 C7, 13 September 2026, migration 0112). When a
role gate refuses somebody — a report their role cannot open, Analytics on a coach, a
subject-access route — the app writes one `access.denied` row here as the person
refused (entity `route`; the gate, the path and the roles they held in the metadata)
and shows them a reference, "D-" and the row's id in base 36 ("D-1Z9K"), to quote to
an administrator. The row shows the reference and the path in its Entity cell, and the
search box finds a row by the reference. Append-only like every row here.

Entries in time order, each naming the person who acted, their role at the time,
the action, the kind of record, the athlete affected where relevant, and when.

## 5. Every number on this page

None. The log is a record, not a measurement.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Filters | Header | Narrow the entries by action, person or athlete | Stays here | Nothing | Sport scientist | None | Absent for everyone else |
| An athlete's name | An entry | Opens that athlete | `/squad/[athleteId]` | Nothing | Sport scientist | None | Absent |

**Nothing on this page writes anything.**

## 7. How this page is built, in plain English

Built on the server.

**What gets audited.** Reading a clinical record, setting availability, granting a
role, resetting a two factor login, releasing a subject access request, running
retention, and viewing a named athlete report. The common thread is that each is
either a change to what somebody may do, or an act of looking at somebody's
personal data.

**The role is recorded as it was at the time**, not looked up when the log is
read, so a later role change does not rewrite history.

**The log says what it cannot show** (PATTERN-S8 A5, 13 September 2026). The type
chips are whatever the club's log holds, so an absent kind is invisible; under the
table: "Sessions and schedule changes are not written to the log yet, so an empty
filter there does not mean nothing happened." (§0al's audit-trigger batch).

## 8. States

**Empty.** Only possible in a brand new club. **Error.** Surfaces as an error.
**Offline.** Not handled.

## 9. Open issues

- **This belongs to admin today.** Decision D-07. Moving it to the sport
  scientist means the person who does day to day analysis also reads the log of
  who looked at what, including their own entries. That is a consequence of your
  decision rather than an objection to it, recorded here so it is visible.
