# 23. Profile settings

**Built 15 September 2026** (Isabella's mobile queue #11): the three account
forms Me carried inline — photo, phone number, password — on one page of their
own, behind the first row of Me's settings card.

## 1. Where it sits

`/me/profile`, under Me. Not a tab. One door: the **Profile settings** row on Me
(`12-me.md`). The layout's Back, under the title, returns to Me.

## 2. Who reaches it and when

The signed-in athlete, for their own row only (RLS on `users` and the avatar
bucket). Rarely — when a photo, a phone number or a password changes.

## 3. What you see

The title, Back beneath it, and three cards in order:

1. **Photo** — `AvatarUploadForm`: upload a JPEG, PNG or WebP up to 2 MB, or pick
   a colour for the initials. Writes `users.avatar_url` and `users.avatar_colour`
   through the Storage bucket migration 0030 added. The header on Me and Today
   shows the result.
2. **Edit profile** — `AthleteProfileEditForm`: the phone number, the one field an
   athlete edits about themselves. Name, date of birth, position and squad number
   are set by staff and are not editable here; the form resends the legal name
   unchanged so `full_name` cannot be blanked.
3. **Password and sign-in** — `ChangePasswordForm`: re-authenticates with the
   current password, then sets the new one (Q-02). The signed-out reset stays at
   `/login/reset`.

Nothing on this page is new: the three forms moved here unchanged. Forms stay
pages (B11): each submits on its own button, no auto-advance.

## 4. What the athlete enters here

See `12-me.md` §4 for the fields (photo, phone, current and new password) — the
forms and their validation are the same components.

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Back | Under the title | The previous page | history | nothing | no | no previous page |
| Upload photo / pick a colour | Photo card | Stores the file, or the colour | stays | `users.avatar_url`, `users.avatar_colour`, the avatar bucket | no | never |
| Save (phone) | Edit profile card | Updates the phone number | stays | `users.phone` (`full_name` resent unchanged) | no | never |
| Change password | Password card | Re-authenticates, then updates | stays | `auth.users` | yes, current password | never |
