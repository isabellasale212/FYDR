# 57. Group

## 1. Page name and URL

**Group**, at `/settings/groups/[groupId]`.

One group: its name and its members.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The group | Rename, add and remove members, delete | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | The group | Rename, add and remove members, delete | None | Base | Same |
| Medic, S&C, Nutritionist | Yes | The group | **View only** in the agreed model | None | Base | **NOT BUILT** |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/groups/[groupId]/page.tsx:23`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A group's name in the groups list.

## 4. What you see

The group's name and its members, with controls to change both.

**Since 13 September 2026 (PATTERN-S8 C5) a rename and an archive say what
they touch before the button.** The page reads, once, everything that
references the group now (`fetchGroupUsage`: live members, upcoming and past
sessions through their participant rows, active programme assignments, live
nutrition targets and rules, live leaderboards, active thresholds) and hands
it to both controls:

- **Rename** (the Edit popover in the header): once the typed name differs, a
  line above Save changes reads "Forwards is in use. Renaming it changes the
  name on 2 upcoming sessions, 2 active programme assignments, 1 nutrition
  target and 1 nutrition rule and 43 past sessions, the schedule and the
  filter — everywhere it appears, including in the past. Nothing else changes:
  who is in it, what they are expected at and what they are prescribed all
  stay." A group nothing uses reads "Nothing uses X yet, so the new name
  appears only in the group filter and on its members."
- **Archive this group** is a card at the foot of the page (no longer a bare
  button in the header). It states, in order: what stops — "removes it from
  the group filter, from every picker and from the groups list. Anyone
  filtering by it sees Whole squad and is told why. Its 15 members stay in the
  squad; nothing about them is deleted."; **what keeps running**, because
  membership rows are untouched and sessions, programme assignments and group
  nutrition targets resolve through them — "2 upcoming sessions still expect
  its members. Expectations follow membership, and archiving does not remove
  anyone from the group.", "2 active programme assignments keep running for
  its members until it ends or is ended.", "1 nutrition target keeps applying
  to its members." (or "Nothing is scheduled, prescribed or targeted through
  it today."); and the way back — "43 past sessions keep the group in their
  record. Restore brings the group back exactly as it was." Pressing
  **Archive** arms the card (warn wash) and swaps the button for **Archive
  Forwards** and **Keep it**; nothing is written before the second press.
  An archived group shows the Archived card with **Restore Forwards**.
- **A rehab group is not archived here.** Its Archive is a `BlockedButton`
  that says on tap: "Rehab groups are set by the medic from an injury record
  and are closed from there, not archived here."

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Member count | How many athletes are in the group | Now | Zero is valid |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Rename | Header, the Edit popover | Changes the group's name everywhere it appears, including past sessions; the consequence line says so once the name differs | Stays here | Updates the group | Coach and sport scientist | Form submission | For every other role |
| Add or remove members | Body | Changes who is in it | Stays here | Writes membership rows | Same, and the medic for a rehab group | None. Membership is reversible | For every other role |
| Archive this group | The card at the foot | Sets `deleted_at`; the group leaves the filter and every picker; memberships, sessions, programmes and targets are untouched and the card says what keeps running | Stays here | `groups.deleted_at` | Coach and sport scientist; blocked with its reason for a rehab group | A second press on "Archive <name>", with "Keep it" beside it | For every other role |
| Restore | The Archived card | Clears `deleted_at` | Stays here | `groups.deleted_at` | Same | None | When not archived |

**Changing membership changes what other people see.** An athlete removed from a
group vanishes from every screen someone has filtered to that group, immediately
and without warning to them.

**Session expectations follow group membership.** A session that expects a group
expects whoever is in it now, not whoever was in it when the session was made.
Adding somebody to a group therefore adds them to that session's expectations,
which is the intended behaviour and worth knowing.

## 7. How this page is built, in plain English

Built on the server; editing runs in the browser.

## 8. States

**Not found.** The not found page. **Empty group.** Valid, and says so. **Error.**
Surfaces as an error. **Offline.** Not handled.

## 9. Open issues

- ~~Every role can edit and delete groups.~~ Rename and archive are the coach's
  and the sport scientist's (`GROUP_EDIT`, migration 0078).
- **Archiving or renaming a group writes no audit row** — `groups` carries no
  audit trigger (only `groups_set_updated_at`). Found 13 September 2026 while
  building C5; belongs with the audit-widening item on the architecture list.
- **Resolved: nothing is silently lost, but the message is unhelpful.** Group
  membership rows are removed with the group
  (`supabase/migrations/0002_tenancy_and_identity.sql:219`). **Seven other tables
  reference a group and none of them cascade**: session participants, thresholds,
  rehab assignments, leaderboards, programmes and two more. The database therefore
  refuses the deletion. That refusal has no wording of its own, so the coach sees
  the generic error, exactly as with sessions. The single fix in decision D-27
  repairs both.
