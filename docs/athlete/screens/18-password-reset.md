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
