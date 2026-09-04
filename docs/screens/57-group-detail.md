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
- **UNVERIFIED: whether deleting a group in use by a session's expectations is
  refused or silently removes the expectation.** Files searched:
  `src/lib/queries/groups.ts`, `supabase/migrations/0003_schedule.sql`. **Worth
  resolving**, because it would silently change what compliance measures.
