# Two factor

## 1. Where it sits

Route `/login/mfa`. **Shared with the staff app.** No tab bar.

## 2. Who reaches it and when

Anybody whose account requires a second factor, after the password step.

**Whether this applies to athletes at all is UNVERIFIED.** The club policy
recorded on the staff Settings screen is that coach, medical and admin accounts
carry a second factor. **No athlete requirement was found.** Looked in
`src/lib/mfa.ts` and `src/app/login/mfa/page.tsx`.

## 3. What you see

The Fydr mark, and a six digit code field.

## 4. What the athlete enters here

| Field | As worded | Type | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Code | UNVERIFIED exact wording | six digits | TOTP, server side | rejected | not stored | n/a | nobody |

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Verify | Below the field | Completes sign in | the resolved shell | a session | no | never |

## 7. Offline and sync

Needs a connection.

## 8. Notifications

None.

## 9. Permissions

None.

## 10. States

Loading, wrong code, expired, error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling, screen
reader labels, browser support policy.

## 12. Open issues

- **UNVERIFIED:** whether an athlete account can ever require a second factor.
