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

## 3. How you get here

- A user's name in the users list.

## 4. What you see

The account's name, email and status. Its roles. **A plain English summary of what
those roles permit**, computed across every role held rather than looked up for
one, so a person holding two roles sees the union they actually have.

## 5. Every number on this page

None.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Grant or remove a role | Roles card | Changes what this person can do | Stays here | Writes role rows and an audit entry | Sport scientist | Form submission | Absent for everyone else |
| **Reset two factor login** | Account card | Removes their second factor so they can enrol again | Stays here | Deletes their factor, and audits it | Sport scientist | Yes | Absent for everyone else |

**Resetting somebody's two factor login is a security act**, not a convenience. It
lets the next person to sign in as that account do so without the factor. It is
audited for that reason.

**The permission summary is computed as a union**, which is the honest
representation: it shows what the person can actually do, not what one of their
roles would allow in isolation
(`src/components/UserDetailPanel/UserDetailPanel.tsx:40`).

## 7. How this page is built, in plain English

Built on the server. Role changes are a server route, audited.

## 8. States

**A user with no roles.** Possible, and they can sign in but reach nothing. The
sign in screen has its own message for this. **Error.** Surfaces as an error.
**Offline.** The connection sentence.

## 9. Open issues

- **This belongs to admin today.** Decision D-07.
- **The role summary should warn when the nutritionist role is combined with
  another.** Decision D-25. This screen is where that warning belongs.
