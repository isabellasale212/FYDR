# S9 — Athlete consent, first run, install teaching

Static review board: `ATH-S9 Consent first run and install.dc.html`
Six artboards, athlete app, 375 wide. Ashcombe Rugby Club, 30 athletes, Sun 13 September 2026 09:12 Europe/London.
Nothing clickable, no hover states. Roboto throughout; Sora only on the set-type `Fydr.` wordmark (artboards 1 and 4B).

## Designed for either lawful basis

The basis is not confirmed, so the board is drawn so that either answer fits without a redraw:

- Performance data and health data are **separate blocks on every frame** that carries the decision (3A, 4B). If the basis lands on legitimate interests for performance and explicit consent for health, block 1 loses its control and keeps its wording; block 2 keeps both. No new screen, no relayout.
- Two records, not one — see Open against code, item 2.
- Accept and decline are **equal weight**: both 56px, both full width, both the accent outline, in source order agree then decline. Frames 3A and 4B are the only frames in the programme with **zero haloed primaries**. The system's one-primary rule is a ceiling, not a quota.
- The sentence "Saying no does not affect selection." is on both decision frames, in the footer with the two choices.
- Its caption is what makes it honest: *"Ashcombe Rugby Club states this. Fydr records your choice and cannot enforce what a coach does with it."* The sentence can be written truthfully as the **club's** statement; it cannot be written as the software's. The attestation behind it is `LEGAL-3C` and is not drafted.

## Artboards

1. **Invite received, setting a password** — two states, 375 × 812 each. Club, squad, inviter, date sent and masked recipient address above the field; "Fydr never asks for a password by email or by message." Three rules stated before typing, neutral en dash meaning *not checked yet*. State B: 9 characters, one rule unmet with the bad glyph, two met with a cyan tick, count "2 of 3 rules met", action blocked not dimmed.
2. **What staff can see** — 375 × 812, top scroll position. Four named staff cards plus the athlete as the fifth role. The coach card leads with the boundary: no diagnosis, no treatment notes, **no body site and no side**. Emphasised card carries the two facts already true — submitted entries are immutable, and a day not answered stays empty rather than counting as a bad score.
3. **The decision** — two states. 3A: the two blocks, the selection sentence, two equal 56px actions, version line. 3B: after declining, as a screen state rather than a toast — the club sees the athlete in the squad list with "no data consent" and a date, cells read an em dash, and squad denominators drop from 30 to 29; the athlete keeps schedule, gym, nutrition and messages.
4. **Under 18** — two states. 4A: the athlete while guardian consent is outstanding — guardian name and masked address from the club's record, not asked for; the athlete is **not** locked out of the app, only out of the two entry forms, because filling one in is the processing being agreed to. 4B: the guardian on the emailed link — a web page, no account, the athlete's own wording verbatim (`LEGAL-3A`, `LEGAL-3B` shown by reference so a reviewer can confirm the strings match), the same sentence, the same two equal actions.
   No date of birth is shown or requested anywhere: 4A says nothing about age, 4B says "under 18 on the club's record".
5. **First check-in** — 375 × 812. The wellness form itself, not a confirmation. One first-run card: no score, no streak. Otherwise ATH-ADULT-03 unchanged — sleep starts empty and counts, both anchors carry their numeral, "0 of 6 answered · 6 to go", action blocked rather than dimmed.
6. **Install teaching, iOS Safari** — 375 × 812. Fydr's own card (eyebrow "From Fydr, not from iPhone", product card treatment, 44px close, worded "Not now"), three steps naming the exact menu item — **Add to Home Screen**, then **Add** — and a schematic Safari bar with the share control ringed and labelled. What changes once added: an icon, no Safari bars, reminders become possible; login, entries and staff visibility unchanged.

## Named, not drawn

**Withdrawal — Settings › Your data › Data consent.** A consent that cannot be withdrawn is not consent, so the row has to exist: one 44px row on the existing athlete settings screen showing the current state and its date, opening the same two blocks with the opposite pair of actions. Withdrawing sets the athlete's squad row to "no data consent" with today's date, stops new entries, and leaves submitted entries alone until `LEGAL-3E` says otherwise. The club sees it on the squad list and in the audit trail. No published mean is recomputed retrospectively. A row on an existing screen — it will not get built unless it is named.

**Reachability — staff squad view.** "18 of 30 athletes can receive reminders", in the shape every other Fydr figure takes. It sits **near** and is **never merged with** any compliance figure: an install problem is a property of a phone, a missed check-in is a property of a person, and one read as the other produces a conversation about attitude when the answer was a Home Screen icon. Caption names the cause — 12 have not added Fydr to a Home Screen, of whom 9 are on iPhone. A figure on an existing screen.

**Where artboard 6 must also be reachable.** An athlete who taps "Not now" must be able to get back to it:
1. Settings › Reminders › Add to Home Screen — permanent, the canonical route.
2. Returned once, automatically, if a reminder could not be delivered — the only case where re-showing is justified, because there is now evidence it matters.
3. From the reachability figure's staff-side counterpart: a coach asking an athlete to install should be able to say where the screen is.
Not on every Today open, and not on a timer.

## What changed, and on which token

- **Zero haloed primaries on a decision screen.** Both actions `--surf` + 1px `--accent` + `--accent` label at 6.88:1, min-height 56px, width 100%. No `--ring-action` on 3A or 4B.
- **56px for committing actions, 44px for everything else.** 44px still governs steppers, scale targets, the close control and the "not my guardian" row. ATH-ADULT-03 draws its submit at 44px and is now out of step by 12px — one line to change.
- **Legal placeholder as a drawn pattern.** 1px dashed `--line-dashed` on `--surf2` at `--r`, monospace reference at `--t-num-nano` / `--faint`, one caption saying who supplies it. Sized for the expected length on purpose.
- **Password rules neutral before typing.** Unchecked en dash at `--faint`; met `✓` at `--accent2`; unmet `--pill-bad` glyph + `--on-bad` at 8.95:1; field 1px `--bad` + `0 0 0 3px rgba(var(--bad-rgb), 0.18)`. Count "2 of 3 rules met" — the denominator rule applied to something that is not data.
- **Declining is a state of the screen.** No banner, no toast; the eyebrow carries the recorded date and time.
- **Guardian route reuses the athlete's wording verbatim,** on a page with no account. Wordmark `--font-brand` Sora 800 at 22px, −0.035em — the only non-Roboto type on the board.
- **The install card is marked as Fydr's three ways at once.** Card `--surf` + `--r-sheet` + `--shadow`; Safari toolbar drawn on the system's existing sticky-bar fill `rgba(234,237,241,0.94)`; share control ringed with `--ring-select` + 2px `--accent`; glyph `ph-export`.
- **No judgement words, no invented data.** No "recommended", no count of teammates who accepted — that would be a real number and also pressure. Every figure is structural (5 of 5 roles, 2 of 3 rules, 1 of 1 guardian) or already established in the programme (24 of 30 submitted, 30 athletes).

## Needs new token

- `--tap-min: 44px` and `--tap-commit: 56px` — two different jobs, the system names neither. Spacing-scale values already in use; naming them stops a footer action drifting back to 44px.
- `--border-pending` → alias of `--line-dashed`, `--pending-fill` → alias of `--surf2`. No new values. Makes the placeholder one named pattern, distinct from the nutrition board's club-default dashed treatment, and findable in one search when wording lands.
- `--on-accent` — still unresolved, carried forward from ATH-ADULT-03. The two haloed actions write `#ffffff` (8.62:1 on `--accent`), which is what the kit Button renders internally.

## Open against code

1. **Does an invite and password flow exist today, or is account creation staff side only?** Artboard 1 assumes a tokenised link with an expiry and a password the athlete sets. If accounts are created staff side with a password handed over, frame 1 is wrong and consent is being taken on an account the athlete never opened — a legal problem before a design one. *Blocks artboard 1.*
2. **Is there any field recording a consent decision, its date, and its version?** Three values, not one. Without the version, changing the wording silently rewrites what every existing athlete agreed to. Two records, one per block, so a separate health decision lands without a migration. *Blocks both decision frames.*
3. **Is a guardian contact held anywhere for an athlete under 18?** 4A shows a name and masked address the club already holds. If no such field exists, the route has no starting point and needs a staff-side capture screen this board does not draw. Also: can the app tell who is under 18 without displaying a birth date? *Blocks artboard 4.*
4. **Can an account exist in a declined state, or does every account assume consent?** 3B needs an account that is in a squad, appears in lists, has no entries and no readiness, and is dropped from every staff denominator rather than counted as a non-submitter. If consent is implied by the existence of a row, declining is indistinguishable from not having answered. *The single biggest thing to confirm on this board — it affects every denominator in the staff app.*
5. **Can the app tell whether it is running installed, and can that be counted per athlete?** Needs a display-mode check on the client and a stored per-athlete state for the staff view. Without the second, "18 of 30 can receive reminders" cannot be drawn honestly and artboard 6 has no measurable effect. Also open: how far back the iOS Safari toolbar layout holds, and what the card says on Android, where the browser can offer the install itself.

## Legal placeholders, by frame

Six. None drafted. No wording anywhere on the board is intended as legal text — including the plain-language lines, which describe the product and must be read against whatever is supplied.

| Ref | Frame | What is needed |
|---|---|---|
| `LEGAL-1A` | 1 | Where an athlete forwards a suspicious invite, and any reporting wording. Drawn as club-contact copy with no address. |
| `LEGAL-3A` | 3A, 4B | Lawful basis and purpose, performance data. Two sentences, same position either basis. |
| `LEGAL-3B` | 3A, 4B | Explicit consent wording for health and injury data, including special-category handling. |
| `LEGAL-3C` | 3A, 4B | The club's attestation that declining does not affect selection, and what Fydr may say on its behalf. |
| `LEGAL-3D` | 3A, 4B | Version identifier shown and stored, and the rule for when a wording change requires re-asking. |
| `LEGAL-3E` | 3B, withdrawal row | Retention and deletion on decline or withdrawal: what goes, what stays, for how long, and what the club keeps in its audit trail. |
| `LEGAL-4A` | 4A | Who holds the decision for an athlete under 18, whether the athlete's own agreement is also required, and when it transfers. |
