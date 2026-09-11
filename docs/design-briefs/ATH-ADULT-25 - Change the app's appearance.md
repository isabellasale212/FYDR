# Design brief — ATH-ADULT-25, Change the app's appearance

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-25 — Change the app's appearance

**Entry point.** "Me" → the theme control.

**Steps.**

1. Press one of two options in a `role="group"` labelled "Theme": "Light"
   (hint "Always light") or "Dark" (hint "Always dark"). Each carries
   `aria-pressed`.

**There is no third option.** An earlier version of this document listed "a
system option" and flagged its label as unverified. Measured 2026-09-11: two
buttons. `ThemeToggle.tsx` records why — *"It had three; 'System' was dropped
there [Design.pdf p45] and this follows it."*

**The system preference is still honoured, without a button for it.** With
nothing stored, the live button is whichever theme is *actually* showing,
resolved from `matchMedia('(prefers-color-scheme: dark)')`, so a user on an
OS-dark machine sees "Dark" pressed rather than being told they are on Light
while the app renders dark. Pressing either button writes an explicit choice
and pins it. The component's own comment names the complaint this avoids: "the
theme switches when I click on different pages."

**End state.** Applies immediately.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-23-to-26-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **Two buttons, not three.** "System" was dropped by decision (Design.pdf
   p45) and `ThemeToggle.tsx` records the argument: with nothing stored, the
   pressed button must be whichever theme is *actually showing*, resolved from
   the OS, so the control never claims a theme the user is not seeing. **A
   proposal that reintroduces "System" must answer that argument, not just add
   the button.**
2. **Applies immediately.** No Save.
3. **`role="group"` labelled "Theme", `aria-pressed` on each** — keep.

## 5. What a proposal should address

1. **Nothing.** It is correct as it stands. Recorded so the missing third
   option is not mistaken for an omission.
