# Persona review — ATH-ADULT-14, See the leaderboards I am on

**Persona.** An athlete checking where they sit — and, more often than the
design assumes, checking whether anyone else can see them there.

**Reviewed 2026-09-10** at **375×812** as a real athlete on one board
(Conor Moroney).

---

## The measured screen

`h1` **"Leaderboards"**, page **812px — one screen, no scroll**. One board link,
"Total session load" → `/my-data/boards/{id}`. One further link, **"Manage who
sees you on a leaderboard"** → `/me/leaderboards`. No gate, no empty state.

---

## The findings

### 1. The screen is honest about a thing most apps hide

"Manage who sees you on a leaderboard" sits on the same screen as the boards
themselves, in plain words, naming visibility rather than "privacy settings" or
a gear icon. For a screen that ranks people against their teammates, putting the
opt-out in view rather than three levels down is the right call and should
survive any redesign.

### 2. Two "Leaderboards" that are not the same screen

`/my-data/boards` shows the boards. "Me" → "Leaderboards" opens
`/me/leaderboards`, the *settings* screen (ATH-ADULT-16/17/18). Both are called
"Leaderboards" and one links to the other. The walkthrough already records this
and it is worth keeping recorded — it is the kind of thing that reads as a bug
in a screenshot pass.

### 3. Sparse, and that is defensible

One board, one management link, 812px. Nothing is wrong; there is simply not
much here for an athlete on a single board. Worth confirming what it looks like
for an athlete on six.

---

## 1–5, briefly

**Taps:** one to open a board, one to reach visibility settings.

**Copy:** "Manage who sees you on a leaderboard" is the strongest line — it
describes the consequence, not the control.

**Mistakes:** nothing here writes.

**Inference:** the board list is derived from consent state.

**Clarity:** nothing ambiguous on the populated path. The gate and empty states
were not reachable for this athlete.

---

## Summary for design

1. **Visibility management belongs on this screen and already is** — keep it.
2. **Two screens named "Leaderboards"**, one linking to the other.
3. **Unverified:** the hidden-leaderboards gate ("Show them again") and the
   no-boards empty state, neither reachable as this athlete without changing his
   consent state — which is ATH-ADULT-18's flow, not this one.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Heading "Leaderboards" | **Correct** |
| Boards this athlete appears on | **Correct** — one, "Total session load" |
| "Manage who sees you on a leaderboard" → `/me/leaderboards` | **Correct** |
| "Me" → "Leaderboards" opens the settings screen instead | **Correct** |
| Gate with "Show them again" when hidden | **Not verified** — needs ATH-ADULT-18 state |
| Empty state when no boards | **Not verified** — athlete is on one |
| Stays on `/my-data/boards` | **Correct** |
