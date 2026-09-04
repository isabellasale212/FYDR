# 50. Invite athletes

## 1. Page name and URL

**Invite athletes**, at `/settings/users/bulk-invite`.

Creates accounts for many athletes at once and links each to an existing athlete
record.

**It does not send anything.** Despite the name, no email leaves Fydr. Each
account is created with a **temporary password**, which is handed back on screen,
and whoever ran the invite must pass it to the athlete themselves
(`src/app/(staff)/settings/users/bulk-invite/send/route.ts:105`). Read section 6
before using it.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The invite form | Create accounts in bulk | None | Base | **Currently admin only**, `src/app/(staff)/settings/users/bulk-invite/page.tsx:17`. Decision D-07 |
| Coach, Medic, S&C, Nutritionist | **No** | Nothing | Nothing | The whole page | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

## 3. How you get here

- The bulk invite control on the users screen.

## 4. What you see

A way to enter many athletes at once, each with an email, and a date of birth
where the athlete record does not already carry one.

**At most 100 rows in one go**, which the screen states rather than failing at
101.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Accepted and rejected counts | How many invites went out and how many did not | This run | Reported per row, with the reason |

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| The rows | The body | Enter the athletes to invite | Stays here | Nothing until sent | Sport scientist | None | Absent for everyone else |
| **Send invites** | Foot | Creates the accounts, grants the athlete role, links each to its athlete record, and fills in a date of birth where one was given | Stays here, with the result | **Creates accounts and role rows, and audits each** | Sport scientist | Form submission | Disabled while sending |

**A date of birth is required for a linked athlete account**, which is why this
screen collects it. It is not gathered out of curiosity: the database refuses an
athlete record linked to a login without one, and the under 18 rules depend on it.

**An invite only ever links to an athlete who already exists.** This screen cannot
create an athlete record. Decision D-16.

**The temporary passwords are the important part of this screen.** For every
account created, a temporary password is generated and returned in the results.
The email address is marked confirmed, so the athlete never receives anything and
never has to prove they own the address. Whoever ran the invite is now holding a
list of working credentials for members of their squad, and has to get each one to
the right person by some means Fydr does not provide.

**What this means in practice, stated plainly.** Squad credentials will be passed
by whatever channel is to hand: a group message, a spreadsheet, a note read aloud.
Nothing forces the athlete to change the password on first use, and nothing
expires it. Decision D-38.

## 7. How this page is built, in plain English

Built on the server; sending is a server route that works through the rows.

**Failures are reported per row with a reason**, rather than the whole batch
failing. A batch of 30 with two bad email addresses invites 28 and names the two.

## 8. States

**Over 100 rows.** Refused with the limit stated. **A row whose athlete is already
linked.** Skipped and reported. **Partial success.** The normal case, reported in
full. **Offline.** The connection sentence.

## 9. Open issues

- **This belongs to admin today.** Decision D-07.
- **Resolved: no email is sent.** Accounts are created with temporary passwords
  returned on screen. Decision D-38 covers what should happen instead.
- **UNVERIFIED: whether a temporary password must be changed on first sign in, or
  ever expires.** Files searched:
  `src/app/(staff)/settings/users/bulk-invite/send/route.ts`,
  `src/components/LoginForm/LoginForm.tsx`.
