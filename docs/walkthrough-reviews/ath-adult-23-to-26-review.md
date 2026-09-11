# Persona review — ATH-ADULT-23 to -26, the rest of "Me"

**Reviewed together**: four one-off settings on the same screen.

**Persona.** An athlete personalising the app on day one — and, for 24 and 26,
one who has a reason: a password they suspect is known, or a request for their
own data.

**Reviewed 2026-09-11** at **375×812** as a real athlete (Conor Moroney).
**23 and 26 exercised; 24 and 25 measured only** — reasons below.

---

## What was and was not exercised

- **23** — pressed "Blue", verified the write and the two avatars, pressed
  "Default". `users.avatar_colour` returned to `null`.
- **24** — **not exercised.** Passwords are never typed in review, and changing
  this account's would lock the remaining batches out of it. The form was
  measured; "Changing…" is recorded from source.
- **25** — measured; not pressed. It writes a theme choice to `localStorage`
  and would have re-rendered every screenshot of the rest of the batch in the
  other theme.
- **26** — fetched `/me/export` read-only and inspected the response; no file
  saved.

---

## ATH-ADULT-23 — Pick a colour for my initials

**Measured.** Eleven `aria-pressed` buttons at 44px, in a plain `<div>` under
the line "Or pick a colour for your initials". No Save button.

**Verified.** Press → `users.avatar_colour = 'Blue'` written at once,
`aria-pressed` moves to "Blue", the Photo card's preview turns
`rgb(37,99,235)`. No error. Press "Default" → `null`, preview back.

**The finding: two avatars, one updates.** `.me-avatar` at the top of `/me` —
the large one with the athlete's name beside it — **stayed on the old colour**
while the card preview 800px below turned blue. After a reload, both agree. The
hero is server-rendered from the row; the picker updates only its own client
preview. On the screen where the athlete is choosing a colour *for that avatar*,
the avatar does not respond. **Design finding** for the flow, not a data defect
— the write is correct.

**The eleven buttons are ungrouped** — the same shape as the nutrition answers
(§0u): a mutually exclusive choice presented as independent toggles with no
group name and no position.

## ATH-ADULT-24 — Change my password

**Measured.** Three fields with the documented ids, `type="password"`, and
correct `autocomplete` (`current-password`, `new-password`, `new-password`), so
a password manager fills the right ones. "At least 12 characters." beneath the
new field. "Change password" button.

**The finding: no `method` on the form.** `ChangePasswordForm.tsx:111` —
`<form onSubmit={onSubmit} className="card" noValidate>`. A submit before
hydration puts the **current and new** passwords in the URL. It is the second
instance of §0x, found one day after the first, one file over — which is exactly
the recurrence the proposed guard predicted. **§0x widened.**

## ATH-ADULT-25 — Change the app's appearance

**Measured.** A `role="group"` labelled "Theme" with **two** `aria-pressed`
buttons: "Light" (Always light), "Dark" (Always dark). "Light" pressed.

**There is no system option.** The doc listed one and flagged its label as
unverified; it does not exist. `ThemeToggle.tsx` records why — it had three,
"System" was dropped per Design.pdf p45 — and, more usefully, records what was
*kept*: with nothing stored, the pressed button is whichever theme is actually
showing, resolved from `matchMedia`, so an OS-dark user sees "Dark" pressed
rather than being told they are on Light while the app renders dark. The
component's own comment names the complaint this prevents: "the theme switches
when I click on different pages."

**Deliberate boundary, well reasoned, preserve it.** A proposal that reintroduces
"System" must answer the comment's argument, not just add the button back.

## ATH-ADULT-26 — Export my data

**Verified by fetch.** A plain `<a href="/me/export">` — not a Next link, so the
browser handles it as a download. Response: `200`, `text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="my-fydr-data-{athleteId}.csv"`, 93
lines. The first line is a comment addressed to the athlete: *"# Your data,
exported from Fydr. Everything you submitted yourself: profile, wellness
check-ins, training ratings, gym s…"*

That opening line is good practice — the file explains itself before the data
starts. The filename carries the athlete's own UUID, which is their own
identifier in their own download; noted, not a concern.

**Nothing to raise.** One tap, one file, correctly headed.

---

## Summary for design

1. **The hero avatar does not reflect a colour choice until reload**, while the
   card preview does. *(23 — design.)*
2. **Eleven ungrouped colour toggles.** *(23 — same pattern as §0u; recorded.)*
3. **Change-password form has no `method`.** *(24 — defect, §0x widened.)*
4. **No system theme option, by decision, with the preference still honoured.**
   *(25 — deliberate boundary; keep.)*
5. Right and worth keeping: the export's self-describing first line; correct
   `autocomplete` on all three password fields; "At least 12 characters." in
   view; colours saving on press with no Save button.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| 23: eleven chips, named as listed, under "Or pick a colour for your initials" | **Correct** |
| 23: saves immediately, no Save button | **Correct** — `avatar_colour` written on press |
| 23: previous colour restored on failure, with error copy | **Not verified** — no failure induced |
| 23: (implied) the avatar updates | **Partly** — card preview yes, hero avatar only after reload. Recorded. |
| 24: three fields with the documented ids | **Correct**, plus correct `autocomplete` |
| 24: "Change password" → "Changing…" | **Button correct**; in-flight label not observed |
| **24: (unstated) form method** | **Absent — §0x, second instance.** |
| **25: "and a system option"** | **Wrong — two options.** Dropped by decision; the preference is still honoured without a button. Corrected. |
| 25: "Light" / "Always light", "Dark" / "Always dark" | **Correct** |
| 26: plain `<a>` to `/me/export` | **Correct** |
| 26: a CSV of the athlete's own data | **Correct** — headers, filename and content verified |
