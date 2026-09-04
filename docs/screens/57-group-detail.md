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

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Member count | How many athletes are in the group | Now | Zero is valid |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Rename | Header | Changes the group's name | Stays here | Updates the group | Coach and sport scientist | Form submission | **Not built** |
| Add or remove members | Body | Changes who is in it | Stays here | Writes membership rows | Same | None. Membership is reversible | **Not built** |
| Delete the group | Header | Removes it | Back to Groups | Deletes the group and its membership | Same | Yes | **Not built** |

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

- **Every role can edit and delete groups.**
- **Resolved: nothing is silently lost, but the message is unhelpful.** Group
  membership rows are removed with the group
  (`supabase/migrations/0002_tenancy_and_identity.sql:219`). **Seven other tables
  reference a group and none of them cascade**: session participants, thresholds,
  rehab assignments, leaderboards, programmes and two more. The database therefore
  refuses the deletion. That refusal has no wording of its own, so the coach sees
  the generic error, exactly as with sessions. The single fix in decision D-27
  repairs both.
