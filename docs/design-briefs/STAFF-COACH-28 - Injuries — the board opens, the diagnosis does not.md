# Design brief — STAFF-COACH-28, Injuries — the board opens, the diagnosis does not

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-12 at **1280×900 and 375×812** as a coach (Mark
Iremonger, one role). Nothing here is aspirational.

**Read the STAFF-SHELL brief and the STAFF-SS-28 brief first.** The phone shell
is built (`af09c17` + `6a2f1d4`); this flow is measured on it. Where the coach's
screen is identical to the sport scientist's by measurement, the SS-28 brief is
the design surface; this brief carries what differs for the coach and what the
sport scientist's review could not see.

---

## 1. The flow, verbatim from the walkthrough document

*From the coach section (identical table):*

| ID | Flow | Entry point |
|---|---|---|
| STAFF-COACH-01 | Read the dashboard | sidebar "Dashboard" |
| STAFF-COACH-02 | Browse the squad and filter by group | sidebar "Squad overview" |
| STAFF-COACH-05 | Open an athlete's profile | athlete name on `/squad` |
| STAFF-COACH-07 | Read the week's schedule | sidebar "Schedule" |
| STAFF-COACH-08 | Create a session | "+ Session" |
| STAFF-COACH-09 | Create a fixture | "+ Fixture" |
| STAFF-COACH-10 | Edit a session in the grid | click a block in Edit mode |
| STAFF-COACH-11 | Remove a session, and restore it | "Remove session" |
| STAFF-COACH-12 | Use the edit-mode toolbar | `/schedule` Edit mode |
| STAFF-COACH-13 | Publish the week to athletes | banner |
| STAFF-COACH-14 | Discard every pending change | banner "Discard" |
| STAFF-COACH-15 | Manage week templates | "Week templates" |
| STAFF-COACH-16 | Squad report and export | sidebar "Reports" |
| STAFF-COACH-17/18/20/21/22 | Athlete, compliance, squad, testing, training reports | by route |
| STAFF-COACH-25 | Explore the leaderboard wall | sidebar "Leaderboard" |
| STAFF-COACH-26 | Publish and manage leaderboards | "Manage published boards →" |
| STAFF-COACH-29 | Settings hub — own profile, photo, password only | sidebar "Settings" |
| STAFF-COACH-30c | Groups | `/settings/groups` |
| STAFF-COACH-30h | Thresholds | `/settings/thresholds` |
| STAFF-COACH-33 | Print a screen | "Print" |

### STAFF-COACH-28 — Injuries: the board opens, the diagnosis does not

**Corrected 2026-09-10.** This said `/injuries` and `/injuries/{id}` were closed
to a coach. They are not: `INJURY_ACCESS` includes the coach, so the board,
the detail pages, rehab groups and team allocation all open. What a coach does
not get is the **clinical content** inside them — diagnosis and mechanism are
withheld by `CLINICAL_ONLY`, the same way they are on the athlete profile.

*The flow itself, as the sport scientist section states it:*

## STAFF-SS-28 — Injuries

**Entry point.** No sidebar row. Reached from the athlete profile, from
`/reports/injuries`, and by URL.

**CORRECTED 2026-09-10, and the correction matters.** An earlier version of this
section said `/injuries` was `CLINICAL_ONLY` and that the sport scientist could
not open it. That was wrong, and so was the same claim in the coach and S&C
sections. **Every `/injuries/*` route is gated by `requireInjuryAccess()` →
`INJURY_ACCESS`.**

| Route | Gate | Who |
|---|---|---|
| `/injuries` | `requireInjuryAccess` | sport scientist, coach, medic, S&C |
| `/injuries/{injuryId}` | `requireInjuryAccess` | same |
| `/injuries/new` | `requireInjuryAccess` | same |
| `/injuries/rehab-groups` | `requireInjuryAccess` | same |
| `/injuries/team-allocation` | `requireInjuryAccess` | same |

**Only the nutritionist is shut out**, and a role without it is redirected to
`/?e=no-injury-access`.

**What IS `CLINICAL_ONLY` is the content, not the door.** `/injuries` computes
`isMedical` from `CLINICAL_ONLY` and decides what renders from it. **Observed
side by side on 2026-09-10**, rather than inferred:

| | Coach | Medic |
|---|---|---|
| The injury list | body area, side, since-date, expected return, availability status ("Modified", "Unavailable") | the same |
| "+ Injury" | **absent** | **present** |
| "PROBLEM REPORTS" section | **absent** | **present** — athletes' own words and the medic's clinical notes |
| Rendered page length | ~815 characters | ~1,778 characters |

So the difference is **structural, not a hidden column**: the medic gets a whole
section the coach does not, plus the ability to create an injury. A screenshot
showing "PROBLEM REPORTS" or "+ Injury" is a medic's; one showing only the
injury list is not.

**The sport scientist sees the coach column** (measured 2026-09-11): "Print",
"Team allocation →" and "Rehab groups →" (both `.tiny` links), the group
filter chips, and six `.load-row` links — name, body area, side, since-date —
and nothing else. No "+ Injury", no "PROBLEM REPORTS".

An earlier draft of this table guessed "clinical columns". That was wrong in
detail — worth recording, because the guess sounded right and only looking
settled it. The team-allocation screen states the asymmetry
itself: "**Read only.** Medical sees the whole board and every availability
status…"

**How the error happened, recorded because the method produced it twice.** The
gate map was built by grepping each page for `hasAnyRole(claims.roles, X)`. On
`/injuries` that matched line 46 — the `isMedical` computation — rather than the
`requireInjuryAccess()` call that actually guards the route. The same mistake
put `CLINICAL_ONLY` on `/reports/injuries` in the first draft. Reading the
`require*` helper is the reliable method; the in-page `hasAnyRole` calls decide
what renders, not who gets in.

*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/staff-coach-23-to-28-review.md`.**

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`, and the complete file is at the foot of
this brief.

---

## 4. The constraint any proposal must satisfy

1. **The clinical boundary holds at the database and is stated on the detail** ("This is what coaching staff see…") — keep the stated boundary.
2. **The board gains "+ Injury" for the coach** (decided 2026-09-12; the coach's form is the non-clinical one, PATTERN-S3 C9) — a proposal draws the board with it for every `INJURY_ACCESS` role.
3. **Rehab groups stays read-only for the coach with its note**; allocation is `REHAB_ALLOCATION`'s.
4. **Only `tokens.css` values.** Anything not in the file below is flagged as a
   proposed new token, never used.

## 5. What a proposal should address

1. **Before selection on a phone:** the board at 997px fits; team allocation at 3,866 does not. Which of the two is the coach's Friday screen, and what it answers first (who is out, who is modified, until when).
2. **The non-clinical injury form for the coach** (S3 C9) — four fields, pitch-side.

---

## Tokens — the complete file

**Use only these custom properties. Any value not in this file must be flagged
as a proposed new token, never used.**

`src/styles/tokens.css`, verbatim, as of the date at the top of this brief:

```css
/* Fydr design tokens.
 *
 * Ported from 06-design-system.md. Section numbers below refer to that file.
 * This is the ONLY file in the application that may contain a hex value.
 *
 *   §2.2  brand and semantic, single valued, identical in both themes
 *   §2.3  theme tokens, light and dark
 *   §3.7  the derived *-text, *-pill-text and --border-strong sets
 *   §4.5  the *-rgb triplets, so an alpha tint never restates a hex
 *   §14   focus, disabled, skeleton
 *
 * Light is the base at :root. Dark arrives three ways, per §2.4:
 *   1. .dark-tokens on a subtree
 *   2. prefers-color-scheme, only where the user has made no choice
 *   3. :root[data-theme="dark"], the explicit choice
 */

/* ---------------------------------------------------------------------------
   Brand and semantic. §2.2. Not theme split: the same value in light and dark.
   --highlight is decorative and never encodes status, §4.2 change 3.
   --------------------------------------------------------------------------- */
:root {
  /* BRAND ACCENT — 11 Sept 2026, Isabella's decision: #1f6fea -> #17489b, the
     whole app. Recorded in docs/decisions/adr-009-brand-accent.md, guarded by
     scripts/test-brand-accent.ts. This is the LIGHT fill; dark overrides it
     below, because a navy this deep measures 1.73:1 against dark --surf and a
     primary button would vanish into its card. As ink it clears AA on every
     light ground (8.46 surf, 7.20 bg, 6.91 --phone-bg), which is why the four
     light accent inks in §3.7 now simply ARE this value. */
  --accent: #17489b;
  /* Spec §2: the accent's border — the same hue and saturation one lightness
     step up, the ratio #3c85f7 had to #1f6fea. Theme-split since 11 Sept 2026
     (Isabella's decision): each fill gets its own step, see the dark block. */
  --accent-border: #1c59bf;
  --accent2: #33b6ff;
  /* Light-theme handoff §5: Good is #4fd6ff. Was #4dcbb2 (teal) site-wide with
     three scoped blocks (.phone, .nutrition-workspace, .sg) overriding it to
     this cyan because each of their specs named the cyan explicitly. The
     handoff settles it for the whole product, so the override blocks that used
     to sit below the dark theme are gone — one value, one place. Dark already
     read as cyan through those blocks; it now does so everywhere. */
  --good: #4fd6ff;
  --warn: #f6ab2f;
  --bad: #f15a4a;
  --highlight: #f5c518;
  --highlight-text: #3a2e00;
  /* Same literal value as --highlight, deliberately a separate token: §4.2
     change 3 fixed --highlight to be decorative only, never a status
     colour, and DASHBOARD-SPEC.md's gym-session pip is a real status use
     (training=accent, gym=gold, rehab=warn, testing=good, match=bad — one
     colour per session type, gold genuinely means "this is a gym session").
     Reusing --highlight itself for that would quietly undo the fix; a
     same-value, differently-named token keeps both true at once. */
  --gym: #f5c518;
  /* Text on a solid --accent fill. 8.62:1 on the light navy, 4.83:1 on the dark
     fill (11 Sept 2026), so it stays single valued. Derived, §14 has no entry
     for it.
     
     IT WENT DARK FOR ONE COMMIT AND CAME BACK. 0f4b574 repointed --accent to
     the analytics spec's softer #5b9bf0, where white measures 2.84:1 and fails
     AA, so this had to become a dark navy — which repainted every primary
     button in both apps as a side effect of matching four chart colours.
     Isabella's call, and the right one: the chart hues moved to their own
     tokens (see --chart-load below) and --accent went back to a blue dark
     enough to carry white. */
  --on-accent: #ffffff;

  /* KEPT FROM THAT REVERSED COMMIT, because the problem it solves is real
     whatever --accent is. .plan-switch-knob read --on-accent as a FILL rather
     than as ink, so the knob was white only because text on the accent
     happened to be — one token doing two unrelated jobs. Now the knob says
     what it means. Nothing changes visually today. */
  --knob-fill: #ffffff;
  --avatar-bg: #1a2340;
  --avatar-text: #6f9bff;
  /* ATHLETE-APP-SPEC.md §13's toast: a fixed near-black chip in both
     themes, same reasoning as --avatar-bg/--avatar-text just above it —
     a small always-dark surface that isn't the theme background, so it
     stays legible and reads as "the same toast" whichever theme the rest
     of the page is in. */
  --toast-bg: #13161c;
  --toast-text: #ffffff;
  --toast-link: #6f9bff;
  --tab-active: #6f9bff;
  --node-empty-border: #313c60;

  /* §4.5 and §14.6. Channel triplets so a tint reads rgb(var(--x-rgb) / a).
     Space-separated, not comma-separated: modern rgb()'s slash-alpha form
     (`rgb(R G B / A)`) cannot mix with the legacy comma form, and a comma
     triplet substituted in front of a slash — `rgb(31, 111, 234 / .2)` —
     is invalid CSS. It was comma-separated before this comment, which
     silently invalidated every `rgb(var(--x-rgb) / alpha)` declaration in
     the app: background fell back to transparent, border fell back to
     0px none. Confirmed live (a wellness-scale dot rendering with no
     border at all, an availability card with no tint) before tracing it
     to this line — every visible tint anywhere in this app was riding on
     a plain solid colour or a token used without the slash, never on this
     triplet-plus-alpha pattern actually working. */
  --accent-rgb: 23 72 155; /* 11 Sept 2026, Isabella's decision — light; dark carries its own */
  --accent2-rgb: 51 182 255;
  --good-rgb: 79 214 255;
  --warn-rgb: 246 171 47;
  --bad-rgb: 241 90 74;
  --highlight-rgb: 245 197 24;
  --gym-rgb: 245 197 24;
  /* SCHEDULE-SPEC.md §5 and §10: the "meeting" session type's tone is a bare
     neutral-ink alpha (rgba(16,18,23,0.3)), matching no existing named
     token. 16/18/23 is not new to this file — it is already the literal
     channel triplet baked into --border (0.085), --hair (0.05) and
     --border-strong (0.52) above, just never exposed as a reusable triplet
     the way --accent-rgb etc. are. Adding it here is a pure exposure, not a
     new colour: every existing rgba(16,18,23,X) constant in this file is
     unchanged. */
  --ink-rgb: 16 18 23;

  /* §4.4. The status pill fill alpha. Raised from 0.16 so the fill separates
     under dichromacy; the text tokens in §3.7 are derived against this value.
     The light-theme handoff §5 gives three per-tone fills rather than one
     shared alpha — good 0.22 (unchanged, so it stays the default every pill
     inherits), warn 0.28, bad 0.24. Amber and red need more fill than cyan to
     read as the same weight of tint, which is the same dichromacy argument
     that raised the shared value from 0.16 in the first place. */
  --pill-fill-alpha: 0.22;
  --pill-fill-alpha-warn: 0.28;
  --pill-fill-alpha-bad: 0.24;

  /* Domain colour-coding, light-theme handoff §6: "used to distinguish where a
     number came from. One dot, bar segment, or tint per domain." Four of the
     five are existing tokens at identical values, so they alias rather than
     restate — a second literal for the same colour is how --gym and --highlight
     nearly became two colours. Only Recovery is a genuinely new value, and it
     is single-valued (a mid slate that reads on both grounds) like --gym above
     for the same reason: it is painted as a dot or a tint, never as text. */
  --domain-gym: var(--gym);
  --domain-pitch: var(--accent2);
  --domain-testing: var(--good);
  --domain-recovery: #8a94b8;
  /* §4.5's triplet convention: the schedule grid tints a recovery block at
     0.14 and outlines it at 0.4, and neither may restate the hex. Only
     Recovery needs one — the other four domains alias tokens that already
     have their triplet. */
  --domain-recovery-rgb: 138 148 184;
  --domain-medical: var(--bad);

  /* The two-athlete comparison pair, from the Analytics design's own caption:
     "Selby solid in the card's own colour · Fox violet and dashed". Athlete A
     takes whichever colour the board already uses, so the card keeps its
     identity; athlete B is one fixed violet everywhere, so the SECOND athlete
     is the same colour on all four boards and a coach learns it once. Violet
     because it is the one hue in reach that collides with none of the four
     board colours or the three semantic tones. Single-valued: it is a line on
     a chart in both themes, never text. */
  --cmp-b: #8b5cf6;
  --cmp-b-rgb: 139 92 246;

  /* §2.6 radius, §2.7 spacing, §2.8 motion.
     --r-band is the handoff's heat/band cell radius; its --r-ctrl (12px) is
     this file's existing --r-field and its --r-round (50%) is a literal every
     dot and dial already writes inline, so neither is restated here. */
  /* ONE RADIUS FOR EVERYTHING YOU CAN CLICK. Buttons, chips, pills, tabs,
     filter buttons, toggles, steppers and inputs are all 6px: crisp, not
     pill-shaped, and set in one place rather than re-decided per component.

     WHY A NEW TOKEN RATHER THAN EDITING THE OLD ONES. Before this, 47 of the
     58 interactive rules in base.css carried a RAW radius — 20px, 12px, 14px,
     11px, 999px, fourteen different values — and only 11 read a token at all.
     Repointing --r-pill would have moved eleven rules and left the other
     forty-seven pill-shaped, so the sweep had to happen either way; naming the
     result is what stops a forty-eighth appearing. check:radius-tokens fails
     the build if one does. */
  --r-control: 6px;

  /* THE ANALYTICS CHART PALETTE, and the reason it is its own family.
   *
   *  These are the four hexes the chart spec names. They were briefly applied
   *  by repointing --accent, --good and --gym themselves (0f4b574), which
   *  matched the spec everywhere — and repainted every primary button, active
   *  tab and selected chip in both apps, because --accent's softer blue could
   *  no longer carry white text. Isabella's decision: the charts get the
   *  spec's colours, the product keeps its own.
   *
   *  ONLY CHART MARKS MAY READ THESE. They are tuned for a bar or a line on a
   *  card, not for a fill with text on it — white on --chart-load measures
   *  2.84:1, which is why putting one behind a label is the mistake this split
   *  exists to prevent. A control reads --accent; a chart mark reads these.
   *
   *  MEASURED as marks against --elev, both themes, light first:
   *    --chart-load      2.79:1 / 5.24:1
   *    --chart-wellness  1.93:1 / 7.56:1
   *    --chart-gym       1.93:1 / 7.58:1
   *  All three are under the 3:1 graphic-object floor on the light ground, as
   *  the cyan and the gold they replace already were (1.66 and 1.60). The
   *  analytics boards carry axis ticks, a legend and a value label, so the
   *  mark is never the only channel — but a single-channel use needs to know. */
  --chart-load: #5b9bf0;
  --chart-wellness: #5bc7de;
  --chart-gym: #ebae4c;
  /* The same three as rgb triples, because the bars and the shaded band are
     drawn at 22% and 10% and this file's convention is `rgb(var(--x-rgb) / a)`
     rather than color-mix. Declared beside the hexes so the pair cannot drift:
     a board's bars, its band and its line all tint from one colour now, where
     the bars and band used to come from --accent-rgb regardless of the
     board — which is why Training load's bars were product blue behind a
     chart-blue trend line. */
  --chart-load-rgb: 91 155 240;
  --chart-wellness-rgb: 91 199 222;
  --chart-gym-rgb: 235 174 76;

  --r-band: 7px;
  --r-stat: 16px;
  --r-card: 18px;
  /* UNCHANGED, and deliberately NOT aliased to --r-control. Aliasing them was
     the first attempt and it was wrong: --r-pill is still read by
     .gym-progress-track, .gym-progress-fill and .pp-bench-bar, which are BARS.
     A progress fill with 6px corners inside a 6px track is not a crisper
     control, it is a broken bar — and pointing the token at 6px changed all
     three without anything saying so. A token keeps its meaning; controls were
     moved to --r-control one rule at a time, and check:control-radius is what
     stops a control drifting back. */
  --r-toggle: 9px;
  --r-field: 12px;
  --r-tab: 14px;
  --r-pill: 20px;
  /* THE ATHLETE REDESIGN'S PILL, and a third distinct meaning of "round" —
     which is exactly why it gets its own name rather than joining one of the
     two above. --r-pill is 20px and belongs to BARS (see the note above it);
     --r-round is the handoff's 50%, a circle, which every dot and dial writes
     inline. This is neither: fully-rounded ENDS on a control whose height
     decides the radius. Only the athlete controls named in
     ATHLETE_PILL_EXEMPT (scripts/check-control-radius.ts) may read it, and
     that guard fails the build if any other interactive rule does — so "no
     pill-shaped buttons anywhere" still holds everywhere it is not listed. */
  --r-full: 999px;
  --gap-stack: 14px;
  /* THE ATHLETE SHELL'S OWN BLOCK RHYTHM, and the reason it is not --gap-stack.
     Isabella tried 14px on a phone on 2026-09-08 and it read too tight, so the
     athlete body sits at 28px. --gap-stack could not simply be changed: it is
     read by .stack, which 21 staff screens use, and by .profile-grid.
     
     28px is also what eight athlete screens rendered by ACCIDENT before that
     day, from a doubled margin (see 0h) — so this is the same spacing she had
     already signed off, now coming from one place instead of a flex gap plus a
     per-block margin that produced 18, 26, 28, 32 and 40.5px across the app.

     20px since 12 Sept 2026, Isabella's decision — "the vertical gaps in the
     athlete app are too large": one step down the spacing ramp, to the
     --sp-20 value, after the 28px had been seen across the whole athlete
     flow set on a 375×812 phone. A token value change under CLAUDE.md §0.01,
     its own commit. Still the athlete shell's own rhythm with one reader
     (.phone-body); --gap-stack, the staff .stack rhythm, is unchanged. The
     in-list gap (14px, --gap-stack) was judged beside it at 375×812 and left. */
  --gap-body: 20px;
  --gap-grid: 12px;
  --pad-card: 16px;
  --pad-field: 12px 14px;

  /* §2.7 TYPE SCALE. Sixteen steps in rem, added 2026-09-09.

     WHY THERE WAS NONE. This file held 361 tokens and every family bar --r-*
     was a colour. Type and space had nothing, so 144 inline fontSize values
     were raw numbers and NOT ONE of them read a token — because there was
     nothing to read. That is the root cause of the inline-style volume, not
     carelessness, and it is why this block exists before any migration.

     REM, NOT PX, and that is the accessibility half. check-font-scaling.ts
     converted 561 base.css declarations on 2026-09-08 for exactly this reason:
     a px font-size ignores the browser's default-text-size preference outright.
     Its own header records that the staff app's ~130 inline px values were left
     "on work nobody has scheduled". They are scheduled now: reading one of
     these tokens converts a value to rem as a side effect of tokenising it.

     THE STEPS ARE THE ONES THE PRODUCT ALREADY USES. Measured across base.css
     and every .tsx: 705 declarations over 32 distinct sizes. The counts
     below are real, so a step nobody uses is visible as a step nobody uses. */
  --fs-9: 0.5625rem;  /* 9px · 14 declarations */
  --fs-10: 0.625rem;  /* 10px · 12 declarations */
  --fs-11: 0.6875rem;  /* 11px · 62 declarations */
  --fs-12: 0.75rem;  /* 12px · 68 declarations */
  --fs-13: 0.8125rem;  /* 13px · 71 declarations */
  --fs-14: 0.875rem;  /* 14px · 45 declarations */
  --fs-15: 0.9375rem;  /* 15px · 42 declarations */
  --fs-16: 1rem;  /* 16px · 38 declarations */
  --fs-18: 1.125rem;  /* 18px · 6 declarations */
  --fs-20: 1.25rem;  /* 20px · 15 declarations */
  --fs-22: 1.375rem;  /* 22px · 14 declarations */
  --fs-24: 1.5rem;  /* 24px · 4 declarations */
  --fs-28: 1.75rem;  /* 28px · 4 declarations */
  --fs-32: 2rem;  /* 32px · 1 declaration */
  --fs-38: 2.375rem;  /* 38px · 1 declaration */
  --fs-48: 3rem;  /* 48px · 1 declaration */

  /* THE LEGACY HALF IS GONE, collapsed 2026-09-09 on Isabella's decision.
     Sixteen steps sat here for one commit: eight half-pixel sizes plus 8, 17,
     19, 26, 27, 30, 34 and 50. They were tokenised first so nothing was raw
     while the aesthetic call was open, then every call site was moved to a
     sanctioned step and the tokens deleted.

     THE SNAP RULE, recorded because a later reader will ask why 12.5 became 13
     and not 12: nearest sanctioned step, and where a value sat exactly between
     two — which every half-step did — the step already carrying more
     declarations won. That consolidates the scale toward the product's own
     weight rather than scattering ties by preference. Largest move was 1px
     (17 -> 16); every half-step moved 0.5px, and --sp-22 -> --sp-20 moved 2.

     I WAS WRONG ABOUT THE COST OF THIS, and the correction is the useful part.
     The earlier note here called the collapse "a 16-line edit in tokens.css",
     meaning repoint each legacy token at a sanctioned value. That would have
     made every one of these names lie about its value, which is exactly what
     check-scale-tokens.ts asserts against — so the collapse had to move the
     64 call sites and delete the tokens instead.

     WHAT IT DID NOT REACH. base.css still holds ~277 half-step font sizes as
     RAW rem values; they reference no token, so nothing here could touch them.
     They snap when the base.css tranche lands, and every value they need is
     already a step above. */

  /* §2.7 SPACING RAMP. 2px steps to 20, then the four larger stops in use.
     THERE IS NO --sp-0. Zero has no step on any scale, `margin: 0` is idiomatic
     CSS everywhere, and tokenising it broke check-athlete-spacing.ts — that
     guard reads `margin-top: 0` as source text, and `var(--sp-0)` computes the
     same but does not read the same. The inline migration had already skipped
     zeros for the first reason; this is that rule applied consistently.
     1706 declarations over 29 distinct values were measured; 1521 of them
     already land on this ramp, which is why it is a ramp and not a proposal.

     PX, NOT REM, and unlike the type scale that is deliberate. Spacing in rem
     grows padding with someone's text preference, which is usually right and is
     a real behaviour change for every layout in the product. Tokenising must not
     smuggle that in. Named as an open follow-up rather than decided here.

     --gap-stack, --gap-body, --gap-grid and --pad-card stay exactly as they are.
     They are NAMED RHYTHMS with arguments attached (see --gap-body above), not
     ramp steps, and aliasing them to a step would throw away the reasoning. */
  --sp-2: 2px;  /* 69 declarations */
  --sp-4: 4px;  /* 78 declarations */
  --sp-6: 6px;  /* 167 declarations */
  --sp-8: 8px;  /* 225 declarations */
  --sp-10: 10px;  /* 297 declarations */
  --sp-12: 12px;  /* 144 declarations */
  --sp-14: 14px;  /* 287 declarations */
  --sp-16: 16px;  /* 64 declarations */
  --sp-18: 18px;  /* 44 declarations */
  --sp-20: 20px;  /* 12 declarations */
  --sp-24: 24px;  /* 2 declarations */
  --sp-28: 28px;  /* 4 declarations */
  --sp-32: 32px;  /* 1 declaration */
  --sp-40: 40px;  /* 1 declaration */
  --sp-48: 48px;  /* 1 declaration */

  --t-state: 0.15s ease;
  --t-press: 0.08s ease;
  /* The one entrance curve in the product. A strong ease-out: fast out of the
     gate, settling at the end, so the moment the eye is on is the moment that
     moves. Added 2026-09-09 with the dial ring-in, which was the last motion
     in the app carrying a hand-typed curve of its own. Sits here rather than in
     a theme block because a curve is not a colour and does not flip. */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  /* Handoff §9 and §10. State opacities and the one blur radius the theme
     permits (the sticky group-filter bar and the athlete tab bar, nowhere
     else). Single valued: an opacity is not a colour and does not flip. */
  --o-disabled: 0.45;
  --o-gated: 0.62;
  --blur: 14px;
}

/* ---------------------------------------------------------------------------
   Light theme. §2.3 surfaces, §3.7 derived text.
   --------------------------------------------------------------------------- */
:root,
:root[data-theme='light'] {
  /* THE VISUAL LIFT'S GROUND. #e4ebf9, from "Fydr Visual Lift.dc.html"
     variants 1b and 2a (vendored at docs/source/visual-lift/) — the designer's
     answer to the question the Aug 6 handoff left open.

     History, because this value has moved twice. The handoff specified
     #eaedf1 at High fidelity, and its §12 reserved a new colour to the
     designer: "a design decision, not an implementation one". A deepened
     #dde4f2 was tried here on my own judgement and reverted for exactly that
     reason. This is the same move, made by the designer instead — deeper and
     markedly bluer — so it lands as a spec change rather than an override.

     Contrast is NOT inherited from the handoff, because this ground is darker
     than #eaedf1 (relative luminance 0.828 vs 0.844) and dark text on it has
     less room, not more. Four tokens fell below 4.5:1 and were re-derived
     against it — see §3.7 below. White cards separate slightly better as a
     side effect: 1.197:1, up from 1.174:1.

     AND MOVED BACK, 4 Sept 2026, on the client's instruction. The report
     headers canvas (CHANGELOG-headers-spec.md) measures the ground as
     #eaedf1, the handoff's original value, and the client asked for the
     tokens to match it. So this is the handoff figure again rather than the
     Visual Lift's.

     The four re-derivations below are DELIBERATELY LEFT AS THEY ARE. They were
     nudged darker because #e4ebf9 is the darker ground; on the lighter one
     they simply have more margin than they need, which is safe. Undoing them
     would be a second change chasing the first, and they are one hex step from
     where they started. Measured after the change: nothing fell below 4.5:1.
     If the Visual Lift's ground is meant to win after all, this is the line to
     revert and the four below need no attention either way.

     AND THE VISUAL LIFT'S GROUND WON, 7 Sept 2026 — the fourth move, on the
     client's instruction and against a blue sent as a swatch. So this is
     #e4ebf9 again, and the sentence above turned out to be the instruction:
     the four re-derivations were left alone through both moves and are
     correctly derived for this ground once more.

     EVERY OTHER SURFACE IS NOW COMPUTED, NOT PICKED. The whole light surface
     scale moves with the ground and is generated by
     scripts/derive-surface-tokens.ts, which holds the pre-blue grey palette and
     measures each separation off it rather than trusting a transcribed table.
     `--check` re-verifies the values below against that arithmetic and runs in
     prebuild. To move the ground a fifth time, run the script with the new hex
     and paste its output over the seven values; do not adjust one by hand,
     because the ratios ARE the design and a lone edit silently redefines it.

     WHY THE CARD IS NO LONGER PURE WHITE, and why it is barely blue. A card
     sits 1.1743:1 above the ground, and nothing is lighter than white, so the
     ground's luminance can never exceed 0.8441. The old #eaedf1 measured
     exactly 0.8441: the grey was already sitting on that ceiling with a white
     card. Any blue at all is therefore darker, the card comes down with it to
     #fcfdfe, and a genuinely blue CARD is unreachable while the separation is
     preserved — the blue has to live in the ground, the sunken surfaces, the
     fields and the borders, which is exactly where the Visual Lift put it. The
     script refuses a ground above the ceiling rather than clipping to white and
     reporting success. */
  --bg: #e4ebf9;
  --surf: #fcfdfe;
  /* The desk behind the app frame, and any inset well. Light-theme handoff §1.
     Distinct from --surf2 (#f3f5f8), which is a RAISED alt surface: this one
     sits below --bg, --surf2 sits above it. */
  --surf-sunken: #d7e1f6;
  /* The gym domain's tint, per theme rather than one color-mix used on both.
     12% of --gym over --surf composites to cream here and to NEUTRAL GREY on
     the dark ground — measured at color(srgb 0.1947 0.1962 0.1976), R≈G≈B —
     because gold's near-zero blue cancels the dark surface's blue. The dark
     value carries more gold to stay gold. */
  --surf2: #eff3fb;
  --gym-tint: #fef8e4;
  --wk-fill: rgba(31, 111, 234, 0.09);
  --wk-match-border: #17489b; /* the accent — 11 Sept 2026, Isabella's decision */
  --gym-on-tint: #6b4708;
  --elev: #fcfdfe;
  --text: #13161c;
  --muted: #484e57;
  /* AA-CORRECTED 2026-09-09, and it forced --muted to move with it.

     THIS BLOCK DESCRIBED THE CORRECTION FOR WEEKS BEFORE THE VALUES CARRIED
     IT. --faint stayed at #929aa5 and --muted at #5b636e, so the scale it
     claims below was a description of work that had not landed. §3.7 further
     down said the opposite in the same file ("remains failing -- 2.38:1 ...
     Still open"), and @media print already carried BOTH corrected values under
     a comment reading "Print takes the same corrected light scale" -- pointing
     at a screen scale that did not exist. The values below are that print
     pair, moved to the screen where they were derived for. Measured after:
     4.57 / 7.01 / 15.14 on --bg, a 1.53:1 step, which is what this block
     predicted. scripts/check-contrast.ts now measures it on every build, so a
     comment can never again outlive the value it describes.
     #929aa5 measured 2.84:1 on --surf and 2.38:1 on --bg, against the 4.5:1
     that applies to the 11px captions, denominators, field labels and em-dash
     empty markers this token is for. It failed under the August handoff, it
     failed under the Visual Lift, and neither addressed it.

     WHY --MUTED MOVED TOO. Raising the lightest level from 2.38 to 4.57
     consumes most of the usable range, and at 4.57 --faint lands within a hair
     of where --muted used to sit — their mutual contrast would have been
     1.06:1, which is one level, not two. The design system's "three levels, no
     more" only survives if the middle level moves as well, so --muted goes to
     7.01 on --bg. The scale is now 4.57 / 7.01 / 15.14 with a 1.54:1 step
     between faint and muted. That is narrower than the old 2.14:1, and the
     narrowing is unavoidable rather than chosen: the old spacing was bought by
     putting the lightest level below AA. */
  --faint: #626a76;
  /* SOLID, not an ink alpha, 4 Sept 2026 — CHANGELOG-headers-spec.md measures
     #dce1e8 and the client asked the tokens to match. It is the one token in
     this group that no longer adapts to what is behind it: the old
     rgba(16,18,23,0.085) composited to about #ebebeb on a white card and
     #d3dae7 on the page ground, so a card's border was lighter than the page's.
     A single value makes every border the same weight wherever it sits, which
     is what the canvas draws. --border-strong and --hair keep the ink alpha,
     because neither was measured and changing them would be my decision rather
     than the canvas's. */
  --border: #d4dff5;
  --border-strong: rgba(16, 18, 23, 0.52);
  --hair: rgba(16, 18, 23, 0.05);
  /* Handoff §3 raises the unfilled track from 0.07 to 0.10 so a bar reads as
     an empty measure rather than as nothing, and adds --tick for a reference
     marker ON that track (the median mark), which has to out-read it. */
  --track: rgba(16, 18, 23, 0.1);
  --tick: rgba(16, 18, 23, 0.22);
  --barfill: rgba(16, 18, 23, 0.155);
  --field: #ebf0fa;
  --shadow: 0 1px 3px rgba(16, 18, 23, 0.08);

  /* §3.7, a coloured label on a plain surface, 4.5:1 against --bg.
     Handoff §5's on-*-strong column, applied as given EXCEPT where the given
     value fails the very test that column exists to satisfy.

     THE HANDOFF'S OWN RULE, §5: "a semantic colour is never used as text.
     #f6ab2f on white fails contrast at small sizes." The whole pairing
     mechanism is contrast-driven — which makes it a genuine internal
     contradiction that two of its three on-*-strong values fail it too.
     Measured against the handoff's own surfaces:

       --warn-text  #b07d0a   3.63:1 on --surf, 3.09:1 on --bg   FAILS
       --good-text  #0d7a96   4.95:1 on --surf, 4.22:1 on --bg   FAILS on --bg
       --bad-text   #8a2418   8.95:1 / 7.62:1                    passes

     Both failures are replaced with the nearest value in the same hue family
     that clears 4.5:1 on both surfaces. Both are contrast-forced rather than
     aesthetic, and both are worth putting back to the designer: the fix
     belongs upstream. THE VISUAL LIFT DID NOT FIX EITHER — its own light
     variants still set #0d7a96 and #b07d0a, which on its new, darker ground
     measure 4.14:1 and 3.03:1, so the deviations carry forward rather than
     being retired.

     RE-DERIVED FOR THE LIFT'S GROUND. #e4ebf9 is darker than #eaedf1, so
     every one of these lost margin and four fell below the line. Re-derived
     with hue and saturation held, stopping at the first value clearing 4.5:1
     on both --bg and --surf:

       --accent-text       #0065de -> #0064dc   4.55 on bg, 5.45 on surf
       --accent2-text      #0070b3 -> #006eb0   4.55 on bg, 5.44 on surf
       --accent-pill-text  #0051c6 -> #0050c4   4.56 / 5.28 on its own fill
       --accent2-pill-text #0064a6 -> #0063a5   4.54 / 5.27 on its own fill
       --good-text         #0c6f89              4.81 on bg   (already deviated)
       --warn-text         #925900              4.81 on bg   (already deviated)
       --bad-text          #8a2418              7.48 on bg   unchanged

     ACCENT INKS COLLAPSED TO THE ACCENT, 11 Sept 2026, Isabella's decision.
     The rows above for --accent-text and --accent-pill-text are history: with
     the brand navy #17489b the fill itself clears AA as ink on every light
     ground (8.46 surf / 7.20 bg / 6.91 --phone-bg / 5.83 on its own 22% pill
     fill / 6.48 on the strong wash), so --accent-text, --accent-pill-text,
     --accent-on-tint and --accent-on-wash are the one value. Keeping the tuned
     brighter blues would have put a 213° blue beside a navy button.

     --faint is CLOSED as of 2026-09-09, and this paragraph is what kept it
     open: it said "remains the handoff's value and remains failing — 2.38:1
     ... Left as specified because no nearby value fixes it ... Still open",
     while the block above --faint said the correction had already been made
     and @media print had been carrying the corrected pair all along. Two
     paragraphs in one file, disagreeing about the same token, and the value
     following the pessimistic one. The darker caption layer was indeed a
     design decision, and Isabella took it. #626a76 / #484e57, 4.57 and 7.01
     on this ground. */
  --accent-text: #17489b; /* 11 Sept 2026, Isabella's decision */
  --accent2-text: #006eb0;
  --good-text: #0d5f75;
  --warn-text: #b07d0a;
  --bad-text: #8a2418;
  --highlight-fg: #876600;
  --avatar-text-fg: #2a68c6;

  /* §3.7, text on that colour's own tint — the handoff's on-* column,
     applied exactly. */
  --accent-pill-text: #17489b; /* 11 Sept 2026, Isabella's decision */
  --accent2-pill-text: #0063a5;
  --good-pill-text: #0d5f75;
  /* Text on the STRONGEST tint of a bright ramp. The %Max ramp's top band is a
     mint fill heavy enough that light theme's dark --text clears it easily
     (14.97:1) while dark theme's near-white --text does not (3.67:1 measured).
     So this is not --text with a tweak: it is ink either way, and dark theme
     is the case that needs saying. */
  --on-bright-tint: var(--text);
  /* Ink for initials on a --group-* avatar. Its own token because the group
     palette INVERTS between themes -- deep saturated colours in light, light
     pastels in dark -- so the two want opposite inks and no existing token
     spans both. --on-bright-tint is dark ink in BOTH themes, which is right
     for the dark palette and wrong for this one.
     Light, measured against all seven: white 3.40-6.29:1, dark ink
     2.88-5.32:1. White, and the 3:1 large-text bar applies (20px, 700). */
  --on-group: #ffffff;
  /* Text on a pill that itself sits on a tinted card — a tint over a tint,
     which the *-pill-text tokens were not derived for: they assume the pill
     sits on a plain surface. Measured on the gym programme's rehab card and
     its gold block header, the pill-text pair lands at 3.6-3.9:1 in dark.
     These are the values the design specifies for that exact case. */
  --bad-on-tint: #7a1f14;
  --accent-on-tint: #17489b; /* 11 Sept 2026, Isabella's decision */
  --warn-pill-text: #6b4708;
  --bad-pill-text: #7a1f14;
  --highlight-pill-text: #7f6000;

  /* Handoff §4 and §5. Tints and outlines, in ascending strength. Composed
     from the -rgb triplets above so no alpha tint restates a hex (§4.5), and
     so a tone's wash follows its base automatically.

Every alpha here is the handoff's own figure (§4 and §5),
     applied exactly. They were raised once — good to 0.20, warn to 0.22 — on
     the argument that a 0.13 tint on white is barely a tint at all, and
     reverted under the handoff's High fidelity rule. The observation stands
     and is the designer's to act on, not this file's. */
  --wash-accent-soft: rgb(var(--accent-rgb) / 0.07);
  --wash-accent: rgb(var(--accent-rgb) / 0.12);
  --wash-accent-strong: rgb(var(--accent-rgb) / 0.16);
  /* The ground the athlete app's cards sit on. Its own value, not --bg: the
     staff app is a neutral page of dense tables, and the phone is a short
     stack of cards that reads better on a blue wash. Per
     CHANGELOG-athlete-app-edits.md, "app-wide". */
  --phone-bg: #dbe7fb;
  /* Accent ink for the phone's tinted grounds. Used to be its own value because
     the old --accent-text was tuned for a white card and fell to 4.37 on
     --phone-bg; the navy accent measures 6.91 there and 5.74 on the week
     card's wash, so it is the accent too. */
  --accent-on-wash: #17489b; /* 11 Sept 2026, Isabella's decision */
  --border-accent: rgb(var(--accent-rgb) / 0.5);
  --border-accent-soft: rgb(var(--accent-rgb) / 0.42);
  --border-hover: rgb(var(--accent-rgb) / 0.4);
  --ring-accent: 0 0 0 3px rgb(var(--accent-rgb) / 0.16);

  --wash-good: rgb(var(--good-rgb) / 0.13);
  --border-good: rgb(var(--good-rgb) / 0.5);
  --wash-warn: rgb(var(--warn-rgb) / 0.16);
  --border-warn: rgb(var(--warn-rgb) / 0.6);
  --wash-bad: rgb(var(--bad-rgb) / 0.13);
  --border-bad: rgb(var(--bad-rgb) / 0.55);

  /* Handoff §7's figures exactly. A benchmark row carries its percentile band
     as a row tint, so a list colour-codes top to bottom. Four bands, not the
     three the band LABEL uses: 0-19 and 20-39 share a colour and separate on
     strength. The bar fill stays the base tone; only the row takes the wash.
     Suppressed below five subjects with data — §7's own rule, "small samples
     make shading lie" — see .pp-bench-row in base.css.

     Raised once to .18/.10/.16/.20 and reverted for fidelity. Recorded because
     it is a real observation about a spec value rather than a preference:
     band 2 at 0.07 is under two percent of ink over white, and the four bands
     are genuinely hard to separate at a glance, which is the one thing §7 says
     this tint is for. The designer's call, not this file's. */
  --band-1-wash: rgb(var(--bad-rgb) / 0.13);
  --band-2-wash: rgb(var(--bad-rgb) / 0.07);
  --band-3-wash: rgb(var(--warn-rgb) / 0.11);
  --band-4-wash: rgb(var(--good-rgb) / 0.14);

  /* Audit S7/finding 22: was single-valued in §2.2 at #4a5578 — 6.25:1 here in
     light, but only 2.13:1 once the same literal rendered against dark's --bg
     (measured live, athlete-app bottom tab bar text + its glyph's 2px border).
     Theme-split like every other on-surface colour in this block instead. */
  --tab-inactive: #4a5578;

  /* §14.1 focus, §14.4 skeleton. The focus ring is the accent: 8.46:1 against
     --surf, 7.20 against --bg. */
  --focus: #17489b; /* 11 Sept 2026, Isabella's decision */
  --skeleton: #eeeeef;

  /* screens/groups.md palette. Ten of the twelve documented slots: Amber and
     Brown are excluded because the spec's own contrast measurements show
     both failing 3:1 against --warn and --highlight in dark theme (O-247,
     unresolved) — not a colour a picker should knowingly offer. */
  /* Brightened on the club's own request ("make the colour selection for
     creating different groups more vibrant"). The previous light-mode values
     were chosen dark enough to pass as small text, but these tokens are only
     ever painted as swatch dots — GroupSwatch is their sole consumer, and it
     renders a filled circle beside the group's name, never coloured type. So
     the contrast budget they were spending was not being used for anything,
     and spending it on saturation instead makes ten groups genuinely
     distinguishable at 10px. Hues are unchanged; only saturation and
     lightness moved, so an existing group keeps the colour its coach picked.
     Dark mode below was already vivid and is untouched. */
  --group-blue: #2563eb;
  --group-green: #059669;
  --group-purple: #9333ea;
  --group-slate: #64748b;
  --group-indigo: #4f46e5;
  --group-cyan: #0891b2;
  --group-olive: #78960f;
  --group-magenta: #c2258f;
  --group-steel: #3d7f99;
  --group-plum: #86339e;
}

/* ---------------------------------------------------------------------------
   LEADERBOARD-SPEC.md §1. Four literal colours the testing wall needs that
   don't already exist as a token — checked --accent/--accent2/--good/--warn/
   --bad and their -rgb triplets first; everything else in that spec's colour
   table (the tints, the avatar pair, the gold pill) already matches an
   existing token exactly. Single-valued like --gym above: the spec renders
   one theme, so there is no separate dark-theme measurement to diverge from.
   --lb-tint-alpha below is the one exception — audit S7/finding 51 measured
   it live, not against the spec's own (light-only) mockup.
   --------------------------------------------------------------------------- */
:root {
  /* Rank-1's marker sits on its own coloured band (the accent tint) — darker
     than the existing --warn-text/--warn-pill-text derivations, which are
     for a different surface (a status pill's own tint, or plain body text).
     THEME-SPLIT since 2026-09-02. It was single-valued, and the note claiming
     one literal could serve both themes was measured wrong: #7a6205 read
     4.35:1 on the light band and 2.21:1 on the dark one — a dark gold on a
     dark blue, effectively invisible. A band that flips from a near-white
     wash to a deep fill cannot share one ink, exactly as
     --lb-warn-tint-text/--lb-bad-tint-text below already concluded. */
  --lb-rank1: #705a05;
  /* The neutral marker for mid-table ranks. Was var(--faint), which is derived
     for plain body surfaces and measured 4.39:1 light / 4.27:1 dark once a
     rank band was under it. */
  --lb-rank-neutral: #4a5160;
  /* The Standard lens's "met" checkmark. SUPERSEDED IN VALUE, KEPT AS A NAME:
     this was declared independently of the old .phone --good-text override it
     coincidentally matched, and since the light-theme handoff made #4fd6ff the
     product's Good it is now also, exactly, --good-pill-text in light. Left as
     its own token rather than pointed at --good-pill-text because the two are
     equal by the handoff's arithmetic, not by intent — this one is a fixed
     single-valued mark on the testing wall, --good-pill-text is theme-split. */
  --lb-standard-met: #0d5f75;
  /* "Meets the standard" tint, rgba(79,214,255,0.2). Was called out here as
     the spec's own cyan, "distinct from the staff --good (#4dcbb2 teal)" —
     no longer distinct from anything: --good-rgb is this triplet now. Kept
     for the same reason as --lb-standard-met above. */
  --lb-standard-met-rgb: 79 214 255;
  /* The selected wall row's sticky name-cell background, a flat literal the
     spec gives directly rather than as a computed alpha-over-white tint. */
  --lb-row-selected: rgb(243 247 254);
  /* The Result/Improvement/Standard lenses' warn and bad rank tints
     (rgb(var(--warn-rgb) / var(--lb-tint-alpha)) etc. in leaderboardWallMath.ts
     and this component's own LEGEND) at the alpha the spec's light mockup
     used. Unchanged here — dark's override below is the fix, not this value. */
  --lb-tint-alpha: 0.14;
  /* Marker text (the Result lens's "#N" rank number, the Standard lens's
     shortfall figure) that renders directly on the warn/bad tints above, not
     on a plain surface. Audit finding: --faint and the old single-valued
     --lb-warn-on-white/--bad measured 2.4–3.5:1 against those tints in BOTH
     themes — below WCAG's 4.5:1 — because none of them were derived for this
     specific composited background. The generic --warn-pill-text/
     --bad-pill-text pair (tuned for a status pill's own tint) happens to
     clear AA here too, but dark's --bad-pill-text only by 4.58:1 — too thin a
     margin to reuse blind, so these get their own values instead. Unlike
     --lb-rank1/--lb-standard-met above, theme-split: the tint itself flips
     character with --lb-tint-alpha, a near-white wash in light (0.14 over
     white --surf) but a dark, muddy fill in dark (0.24 over #171e36 --surf),
     so one literal colour can't sit on both. Verified with getComputedStyle
     luminance math against the actual composited background, not the raw
     --warn-rgb/--bad-rgb: light 5.08:1 / 5.08:1, dark 5.16:1 / 5.03:1 — all
     comfortably over 4.5:1. */
  --lb-warn-tint-text: #8a601a;
  --lb-bad-tint-text: #ab4035;
}

/* ---------------------------------------------------------------------------
   Dark theme. One block, delivered three ways per §2.4.
   In dark, --surf2, --elev, --field and --avatar-bg are all #1a2340: there is
   one raised surface, not a scale.
   --------------------------------------------------------------------------- */
.dark-tokens,
:root[data-theme='dark'] {
  /* Visual Lift variants 1a and 2b, the dark half of the same scheme:
     #182241 -> #202b4e. Lighter and bluer, so the dark shell reads as a
     surface rather than a void, and it is what the lift's "dark as the hero"
     dashboard is drawn on. */
  --bg: #202b4e;
  --surf: #1d2643;
  /* THE DARK FILL — 11 Sept 2026, Isabella's decision. The brand navy #17489b
     measures 1.73:1 against this theme's --surf (1.61 --bg, 1.97 --phone-bg):
     a primary button that disappears into its card. So dark carries the same
     hue and saturation at the lightness that keeps --on-accent at 4.83:1 and
     the fill 3.08:1 off the card (3.53 off the athlete ground; 2.87 off --bg,
     as the old fill's 2.98 was — a labelled solid button, not a boundary).
     --accent-rgb moves with it so every wash, ring and border alpha in this
     block follows; --accent-border is the same one-step lift as light's. */
  --accent: #2a6ddf; /* 11 Sept 2026, Isabella's decision */
  --accent-rgb: 42 109 223; /* 11 Sept 2026, Isabella's decision */
  --accent-border: #4d86e5; /* 11 Sept 2026, Isabella's decision */
  --surf-sunken: #121a33;
  --surf2: #2b3559;
  --gym-tint: #48432f;
  --wk-fill: rgba(79, 214, 255, 0.12);
  --wk-match-border: #4fd6ff;
  --gym-on-tint: #ffdda6;
  --elev: #1d2643;
  --text: #e9edfa;
  --muted: #a6b3d2;
  /* Same correction, dark side: #6472a0 measured 2.94:1 on --bg. Moved
     lighter, clearing 4.5:1 on all three dark surfaces (--bg 4.56,
     --surf 5.42, --surf2 5.09). --muted is unchanged: at 6.59:1 it already
     passed, and it keeps a 1.45:1 step from the new faint. */
  --faint: #8492bd;
  --border: #2b3559;
  --border-strong: #657199;
  --hair: rgba(255, 255, 255, 0.055);
  --track: rgba(255, 255, 255, 0.12);
  --tick: rgba(255, 255, 255, 0.26);
  --barfill: rgba(255, 255, 255, 0.19);
  --field: #1a2340;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);

  --accent-text: #8fb4ff;
  --accent2-text: #33b6ff;
  --good-text: #8ceaff;
  --warn-text: #ffdda6;
  --bad-text: #ff7460; /* 11 Sept 2026, Isabella's decision — was #f15a4a, 4.47:1 on --surf; now 5.61 surf, 5.22 bg, 5.17 on the bad wash */
  --highlight-fg: #f5c518;
  --avatar-text-fg: #6f9bff;

  --accent-pill-text: #8fb4ff; /* 11 Sept 2026, Isabella's decision — was #699bff, 4.34:1 on its own pill fill; now 5.71 */
  --accent2-pill-text: #33b6ff;
  --good-pill-text: #4fd6ff;
  --on-bright-tint: #101219;
  /* See :root. Dark's palette is pastel, so ink: white 1.89-4.11:1 here,
     ink 4.55-9.90:1. */
  --on-group: #101219;
  /* See :root — text on a tint over a tint. Lighter than *-pill-text, which
     assumes a plain surface underneath the pill. */
  --bad-on-tint: #ffb3a8;
  --accent-on-tint: #8fb4ff;
  --warn-pill-text: #f6ab2f;
  --bad-pill-text: #ff7460;
  --highlight-pill-text: #f5c518;

  /* DARK VALUES DERIVED HERE, NOT SUPPLIED. The light-theme handoff is
     light-only; every wash, border and tint alpha below is a derivation from
     its light counterpart, not a designer measurement, and the two rules used
     to derive them are:
       1. Match perceived tint STRENGTH, not the number. The same alpha of a
          bright tone lifts a dark ground far more than it tints white, so the
          alphas here are mostly LOWER than light's, chosen so a wash separates
          from --surf by roughly the same luminance ratio it does in light
          (~1.07-1.16). A literal copy of light's 0.13/0.16 would have made
          dark's rows shout.
       2. Never let a wash break the text that sits on it. --bad-text was the
          raw #f15a4a here and measured 4.47:1 on plain --surf (this note once
          said 4.94, against an earlier --surf), so any red wash under it ate
          the AA margin — which is what capped --wash-bad and --band-1-wash at
          0.08, the two values furthest from their light siblings. Since
          11 Sept 2026 --bad-text is #ff7460 (5.61 on --surf, 5.17 on the
          0.08 wash); the caps stay, the margin is real now.
     Borders and the focus ring move the other way, up rather than down: a
     1px outline and a 3px ring have to survive on a dark ground. */
  --wash-accent-soft: rgb(var(--accent-rgb) / 0.1);
  --wash-accent: rgb(var(--accent-rgb) / 0.16);
  --wash-accent-strong: rgb(var(--accent-rgb) / 0.22);
  --phone-bg: #141b33;
  /* Dark needs the opposite move: lighter, not darker, against #141b33. */
  --accent-on-wash: #9dbcff;
  --border-accent: rgb(var(--accent-rgb) / 0.62);
  --border-accent-soft: rgb(var(--accent-rgb) / 0.52);
  --border-hover: rgb(var(--accent-rgb) / 0.52);
  --ring-accent: 0 0 0 3px rgb(var(--accent-rgb) / 0.34);

  --wash-good: rgb(var(--good-rgb) / 0.07);
  --border-good: rgb(var(--good-rgb) / 0.55);
  --wash-warn: rgb(var(--warn-rgb) / 0.08);
  --border-warn: rgb(var(--warn-rgb) / 0.62);
  --wash-bad: rgb(var(--bad-rgb) / 0.08);
  --border-bad: rgb(var(--bad-rgb) / 0.6);

  --band-1-wash: rgb(var(--bad-rgb) / 0.08);
  --band-2-wash: rgb(var(--bad-rgb) / 0.045);
  --band-3-wash: rgb(var(--warn-rgb) / 0.08);
  --band-4-wash: rgb(var(--good-rgb) / 0.07);

  /* 4.99:1 vs --bg, 4.94:1 vs --elev (live-measured) — comfortably over the
     4.5:1 this text (and the glyph border it doubles as) needs, dimmer than
     --muted so the active/inactive tab hierarchy still reads, closer in hue
     to the light value above than a bare reuse of --muted would be. */
  --tab-inactive: #949ec9;

  --focus: #33b6ff;
  --skeleton: #33394e;

  --group-blue: #5aa8ff;
  --group-green: #22ab60;
  --group-purple: #ee9fe6;
  --group-slate: #6e7f91;
  --group-indigo: #8c8cf5;
  --group-cyan: #4fc3e8;
  --group-olive: #b4c64a;
  --group-magenta: #f08cc8;
  --group-steel: #7fb4c8;
  --group-plum: #c08fd2;

  --lb-tint-alpha: 0.24;
  --lb-warn-tint-text: #f6ab2f;
  --lb-bad-tint-text: #f5887d;
  /* See :root. Gold has to LIGHTEN on a dark band, not darken. */
  --lb-rank1: #e8c766;
  --lb-rank-neutral: #a3adc9;
}

/* ---------------------------------------------------------------------------
   REMOVED: the .phone, .nutrition-workspace and .sg "Good is cyan" overrides.
   Three specs (ATHLETE-APP-SPEC.md §1, NUTRITION-SPEC.md §1, SCHEDULE-SPEC.md
   §1) each independently named #4fd6ff as their own Good and each got a scoped
   block overriding the staff-wide #4dcbb2 teal, on the reasoning that those
   surfaces never render side by side so nobody could spot the inconsistency.

   The light-theme handoff §5 makes #4fd6ff the product's Good outright, so the
   thing being worked around no longer exists: --good is cyan at :root, and
   light's derived pair is one value per job (--good-text for a label on a
   plain surface, --good-pill-text #0d5f75 for text on the tint — the value
   all three scoped blocks used for both). The label value started as the
   handoff's own #0d7a96 and is now #0c6f89: see §3.7 above, where it was
   re-derived along with the rest when --bg deepened, and where it turned out
   to have been below AA on the old ground too. Keeping the blocks would
   have pinned those three screens to the pill value in places the rest of the
   app now uses the stronger one, which is the inconsistency the overrides
   existed to prevent, only inverted.
   --------------------------------------------------------------------------- */

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* Route 2 of the three ways dark arrives (§2.4). Must track
       :root[data-theme='dark'] exactly — this block was missed when the
       Visual Lift moved the dark ground, so an OS-dark viewer with no explicit
       choice kept #182241 while an explicit choice got #202b4e. Caught by
       diffing the two dark blocks against each other after deploying; they now
       differ in nothing. */
    --bg: #202b4e;
    --surf: #1d2643;
    /* THE DARK FILL — 11 Sept 2026, Isabella's decision. The brand navy #17489b
       measures 1.73:1 against this theme's --surf (1.61 --bg, 1.97 --phone-bg):
       a primary button that disappears into its card. So dark carries the same
       hue and saturation at the lightness that keeps --on-accent at 4.83:1 and
       the fill 3.08:1 off the card (3.53 off the athlete ground; 2.87 off --bg,
       as the old fill's 2.98 was — a labelled solid button, not a boundary).
       --accent-rgb moves with it so every wash, ring and border alpha in this
       block follows; --accent-border is the same one-step lift as light's. */
    --accent: #2a6ddf; /* 11 Sept 2026, Isabella's decision */
    --accent-rgb: 42 109 223; /* 11 Sept 2026, Isabella's decision */
    --accent-border: #4d86e5; /* 11 Sept 2026, Isabella's decision */
    --surf-sunken: #121a33;
    --surf2: #2b3559;
    --gym-tint: #48432f;
    --wk-fill: rgba(79, 214, 255, 0.12);
    --wk-match-border: #4fd6ff;
    --gym-on-tint: #ffdda6;
    --elev: #1d2643;
    --text: #e9edfa;
    --muted: #a6b3d2;
    /* Same correction, dark side: #6472a0 measured 2.94:1 on --bg. Moved
       lighter, clearing 4.5:1 on all three dark surfaces (--bg 4.56,
       --surf 5.42, --surf2 5.09). --muted is unchanged: at 6.59:1 it already
       passed, and it keeps a 1.45:1 step from the new faint. */
    --faint: #8492bd;
    --border: #2b3559;
    --border-strong: #657199;
    --hair: rgba(255, 255, 255, 0.055);
    --track: rgba(255, 255, 255, 0.12);
    --tick: rgba(255, 255, 255, 0.26);
    --barfill: rgba(255, 255, 255, 0.19);
    --field: #1a2340;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4);

    --accent-text: #8fb4ff;
    --accent2-text: #33b6ff;
    --good-text: #8ceaff;
    --warn-text: #ffdda6;
    --bad-text: #ff7460; /* 11 Sept 2026, Isabella's decision */
    --highlight-fg: #f5c518;
    --avatar-text-fg: #6f9bff;

    --accent-pill-text: #8fb4ff; /* 11 Sept 2026, Isabella's decision */
    --accent2-pill-text: #33b6ff;
    --good-pill-text: #4fd6ff;
    --on-bright-tint: #101219;
    /* See :root. Dark's palette is pastel, so ink: white 1.89-4.11:1 here,
       ink 4.55-9.90:1. */
    --on-group: #101219;
    /* See :root — text on a tint over a tint. Lighter than *-pill-text, which
       assumes a plain surface underneath the pill. */
    --bad-on-tint: #ffb3a8;
    --accent-on-tint: #8fb4ff;
    --warn-pill-text: #f6ab2f;
    --bad-pill-text: #ff7460;
    --highlight-pill-text: #f5c518;

    /* Mirror of the .dark-tokens block above; see its comment for how these
       alphas were derived. Kept literal rather than factored out because this
       whole block is already a deliberate duplicate (§2.4's three delivery
       routes) and a half-shared dark theme is worse than a fully repeated one. */
    --wash-accent-soft: rgb(var(--accent-rgb) / 0.1);
    --wash-accent: rgb(var(--accent-rgb) / 0.16);
    --wash-accent-strong: rgb(var(--accent-rgb) / 0.22);
    /* --phone-bg and --accent-on-wash were MISSING from this block until
       11 Sept 2026 — the only two tokens the explicit dark block set that this
       one did not, so an OS-dark athlete with no stored choice got the light
       #dbe7fb shell ground under dark text. Found by diffing the two blocks by
       name while splitting the accent; scripts/test-brand-accent.ts now
       asserts the two define the same set. */
    --phone-bg: #141b33;
    --accent-on-wash: #9dbcff;
    --border-accent: rgb(var(--accent-rgb) / 0.62);
    --border-accent-soft: rgb(var(--accent-rgb) / 0.52);
    --border-hover: rgb(var(--accent-rgb) / 0.52);
    --ring-accent: 0 0 0 3px rgb(var(--accent-rgb) / 0.34);

    --wash-good: rgb(var(--good-rgb) / 0.07);
    --border-good: rgb(var(--good-rgb) / 0.55);
    --wash-warn: rgb(var(--warn-rgb) / 0.08);
    --border-warn: rgb(var(--warn-rgb) / 0.62);
    --wash-bad: rgb(var(--bad-rgb) / 0.08);
    --border-bad: rgb(var(--bad-rgb) / 0.6);

    --band-1-wash: rgb(var(--bad-rgb) / 0.08);
    --band-2-wash: rgb(var(--bad-rgb) / 0.045);
    --band-3-wash: rgb(var(--warn-rgb) / 0.08);
    --band-4-wash: rgb(var(--good-rgb) / 0.07);

    --tab-inactive: #949ec9;

    --focus: #33b6ff;
    --skeleton: #33394e;

    --group-blue: #5aa8ff;
    --group-green: #22ab60;
    --group-purple: #ee9fe6;
    --group-slate: #6e7f91;
    --group-indigo: #8c8cf5;
    --group-cyan: #4fc3e8;
    --group-olive: #b4c64a;
    --group-magenta: #f08cc8;
    --group-steel: #7fb4c8;
    --group-plum: #c08fd2;

    --lb-tint-alpha: 0.24;
    --lb-warn-tint-text: #f6ab2f;
    --lb-bad-tint-text: #f5887d;
    /* See :root. Gold has to LIGHTEN on a dark band, not darken. */
    --lb-rank1: #e8c766;
    --lb-rank-neutral: #a3adc9;
  }
}

/* ---------------------------------------------------------------------------
   Print. §14.7's "Smaller gaps" table: "A print stylesheet forcing the light
   theme, removing shadows, and keeping glyphs." The layout half of that (no
   shadows, hidden nav chrome) lives in base.css's own `@media print` block;
   this is the theme half, and it belongs here specifically because it's the
   one piece that has to repeat literal hex values, which only this file may
   contain.

   Repeats every selector dark theme can arrive through, matched at equal or
   higher specificity than the dark rule it needs to beat in each case —
   this was tried once at a plain `:root` and verified wrong: an OS dark
   preference with no explicit choice delivers dark tokens through
   `:root:not([data-theme])` (§2.4 above), and `:not()`'s specificity is its
   argument's, so that selector outranks a bare `:root` and would have kept
   printing dark regardless of source order. `:root[data-theme='dark']` and
   `.dark-tokens` both already match or exceed a bare `:root` on their own,
   but are listed explicitly rather than relied on implicitly. Only the
   tokens that actually appear in the surfaces clubs print (cards, pills,
   text) are repeated here, not the full set — --focus, --skeleton and the
   group/tab/avatar palette don't render on a printed availability board.
   --------------------------------------------------------------------------- */
@media print {
  :root:not([data-theme]),
  :root[data-theme='dark'],
  :root[data-theme='light'],
  .dark-tokens {
    --bg: #eaedf1;
    --surf: #ffffff;
    --surf-sunken: #dfe3e9;
    --surf2: #f3f5f8;
    --gym-tint: #fef8e4;
    --wk-fill: rgba(31, 111, 234, 0.09);
    --wk-match-border: #17489b;
    --gym-on-tint: #6b4708;
    --elev: #ffffff;
    --text: #13161c;
    --muted: #484e57;
    /* Print takes the same corrected light scale — a printed 11px caption
       is as unreadable at 2.84:1 as an on-screen one. */
    --faint: #626a76;
    --border: rgba(16, 18, 23, 0.085);
    --border-strong: rgba(16, 18, 23, 0.52);
    --hair: rgba(16, 18, 23, 0.05);
    --track: rgba(16, 18, 23, 0.1);
    --tick: rgba(16, 18, 23, 0.22);
    --barfill: rgba(16, 18, 23, 0.155);
    --shadow: none;

    --accent-text: #17489b;
    --accent2-text: #0070b3;
    /* Deliberately NOT tracking the screen theme's re-derivation above. This
       block keeps its own lighter --bg (#eaedf1) and its own restrained wash
       alphas, because a printed page pays for tint in ink and a heavier wash
       is a worse printout, not a better one — so the values derived against
       the screen's deeper ground do not belong here. The ONE exception is
       --good-text: at #0d7a96 it measured 4.22:1 on this block's own ground,
       a real AA failure on paper as much as on screen, so it takes the
       corrected value (4.90:1 here, 5.75:1 on white). */
    --good-text: #0c6f89;
    --warn-text: #995d00;
    --bad-text: #8a2418;

    --accent-pill-text: #17489b;
    --accent2-pill-text: #0064a6;
    --good-pill-text: #0d5f75;
    /* Text on the STRONGEST tint of a bright ramp. The %Max ramp's top band is a
       mint fill heavy enough that light theme's dark --text clears it easily
       (14.97:1) while dark theme's near-white --text does not (3.67:1 measured).
       So this is not --text with a tweak: it is ink either way, and dark theme
       is the case that needs saying. */
    --on-bright-tint: var(--text);
    /* Text on a pill that itself sits on a tinted card — a tint over a tint,
       which the *-pill-text tokens were not derived for: they assume the pill
       sits on a plain surface. Measured on the gym programme's rehab card and
       its gold block header, the pill-text pair lands at 3.6-3.9:1 in dark.
       These are the values the design specifies for that exact case. */
    --bad-on-tint: #7a1f14;
    --accent-on-tint: #17489b;
    --warn-pill-text: #6b4708;
    --bad-pill-text: #7a1f14;

    /* The washes and band tints have to be forced back to their light values
       too, for the same reason every token above is: a club printing from a
       dark session gets light surfaces from this block, and a dark-derived
       wash composited over white would be the wrong tint on the page. */
    --wash-accent-soft: rgb(var(--accent-rgb) / 0.07);
    --wash-accent: rgb(var(--accent-rgb) / 0.12);
    --wash-accent-strong: rgb(var(--accent-rgb) / 0.16);
    --border-accent: rgb(var(--accent-rgb) / 0.5);
    --border-accent-soft: rgb(var(--accent-rgb) / 0.42);
    --border-hover: rgb(var(--accent-rgb) / 0.4);
    --ring-accent: none;

    --wash-good: rgb(var(--good-rgb) / 0.13);
    --border-good: rgb(var(--good-rgb) / 0.5);
    --wash-warn: rgb(var(--warn-rgb) / 0.16);
    --border-warn: rgb(var(--warn-rgb) / 0.6);
    --wash-bad: rgb(var(--bad-rgb) / 0.13);
    --border-bad: rgb(var(--bad-rgb) / 0.55);

    --band-1-wash: rgb(var(--bad-rgb) / 0.13);
    --band-2-wash: rgb(var(--bad-rgb) / 0.07);
    --band-3-wash: rgb(var(--warn-rgb) / 0.11);
    --band-4-wash: rgb(var(--good-rgb) / 0.14);
  }
}
```
