# PATTERN-S9. Athlete consent, first run, install teaching. Build prompt.

## Source of truth and precedence

Build against `docs/designs/PATTERN-S9-final/notes.md` and the board export beside it.

Precedence: `notes.md` beats this prompt, which beats the persona review, which beats the walkthrough, which beats the specification. Where this prompt and the notes disagree, the notes win and you report the disagreement.

## Why this exists

No real athlete data can lawfully enter Fydr without this flow and it does not exist. Every other athlete screen is built. This is the last thing between Fydr and its first paying club.

## Step 1. Report before building. Answer and stop.

Do not write any code until these are answered and confirmed. Four of the five block specific artboards.

1. **Does an invite and password flow exist today, or is account creation staff side only?** Artboard 1 assumes a tokenised link with an expiry and an athlete-set password. If accounts are created staff side with a password handed over, consent is being taken on an account the athlete never opened. *Blocks artboard 1.*

2. **Is there any field recording a consent decision, its date, and its version?** Three values, not one. Without the version, changing the wording silently rewrites what every existing athlete agreed to. Two records are needed, one per block, so a separate health decision lands later without a migration. *Blocks both decision frames.*

3. **Is a guardian contact held for an athlete under 18?** Artboard 4A shows a name and masked address the club already holds. If no such field exists, the route has no starting point and needs a staff side capture screen this board does not draw. Also report whether the app can tell who is under 18 without displaying a birth date. *Blocks artboard 4.*

4. **Can an account exist in a declined state?** Artboard 3B needs an account that sits in a squad, appears in lists, has no entries and no readiness, and is dropped from every staff denominator rather than counted as a non-submitter. If consent is implied by the existence of a row, declining is indistinguishable from not having answered. *This is the biggest item on the board. It affects every denominator in the staff app.*

5. **Can the app tell whether it is running installed, and can that be stored per athlete?** Needs a display-mode check on the client and stored per-athlete state for the staff view. Without the second, "18 of 30 athletes can receive reminders" cannot be drawn honestly and artboard 6 has no measurable effect. Report also how far back the iOS Safari toolbar layout holds, and what the card should say on Android where the browser can offer the install itself.

Report the answers, then stop.

## Legal gate. Read before writing any copy.

Six placeholders are named in the notes and **none is drafted**. `LEGAL-1A`, `LEGAL-3A`, `LEGAL-3B`, `LEGAL-3C`, `LEGAL-3D`, `LEGAL-3E`, plus `LEGAL-4A`.

- Do not write, paraphrase, improve or fill in any legal wording, including plain-language lines that sit next to it.
- Render each placeholder using the drawn pattern: 1px dashed `--line-dashed` on `--surf2` at `--r`, monospace reference at `--t-num-nano` and `--faint`, with the caption naming who supplies it. Keep the sized box, it is deliberate.
- The build ships with placeholders visible. It does not ship to a real club until they are replaced.

## Build order once unblocked

One commit per artboard, in this order. Artboards 1, 5 and 6 are unblocked by anything except question 1 and question 5.

### 1. Invite received, setting a password
Two states. Club, squad, inviter, date sent, masked recipient address above the field. The line "Fydr never asks for a password by email or by message." Three rules stated before typing, neutral en dash meaning not checked yet. Invalid state shows the unmet rule with the bad glyph, met rules with a tick, the count "2 of 3 rules met", and the action blocked rather than dimmed.

### 2. What staff can see
Four named staff cards plus the athlete as a fifth role. The coach card leads with the boundary: no diagnosis, no treatment notes, no body site, no side. Emphasised card carries the two facts already true in the product: submitted entries are immutable, and a day not answered stays empty rather than counting as a bad score.

Verify these against the code as built, not against the board. If any of them is not true in the running product, stop and report it. A screen that promises a boundary the database does not enforce is worse than no screen.

### 3. The decision
3A: two separate blocks, performance data and health data. The selection sentence with its caption. Two equal actions, both 56px, both full width, both `--surf` with 1px `--accent` and an `--accent` label, in source order agree then decline. **Zero haloed primaries. Do not apply `--ring-action` here.** Version line present, sourced from the stored consent version.

3B: declining as a screen state, not a toast or banner. Eyebrow carries the recorded date and time. The club sees the athlete in the squad list with "no data consent" and a date, cells read an em dash, and squad denominators drop from 30 to 29. The athlete keeps schedule, gym, nutrition and messages.

### 4. Under 18
4A: the athlete while guardian consent is outstanding. Guardian name and masked address from the club's record, never asked for. The athlete is not locked out of the app, only out of the entry forms. **See finding 3 below before deciding which forms.**

4B: the guardian on the emailed link. A web page with no account. The athlete's own wording verbatim, same sentence, same two equal actions, zero haloed primaries. The Sora wordmark appears here and on artboard 1 only.

No date of birth is shown or requested anywhere.

### 5. First check-in
The wellness form itself, not a confirmation. One first-run card, no score and no streak. Otherwise ATH-ADULT-03 unchanged: sleep starts empty and counts, both anchors carry their numeral, "0 of 6 answered · 6 to go", action blocked rather than dimmed.

### 6. Install teaching, iOS Safari
Fydr's own card, marked as Fydr's: eyebrow "From Fydr, not from iPhone", product card treatment, 44px close control, worded "Not now". Three steps naming the exact menu items, Add to Home Screen then Add, with a schematic Safari bar and the share control ringed and labelled. State what changes once added: an icon, no Safari bars, reminders become possible, and login, entries and staff visibility unchanged.

It must not imitate a system dialog.

## Named, not drawn. Build these too.

**Withdrawal row.** Settings, Your data, Data consent. One 44px row on the existing athlete settings screen showing the current state and its date, opening the same two blocks with the opposite pair of actions. Withdrawing sets the squad row to "no data consent" with today's date, stops new entries, and leaves submitted entries alone pending `LEGAL-3E`. The club sees it on the squad list and in the audit trail.

**Reachability figure.** "18 of 30 athletes can receive reminders" on the staff squad view, in the shape every other Fydr figure takes. It sits near and is never merged with any compliance figure. Caption names the cause, for example 12 have not added Fydr to a Home Screen, of whom 9 are on iPhone.

**Re-entry to artboard 6.** Three routes only. Settings, Reminders, Add to Home Screen as the permanent canonical route. Returned once automatically if a reminder could not be delivered. And reachable by name so a coach can tell an athlete where it is. Not on every Today open and not on a timer.

## Tokens

Add `--tap-min: 44px` and `--tap-commit: 56px`. Values already in the spacing scale, this names them.

Add `--border-pending` as an alias of `--line-dashed` and `--pending-fill` as an alias of `--surf2`. No new values. Keeps the legal placeholder pattern distinct from the nutrition club-default dashed treatment and findable in one search when wording lands.

`--on-accent` is still unresolved and carried forward. Do not resolve it in this commit.

## Five findings to carry, from review of the notes

1. **The decline is visible to the coach by design**, by name, on the squad list. That is operationally right and it is in tension with the sentence "Saying no does not affect selection". Do not resolve it in code. Flag it in the build report so it reaches the solicitor as a named question alongside `LEGAL-3C`.

2. **Subject access has no route.** A withdrawal row exists, a "get my data" route does not. Under UK GDPR a club cannot refuse a subject access request, which is a different thing from the decision that athletes get no self-service report export. Add a named row beside withdrawal pointing at how to ask, with a new placeholder `LEGAL-3F`. Do not build an export.

3. **Artboard 4A locks two entry forms.** Gym set logging and nutrition weigh-ins are also the athlete entering data about themselves. Either lock all four or report why the other two differ. Do not decide this silently.

4. **"No published mean is recomputed retrospectively"** is a retention decision, not a footnote. Move it into `LEGAL-3E` and do not implement any retrospective recomputation either way until that is answered.

5. **ATH-ADULT-03's submit is 44px and the new commit token is 56px.** Do not change it in this work. The restyle pass was cancelled. Report it as a finding under the accessibility sweep and let Isabella decide.

## Rules every screen must obey

Missing is not zero. Every count carries its denominator. No judgement words. Success is the screen changing, never a toast alone. Minimum tap target 44px and committing actions 56px. No value available on hover alone. One emphasised card per screen, and on the two decision frames, zero haloed primaries.

Role gates hold at the database, not only the interface. Anything artboard 2 promises must be enforced in RLS.

## Commit and verify

- One commit per artboard, plus one each for the withdrawal row and the reachability figure.
- Screenshots at 375px and 1440px for every screen.
- Confirm every claim on artboard 2 against the running product and say which you verified and how.
- Report drift: anything in the notes you could not build as drawn, and why.
- Do not mark this complete while any legal placeholder is unfilled. Report it as built and gated.

---

## AMENDMENT, 13 September 2026: artboard 1 is no longer unblocked

Question 1 was answered (the invite and password flow exists), which marked
artboard 1 buildable. **That is now out of date.** Isabella's decision to build
both guardian consent methods changes what artboard 1 does.

Add to the artboard 1 section:

> For an athlete under 18, this flow also captures a **guardian name and email
> address**, which artboard 4A displays masked and never asks for again.
> **Confirm where in the invite flow that capture sits before building, since
> the field does not exist today.**

Do not build artboard 1 before answering that.

**And in the same commit as the field, not after it:** reword the schema comment
on `athletes.parental_consent_recorded_by`, which currently reads "There is no
parent login." That stays true, because the guardian page is tokenised and
accountless, but it will read as a contradiction beside a guardian page unless
it says so.
