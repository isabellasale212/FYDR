# 49. User

## 1. Page name and URL

**User**, at `/settings/users/[userId]`.

One account: its roles, what those roles permit, and the controls to change them.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The account and its roles | Grant and remove roles, reset two factor login | None | Base | **Currently admin only**, `src/app/(staff)/settings/users/[userId]/page.tsx:31`. Decision D-07 |
| Coach, Medic, S&C, Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/users/[userId]/page.tsx:24`; a **admin** check at `src/app/(staff)/settings/users/[userId]/page.tsx:31`, which redirects. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- A user's name in the users list.

## 4. What you see

The account's name, email and status. Its roles, as chips. **A plain English
summary of what those roles permit** ("What this user can see"), computed across
every role held rather than looked up for one, so a person holding two roles
sees the union they actually have. Since 13 September 2026 (PATTERN-S8 C4) the
summary is `src/lib/roleGrants.ts`: one sentence per set in `src/lib/access.ts`
(24 of them, from "The staff app: squad, schedule, wellness and nutrition
screens" to "Clinical detail: diagnosis, mechanism, severity, treatment notes,
and the clinical review of a subject access request"), so the list a sport
scientist reads is the list the gates use. A role with nothing in the staff
app says so ("Nothing in the staff app — the athlete app for their own record
only").

**A role change previews what it grants and what it removes before the
button** (PATTERN-S8 C4). Tapping a role chip changes a pending set, not the
account. While the pending set differs from what is held, a preview card sits
in the Roles card, above the grant history and in the same card as the button:

- a heading naming the change and its counts — "Adding Medic: gains 5 things
  and removes nothing; 14 things unchanged." / "Removing S&C: gains nothing and
  removes 4 things; 14 things unchanged." / "Adding Medic, Nutritionist,
  removing Coach: …";
- **Grants**, each capability the change opens, and **Removes**, each it closes
  — from the union before and the union after, so removing Medic from a person
  who is also a Coach does not list injury records or availability, which the
  coach role keeps;
- the standing rules the change trips, in full sentences: D-25 when a
  nutritionist gains, or is joined by, a role that reads injury information
  ("Roles add up. With this, the nutritionist reads injury information …");
  down to a nutritionist alone; only the athlete role; no role at all
  ("… they can sign in and reach nothing. Deactivate the account instead …");
  removing Medic ("Clinical records they wrote stay, with their name against
  them; they can no longer open them.");
- the effect line: "Takes effect on their next page load — a screen they
  already have open stays until they move — and is written to the audit log
  with your name against it." (the claims version bumps on any role change,
  migration 0010, so the next request carries the new roles);
- **Save roles** (primary) and **Cancel**. Nothing is written until Save roles.

The card carries the warn wash while the change only grants and the bad wash
once it removes something. A chip the sport scientist may not press — Medic on
their own account, the last Sport scientist on their own account, any chip on
a deactivated account — is a `BlockedButton`: it stays in the row, muted, and
says why on tap or focus, never in a `title`.

Roles are named as the app names them everywhere: Sport scientist, Coach,
Medic, S&C, Nutritionist, Athlete.

## 5. Every number on this page

None.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A role chip | Roles card | Moves the pending set and shows the preview; writes nothing | Stays here | Nothing | Sport scientist | None | Blocked, with its reason on tap, for a self-grant of Medic, the last Sport scientist, or a deactivated account |
| Save roles | The preview card | Applies the pending set | Stays here | Writes role rows and an audit entry (`user_roles.changed`, added and removed) | Sport scientist | The preview is the confirmation | When nothing is pending |
| Cancel | The preview card | Drops the pending set | Stays here | Nothing | Sport scientist | None | When nothing is pending |
| **Reset two factor login** | Account card | Removes their second factor so they can enrol again | Stays here | Deletes their factor, and audits it | Sport scientist | Yes | Absent for everyone else |
| **Deactivate user / Reactivate user** | Danger zone card | Changes the account's status through `POST /settings/users/[id]/status`, which also bans or unbans the sign-in itself — **deactivate is the revoke** (PATTERN-S8 D5, batch B1, 13 September 2026): any outstanding invite or magic link is refused from the same moment, and there is no separate Revoke control. The caption says so before the press: "Signs them out, blocks sign in and cancels any outstanding invite or magic link at the same moment. Nothing is deleted." / "Lets them sign in again — an invite they never followed works again too, until it expires." | Stays here | `users.status`, the auth ban, `user.deactivated` and `user.invites_revoked` (or the two restore actions) | Sport scientist, on another account | None beyond the caption (reversible) | Disabled for your own account |

**Resetting somebody's two factor login is a security act**, not a convenience. It
lets the next person to sign in as that account do so without the factor. It is
audited for that reason.

**The permission summary is computed as a union**, which is the honest
representation: it shows what the person can actually do, not what one of their
roles would allow in isolation (`capabilitiesFor` in `src/lib/roleGrants.ts`).

## 7. How this page is built, in plain English

Built on the server. Role changes are a server route, audited.

## 8. States

**A user with no roles.** Possible, and they can sign in but reach nothing. The
sign in screen has its own message for this. **Error.** Surfaces as an error.
**Offline.** The connection sentence.

## 9. Open issues

- **This belongs to admin today.** Decision D-07.
- ~~The role summary should warn when the nutritionist role is combined with
  another. Decision D-25.~~ The preview does, since 13 September 2026 (C4),
  before the button.
