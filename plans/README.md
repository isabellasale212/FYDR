# Animation plans

Produced by the `improve-animations` skill on 2026-09-09 against commit
`fea25a6`. The audit surveyed both surfaces — staff (`src/app/(staff)/`) and
athlete (`src/app/(athlete)/`) — plus the sign-in launch screen.

The skill is read-only on source: these plans describe changes, they do not
contain them. Nothing in `src/` was modified to produce them.

| # | Title | Severity | Category | Status |
|---|---|---|---|---|
| [001](001-remove-dial-ring-in.md) | Stop the profile dials redrawing on every page load | HIGH | Purpose & frequency / duration | **DONE** — via the alternative: gated + 280ms, not deleted |
| [002](002-press-states-fill-not-transform.md) | Make the last four press states a fill, not a shrink | MEDIUM | Cohesion & tokens | **DONE** — reviewed, PASS with two flags |

## Recommended order

**002 first, then 001.** 002 is the safer of the two and needs no product
decision: it finishes a sweep this repo already committed to in writing at
`src/styles/base.css:737`, and every value it uses is copied from a rule that
already exists. 001 removes a visible animation, so it is blocked on Isabella
under `CLAUDE.md` §0 ("the design is frozen") regardless of how well evidenced it
is.

## Dependencies

None. The two plans touch disjoint regions of `src/styles/base.css` — 001 edits
lines 140-147, 002 edits lines 595-668, 2652-2670, 7483-7497 and 8189-8206 — so
they can be executed in either order or in parallel worktrees. Each plan says
"do not also apply the other" only so the two diffs stay separately reviewable.

## What was deliberately NOT planned

The audit produced five findings; three were left unplanned on purpose:

- **`transition: width` on `.gym-progress-fill`** (`base.css:3237`). Animating
  `width` costs layout + paint where `transform: scaleX()` would composite. Real,
  but it is one small element and the fix touches a bar whose geometry is
  spec'd — low leverage against the risk of getting the origin wrong.
- **`transform: scale(0)` in `@keyframes lk-pop`** (`base.css:10920`). The
  animation rubric prohibits `scale(0)` absolutely — nothing in the real world
  appears from nothing. This is the dot on the brand lockup during the sign-in
  splash: a logo rather than UI, seen rarely, and a wordmark is entitled to its
  own motion language. Noted, not planned.
- **No easing tokens at all.** 17 hand-typed `cubic-bezier()` curves,
  `(0.165, 0.84, 0.44, 1)` alone repeated 9 times, in a repo that guards radius,
  spacing, surface tokens and font scaling at build time. Motion is the one axis
  with no token and no guard. Worth doing — but all 17 live in the launch
  sequence, so consolidating them is a refactor of code that is working and
  visually signed off, with no behaviour change to show for it. Raise it when the
  launch sequence is next touched for another reason.

## Missed opportunities: none

Recorded explicitly, because an empty list here is a result rather than an
omission. `CLAUDE.md` §0 freezes the design and `src/styles/base.css:737`
records a deliberate anti-motion position for interaction feedback. Proposing
entrances, staggers or spring physics would re-litigate a settled decision,
which this skill's own Hard Rule 5 forbids.

One genuine seam was observed and is named without a recommendation: after
Publish, `router.refresh()` swaps the schedule grid with no transition, so the
week teleports. Under the current design rule that is correct.


## Verdict on 002 (executed 2026-09-09)

Reviewed against the ten non-negotiable standards in the `review-animations`
skill. **PASS**, with two standards deliberately not met and one check that
could not be run. Recorded here rather than left implicit, because "it went
green" is not the same as "it met the bar".

**Met:** justified motion (1), frequency-appropriate (2), sub-300ms at 80ms (4),
interruptibility — CSS transitions retarget from the current state rather than
restarting like keyframes (6), reduced-motion honoured (8), cohesion — 22 of 22
press rules now speak one language (10). Standard 3's easing question resolves in
favour of `ease`: the audit playbook maps colour changes to `ease`, and this is
now a colour change.

**Standard 7 — GPU-only properties — is NOT met, by design.** The diff trades
`transform` (compositor) for `background` (paint). Strictly, the rule is
"animate transform and opacity only". In practice this is an 80ms paint on
controls between 38px and 44px, which is negligible — but it is a real trade and
it was made on instruction: `src/styles/base.css:737` and the press-states block
at `:11960` both require a fill.

**Standard 5's press-scale preference is also deliberately diverged from.** The
playbook's recommended press feedback is `transform: scale(0.97)` — precisely
what this plan removed. That divergence is the point of the plan, and Hard Rule 5
of `improve-animations` ("don't re-litigate settled decisions") is why the audit
never proposed the reverse.

**Standard 9 — asymmetric enter/exit — is not met, and this diff did not change
that.** Press and release both ramp at `--t-press` (80ms), so the interaction is
symmetric, where the bar wants the deliberate half slower than the system's
response. The four rules changed here inherited that from the eighteen that
preceded them; fixing it is a product-wide decision about `--t-press`, not
something to settle inside a cohesion fix. Filed here, not planned.

**Could not be verified: the held `:active` appearance.** The browser automation
available in this session dispatches clicks that never produce an observable
`mousedown`, so `:active` never engages and the fill cannot be sampled mid-press.
What *was* verified: all four rules are parsed and live in the browser's CSSOM
with the exact intended declarations, across 1701 selectors **no** `:active` rule
still carries a transform, and `.sg-stepper-btn` computes
`transition-property: background` / `transition-duration: 0.08s`. The plan's
touch-device feel check therefore remains outstanding and is a human step.


## Verdict on 001 (executed 2026-09-09, via the alternative target)

Isabella declined the deletion and chose the gated variant: keep the entrance,
fire it once per screen per session, cut 900ms to 280ms, and put the curve in a
token instead of hand-typing a fifth one.

**What shipped.** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` in
`src/styles/tokens.css` — the playbook's strong ease-out, copied not
approximated, and the first easing token this repo has. `base.css` now has
`.dial-arc[data-animate] { animation: ring-in 0.28s var(--ease-out); }` with no
ungated rule left. `Dial.tsx` became a client component holding a module-scope
`Set<string>` of pathnames already played.

**The load-bearing detail.** The played-mark is written in a `useEffect`, never
during render. Effects run after the whole commit, so every dial on a screen
reads the same pre-visit value and they animate together. Written during render —
in the `useState` initialiser, which is the obvious place — the first dial marks
the path and the rest read it as already played: one ring draws, the others sit
still. That failure is invisible with a single dial, so the guard asserts the
mark is absent from the initialiser.

**Verified on the running app, signed in as a coach, in two JS contexts with a
stamped marker proving each navigation was client-side rather than a reload:**

| Case | Arcs | Animating |
| --- | --- | --- |
| Player profile, first visit | 2 | **2** — `ring-in`, `0.28s`, `cubic-bezier(0.23, 1, 0.32, 1)` |
| Same profile, second visit, same session | 2 | **0** — `animation-name: none` |
| Profile first visit *after* the training report had played | 2 | **2** — per-screen, not global |
| A different athlete's profile, first visit | 2 | **2** |
| Training report, first visit | 3 | **3** |
| Training report, revisited client-side in the same session | 3 | **0** |

Both dials animating together on a first visit is the observation that proves the
effect-vs-render detail; a single animating ring would have meant the render-time
bug.

**Two things worth knowing.** The player profile mounts three `<Dial>`s but only
**two** render an arc — the third has `pct === null` and draws the track only,
which is the existing em-dash rule (`Dial.tsx`'s own header: "a missing value is
an em dash, never a zero"). Nothing is broken there. And a hard reload
legitimately resets the gate, because the `Set` lives in the JS context; if the
requirement ever becomes "once per browser session across reloads", that is
`sessionStorage` and a different change.

Reduced motion is unaffected: the global block at `src/styles/base.css:162` still
sets `animation-duration: 0.001ms !important`, so the entrance is neutralised
there as it was before.

`prebuild` exits 0 with 23 suites green, including the new
`test:dial-ring-in` (16 assertions, written to fail first: 13 of 16 failed
against the pre-change code).
