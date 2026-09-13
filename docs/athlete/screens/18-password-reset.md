# Password reset

## 1. Where it sits

Route `/login/reset`, and `/login/reset/confirm` after the emailed link.
**Shared with the staff app.**

## 2. Who reaches it and when

Anybody who cannot sign in.

## 3. What you see

The Fydr mark, a heading, and one email field.

## 4. What the athlete enters here

| Field | As worded | Type | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Email | "Enter the email your club has on file" | email | server side | UNVERIFIED whether it confirms the address exists | not stored | n/a | nobody |

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Send | Below | Sends a reset link | stays, with a message | nothing directly | no | never |

**The link only works in the browser that asked for it.** The reset flow is PKCE,
so a link forwarded to another device fails. The request screen's own copy says
so. **An invite link is different and does forward**, because it is verified
server side.

### The invite arrival (PATTERN-S9 artboard 1, 13 September 2026)

`/login/reset/confirm?invite=1` is where an invite lands after `/auth/confirm`
verifies its token, and it is a different screen from the reset in everything
but the field. Eyebrow "Invite", title "Set a password". Then, **above the
field, the emphasised card "Who invited you"**: the club and the squad (the
athlete's live groups), the person who sent it and their role and the date
("Jane Pemberton, sport scientist, on Sun 13 Sept" — read from the account's
own creation audit row), and the address it went to, **masked** (`n***@***.example`)
— a phishing page can restate an address it already has; a real invite can
name somebody the athlete can walk up to. Under it the one sentence that does
the work: "Fydr never asks for a password by email or by message. If you did
not expect this, do not set one — ask Jane at the club." and the `LEGAL-1A`
placeholder (where to forward a suspicious invite; undrafted).

**Three rules, stated before you type**, each with a mark: an en dash at
`--faint` before typing ("A dash means not checked yet, not failed."); once
typing, a met rule's tick at `--accent2` and the one unmet rule's bad glyph
with what it needs ("At least 12 characters — this has 9"). The second rule —
"Not a password you already use somewhere else" — is the one no code can
check: it is the athlete's own tick (a checkbox in its row), not a tick the
system awards. The count reads "n of 3 rules met". Under the field, the unmet
rule's sentence ("Add 3 more characters. This one is 9 of the 12 needed.").
The action, "Set password", is **blocked rather than dimmed** while a rule is
unmet (`aria-disabled`, the ghost treatment) and nothing is sent — "Nothing is
sent while a rule is unmet, so no attempt is recorded against you." Met, it is
the primary at 56px (`--tap-commit`); the foot says "Next you will read what
staff can see, then make one choice." for an athlete. No confirm field: the
Show toggle is the confirmation. The reset arrival keeps its two-field shape.

**Not drawn, built with it.** The guardian for an athlete under 18 is captured
on the staff Add athlete form (`/squad/new`): once the date of birth makes the
athlete under 18 a Guardian fieldset appears — name and email, required the
moment an invite email is given, optional for a roster-only row — and the
route refuses an invited under-18 with no guardian, or a guardian address the
same as the athlete's. The bulk invite refuses an under-18 row by name with
the way through. The athlete is never asked for either.

## 7. Offline and sync

Needs a connection.

## 8. Notifications

An email carries the link. **Whether that email is actually delivered depends on
an email provider, and none is configured**, so in this deployment the link is
usually shown on screen rather than sent.

## 9. Permissions

None.

## 10. States

Loading, sent, **expired link**, **already used link**, **forged token**.

**The last three are deliberately indistinguishable.** Telling an anonymous
caller which of the three they hit turns the screen into an oracle for guessing
tokens.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling, screen
reader labels, browser support policy.

## 12. Open issues

- **UNVERIFIED:** whether an athlete without a working email address has any
  recovery path at all. This is a real risk for academy players.
