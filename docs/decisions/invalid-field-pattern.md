# The invalid field — a record of what is built

**A record, not new work. Written 16 September 2026 from the code; nothing was
changed to write it.** ATH-ADULT-03 designed the pattern for the morning
check-in's two optional numbers (A7, B8, C-e) and it was built there; the same
mechanism carries the four forms where validation genuinely names a field.
It was written down in the code's comments and in `scripts/test-field-errors.ts`
and nowhere a designer would look.

## What a wrong field does

1. **The field says it is wrong, from state.** `aria-invalid` is bound to the
   validation result — `aria-invalid={hrProblem ? true : undefined}` — never a
   bare `true`, so a screen reader is not told "invalid" on every visit of a
   field that is fine.
2. **It says why, and the "why" exists.** `aria-describedby` names the help
   line and the error line by id, and both ids render in the same file; the
   guard fails the build if either dangles, because a dangling reference is
   the quietest failure there is — the browser drops the association and the
   field announces "invalid" with no reason.
3. **The look** (`base.css`, `.disclose-body .field[aria-invalid='true']`,
   `.err-line`, `.err-dot`): the field takes a 1px `--bad` border and a 3px
   ring of `--bad-rgb` at 0.18 — the accent ring's own shape with the hue
   swapped; beneath it the message at `--fs-13` / `--w-semi` / `--bad-text`
   (the board's on-bad-strong), led by a small round glyph in `--wash-bad`,
   `role="alert"` so it is announced when it appears. The helper line
   ("Usually 25 to 120 bpm") is under the field at `--fs-12` `--muted`, never
   a placeholder, so it stays readable once a value is typed.
4. **Contrast is measured, not assumed**: `--bad-text` on the form's own
   ground (`--phone-bg`) is asserted at or above 4.5:1 in both themes by
   `test-ath-adult-03`.

## What a wrong submission does, and why that is a different thing

The 2026-09-09 audit found 233 controls and zero `aria-invalid` and read it as
233 missing attributes. Reading the code says otherwise: of 54 components that
hold a control and its own error state, fifty produce only submission errors —
the server's `json.error`, a network failure, a rejected mutation. This app
validates very little in the browser; it submits and reports what the server
said. `aria-invalid` means *the value is wrong*, and on a network failure the
value is usually fine, so setting it there would be a lie told to exactly the
users who cannot see the form to check. Those fifty carry `role="alert"` on
the form-level message instead, which is the right mechanism, and every one
does (`test-a11y-floor`, `test-field-errors`).

## Where it is

The morning check-in's heart rate and body mass (`CheckInForm`), and the three
other forms `scripts/test-field-errors.ts` names, which pins both halves of the
pattern — bound state, resolvable reference — so a fifth form cannot drift.
