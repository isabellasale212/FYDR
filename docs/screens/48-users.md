# 48. Users

## 1. Page name and URL

**Users**, at `/settings/users`.

Every account in the club, and the roles each holds.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Every account | View, create, edit roles, reset two factor login | None | Base | **Currently admin only**, at `src/app/(staff)/settings/users/page.tsx:21`. Decision D-07 |
| Coach | **No** | Nothing | Nothing | The whole page | Base | Same |
| Medic | **No** | Nothing | Nothing | The whole page | Base | Same |
| S&C | **No** | Nothing | Nothing | The whole page | Base | Same |
| Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/users/page.tsx:20`; a **admin** check at `src/app/(staff)/settings/users/page.tsx:21`, which redirects. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Users row in the settings hub's People group (`/settings`).
- A link carrying `?q=`, `?role=` or `?status=` lands on the list already
  filtered (since 13 September 2026, PATTERN-S8 C3); an unknown value falls
  back to "all" rather than filtering to nothing.

## 4. What you see

A count of accounts, staff and athlete accounts. Then, since 13 September 2026
(PATTERN-S8 C3), **search by name or email and two rows of filter chips**:
one role (Every role · Sport scientist · Coach · S&C · Medic · Nutritionist ·
Athlete) and one status (Any status · Active · Invited · Suspended ·
Deactivated). The search field and every chip are 44px. Above the list a count
line always carries its denominator and names the active filters in words:
"37 accounts"; "5 of 37 accounts · coaches"; "1 of 37 accounts · athlete
accounts · matching "okon"". When nothing matches, the list card says so once,
with the way out — "No account matches — coaches · invited, not yet signed in.
Clear the filters to see all 37." and a **Clear filters** button.

Then every account with their name, email, linked athlete, last seen date, role
toggles and status. At desktop each account is one row: name and email, the
role chips, the status pill and Deactivate. **Below 768px the same row is a
stacked card** — name and email, the chips wrapping, then status and the
action on one line — so nothing scrolls sideways at 375 (`.um-row`).

Athlete accounts stay in this list, because invitations and the athlete link
live here; "Athlete" is a role filter like any other. The S8 board draws staff
only; the code keeps the complete list and lets the chip separate them.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Staff and athlete account counts | How many of each exist | Now | Zero says so |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Create a user | Header | Creates an account, grants roles, and links it to an athlete record if one is chosen | Stays here | **Writes a user, their roles, and an audit entry** | Sport scientist | Form submission | Absent for everyone else |
| Invite in bulk | Header | Opens the bulk invite screen | `/settings/users/bulk-invite` | Nothing | Sport scientist | None | Absent for everyone else |
| Search, role chips, status chips | Above the list | Narrow the list; the count line reads the result back with its denominator | Stays here | Nothing | Sport scientist | None | Never |
| Clear filters | The empty list card | Resets search, role and status | Stays here | Nothing | Sport scientist | None | When something matches or nothing is filtered |
| A user's name | The list | Opens their record | `/settings/users/[userId]` | Nothing | Sport scientist | None | Absent |
| Deactivate / Reactivate | The user's record | Changes the account's status. **Held at the database since 13 September 2026 (migration 0109, §0bd):** a person cannot change their own status (the screen's refusal was only in the browser before); the club's only active sport scientist cannot be deactivated by anyone; and any status change bumps `claims_version`, so the account is signed out on its next request. The screen says each refusal in words (`STATUS_REFUSALS`) | Stays | `users.status`, an audit entry | Sport scientist, on another account | The typed confirmation | — |

**Granting roles is where the nutritionist rule can be lost.** Permissions add up,
so a nutritionist granted any second role sees what that role sees, injury
information included. **Nothing on this screen says so.** Decision D-25.

**Creating a user writes an audit entry naming who granted what.** That is not
optional bookkeeping: it is what makes role grants defensible later.

## 7. How this page is built, in plain English

Built on the server. Creating a user is a server route that writes the account,
the roles and the audit entry, and links an athlete record where one was chosen.
If the account is created but the roles fail, the account is removed rather than
left without roles.

## 8. States

**Only one user.** Normal for a new club. **Error.** Surfaces as an error. A
duplicate email says so in those words rather than as a database message.
**Offline.** The connection sentence.

## 9. Open issues

- **This belongs to admin today.** Decision D-07.
- **Nothing warns about combining the nutritionist role with another.** Decision
  D-25.
- **There is no way to create an athlete record**, only to link an account to one
  that already exists. Decision D-16.
