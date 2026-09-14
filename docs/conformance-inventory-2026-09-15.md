# Design system conformance — the inventory, 15 September 2026

**Step 1 of the first closing pass (`docs/queue-pending.md`, "FIRST OF THE TWO
CLOSING PASSES"). Report before building, and stop.** Nothing in
`src/styles/base.css` or any `.tsx` has been changed. The look is settled; this
is the list of every literal value a token covers, by file and line, with the
token it maps to, the current value, the token's value, and whether the
difference is visible — grouped by page, with anything that has no token
flagged rather than invented.

The generator is `scripts/conformance-inventory.ts` (not chained into
prebuild): run it with `--md <file>` to regenerate this document's tables, and
the fix pass re-runs it to prove the count reached zero. Numbers here are
its output on commit `447d827`'s tree.

## Method

**What counts as a literal.** In `src/styles/base.css`, every declaration
value carrying a `px`, `rem`, hex, `rgb()`/`rgba()` or `hsl()` literal for a
property a token family covers: corner radius, spacing (margin, padding, gap,
inset offsets), box sizes (width, height, min/max — a hit target or a fixed
dimension), type size and weight, colour, border widths and shadows. In every
`.tsx`, the same inside `style={{ }}` objects (a bare number is px) and SVG
`fill`/`stroke` colour attributes. Not scanned, by the prompt's own scope or
the repository's standing rules: `tokens.css` itself (the source), `@media
print` blocks (physical output — `check-font-scaling.ts`), `src/lib/pdf.tsx`
(`@react-pdf/renderer` resolves no custom properties — `check-scale-tokens.ts`),
and layout geometry no token covers (`grid-template-*`, `transform`,
`line-height`, `background-size/position`, `stroke-*`, `flex`) — layout is
out of scope.

**How a token is chosen.** By family first, then by value. A radius literal is
matched against `--r-*`, a spacing literal against `--sp-*`, `--gap-*`,
`--pad-*`, a box size against `--sp-*` and the tap floors `--tap-*` / `--hit-*`,
a size against `--fs-*`, a colour against every colour token of the theme block
the rule sits in (light for the default block, dark for `[data-theme='dark']`
and `prefers-color-scheme: dark` blocks). **Exact** when the values are equal.
Otherwise the nearest token within a window — 2px for spacing and radius, 1.5px
for type size, ΔE 6 for colour — with the difference measured (px apart;
CIE76 ΔE with alpha counted) and a verdict: **imperceptible** (≤ 1px, or
ΔE ≤ 2.3, the just-noticeable difference) or **visible**. Beyond the window
the mapping is meaningless and the literal is **flagged as having no token at
that value**; a box size maps only on an exact match, because a 110px column
is layout, not a spacing step. The 9px corner: a radius within a pixel of 9
maps to `--r-toggle`, never to a neighbour that ties.

**A caution the fix pass must carry.** A colour matched *by value* may carry
the wrong *name*: `#fff` maps here to `--on-group` because that token is
`#ffffff`, but the pass should choose the semantic token where several share a
value (a white surface is `--surf`'s business, not "the colour of text on a
group chip"). The table names the value-match; the fix pass names the meaning.

## Totals

- literals: 1593 (base.css 1172, tsx 421)
- exact match to a token: 543
- nearest token within an imperceptible difference: 94
- visible difference (stop on that instance): 10
- no token covers it (flagged, not invented): 946
- by family: weight 444, border 269, spacing 325, radius 89, dimension 390, none 14, shadow 14, colour 41, size 7

Read as a decision list:

- **543 exact matches** are mechanical swaps — the literal becomes the token
  and nothing on screen changes. 80 of them are `44px` hit floors → `--tap-min`,
  and the rest are spacing steps and radii the scale already has.
- **94 imperceptible differences** (≤ 1px, or ΔE ≤ 2.3) would be brought onto
  the token under the prompt's own rule; each is listed with its measured
  difference so the reader can disagree with any one of them.
- **10 visible differences — the stop list below.** The pass stops on each of
  these and asks; none is changed without a ruling.
- **946 flagged, no token** — the majority of the inventory, and not a
  backlog: they are the values the token sheet does not yet cover. No token is
  invented here. They fall into the eight groups under "Flagged" below, and
  the single largest is font weight (444), a family `tokens.css` has never had.

## The stop list — visible differences (10)

Each of these has a nearest token whose value differs visibly. The pass stops
here; the choice is Isabella's: accept the token's value (a visible change),
keep the literal (recorded drift), or add a token (a system decision, §0.01).

| File | Line | Selector / site | Property | Literal | Nearest token | Token value | Difference | Where it shows |
|---|---|---|---|---|---|---|---|---|
| base.css | 86 | `:focus-visible` | border-radius | `4px` | `--r-control` | 6px | 2px | every focus ring, both apps |
| base.css | 7635 | `.nutr-totals-track` | border-radius | `4px` | `--r-control` | 6px | 2px | Nutrition targets, the totals bar |
| base.css | 7641 | `.nutr-totals-fill` | border-radius | `4px` | `--r-control` | 6px | 2px | same bar's fill |
| base.css | 8389 | `.lbw-swatch` | border-radius | `4px` | `--r-control` | 6px | 2px | the leaderboard wall's legend swatch |
| base.css | 9162 | `.wtp-block` | border-radius | `4px` | `--r-control` | 6px | 2px | the week-template preview's blocks |
| base.css | 9532 | `.sg-legend-swatch` | border-radius | `4px` | `--r-control` | 6px | 2px | the schedule's legend |
| base.css | 12869 | `.launch` | `--lk-trace` | `#c5d1e6` | `--border` | `#d4dff5` | ΔE 5.1 | the launch mark's trace, light |
| base.css | 3601 | `.signin-logo` | `--lk-trace` | `#c5d1e6` | `--border` | `#d4dff5` | ΔE 5.1 | the sign-in mark's trace, light |
| base.css | 12923 | `.launch-lockup` | left | `30px` | `--sp-28` | 28px | 2px | the launch lockup's position |
| app/(staff)/platform/sign-in-probes/page.tsx | 110 | `style={{}}` | margin | `26px` | `--sp-24` | 24px | 2px | the platform staff's sign-in probes page |

Five of the ten are one decision: a **4px radius on a small swatch, track or
block**, where the nearest step is `--r-control` at 6px. The other small radii
(1px, 1.5px, 2px, 3px — 16 sites, on bar tracks, pips and hairline markers) are
under "Flagged" because no step is within 2px of them; they are the same
question. The two `--lk-trace` colours are the brand mark's second stroke
(ADR-009 territory, not a page colour). The two 2px offsets are single sites.

## Flagged — no token covers it (946)

Listed by kind. None is changed; none is invented. Each kind is a question for
the token sheet, and the answer belongs to Isabella (§0.01: a new token is a
system decision).

1. **Font weight — 444 sites, no `--w-*` family exists.** `700` ×215, `600`
   ×140, `800` ×38, `500` ×33, `400` ×18, across base.css and 60 `.tsx` files.
   The prompt lists weights in scope; the token sheet has never carried them.
   Recommend: five tokens named for the five weights in use, or a ruling that
   weights stay literal. Until ruled, every one stays as it is.
2. **Border widths — 269 sites, no token.** `1px` ×224 (`border` 114,
   `border-top` 85, `border-bottom` 16, `border-left` 9), `2px` ×27 (19 of them
   focus/outline rings, 8 inline-start accents), `3px` ×10 (emphasis edges on
   flag rows, the profile's flag items). The colour half of every one of these
   borders is already a token; only the width is literal.
3. **Fixed dimensions — 171 sites.** Widths and heights with no exact spacing
   or tap token: columns (`62px`, `76px`, `110px`, `120px`, `480px`), hairlines
   (`1px` ×19 tracks and dividers), marks (`7px`, `9px`, `30px`, `46px`). Layout
   is out of the prompt's scope; they are listed so the count is honest, not so
   they are changed.
4. **Radii off the scale — 16 sites.** `1px`, `1.5px`, `2px`, `3px` on range
   tracks, pips, bars and legend squares (`.nutr-range-*`, `.pc-track`,
   `.dash-stat-bar-*`, `.sg-wiz-pip`, `.gb-bar`, `.legend i`). With the five
   4px sites on the stop list, this is one question: does the system want a
   hairline radius step, or do these become `--r-control` (visible) or stay?
5. **Spacing off the scale — 10 sites.** The launch page (`92px`, `176px`,
   `64px`), `.main`'s page padding (`56px`, `64px`), two field insets that make
   room for an icon (`36px`, `52px`), the skip link's `-9999px`. Page-scale
   distances with no step near them.
6. **Type sizes off the scale — 2 sites.** `.launch-claim-h` at `34px` (the
   scale has 32 and 38) and `.lockup-word` at `386px` (the wordmark, drawn as
   type). Every other font-size in the product is already on the scale — the
   2026-09-09 migration did that work.
7. **Shadows — 13 sites, one `--shadow` token.** The toast, the draft
   popover, the flags panel, the invalid-field ring, the selected phone tile,
   the marker on the positional chart: each a shadow of its own shape. The
   token sheet has one shadow. Recommend: a ruling on whether these are the
   one shadow (imperceptible in most cases) or a second token.
8. **Colours with no token near them — 9 sites.** Two dark-theme whites at
   low alpha on the compliance track and tick (`rgb(255 255 255 / 0.12)`,
   `/ 0.26`), the Safari address bar's `rgb(234 237 241 / 0.94)` (an iOS
   likeness on the install teaching screen — deliberately not a token), the
   CR-10 selected row's `rgb(255 255 255 / 0.8)`, two shadow blacks, one SVG
   stroke at `rgba(16,18,23,0.4)`.
9. **Component-local custom properties — 12 sites.** `--main-pad`,
   `--pad-card-x/y`, `--claim-x/lead`, `--exlib-cols` and the `--lk-*` mark
   colours: a page's own variables, defined once and read below. They are the
   right shape (one place, named) and simply are not on the sheet.
10. **`text-underline-offset` and `vertical-align` — 4 sites.** No family.

## The 9px corner

`--r-toggle: 9px` is the athlete app's card radius (Isabella, 11 September
2026); staff cards keep `--r-card: 18px`. The inventory maps every literal
radius within a pixel of 9 to `--r-toggle`: 14 sites at `8px` and 5 at `10px`
(imperceptible, 1px), 3 already at `9px` (exact). The fix pass must check each
against its app: an `8px` on a staff-only rule maps to `--r-toggle` by value
but may be a staff shape that should read `--r-band` (7px) or stay; the table
carries the file and selector so that reading can be made site by site. Inline
`borderRadius: 8` in `.tsx` (OrgLogoField, UserManagementPanel, TestTrendChart's
dot, PlanGate's icon square) are in the appendix under their files.

## Drift the pass cannot resolve alone

- The **launch page** (`.launch*`, `app/login`) is the product's one screen
  built as an illustration: its distances, its claim size and its mark colours
  are off every scale. Bringing it onto the sheet would be a redesign of that
  screen. Recommend: recorded drift, left alone.
- The **Safari bar** on the install teaching screen imitates iOS Safari on
  purpose; its colours must not be Fydr's tokens. Recommend: recorded drift.
- **`:focus-visible`'s 4px ring radius** is global; changing it to 6px is a
  visible change on every focus ring in both apps. On the stop list.

## What the pass will do once ruled

One commit per page, in the order of the "By page" table below (largest
first), each with before-and-after screenshots at 1440 and 390 in both themes:
the exact swaps, then the imperceptible swaps, with the stop-list and flagged
sites left as they are and named in the commit body. Then `scripts/
conformance-inventory.ts` is run again and its counts are the proof.

## By page or class family

A `base.css` family is the classes sharing a prefix; "used on" lists the files whose markup names one of them, so the family reads as pages.

| Page / family | Literals | Exact | Imperceptible | Visible | No token | Used on |
|---|---|---|---|---|---|---|
| base.css · .sg | 121 | 39 | 3 | 1 | 78 | components/ScheduleGrid/SchedulePhoneDay.tsx, components/ScheduleGrid/ScheduleWorkspace.tsx, components/ScheduleGrid/SelectedSessionPanel.tsx, components/ScheduleGrid/TimeGrid.tsx, components/ScheduleGrid/WeekStatsPanel.tsx |
| base.css · .dash | 86 | 24 | 3 | 0 | 59 | app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/gps/page.tsx +8 |
| base.css · .nutr | 83 | 29 | 10 | 2 | 42 | app/(athlete)/programme/nutrition/page.tsx, components/NutritionTargetForm/NutritionTargetForm.tsx, components/NutritionWorkspace/MealLibraryPicker.tsx, components/NutritionWorkspace/NutritionWorkspace.tsx, components/NutritionWorkspace/RuleStepper.tsx, components/NutritionWorkspace/SelectedAthleteCard.tsx +1 |
| base.css · .tr | 52 | 9 | 6 | 0 | 37 | app/(staff)/reports/gps/page.tsx, components/BodyWeightPanel/BodyWeightPanel.tsx, components/TrainingScatter/TrainingScatter.tsx, components/TrainingSparkline/TrainingSparkline.tsx |
| base.css · .pp | 44 | 4 | 0 | 0 | 40 | app/(staff)/squad/[athleteId]/gym/page.tsx, app/(staff)/squad/[athleteId]/nutrition/page.tsx, app/(staff)/squad/[athleteId]/page.tsx, app/(staff)/squad/[athleteId]/wellness/page.tsx, components/AthleteDomainShell/AthleteDomainShell.tsx, components/BodyWeightPanel/BodyWeightPanel.tsx +7 |
| base.css · .lbw | 37 | 7 | 4 | 1 | 25 | components/LeaderboardWall/LeaderboardWall.tsx |
| base.css · .launch | 29 | 4 | 9 | 2 | 14 | app/login/loading.tsx, app/login/page.tsx |
| base.css · .ph | 29 | 15 | 1 | 0 | 13 | components/AuditLogFilters/AuditLogFilters.tsx, components/StaffPhoneShell/StaffPhoneShell.tsx |
| base.css · .exlib | 27 | 3 | 1 | 0 | 23 | components/ExerciseForm/ExerciseForm.tsx, components/ExerciseLibraryList/ExerciseLibraryList.tsx |
| base.css · .rhead | 27 | 8 | 0 | 0 | 19 | app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/gps/page.tsx, app/(staff)/reports/injuries/page.tsx, app/(staff)/reports/match/page.tsx, app/(staff)/reports/squad/page.tsx +5 |
| base.css · .cmpl | 26 | 8 | 1 | 0 | 17 | app/(staff)/leaderboards/[leaderboardId]/page.tsx, app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/athlete/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/injuries/page.tsx |
| base.css · .ath | 24 | 2 | 1 | 0 | 21 | app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/injuries/page.tsx, app/(staff)/reports/squad/page.tsx |
| base.css · .gym | 22 | 6 | 0 | 0 | 16 | app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx, app/(athlete)/me/privacy/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx +37 |
| src/app/(staff)/reports/gps/page.tsx | 21 | 1 | 2 | 0 | 18 |  |
| base.css · .gl | 18 | 3 | 0 | 0 | 15 | app/(staff)/settings/groups/[groupId]/page.tsx, components/GroupMemberManager/GroupMemberManager.tsx, components/GymSessionLogger/GymSessionLogger.tsx |
| base.css · .pc | 18 | 9 | 3 | 0 | 6 | app/(staff)/squad/[athleteId]/gym/page.tsx, app/(staff)/squad/[athleteId]/nutrition/page.tsx, app/(staff)/squad/[athleteId]/wellness/page.tsx, components/PositionalContext/PositionalContext.tsx |
| src/components/WeekTemplateBuilder/WeekTemplateBuilder.tsx | 17 | 12 | 1 | 0 | 4 |  |
| base.css · .main | 16 | 8 | 0 | 0 | 8 | app/(athlete)/layout.tsx, app/(staff)/layout.tsx, app/(staff)/settings/users/bulk-invite/page.tsx, app/guardian/[token]/page.tsx, app/login/mfa/page.tsx, app/login/page.tsx +4 |
| src/components/EntryCorrectionPanel/EntryCorrectionPanel.tsx | 16 | 12 | 0 | 0 | 4 |  |
| src/components/TimetableSessionCard/TimetableSessionCard.tsx | 15 | 12 | 0 | 0 | 3 |  |
| base.css · .sw | 14 | 0 | 0 | 0 | 14 | app/(staff)/reports/squad/page.tsx |
| base.css · .nav | 13 | 0 | 1 | 0 | 12 | app/(staff)/injuries/page.tsx, app/(staff)/nutrition/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/gps/page.tsx, app/(staff)/reports/squad/page.tsx, app/(staff)/reports/training-load/page.tsx +3 |
| src/app/(staff)/reports/athlete/[athleteId]/page.tsx | 13 | 3 | 0 | 0 | 10 |  |
| base.css · .wm | 12 | 1 | 3 | 0 | 8 | components/Sidebar/Sidebar.tsx |
| base.css · .hist | 12 | 3 | 0 | 0 | 9 | app/(athlete)/my-data/page.tsx, components/WaitingQueue/WaitingQueue.tsx |
| base.css · .me | 12 | 0 | 0 | 0 | 12 | app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/me/leaderboards/page.tsx, app/(athlete)/me/notifications/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx +6 |
| base.css · .wtp | 12 | 5 | 1 | 1 | 5 | components/WeekTemplatePreview/WeekTemplatePreview.tsx |
| base.css · .mute | 12 | 6 | 3 | 0 | 3 | app/(athlete)/me/notifications/page.tsx, app/(staff)/settings/notifications/page.tsx, components/InjurySiteSettingSwitch/InjurySiteSettingSwitch.tsx, components/NotificationPreferencesForm/NotificationPreferencesForm.tsx, components/RpeSettingSwitch/RpeSettingSwitch.tsx |
| base.css · .pick | 12 | 3 | 1 | 0 | 8 | app/(athlete)/my-data/page.tsx, app/(staff)/reports/athlete/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/gps/page.tsx, app/(staff)/reports/testing/page.tsx, app/(staff)/squad/[athleteId]/nutrition/page.tsx +5 |
| src/app/(athlete)/my-data/page.tsx | 12 | 12 | 0 | 0 | 0 |  |
| src/components/InjuryCard/InjuryCard.tsx | 12 | 12 | 0 | 0 | 0 |  |
| base.css · .lb | 11 | 3 | 1 | 0 | 7 | app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(staff)/leaderboards/[leaderboardId]/page.tsx, components/LeaderboardBuilderForm/LeaderboardBuilderForm.tsx |
| src/app/(staff)/dashboard/page.tsx | 11 | 6 | 0 | 0 | 5 |  |
| base.css · .avail | 10 | 1 | 0 | 0 | 9 | app/(athlete)/today/page.tsx, components/AvailabilityAudience/AvailabilityAudience.tsx, components/AvailabilityBanner/AvailabilityBanner.tsx, components/SetAvailabilityForm/SetAvailabilityForm.tsx, components/SetAvailabilityFormCoach/SetAvailabilityFormCoach.tsx |
| base.css · .tbl | 10 | 0 | 0 | 0 | 10 | app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(staff)/platform/sign-in-probes/page.tsx, app/(staff)/programmes/proposals/page.tsx, app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/match/page.tsx +16 |
| base.css · .wk | 10 | 1 | 0 | 0 | 9 | app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/reports/compliance/page.tsx |
| base.css · .set | 10 | 2 | 0 | 0 | 8 | app/(athlete)/consent/staff/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx +76 |
| src/app/(staff)/settings/club/page.tsx | 10 | 6 | 0 | 0 | 4 |  |
| src/components/GroupMemberManager/GroupMemberManager.tsx | 10 | 4 | 0 | 0 | 6 |  |
| src/components/UserManagementPanel/UserManagementPanel.tsx | 10 | 9 | 1 | 0 | 0 |  |
| base.css · .sc | 9 | 1 | 0 | 0 | 8 | app/(staff)/dashboard/page.tsx, components/RpeForm/RpeForm.tsx, components/ScaleInput/ScaleInput.tsx |
| base.css · .signin | 9 | 0 | 3 | 1 | 5 | app/guardian/[token]/page.tsx, app/login/mfa/page.tsx, app/login/reset/confirm/page.tsx, app/login/reset/page.tsx, components/LoginForm/LoginForm.tsx, components/MfaChallengeForm/MfaChallengeForm.tsx +2 |
| base.css · .dark | 9 | 0 | 7 | 0 | 2 | app/layout.tsx, components/AvatarUploadForm/AvatarUploadForm.tsx, components/InjuryCard/InjuryCard.tsx, components/NutritionWorkspace/TargetsTable.tsx, components/Sidebar/Sidebar.tsx, components/ThemeToggle/ThemeToggle.tsx +1 |
| base.css · .setup | 9 | 3 | 0 | 0 | 6 | app/(staff)/dashboard/page.tsx, app/(staff)/settings/page.tsx, app/(staff)/settings/setup/page.tsx, components/UserManagementPanel/UserManagementPanel.tsx |
| base.css · .inj | 9 | 0 | 1 | 0 | 8 | app/(staff)/reports/athlete/page.tsx, app/(staff)/reports/injuries/page.tsx, components/InjuryMedicalForm/InjuryMedicalForm.tsx |
| base.css · .rsel | 9 | 0 | 2 | 0 | 7 | components/ReportSelectNav/ReportSelectNav.tsx |
| base.css · .safari | 9 | 3 | 2 | 0 | 4 | components/InstallCard/InstallCard.tsx |
| src/app/(staff)/reports/testing/page.tsx | 9 | 4 | 1 | 0 | 4 |  |
| src/components/ScheduleGrid/SelectedSessionPanel.tsx | 9 | 6 | 1 | 0 | 2 |  |
| base.css · .btn | 8 | 2 | 0 | 0 | 6 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/data-consent/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx +129 |
| base.css · .dots | 8 | 4 | 1 | 0 | 3 | app/(athlete)/my-data/page.tsx, app/(staff)/dashboard/page.tsx, components/ScaleInput/ScaleInput.tsx, components/WellnessChart/WellnessChart.tsx |
| base.css · .toast | 8 | 3 | 0 | 0 | 5 | app/(athlete)/today/page.tsx, components/NewSessionForm/NewSessionForm.tsx, components/RpeForm/RpeForm.tsx, components/Toast/Toast.tsx |
| base.css · .plan | 8 | 4 | 0 | 0 | 4 | app/(athlete)/consent/guardian/page.tsx, app/(athlete)/layout.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/injuries/[injuryId]/page.tsx, app/(staff)/leaderboards/[leaderboardId]/page.tsx +23 |
| base.css · .cmp | 8 | 1 | 0 | 0 | 7 | app/(staff)/analytics/page.tsx |
| src/components/AvatarUploadForm/AvatarUploadForm.tsx | 8 | 2 | 0 | 0 | 6 |  |
| src/components/OrgLogoField/OrgLogoField.tsx | 8 | 3 | 2 | 0 | 3 |  |
| base.css · .athlete | 7 | 1 | 1 | 0 | 5 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/decide/page.tsx, app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx +156 |
| base.css · .rd | 7 | 0 | 1 | 0 | 6 | app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx |
| base.css · .subm | 7 | 1 | 0 | 0 | 6 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/data-consent/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx +9 |
| base.css · .cr10 | 7 | 1 | 0 | 0 | 6 | components/CR10List/CR10List.tsx, components/TodayRpeRow/TodayRpeRow.tsx |
| base.css · .prog | 7 | 2 | 0 | 0 | 5 | app/(athlete)/programme/page.tsx, app/(staff)/programmes/[programmeId]/athlete/[athleteId]/page.tsx, app/(staff)/programmes/page.tsx, components/GymSessionLogger/GymSessionLogger.tsx |
| base.css · .pw | 7 | 5 | 0 | 0 | 2 | app/(athlete)/me/status/page.tsx, components/PasswordField/PasswordField.tsx, components/ResetConfirmForm/ResetConfirmForm.tsx, components/StageLadder/StageLadder.tsx |
| src/app/(athlete)/my-data/boards/[leaderboardId]/page.tsx | 7 | 6 | 0 | 0 | 1 |  |
| src/app/(staff)/reports/injuries/page.tsx | 7 | 5 | 0 | 0 | 2 |  |
| src/app/(staff)/squad/[athleteId]/page.tsx | 7 | 7 | 0 | 0 | 0 |  |
| src/components/PlayerProfileFlags/PlayerProfileFlags.tsx | 7 | 4 | 2 | 0 | 1 |  |
| src/components/TestLogGrid/TestLogGrid.tsx | 7 | 6 | 0 | 0 | 1 |  |
| src/components/ThresholdEditorForm/ThresholdEditorForm.tsx | 7 | 4 | 0 | 0 | 3 |  |
| src/components/TrainingScatter/TrainingScatter.tsx | 7 | 3 | 1 | 0 | 3 |  |
| base.css · .theme | 6 | 2 | 1 | 0 | 3 | app/(athlete)/layout.tsx, app/(athlete)/me/page.tsx, app/layout.tsx, app/login/page.tsx, components/GroupEditForm/GroupEditForm.tsx, components/NutritionWorkspace/TargetsTable.tsx +2 |
| base.css · .empty | 6 | 2 | 0 | 0 | 4 | app/(athlete)/consent/staff/page.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/dashboard/page.tsx +41 |
| base.css · .legend | 6 | 1 | 0 | 0 | 5 | app/(athlete)/today/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/reports/athlete/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/gps/page.tsx, app/(staff)/squad/[athleteId]/wellness/page.tsx |
| base.css · .sheet | 6 | 3 | 1 | 0 | 2 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/leaderboards/page.tsx, app/(athlete)/me/reminders/install/page.tsx +19 |
| base.css · .back | 6 | 1 | 0 | 0 | 5 | app/(athlete)/consent/guardian/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/boards/page.tsx +73 |
| base.css · .lockup | 6 | 1 | 0 | 0 | 5 | app/login/loading.tsx, app/login/page.tsx, components/FydrLockup/FydrLockup.tsx |
| src/app/(staff)/settings/groups/[groupId]/page.tsx | 6 | 3 | 0 | 0 | 3 |  |
| src/app/(staff)/settings/groups/page.tsx | 6 | 4 | 0 | 0 | 2 |  |
| src/components/ExportBuilderForm/ExportBuilderForm.tsx | 6 | 4 | 0 | 0 | 2 |  |
| src/components/PlayerProfileBio/PlayerProfileBio.tsx | 6 | 2 | 0 | 0 | 4 |  |
| base.css · .pill | 5 | 0 | 0 | 0 | 5 | app/(athlete)/check-in/page.tsx, app/(athlete)/layout.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/nutrition-check-in/page.tsx +56 |
| base.css · .attn | 5 | 0 | 0 | 0 | 5 | app/(staff)/reports/squad/page.tsx, components/AttentionRow/AttentionRow.tsx |
| base.css · .phone | 5 | 1 | 0 | 0 | 4 | app/(athlete)/layout.tsx, app/(athlete)/me/notifications/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(athlete)/today/waiting/page.tsx +27 |
| base.css · .gb | 5 | 2 | 0 | 0 | 3 | app/(athlete)/my-data/page.tsx, app/guardian/[token]/page.tsx |
| base.css · .md | 5 | 1 | 1 | 0 | 3 | app/(athlete)/my-data/page.tsx, app/(athlete)/rpe/[sessionId]/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/programmes/[programmeId]/athlete/[athleteId]/page.tsx, app/(staff)/programmes/page.tsx, app/(staff)/reports/gps/page.tsx +5 |
| base.css · .flag | 5 | 0 | 0 | 0 | 5 | app/(athlete)/my-data/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/flags/page.tsx, app/(staff)/layout.tsx, app/(staff)/nutrition/new/page.tsx, app/(staff)/nutrition/page.tsx +18 |
| base.css · .consent | 5 | 1 | 0 | 0 | 4 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/decide/page.tsx, app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx +14 |
| src/app/(staff)/reports/compliance/page.tsx | 5 | 4 | 0 | 0 | 1 |  |
| src/components/DashboardHeadlineStats/DashboardHeadlineStats.tsx | 5 | 0 | 0 | 0 | 5 |  |
| src/components/PlanGate/PlanGate.tsx | 5 | 2 | 0 | 0 | 3 |  |
| src/components/StageLadder/StageLadder.tsx | 5 | 3 | 0 | 0 | 2 |  |
| base.css · .skip | 4 | 2 | 0 | 0 | 2 | app/(athlete)/rpe/[sessionId]/page.tsx, app/(staff)/schedule/planner/apply/page.tsx, app/layout.tsx, components/ClinicalReviewForm/ClinicalReviewForm.tsx |
| base.css · .sign | 4 | 1 | 0 | 0 | 3 | app/(athlete)/me/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/injuries/[injuryId]/page.tsx, app/(staff)/platform/sign-in-probes/page.tsx, app/(staff)/reports/athlete/[athleteId]/page.tsx +20 |
| base.css · .sess | 4 | 1 | 1 | 0 | 2 | app/(athlete)/rpe/[sessionId]/page.tsx, components/ScheduleGrid/SelectedSessionPanel.tsx |
| base.css · .step | 4 | 2 | 0 | 0 | 2 | app/(staff)/dashboard/page.tsx, app/(staff)/leaderboards/[leaderboardId]/pdf/route.tsx, app/(staff)/reports/compliance/pdf/route.tsx, app/(staff)/settings/groups/page.tsx, app/(staff)/settings/setup/page.tsx, app/(staff)/settings/subject-access/[requestId]/review/page.tsx +24 |
| base.css · .disclose | 4 | 1 | 0 | 0 | 3 | components/CheckInForm/CheckInForm.tsx, components/InjuryCard/InjuryCard.tsx |
| base.css · .audit | 4 | 4 | 0 | 0 | 0 | app/(athlete)/me/data-consent/page.tsx, app/(athlete)/me/privacy/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/programme/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/compliance/page.tsx +45 |
| base.css · .rep | 4 | 0 | 0 | 0 | 4 | app/(athlete)/my-data/page.tsx, app/(staff)/reports/page.tsx, components/TestLogGrid/TestLogGrid.tsx |
| base.css · .rfig | 4 | 0 | 0 | 0 | 4 | components/ReportFigure/ReportFigure.tsx |
| src/app/(athlete)/rpe/[sessionId]/page.tsx | 4 | 4 | 0 | 0 | 0 |  |
| src/app/(staff)/programmes/page.tsx | 4 | 2 | 0 | 0 | 2 |  |
| src/app/(staff)/settings/thresholds/page.tsx | 4 | 4 | 0 | 0 | 0 |  |
| src/components/NutritionWorkspace/MealLibraryPicker.tsx | 4 | 2 | 0 | 0 | 2 |  |
| src/components/TestDateNav/TestDateNav.tsx | 4 | 4 | 0 | 0 | 0 |  |
| base.css · .(element) | 3 | 1 | 0 | 1 | 1 | (no .tsx names this family — element or global rule) |
| base.css · .visually | 3 | 0 | 1 | 0 | 2 | app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/programmes/proposals/page.tsx, app/(staff)/reports/athlete/page.tsx, app/(staff)/reports/match/page.tsx +21 |
| base.css · .brand | 3 | 1 | 0 | 0 | 2 | app/(athlete)/my-data/page.tsx, app/layout.tsx, app/login/page.tsx, components/LeaderboardWall/LeaderboardWall.tsx, components/ScheduleGrid/ScheduleWorkspace.tsx, components/ScheduleGrid/SelectedSessionPanel.tsx +3 |
| base.css · .toggle | 3 | 1 | 0 | 0 | 2 | app/(athlete)/layout.tsx, app/(athlete)/me/leaderboards/page.tsx, app/(athlete)/me/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/reports/gps/page.tsx, app/(staff)/schedule/page.tsx +8 |
| base.css · .field | 3 | 1 | 0 | 0 | 2 | app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/injuries/rehab-groups/page.tsx, app/(staff)/leaderboards/[leaderboardId]/page.tsx, app/(staff)/nutrition/new/page.tsx +81 |
| base.css · .squad | 3 | 1 | 0 | 0 | 2 | app/(athlete)/consent/declined/page.tsx, app/(athlete)/me/data-consent/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(staff)/analytics/page.tsx +88 |
| base.css · .hd | 3 | 2 | 0 | 0 | 1 | app/(athlete)/me/data-consent/page.tsx, app/(athlete)/me/notifications/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/me/privacy/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/boards/page.tsx +6 |
| base.css · .done | 3 | 2 | 0 | 0 | 1 | app/(athlete)/me/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/schedule/fixtures/[fixtureId]/page.tsx +14 |
| base.css · .report | 3 | 0 | 0 | 0 | 3 | app/(athlete)/check-in/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/report-problem/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/analytics/page.tsx +54 |
| base.css · .after | 3 | 0 | 0 | 0 | 3 | app/(athlete)/check-in/page.tsx, app/(athlete)/me/data-consent/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/me/reminders/install/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx +61 |
| base.css · .nut | 3 | 0 | 0 | 0 | 3 | components/NutritionCheckinForm/NutritionCheckinForm.tsx |
| base.css · .reorder | 3 | 2 | 0 | 0 | 1 | app/(staff)/settings/groups/page.tsx, components/BlockedButton/BlockedButton.tsx, components/GroupReorderButtons/GroupReorderButtons.tsx |
| base.css · .um | 3 | 2 | 0 | 0 | 1 | components/UserManagementPanel/UserManagementPanel.tsx |
| base.css · .dlg | 3 | 1 | 0 | 0 | 2 | components/Dialog/Dialog.tsx, components/ExportDialog/ExportDialog.tsx, components/RetentionPanel/RetentionPanel.tsx |
| base.css · .pv | 3 | 0 | 0 | 0 | 3 | app/(athlete)/me/privacy/page.tsx |
| base.css · .held | 3 | 1 | 0 | 0 | 2 | app/(athlete)/consent/guardian/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/programmes/page.tsx, app/(staff)/schedule/page.tsx +15 |
| base.css · .ap | 3 | 0 | 0 | 0 | 3 | app/(staff)/analytics/page.tsx, components/AnalyticsPanel/AnalyticsPanel.tsx |
| base.css · .tst | 3 | 2 | 0 | 0 | 1 | app/(staff)/reports/testing/page.tsx |
| base.css · .pb | 3 | 1 | 0 | 0 | 2 | app/(staff)/reports/athlete/[athleteId]/pdf/route.tsx, components/ProgrammeBuilder/ProgrammeBuilder.tsx |
| src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx | 3 | 3 | 0 | 0 | 0 |  |
| src/app/(athlete)/report-problem/page.tsx | 3 | 2 | 1 | 0 | 0 |  |
| src/app/(athlete)/today/page.tsx | 3 | 0 | 3 | 0 | 0 |  |
| src/app/(staff)/leaderboards/[leaderboardId]/page.tsx | 3 | 2 | 0 | 0 | 1 |  |
| src/app/(staff)/reports/page.tsx | 3 | 1 | 1 | 0 | 1 |  |
| src/app/(staff)/schedule/fixtures/[fixtureId]/participation/page.tsx | 3 | 1 | 0 | 0 | 2 |  |
| src/app/(staff)/settings/plan/page.tsx | 3 | 2 | 0 | 0 | 1 |  |
| src/components/BodyWeightPanel/BodyWeightPanel.tsx | 3 | 2 | 0 | 0 | 1 |  |
| src/components/BulkInviteForm/BulkInviteForm.tsx | 3 | 3 | 0 | 0 | 0 |  |
| src/components/TestBests/TestBests.tsx | 3 | 0 | 0 | 0 | 3 |  |
| src/components/TestTrendChart/TestTrendChart.tsx | 3 | 2 | 1 | 0 | 0 |  |
| src/components/UserDetailPanel/UserDetailPanel.tsx | 3 | 3 | 0 | 0 | 0 |  |
| base.css · .page | 2 | 0 | 0 | 0 | 2 | app/(athlete)/layout.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/boards/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx +148 |
| base.css · .card | 2 | 0 | 0 | 0 | 2 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/data-consent/page.tsx, app/(athlete)/me/leaderboards/page.tsx +167 |
| base.css · .chip | 2 | 0 | 0 | 0 | 2 | app/(athlete)/my-data/page.tsx, app/(staff)/injuries/[injuryId]/page.tsx, app/(staff)/layout.tsx, app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/gps/page.tsx +31 |
| base.css · .arow | 2 | 0 | 0 | 0 | 2 | components/AvailabilityList/AvailabilityList.tsx |
| base.css · .load | 2 | 0 | 0 | 0 | 2 | app/(athlete)/my-data/boards/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/programme/page.tsx, app/(athlete)/report-problem/page.tsx, app/(staff)/analytics/page.tsx +49 |
| base.css · .pbar | 2 | 0 | 0 | 0 | 2 | (no .tsx names this family — element or global rule) |
| base.css · .todo | 2 | 0 | 0 | 0 | 2 | app/(athlete)/today/page.tsx, app/(staff)/settings/groups/[groupId]/page.tsx, app/(staff)/settings/groups/page.tsx, components/ExportBuilderForm/ExportBuilderForm.tsx, components/GroupMemberManager/GroupMemberManager.tsx, components/ScheduleGrid/SelectedSessionPanel.tsx +1 |
| base.css · .td | 2 | 1 | 0 | 0 | 1 | app/(athlete)/me/status/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/reports/gps/pdf/route.tsx, components/TodayRpeRow/TodayRpeRow.tsx |
| base.css · .dir | 2 | 0 | 0 | 0 | 2 | components/NutritionCheckinForm/NutritionCheckinForm.tsx, components/RpeForm/RpeForm.tsx |
| base.css · .err | 2 | 0 | 0 | 0 | 2 | components/AvatarUploadForm/AvatarUploadForm.tsx, components/CheckInForm/CheckInForm.tsx, components/ClinicalReviewForm/ClinicalReviewForm.tsx, components/ClubDetailsEditForm/ClubDetailsEditForm.tsx, components/InjurySiteSettingSwitch/InjurySiteSettingSwitch.tsx, components/NotificationPreferencesForm/NotificationPreferencesForm.tsx +3 |
| base.css · .login | 2 | 1 | 0 | 0 | 1 | app/(staff)/settings/profile/page.tsx, app/guardian/[token]/page.tsx, app/login/mfa/page.tsx, app/login/page.tsx, app/login/reset/confirm/page.tsx, app/login/reset/page.tsx +4 |
| base.css · .form | 2 | 0 | 0 | 0 | 2 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/nutrition-check-in/page.tsx, app/(athlete)/rpe/[sessionId]/page.tsx +113 |
| base.css · .gold | 2 | 1 | 0 | 0 | 1 | app/(athlete)/my-data/page.tsx, app/(staff)/settings/club/page.tsx, components/AthleteTabBar/AthleteTabBar.tsx |
| base.css · .linklike | 2 | 0 | 0 | 0 | 2 | app/(athlete)/me/data-consent/page.tsx, app/(staff)/flags/page.tsx, app/(staff)/reports/compliance/page.tsx, app/(staff)/reports/match/page.tsx, app/(staff)/reports/training-load/page.tsx, components/GroupFilter/GroupFilter.tsx +3 |
| base.css · .roster | 2 | 0 | 0 | 0 | 2 | app/(staff)/reports/injuries/page.tsx, app/(staff)/reports/testing/page.tsx, app/(staff)/schedule/fixtures/[fixtureId]/participation/page.tsx, app/(staff)/settings/club/page.tsx, app/(staff)/settings/imports/page.tsx, app/(staff)/squad/[athleteId]/page.tsx +7 |
| base.css · .week | 2 | 0 | 0 | 0 | 2 | app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/nutrition-check-in/page.tsx, app/(athlete)/programme/page.tsx, app/(athlete)/rpe/[sessionId]/page.tsx, app/(athlete)/today/page.tsx +52 |
| base.css · .absence | 2 | 0 | 0 | 0 | 2 | app/(athlete)/me/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/leaderboards/[leaderboardId]/page.tsx +16 |
| base.css · .ro | 2 | 0 | 0 | 0 | 2 | components/ReadOnlyOwner/ReadOnlyOwner.tsx, components/ScheduleGrid/TimeGrid.tsx |
| base.css · .legal | 2 | 0 | 0 | 0 | 2 | app/(athlete)/me/page.tsx, app/(staff)/nutrition/page.tsx, app/(staff)/settings/plan/page.tsx, components/AthleteProfileEditForm/AthleteProfileEditForm.tsx, components/LegalPlaceholder/LegalPlaceholder.tsx, components/PeriodSelector/PeriodSelector.tsx |
| base.css · .install | 2 | 1 | 0 | 0 | 1 | app/(athlete)/me/notifications/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/today/page.tsx, components/DeviceBeacon/DeviceBeacon.tsx, components/InstallCard/InstallCard.tsx, components/StageLadder/StageLadder.tsx |
| src/app/(athlete)/me/status/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/app/(staff)/nutrition/page.tsx | 2 | 0 | 0 | 0 | 2 |  |
| src/app/(staff)/platform/sign-in-probes/page.tsx | 2 | 1 | 0 | 1 | 0 |  |
| src/app/(staff)/programmes/[programmeId]/athlete/[athleteId]/page.tsx | 2 | 0 | 0 | 0 | 2 |  |
| src/app/(staff)/programmes/proposals/page.tsx | 2 | 1 | 0 | 0 | 1 |  |
| src/app/(staff)/reports/athlete/page.tsx | 2 | 1 | 0 | 0 | 1 |  |
| src/app/(staff)/reports/match/page.tsx | 2 | 1 | 0 | 0 | 1 |  |
| src/app/(staff)/reports/squad/page.tsx | 2 | 0 | 0 | 0 | 2 |  |
| src/app/(staff)/reports/training-load/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/app/(staff)/settings/subject-access/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/app/(staff)/squad/[athleteId]/gym/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/app/(staff)/squad/[athleteId]/nutrition/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/app/(staff)/squad/[athleteId]/wellness/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/app/(staff)/timetable/page.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/FixtureEditForm/FixtureEditForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/FlagCard/FlagCard.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/FlagNotice/FlagNotice.tsx | 2 | 1 | 1 | 0 | 0 |  |
| src/components/GroupEditForm/GroupEditForm.tsx | 2 | 1 | 0 | 0 | 1 |  |
| src/components/GroupEditorForm/GroupEditorForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/MfaEnrollment/MfaEnrollment.tsx | 2 | 1 | 0 | 0 | 1 |  |
| src/components/NewFixtureForm/NewFixtureForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/NewSessionForm/NewSessionForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/NotificationPreferencesForm/NotificationPreferencesForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/ResetConfirmForm/ResetConfirmForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/SessionEditForm/SessionEditForm.tsx | 2 | 2 | 0 | 0 | 0 |  |
| src/components/ThresholdRow/ThresholdRow.tsx | 2 | 0 | 0 | 0 | 2 |  |
| src/components/WeekLoadChart/WeekLoadChart.tsx | 2 | 0 | 0 | 0 | 2 |  |
| base.css · .body | 1 | 0 | 0 | 0 | 1 | app/(athlete)/me/page.tsx, app/(athlete)/me/privacy/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/rpe/[sessionId]/page.tsx, app/(staff)/injuries/page.tsx, app/(staff)/injuries/rehab-groups/page.tsx +33 |
| base.css · .sidebar | 1 | 0 | 0 | 0 | 1 | app/(staff)/analytics/page.tsx, app/(staff)/dashboard/page.tsx, app/(staff)/denied/page.tsx, app/(staff)/injuries/page.tsx, app/(staff)/injuries/rehab-groups/page.tsx, app/(staff)/leaderboards/page.tsx +8 |
| base.css · .eyebrow | 1 | 0 | 0 | 0 | 1 | app/(athlete)/consent/declined/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx, app/(athlete)/me/page.tsx, app/(athlete)/me/status/page.tsx +91 |
| base.css · .nm | 1 | 0 | 0 | 0 | 1 | app/(athlete)/my-data/boards/[leaderboardId]/page.tsx, app/(athlete)/my-data/boards/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/programme/page.tsx, app/(staff)/injuries/[injuryId]/page.tsx, app/(staff)/injuries/page.tsx +44 |
| base.css · .hr | 1 | 0 | 0 | 0 | 1 | components/InjuryCard/InjuryCard.tsx |
| base.css · .hair | 1 | 0 | 0 | 0 | 1 | app/(athlete)/me/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/programme/page.tsx, app/(athlete)/report-problem/page.tsx, app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/reports/squad/page.tsx +11 |
| base.css · .label | 1 | 0 | 0 | 0 | 1 | app/(athlete)/my-data/page.tsx, app/(athlete)/nutrition-check-in/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/programmes/[programmeId]/athlete/[athleteId]/page.tsx, app/(staff)/reports/athlete/[athleteId]/pdf/route.tsx, app/(staff)/reports/compliance/page.tsx +87 |
| base.css · .row | 1 | 1 | 0 | 0 | 0 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/decide/page.tsx, app/(athlete)/consent/guardian/page.tsx, app/(athlete)/gym/[sessionId]/page.tsx, app/(athlete)/layout.tsx, app/(athlete)/me/data-consent/page.tsx +124 |
| base.css · .kv | 1 | 0 | 0 | 0 | 1 | app/(staff)/reports/athlete/[athleteId]/page.tsx, app/(staff)/settings/profile/page.tsx, components/ClinicalReviewForm/ClinicalReviewForm.tsx, components/MfaEnrollment/MfaEnrollment.tsx, components/UserDetailPanel/UserDetailPanel.tsx |
| base.css · .banner | 1 | 0 | 0 | 0 | 1 | app/(athlete)/rpe/[sessionId]/page.tsx, app/(athlete)/today/page.tsx, app/(staff)/platform/sign-in-probes/page.tsx, app/(staff)/reports/injuries/pdf/route.tsx, app/(staff)/settings/groups/[groupId]/page.tsx, app/(staff)/settings/page.tsx +29 |
| base.css · .chart | 1 | 0 | 0 | 0 | 1 | app/(athlete)/my-data/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/reports/athlete/[athleteId]/pdf/route.tsx, app/(staff)/settings/club/page.tsx, app/(staff)/squad/[athleteId]/nutrition/page.tsx, app/(staff)/squad/[athleteId]/page.tsx +17 |
| base.css · .day | 1 | 0 | 0 | 0 | 1 | app/(athlete)/check-in/page.tsx, app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/privacy/page.tsx, app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/rpe/[sessionId]/page.tsx +50 |
| base.css · .next | 1 | 0 | 0 | 0 | 1 | app/(athlete)/consent/staff/page.tsx, app/(athlete)/me/status/page.tsx, app/(athlete)/my-data/page.tsx, app/(athlete)/rpe/[sessionId]/page.tsx, app/(staff)/analytics/page.tsx, app/(staff)/dashboard/page.tsx +60 |
| base.css · .sect | 1 | 0 | 0 | 0 | 1 | app/(athlete)/report-problem/page.tsx, app/(staff)/injuries/[injuryId]/page.tsx, app/(staff)/injuries/page.tsx, app/(staff)/leaderboards/[leaderboardId]/page.tsx, app/(staff)/platform/sign-in-probes/page.tsx, app/(staff)/schedule/[sessionId]/page.tsx +3 |
| base.css · .sleep | 1 | 0 | 0 | 0 | 1 | app/(athlete)/check-in/page.tsx, app/(athlete)/my-data/page.tsx, app/(staff)/squad/[athleteId]/wellness/page.tsx, components/CheckInForm/CheckInForm.tsx, components/EntryCorrectionPanel/EntryCorrectionPanel.tsx, components/FlagNotice/FlagNotice.tsx +1 |
| base.css · .target | 1 | 0 | 0 | 0 | 1 | app/(athlete)/my-data/page.tsx, app/(athlete)/programme/nutrition/page.tsx, app/(athlete)/programme/page.tsx, app/(staff)/nutrition/new/page.tsx, app/(staff)/nutrition/page.tsx, app/(staff)/schedule/planner/apply/page.tsx +15 |
| base.css · .ret | 1 | 0 | 0 | 0 | 1 | app/(athlete)/me/data-consent/page.tsx, components/RetentionPanel/RetentionPanel.tsx |
| base.css · .rtable | 1 | 0 | 0 | 0 | 1 | components/TableShell/TableShell.tsx |
| src/app/(athlete)/check-in/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(athlete)/consent/guardian/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(athlete)/me/leaderboards/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(athlete)/me/reminders/install/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(athlete)/nutrition-check-in/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(athlete)/programme/page.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/app/(staff)/denied/page.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/app/(staff)/flags/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/injuries/rehab-groups/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/injuries/team-allocation/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/leaderboards/manage/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/schedule/[sessionId]/page.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/app/(staff)/schedule/fixtures/[fixtureId]/page.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/app/(staff)/settings/audit/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/settings/exports/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/settings/retention/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/settings/setup/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/(staff)/settings/users/bulk-invite/page.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/app/guardian/[token]/page.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/components/AddAthleteForm/AddAthleteForm.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/components/AthleteDomainShell/AthleteDomainShell.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/AvailabilityBanner/AvailabilityBanner.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/ClubDetailsEditForm/ClubDetailsEditForm.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/components/Dial/Dial.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/components/EntryLocked/EntryLocked.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/InjuryMedicalForm/InjuryMedicalForm.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/NewTemplateForm/NewTemplateForm.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/components/NutritionCheckinForm/NutritionCheckinForm.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/NutritionWorkspace/NewMealForm.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/NutritionWorkspace/NutritionWorkspace.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/NutritionWorkspace/TargetsTable.tsx | 1 | 0 | 0 | 0 | 1 |  |
| src/components/ProblemReportForm/ProblemReportForm.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/RpeForm/RpeForm.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/Sidebar/Sidebar.tsx | 1 | 1 | 0 | 0 | 0 |  |
| src/components/TodayRpeRow/TodayRpeRow.tsx | 1 | 0 | 1 | 0 | 0 |  |
| src/components/WeekTemplatePreview/WeekTemplatePreview.tsx | 1 | 0 | 0 | 0 | 1 |  |

## Every literal

### base.css · .sg

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 8738 | `.sg-filterbar` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 8743 | `.sg-filterbar` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 8761 | `.sg-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 8784 | `.sg-segment` | font-weight | `700` | — | — | no weight token | no token | both |
| 8804 | `.sg-weeknav-btn` | width | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 8805 | `.sg-weeknav-btn` | height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 8807 | `.sg-weeknav-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8835 | `.sg-banner` | border-inline-start | `3px` | — | — | no border-width token exists | no token | both |
| 8844 | `.sg-banner-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 8861 | `.sg-btn-published` | font-weight | `600` | — | — | no weight token | no token | both |
| 8872 | `.sg-btn-publish` | font-weight | `700` | — | — | no weight token | no token | both |
| 8886 | `.sg-btn-discard` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8890 | `.sg-btn-discard` | font-weight | `600` | — | — | no weight token | no token | both |
| 8916 | `.sg-btn-add` | font-weight | `700` | — | — | no weight token | no token | both |
| 8921 | `.sg-toolbar-divider` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 8922 | `.sg-toolbar-divider` | height | `26px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 8928 | `.sg-toolbar-label` | font-weight | `700` | — | — | no weight token | no token | both |
| 8949 | `.sg-clash` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8950 | `.sg-clash` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 8959 | `.sg-clash-dot` | width | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 8960 | `.sg-clash-dot` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 8967 | `.sg-clash-count` | font-weight | `700` | — | — | no weight token | no token | both |
| 8975 | `.sg-clash-link` | font-weight | `600` | — | — | no weight token | no token | both |
| 9016 | `.sg-grid-header` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 9019 | `.sg-day-head` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 9036 | `.sg-day-head-weekday` | font-weight | `700` | — | — | no weight token | no token | both |
| 9055 | `.sg-day-head-md` | font-weight | `500` | — | — | no weight token | no token | both |
| 9075 | `.sg-hour-gutter` | height | `680px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9081 | `.sg-hour-label` | right | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 9189 | `.sg-wiz-step` | font-weight | `600` | — | — | no weight token | no token | both |
| 9203 | `.sg-wiz-pip` | height | `3px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9205 | `.sg-wiz-pip` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |
| 9219 | `.sg-draft-pop` | left | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 9221 | `.sg-draft-pop` | width | `300px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9222 | `.sg-draft-pop` | max-width | `300px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9225 | `.sg-draft-pop` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 9227 | `.sg-draft-pop` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9228 | `.sg-draft-pop` | box-shadow | `rgb(0 0 0 / 0.34)` | — | — | no token near this colour (nearest --tick, ΔE 18.4) | no token | both |
| 9228 | `.sg-draft-pop` | box-shadow | `18px` | — | — | no shadow token matches this shadow | no token | both |
| 9228 | `.sg-draft-pop` | box-shadow | `44px` | — | — | no shadow token matches this shadow | no token | both |
| 9236 | `.sg-day-col:nth-last-child(-n + 2) .sg-draft-pop` | right | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 9253 | `.sg-day-col:nth-last-child(-n + 2) .sg-draft-pop` | border-radius | `16px` | `--r-stat` | `16px` | 0px | no | both |
| 9261 | `.sg-day-col` | height | `680px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9262 | `.sg-day-col` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 9281 | `.sg-hour-line` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9288 | `.sg-now-line` | height | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 9294 | `.sg-now-dot` | left | `-4px` | `--sp-4` | `4px` | 0px | no | both |
| 9295 | `.sg-now-dot` | width | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 9296 | `.sg-now-dot` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 9306 | `.sg-block` | border-radius | `10px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 9309 | `.sg-block` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9310 | `.sg-block` | border-left | `3px` | — | — | no border-width token exists | no token | both |
| 9378 | `.sg-failed-retry` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 9408 | `.sg-fixture` | left | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 9409 | `.sg-fixture` | right | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 9417 | `.sg-fixture` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9418 | `.sg-fixture` | border-top | `3px` | — | — | no border-width token exists | no token | both |
| 9419 | `.sg-fixture` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 9420 | `.sg-fixture` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 9429 | `.sg-fixture-meta` | font-weight | `600` | — | — | no weight token | no token | both |
| 9436 | `.sg-fixture-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 9446 | `.sg-block-row` | height | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 9458 | `.sg-block-badge` | font-weight | `700` | — | — | no weight token | no token | both |
| 9463 | `.sg-block-badge` | border-radius | `6px` | `--r-control` | `6px` | 0px | no | both |
| 9464 | `.sg-block-badge` | padding | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 9469 | `.sg-block-dot` | width | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 9470 | `.sg-block-dot` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 9477 | `.sg-block-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 9520 | `.sg-legend-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 9530 | `.sg-legend-swatch` | width | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 9531 | `.sg-legend-swatch` | height | `11px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9532 | `.sg-legend-swatch` | border-radius | `4px` | `--r-control` | `6px` | 2px | visible | both |
| 9533 | `.sg-legend-swatch` | border-left | `3px` | — | — | no border-width token exists | no token | both |
| 9587 | `.sg-phone-tile` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 9595 | `.sg-phone-tile` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9604 | `.sg-phone-tile[aria-selected='true']` | box-shadow | `1px` | — | — | no shadow token matches this shadow | no token | both |
| 9608 | `.sg-phone-tile[data-match] .sg-phone-tile-meta` | font-weight | `700` | — | — | no weight token | no token | both |
| 9612 | `.sg-phone-tile-day` | font-weight | `700` | — | — | no weight token | no token | both |
| 9616 | `.sg-phone-tile-date` | font-weight | `600` | — | — | no weight token | no token | both |
| 9633 | `.sg-phone-day-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 9642 | `.sg-phone-add` | min-width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 9643 | `.sg-phone-add` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 9651 | `.sg-phone-rows` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9662 | `.sg-phone-row` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 9664 | `.sg-phone-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 9676 | `.sg-phone-row-time` | font-weight | `600` | — | — | no weight token | no token | both |
| 9691 | `.sg-phone-row-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 9694 | `.sg-phone-row-dot` | width | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 9695 | `.sg-phone-row-dot` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 9720 | `.sg-phone-next` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 9729 | `.sg-phone-next-k` | font-weight | `700` | — | — | no weight token | no token | both |
| 9750 | `.sg-panel-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 9777 | `.sg-fact-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 9790 | `.sg-edit-field` | min-width | `160px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9800 | `.sg-stepper-btn` | width | `38px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9801 | `.sg-stepper-btn` | min-height | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 9803 | `.sg-stepper-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9822 | `.sg-stepper-value` | min-height | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 9829 | `.sg-stepper-value` | font-weight | `600` | — | — | no weight token | no token | both |
| 9838 | `.sg-field-ro` | min-height | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 9855 | `.sg-btn-remove` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9860 | `.sg-btn-remove` | font-weight | `600` | — | — | no weight token | no token | both |
| 9867 | `.sg-preview` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 9879 | `.sg-preview-head .sub` | font-weight | `700` | — | — | no weight token | no token | both |
| 9883 | `.sg-preview-card` | border | `1px` | — | — | no border-width token exists | no token | both |
| 9884 | `.sg-preview-card` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 9889 | `.sg-preview-expects` | font-weight | `600` | — | — | no weight token | no token | both |
| 9918 | `.sg-cmp-head` | font-weight | `600` | — | — | no weight token | no token | both |
| 9932 | `.sg-cmp-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 9940 | `.sg-cmp-type` | font-weight | `600` | — | — | no weight token | no token | both |
| 9944 | `.sg-cmp-bar` | width | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 9945 | `.sg-cmp-bar` | height | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 9946 | `.sg-cmp-bar` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |
| 9971 | `.sg-cmp-total` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 9972 | `.sg-cmp-total` | font-weight | `700` | — | — | no weight token | no token | both |
| 9998 | `.sg-group-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 10004 | `.sg-group-track` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 10005 | `.sg-group-track` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 10012 | `.sg-group-fill` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 14294 | `.sg-filterbar` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14699 | `.sg-readonly-well` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .dash

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 6246 | `.dash-flags-panel` | border | `1px` | — | — | no border-width token exists | no token | both |
| 6247 | `.dash-flags-panel` | border-radius | `10px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 6249 | `.dash-flags-panel` | box-shadow | `rgb(16 18 23 / 0.08)` | `--track` | `rgba(16, 18, 23, 0.1)` | ΔE 2.0 | imperceptible | both |
| 6249 | `.dash-flags-panel` | box-shadow | `1px` | — | — | no shadow token matches this shadow | no token | both |
| 6249 | `.dash-flags-panel` | box-shadow | `3px` | — | — | no shadow token matches this shadow | no token | both |
| 6288 | `.dash-flags-head:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 6289 | `.dash-flags-head:focus-visible` | outline-offset | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 6293 | `.dash-flags-badge` | width | `38px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6294 | `.dash-flags-badge` | height | `38px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6296 | `.dash-flags-badge` | border-radius | `9px` | `--r-toggle` | `9px` | 0px | no | both |
| 6351 | `.dash-flags-head .ic` | width | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 6352 | `.dash-flags-head .ic` | height | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 6358 | `.dash-flags-count` | font-weight | `800` | — | — | no weight token | no token | both |
| 6364 | `.dash-flags-word` | font-weight | `700` | — | — | no weight token | no token | both |
| 6391 | `.dash-flags-thresholds a` | font-weight | `600` | — | — | no weight token | no token | both |
| 6397 | `.dash-flags-list` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6402 | `.dash-flags-item` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 6403 | `.dash-flags-item` | border-left | `3px` | — | — | no border-width token exists | no token | both |
| 6450 | `.dash-flags-name` | font-weight | `800` | — | — | no weight token | no token | both |
| 6510 | `.dash-flags-evidence` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6520 | `.dash-flags-rule` | font-weight | `600` | — | — | no weight token | no token | both |
| 6540 | `.dash-flags-all` | font-weight | `600` | — | — | no weight token | no token | both |
| 6571 | `.dash-stat` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 6591 | `button.dash-stat` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 6599 | `button.dash-stat[aria-expanded='true']` | box-shadow | `1px` | — | — | no shadow token matches this shadow | no token | both |
| 6604 | `.dash-stat-state` | font-weight | `600` | — | — | no weight token | no token | both |
| 6612 | `.dash-stat-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 6626 | `.dash-stat-dot` | width | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 6627 | `.dash-stat-dot` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 6686 | `.dash-stat-bar` | height | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 6690 | `.dash-stat-bar-track` | height | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 6691 | `.dash-stat-bar-track` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |
| 6698 | `.dash-stat-bar-fill` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |
| 6701 | `.dash-stat-bar-seg` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |
| 6702 | `.dash-stat-bar-seg` | min-width | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 6707 | `.dash-stat-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 6737 | `.dash-stat-expand` | border | `1px` | — | — | no border-width token exists | no token | both |
| 6749 | `.dash-stat-expand-head` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 6756 | `.dash-stat-expand-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6781 | `.dash-week` | border | `1px` | — | — | no border-width token exists | no token | both |
| 6795 | `.dash-week-head-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 6818 | `.dash-week-grid` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6822 | `.dash-week-col` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 6853 | `.dash-week-col-day` | font-weight | `700` | — | — | no weight token | no token | both |
| 6877 | `.dash-week-act` | font-weight | `600` | — | — | no weight token | no token | both |
| 6881 | `.dash-week-act-dot` | width | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 6882 | `.dash-week-act-dot` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 6896 | `.dash-week-col-flag` | font-weight | `600` | — | — | no weight token | no token | both |
| 6905 | `.dash-week-col` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6917 | `.dash-week-list` | border | `1px` | — | — | no border-width token exists | no token | both |
| 6926 | `.dash-week-md` | font-weight | `600` | — | — | no weight token | no token | both |
| 6947 | `.dash-timeline-clock` | font-weight | `500` | — | — | no weight token | no token | both |
| 6958 | `.dash-session-card` | border-left | `3px` | — | — | no border-width token exists | no token | both |
| 6982 | `.dash-session-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 6994 | `.dash-session-count` | font-weight | `500` | — | — | no weight token | no token | both |
| 7001 | `.dash-session-count-label` | margin-top | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 7011 | `.dash-affected` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7025 | `.dash-avatar` | width | `28px` | `--sp-28` | `28px` | 0px | no | both |
| 7026 | `.dash-avatar` | height | `28px` | `--sp-28` | `28px` | 0px | no | both |
| 7027 | `.dash-avatar` | border-radius | `9px` | `--r-toggle` | `9px` | 0px | no | both |
| 7033 | `.dash-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 7038 | `.dash-affected-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 7055 | `.dash-clean` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7058 | `.dash-clean-check` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 7059 | `.dash-clean-check` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 7078 | `.dash-lead` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7090 | `.dash-lead-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 7110 | `.dash-lead-stat` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 7117 | `.dash-lead-stat-n` | font-weight | `500` | — | — | no weight token | no token | both |
| 7130 | `.dash-lead-stat-k` | font-weight | `600` | — | — | no weight token | no token | both |
| 7151 | `.dash-lead-list[data-tone='warn']` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7155 | `.dash-lead-list[data-tone='bad']` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7160 | `.dash-lead-list-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 7178 | `.dash-lead-row` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 7179 | `.dash-lead-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7189 | `.dash-lead-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 7207 | `.dash-lead-med` | font-weight | `600` | — | — | no weight token | no token | both |
| 7220 | `.dash-lead-tail` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7226 | `.dash-lead-tail a` | min-height | `24px` | `--sp-24` | `24px` | 0px | no | both |
| 7235 | `.dash-week[data-lead='true']` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7254 | `.dash-squad-dot` | width | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 7255 | `.dash-squad-dot` | height | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 7261 | `.dash-untied-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7276 | `.dash-track-bar-outer` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 7277 | `.dash-track-bar-outer` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 7284 | `.dash-track-bar-fill` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |

### base.css · .nutr

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 7366 | `.nutr-daytype-item` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 7368 | `.nutr-daytype-item` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7382 | `.nutr-daytype-item` | border-radius | `12px` | `--r-field` | `12px` | 0px | no | both |
| 7391 | `.nutr-plan-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 7400 | `.nutr-daytype-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 7427 | `.nutr-needs-word` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7440 | `.nutr-chase-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7457 | `.nutr-chase-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 7490 | `.nutr-plan-rules-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 7511 | `.nutr-rule-tile` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7512 | `.nutr-rule-tile` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 7529 | `.nutr-stepper-btn` | width | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 7530 | `.nutr-stepper-btn` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 7532 | `.nutr-stepper-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7555 | `.nutr-rule-value span` | font-weight | `500` | — | — | no weight token | no token | both |
| 7580 | `.nutr-read-line` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7591 | `.nutr-read-mean` | font-weight | `500` | — | — | no weight token | no token | both |
| 7621 | `.nutr-totals-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 7634 | `.nutr-totals-track` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 7635 | `.nutr-totals-track` | border-radius | `4px` | `--r-control` | `6px` | 2px | visible | both |
| 7641 | `.nutr-totals-fill` | border-radius | `4px` | `--r-control` | `6px` | 2px | visible | both |
| 7649 | `.nutr-totals-tick` | top | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 7650 | `.nutr-totals-tick` | bottom | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 7651 | `.nutr-totals-tick` | width | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 7669 | `.nutr-meal-card` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 7670 | `.nutr-meal-card` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7680 | `.nutr-meal-header` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 7685 | `.nutr-meal-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 7699 | `.nutr-meal-item` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7726 | `.nutr-meal-macro-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 7733 | `.nutr-meal-macro-label` | margin-top | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 7742 | `.nutr-meal-caption` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7751 | `.nutr-table-head` | font-weight | `600` | — | — | no weight token | no token | both |
| 7767 | `.nutr-group-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 7784 | `.nutr-athlete-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 7801 | `.nutr-set-pill` | padding | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 7806 | `.nutr-range-track` | height | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 7811 | `.nutr-range-track::before` | left | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 7812 | `.nutr-range-track::before` | right | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 7813 | `.nutr-range-track::before` | top | `5px` | `--sp-4` | `4px` | 1px | imperceptible | both |
| 7814 | `.nutr-range-track::before` | height | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 7815 | `.nutr-range-track::before` | border-radius | `1px` | — | — | no radius step within 2px (nearest --r-control 6px, 5px away) | no token | both |
| 7820 | `.nutr-range-band` | top | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 7821 | `.nutr-range-band` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 7822 | `.nutr-range-band` | border-radius | `3px` | — | — | no radius step within 2px (nearest --r-control 6px, 3px away) | no token | both |
| 7836 | `.nutr-target-bracket` | top | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 7837 | `.nutr-target-bracket` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 7838 | `.nutr-target-bracket` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7839 | `.nutr-target-bracket` | border-radius | `3px` | — | — | no radius step within 2px (nearest --r-control 6px, 3px away) | no token | both |
| 7845 | `.nutr-range-marker` | width | `3px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 7846 | `.nutr-range-marker` | height | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 7847 | `.nutr-range-marker` | border-radius | `1.5px` | — | — | no radius step within 2px (nearest --r-control 6px, 4.5px away) | no token | both |
| 7860 | `.nutr-legend-band` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 7861 | `.nutr-legend-band` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 7862 | `.nutr-legend-band` | border-radius | `3px` | — | — | no radius step within 2px (nearest --r-control 6px, 3px away) | no token | both |
| 7867 | `.nutr-legend-bracket` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 7868 | `.nutr-legend-bracket` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 7869 | `.nutr-legend-bracket` | border | `1px` | — | — | no border-width token exists | no token | both |
| 7870 | `.nutr-legend-bracket` | border-radius | `3px` | — | — | no radius step within 2px (nearest --r-control 6px, 3px away) | no token | both |
| 7888 | `.nutr-table-caption` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 7909 | `.nutr-selected-avatar` | width | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 7910 | `.nutr-selected-avatar` | height | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 7911 | `.nutr-selected-avatar` | border-radius | `13px` | `--r-tab` | `14px` | 1px | imperceptible | both |
| 7918 | `.nutr-selected-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 7922 | `.nutr-selected-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 7960 | `.nutr-mass-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 7974 | `.nutr-sparkline` | height | `62px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 8015 | `.nutr-logging-swatch` | width | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 8016 | `.nutr-logging-swatch` | height | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 8017 | `.nutr-logging-swatch` | border-radius | `5px` | `--r-control` | `6px` | 1px | imperceptible | both |
| 8019 | `.nutr-logging-swatch` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8041 | `.nutr-checkin-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 8054 | `.nutr-checkin-cell` | width | `28px` | `--sp-28` | `28px` | 0px | no | both |
| 8055 | `.nutr-checkin-cell` | min-height | `28px` | `--sp-28` | `28px` | 0px | no | both |
| 8056 | `.nutr-checkin-cell` | border-radius | `6px` | `--r-control` | `6px` | 0px | no | both |
| 8063 | `.nutr-checkin-cell` | font-weight | `700` | — | — | no weight token | no token | both |
| 8064 | `.nutr-checkin-cell` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8085 | `.nutr-override-note` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8086 | `.nutr-override-note` | border-radius | `10px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 10157 | `.nutr-totals-warning` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |
| 10180 | `.nutr-totals-overflow` | top | `-3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 10181 | `.nutr-totals-overflow` | right | `-3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 10184 | `.nutr-totals-overflow` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .tr

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5903 | `.tr-mode-switch a` | font-weight | `700` | — | — | no weight token | no token | both |
| 5918 | `.tr-session-chip` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5922 | `.tr-session-chip` | font-weight | `600` | — | — | no weight token | no token | both |
| 5960 | `.tr-fact-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 5966 | `.tr-read` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5996 | `.tr-dials` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 6003 | `.tr-dial-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 6012 | `.tr-dial-of` | margin-top | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 6024 | `.tr-scope-chip` | font-weight | `600` | — | — | no weight token | no token | both |
| 6025 | `.tr-scope-chip` | border | `1px` | — | — | no border-width token exists | no token | both |
| 6040 | `.tr-table` | min-width | `720px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6047 | `.tr-table-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6048 | `.tr-table-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 6062 | `.tr-bar-track` | height | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 6063 | `.tr-bar-track` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 6070 | `.tr-bar-fill` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 6079 | `.tr-scatter-yaxis` | height | `320px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6091 | `.tr-scatter-plot` | height | `320px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6099 | `.tr-scatter-plot` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 6100 | `.tr-scatter-plot` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 6110 | `.tr-scatter-dot` | border-width | `2px` | — | — | no border-width token exists | no token | both |
| 6124 | `.tr-scatter-label` | font-weight | `700` | — | — | no weight token | no token | both |
| 6135 | `.tr-scatter-legend` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 6140 | `.tr-scatter-legend-dot` | width | `9px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6141 | `.tr-scatter-legend-dot` | height | `9px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6144 | `.tr-scatter-legend-dot` | vertical-align | `-1px` | — | — | no token family covers vertical-align | no token | both |
| 6156 | `.tr-sparkline-wrap svg` | height | `62px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6166 | `.tr-board-inner` | min-width | `548px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6169 | `.tr-board-inner.match` | min-width | `980px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 6175 | `.tr-board-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 6189 | `.tr-board-row.selected` | font-weight | `700` | — | — | no weight token | no token | both |
| 6193 | `.tr-board-unit-header` | font-weight | `700` | — | — | no weight token | no token | both |
| 6209 | `.tr-dials` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 10773 | `.tr-outlier` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 10786 | `.tr-outlier-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 10792 | `.tr-outlier-delta` | font-weight | `700` | — | — | no weight token | no token | both |
| 10807 | `.tr-heat` | border-radius | `7px` | `--r-band` | `7px` | 0px | no | both |
| 10849 | `.tr-unit-mean` | font-weight | `400` | — | — | no weight token | no token | both |
| 10859 | `.tr-legend-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 10866 | `.tr-legend-label` | font-weight | `700` | — | — | no weight token | no token | both |
| 10874 | `.tr-legend-step` | height | `26px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11000 | `.tr-heat-toggle` | font-weight | `600` | — | — | no weight token | no token | both |
| 11006 | `.tr-heat-toggle-track` | width | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 11007 | `.tr-heat-toggle-track` | height | `22px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11008 | `.tr-heat-toggle-track` | border-radius | `999px` | `--r-full` | `999px` | 0px | no | both |
| 11017 | `.tr-heat-toggle-track::after` | top | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 11018 | `.tr-heat-toggle-track::after` | left | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 11019 | `.tr-heat-toggle-track::after` | width | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 11020 | `.tr-heat-toggle-track::after` | height | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 11022 | `.tr-heat-toggle-track::after` | background | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 11032 | `.tr-heat-toggle:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 11033 | `.tr-heat-toggle:focus-visible` | outline-offset | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |

### base.css · .pp

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 4366 | `.pp-col` | max-width | `1180px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4389 | `.pp-link` | font-weight | `600` | — | — | no weight token | no token | both |
| 4445 | `.pp-hero` | border | `1px` | — | — | no border-width token exists | no token | both |
| 4451 | `.pp-hero-sub` | font-weight | `600` | — | — | no weight token | no token | both |
| 4464 | `.pp-hero-owner` | font-weight | `600` | — | — | no weight token | no token | both |
| 4470 | `.pp-hero .pp-detail-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4480 | `.pp-hero-plan-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4512 | `.pp-header-top > .pp-name-block` | min-width | `220px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4515 | `.pp-avatar` | width | `56px` | `--hit-lg` | `56px` | 0px | no | both |
| 4516 | `.pp-avatar` | height | `56px` | `--hit-lg` | `56px` | 0px | no | both |
| 4521 | `.pp-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 4535 | `.pp-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 4543 | `.pp-wellness-mini` | width | `62px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4544 | `.pp-wellness-mini` | height | `62px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4546 | `.pp-wellness-mini` | border | `1px` | — | — | no border-width token exists | no token | both |
| 4570 | `.pp-detail-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4589 | `.pp-detail-cell .v` | font-weight | `700` | — | — | no weight token | no token | both |
| 4631 | `.pp-dial-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 4641 | `.pp-athleticism-band` | font-weight | `700` | — | — | no weight token | no token | both |
| 4652 | `.pp-bench-head` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4656 | `.pp-bench-head .t` | font-weight | `700` | — | — | no weight token | no token | both |
| 4677 | `.pp-bench-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4714 | `.pp-bench-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 4718 | `.pp-bench-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 4721 | `.pp-bench-bar` | height | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4738 | `.pp-bench-band` | font-weight | `700` | — | — | no weight token | no token | both |
| 4775 | `.pp-flag-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 4805 | `.pp-ack-btn` | font-weight | `700` | — | — | no weight token | no token | both |
| 4809 | `.pp-ack-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 4837 | `.pp-dial-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 4845 | `.pp-dial-status` | font-weight | `700` | — | — | no weight token | no token | both |
| 4858 | `.pp-big-dial-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 4873 | `.pp-goal-label` | font-weight | `700` | — | — | no weight token | no token | both |
| 4904 | `.pp-macro-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 4934 | `.pp-weight-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 4940 | `.pp-weight-value .u` | font-weight | `400` | — | — | no weight token | no token | both |
| 4959 | `.pp-sparkline` | height | `84px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4987 | `.pp-weight-form` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4998 | `.pp-weight-edit-list` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5031 | `.pp-target-swatch` | width | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 5035 | `.pp-target-swatch` | border-top | `1.5px` | — | — | no border-width token exists | no token | both |
| 5043 | `.pp-target-private` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5044 | `.pp-target-private` | border-radius | `6px` | `--r-control` | `6px` | 0px | no | both |
| 5059 | `.pp-target-history` | border-top | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .lbw

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 6677 | `.lbw-stats-card .dash-stat-value` | font-weight | `700` | — | — | no weight token | no token | both |
| 8210 | `.lbw-movers-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 8255 | `.lbw-mover-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 8276 | `.lbw-mover-delta-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 8296 | `.lbw-mover-spark svg` | height | `42px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 8339 | `.lbw-segmented button` | font-weight | `700` | — | — | no weight token | no token | both |
| 8387 | `.lbw-swatch` | width | `22px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 8388 | `.lbw-swatch` | height | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 8389 | `.lbw-swatch` | border-radius | `4px` | `--r-control` | `6px` | 2px | visible | both |
| 8406 | `.lbw-wall-head-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 8419 | `.lbw-wall-head-board` | font-weight | `600` | — | — | no weight token | no token | both |
| 8432 | `.lbw-wall-head-sub` | font-weight | `400` | — | — | no weight token | no token | both |
| 8437 | `.lbw-group-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 8441 | `.lbw-group-label` | font-weight | `700` | — | — | no weight token | no token | both |
| 8459 | `.lbw-athlete-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 8489 | `.lbw-athlete-row.is-selected .lbw-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 8505 | `.lbw-value-cell` | border-radius | `7px` | `--r-band` | `7px` | 0px | no | both |
| 8512 | `.lbw-value-marker` | font-weight | `500` | — | — | no weight token | no token | both |
| 8527 | `.lbw-wall-caption` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 8546 | `.lbw-avatar` | width | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 8547 | `.lbw-avatar` | height | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 8548 | `.lbw-avatar` | border-radius | `13px` | `--r-tab` | `14px` | 1px | imperceptible | both |
| 8555 | `.lbw-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 8567 | `.lbw-sel-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 8577 | `.lbw-profile-link` | font-weight | `600` | — | — | no weight token | no token | both |
| 8596 | `.lbw-sel-thead` | margin | `-12px` | `--sp-12` | `12px` | 0px | no | both |
| 8598 | `.lbw-sel-thead` | border-radius | `10px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 8600 | `.lbw-sel-thead` | font-weight | `600` | — | — | no weight token | no token | both |
| 8614 | `.lbw-sel-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 8628 | `.lbw-sel-test` | font-weight | `600` | — | — | no weight token | no token | both |
| 8634 | `.lbw-sel-std` | margin | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 8650 | `.lbw-leaders-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 8666 | `.lbw-leader-tile` | border | `1px` | — | — | no border-width token exists | no token | both |
| 8667 | `.lbw-leader-tile` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 8672 | `.lbw-leader-board` | font-weight | `600` | — | — | no weight token | no token | both |
| 8694 | `.lbw-leader-value` | font-weight | `600` | — | — | no weight token | no token | both |
| 13663 | `.lbw-sel-row .pill` | min-width | `56px` | `--hit-lg` | `56px` | 0px | no | both |

### base.css · .launch

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 12869 | `.launch` | --lk-trace | `#c5d1e6` | `--border` | `#d4dff5` | ΔE 5.1 | visible | both |
| 12876 | `.launch` | --splash-ground | `#182241` | `--avatar-bg` | `#1a2340` | ΔE 1.5 | imperceptible | both |
| 12877 | `.launch` | --splash-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 12880 | `.launch` | max-width | `402px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12894 | `:root:not([data-theme='light']) .launch` | --lk-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 12895 | `:root:not([data-theme='light']) .launch` | --lk-trace | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 12896 | `:root:not([data-theme='light']) .launch` | --lk-dot | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 12898 | `:root:not([data-theme='light']) .launch` | --splash-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 12923 | `.launch-lockup` | left | `30px` | `--sp-28` | `28px` | 2px | visible | both |
| 12924 | `.launch-lockup` | top | `92px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 44px away) | no token | both |
| 12935 | `.launch-page` | padding | `176px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 128px away) | no token | both |
| 13061 | `.launch-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 13093 | `.launch-splash` | --lk-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 13094 | `.launch-splash` | --lk-trace | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 13095 | `.launch-splash` | --lk-dot | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 13123 | `.launch .signin-fields .field` | height | `48px` | `--sp-48` | `48px` | 0px | no | both |
| 13128 | `.launch .signin-submit` | height | `48px` | `--sp-48` | `48px` | 0px | no | both |
| 13159 | `.launch` | --claim-x | `40px` | — | — | no token family covers --claim-x | no token | both |
| 13159 | `.launch` | --claim-x | `76px` | — | — | no token family covers --claim-x | no token | both |
| 13163 | `.launch-lockup` | top | `92px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 44px away) | no token | both |
| 13192 | `.launch-claim` | --claim-lead | `56px` | — | — | no token family covers --claim-lead | no token | both |
| 13193 | `.launch-claim` | padding | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 13211 | `.launch-claim-h` | font-weight | `800` | — | — | no weight token | no token | both |
| 13212 | `.launch-claim-h` | font-size | `34px` | — | — | no size step within 1.5px (nearest --fs-32 2rem, 2px away) | no token | both |
| 13279 | `.launch-features .k` | font-weight | `700` | — | — | no weight token | no token | both |
| 13310 | `.launch-page` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 13311 | `.launch-page` | padding | `64px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 16px away) | no token | both |
| 13440 | `.launch .signin-forgot a` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 13451 | `.launch .form-error` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .ph

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14351 | `.ph-titlebar` | height | `64px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 14358 | `.ph-titlebar` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 14363 | `.ph-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 14390 | `.ph-tabbar` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 14391 | `.ph-tabbar` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |
| 14391 | `.ph-tabbar` | padding | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 14399 | `.ph-tab` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14405 | `.ph-tab` | font-weight | `600` | — | — | no weight token | no token | both |
| 14415 | `.ph-tab[data-active]` | font-weight | `700` | — | — | no weight token | no token | both |
| 14418 | `.ph-tab:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 14419 | `.ph-tab:focus-visible` | outline-offset | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 14427 | `.ph-tab-glyph` | width | `23px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 14428 | `.ph-tab-glyph` | height | `23px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 14437 | `.ph-count-mark` | top | `-6px` | `--sp-6` | `6px` | 0px | no | both |
| 14438 | `.ph-count-mark` | right | `-10px` | `--sp-10` | `10px` | 0px | no | both |
| 14439 | `.ph-count-mark` | min-width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 14440 | `.ph-count-mark` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 14446 | `.ph-count-mark` | font-weight | `700` | — | — | no weight token | no token | both |
| 14451 | `.ph-tab-glyph .ic` | width | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 14452 | `.ph-tab-glyph .ic` | height | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 14476 | `.ph-sheet-title` | font-weight | `600` | — | — | no weight token | no token | both |
| 14486 | `.ph-sheet-row` | min-height | `52px` | `--hit-md` | `52px` | 0px | no | both |
| 14493 | `.ph-sheet-row` | font-weight | `600` | — | — | no weight token | no token | both |
| 14504 | `.ph-sheet-row:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 14505 | `.ph-sheet-row:focus-visible` | outline-offset | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 14509 | `.ph-sheet-glyph` | width | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 14510 | `.ph-sheet-glyph` | height | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 14514 | `.ph-sheet-glyph .ic` | width | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 14515 | `.ph-sheet-glyph .ic` | height | `20px` | `--sp-20` | `20px` | 0px | no | both |

### base.css · .exlib

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 12408 | `.exlib-search` | max-width | `300px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12412 | `.exlib-search-icon` | inset-inline-start | `13px` | `--sp-12` | `12px` | 1px | imperceptible | both |
| 12415 | `.exlib-search-icon` | width | `15px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12416 | `.exlib-search-icon` | height | `15px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12423 | `.exlib-search-input` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 12427 | `.exlib-search-input` | padding-inline-start | `36px` | — | — | no spacing step within 2px (nearest --sp-32 32px, 4px away) | no token | both |
| 12428 | `.exlib-search-input` | border | `1px` | — | — | no border-width token exists | no token | both |
| 12460 | `.exlib-cat` | width | `360px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12462 | `.exlib-cat` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 12464 | `.exlib-cat` | border | `1px` | — | — | no border-width token exists | no token | both |
| 12473 | `.exlib-cat:has(.exlib-cat-select:focus-visible)` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 12474 | `.exlib-cat:has(.exlib-cat-select:focus-visible)` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 12482 | `.exlib-cat-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 12491 | `.exlib-cat-count` | font-weight | `700` | — | — | no weight token | no token | both |
| 12550 | `.exlib-list` | --exlib-cols | `124px` | — | — | no token family covers --exlib-cols | no token | both |
| 12550 | `.exlib-list` | --exlib-cols | `16px` | — | — | no token family covers --exlib-cols | no token | both |
| 12562 | `.exlib-head` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 12566 | `.exlib-col` | font-weight | `700` | — | — | no weight token | no token | both |
| 12580 | `.exlib-row + .exlib-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 12590 | `.exlib-row-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 12607 | `.exlib-pill` | border | `1px` | — | — | no border-width token exists | no token | both |
| 12612 | `.exlib-pill` | font-weight | `700` | — | — | no weight token | no token | both |
| 12639 | `.exlib-foot` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 12655 | `.exlib-form-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 12683 | `.exlib-flabel` | font-weight | `600` | — | — | no weight token | no token | both |
| 12688 | `.exlib-fopt` | font-weight | `400` | — | — | no weight token | no token | both |
| 12707 | `.exlib-textarea` | min-height | `66px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .rhead

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 13780 | `.rhead-chip` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13783 | `.rhead-chip` | font-weight | `700` | — | — | no weight token | no token | both |
| 13794 | `.rhead-chip[aria-pressed='true']` | color | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 13806 | `.rhead-eyebrow` | font-weight | `700` | — | — | no weight token | no token | both |
| 13832 | `.rhead-btn-primary` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13834 | `.rhead-btn-primary` | font-weight | `700` | — | — | no weight token | no token | both |
| 13836 | `.rhead-btn-primary` | color | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 13840 | `.rhead-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13842 | `.rhead-btn` | font-weight | `600` | — | — | no weight token | no token | both |
| 13850 | `.rhead-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 13868 | `.rhead-tabs` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13883 | `.rhead-tab` | font-weight | `700` | — | — | no weight token | no token | both |
| 13891 | `.rhead-tab[aria-selected='true']` | background | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 13900 | `.rhead-tabrow .tr-mode-switch` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13908 | `.rhead-tabrow .tr-mode-switch a` | font-weight | `700` | — | — | no weight token | no token | both |
| 13913 | `.rhead-tabrow .tr-mode-switch a[aria-current='true']` | background | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 13930 | `.rhead .rsel-label` | font-weight | `400` | — | — | no weight token | no token | both |
| 13940 | `.rhead .rsel select` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13943 | `.rhead .rsel select` | min-width | `220px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 13945 | `.rhead .rsel select` | font-weight | `600` | — | — | no weight token | no token | both |
| 13951 | `.rhead .rsel-chev` | right | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 14105 | `.rhead-tabrow .sg-viewtabs` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14111 | `.rhead-tabrow .sg-viewtab` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 14112 | `.rhead-tabrow .sg-viewtab` | font-weight | `700` | — | — | no weight token | no token | both |
| 14119 | `.rhead-tabrow .sg-viewtab[aria-selected='true']` | background | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 14144 | `.rhead-period-nav .rhead-btn` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14170 | `.rhead-period .sg-weeknav` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .cmpl

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 11204 | `.cmpl-exclusions` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11219 | `.cmpl-stat` | border-right | `1px` | — | — | no border-width token exists | no token | both |
| 11242 | `.cmpl-stat-label` | font-weight | `500` | — | — | no weight token | no token | both |
| 11253 | `.cmpl-stat-value` | font-weight | `700` | — | — | no weight token | no token | both |
| 11260 | `.cmpl-stat-value small` | font-weight | `700` | — | — | no weight token | no token | both |
| 11294 | `.cmpl-head` | font-weight | `500` | — | — | no weight token | no token | both |
| 11300 | `.cmpl-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 11310 | `.cmpl-band` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11314 | `.cmpl-band-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 11330 | `.cmpl-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 11359 | `.cmpl-meter-count` | width | `74px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11362 | `.cmpl-meter-count` | font-weight | `700` | — | — | no weight token | no token | both |
| 11366 | `.cmpl-meter-pct` | width | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11369 | `.cmpl-meter-pct` | font-weight | `700` | — | — | no weight token | no token | both |
| 11375 | `.cmpl-track` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 11376 | `.cmpl-track` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 11387 | `:root:not([data-theme='light']) .cmpl-track` | background | `rgb(255 255 255 / 0.12)` | — | — | no token near this colour (nearest --wash-good, ΔE 44.6) | no token | light |
| 11395 | `.cmpl-fill` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 11400 | `.cmpl-tick` | top | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 11401 | `.cmpl-tick` | bottom | `-2px` | `--sp-2` | `2px` | 0px | no | both |
| 11402 | `.cmpl-tick` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11411 | `:root:not([data-theme='light']) .cmpl-tick` | background | `rgb(255 255 255 / 0.26)` | — | — | no token near this colour (nearest --band-4-wash, ΔE 55.6) | no token | light |
| 11428 | `.cmpl-foot` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11452 | `.cmpl-swatch` | width | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 11453 | `.cmpl-swatch` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 11454 | `.cmpl-swatch` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |

### base.css · .ath

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 11600 | `.ath-avatar` | width | `42px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11601 | `.ath-avatar` | height | `42px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11608 | `.ath-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 11625 | `.ath-position` | font-weight | `800` | — | — | no weight token | no token | both |
| 11646 | `.ath-card-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 11653 | `.ath-latest` | font-weight | `700` | — | — | no weight token | no token | both |
| 11667 | `.ath-tile` | border-radius | `12px` | `--r-field` | `12px` | 0px | no | both |
| 11668 | `.ath-tile` | border | `1px` | — | — | no border-width token exists | no token | both |
| 11677 | `.ath-stat-label` | font-weight | `500` | — | — | no weight token | no token | both |
| 11684 | `.ath-tile-value` | font-weight | `700` | — | — | no weight token | no token | both |
| 11699 | `.ath-stats` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11703 | `.ath-stat-value` | font-weight | `700` | — | — | no weight token | no token | both |
| 11713 | `.ath-loadday-day` | width | `82px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11720 | `.ath-loadday-val` | width | `42px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11723 | `.ath-loadday-val` | font-weight | `700` | — | — | no weight token | no token | both |
| 11744 | `.ath-tests-head` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 11746 | `.ath-tests-head` | font-weight | `500` | — | — | no weight token | no token | both |
| 11752 | `.ath-test-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 11753 | `.ath-test-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11774 | `.ath-test-delta` | font-weight | `700` | — | — | no weight token | no token | both |
| 11786 | `.ath-note` | border-radius | `12px` | `--r-field` | `12px` | 0px | no | both |
| 11787 | `.ath-note` | border | `1px` | — | — | no border-width token exists | no token | both |
| 11797 | `.ath-note-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 11813 | `.ath-loaddays` | max-height | `232px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .gym

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3238 | `.gym-finish-early` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3241 | `.gym-finish-early` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 3743 | `.gym-head` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 3743 | `.gym-head` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 3744 | `.gym-head` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 3766 | `.gym-head-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 3780 | `.gym-progress .prog` | font-weight | `700` | — | — | no weight token | no token | both |
| 3784 | `.gym-progress-track` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 3792 | `.gym-head-eyebrow` | font-weight | `600` | — | — | no weight token | no token | both |
| 3837 | `.gym-set-key` | min-height | `48px` | `--sp-48` | `48px` | 0px | no | both |
| 3847 | `.gym-set-key` | font-weight | `700` | — | — | no weight token | no token | both |
| 3866 | `.gym-set-key:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 3867 | `.gym-set-key:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 4108 | `.gym-sum-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 4118 | `.gym-sum-early` | border | `1px` | — | — | no border-width token exists | no token | both |
| 4132 | `.gym-sum-k` | font-weight | `600` | — | — | no weight token | no token | both |
| 4140 | `.gym-sum-num` | font-weight | `800` | — | — | no weight token | no token | both |
| 4148 | `.gym-sum-num small` | font-weight | `600` | — | — | no weight token | no token | both |
| 4161 | `.gym-sum-bests` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 4174 | `.gym-sum-best-val` | font-weight | `700` | — | — | no weight token | no token | both |
| 4194 | `.gym-sum-pill-short` | border | `1px` | — | — | no border-width token exists | no token | both |
| 4195 | `.gym-sum-pill-short` | border-inline-start | `1px` | — | — | no border-width token exists | no token | both |

### src/app/(staff)/reports/gps/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 111 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 112 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 133 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 134 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 160 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 460 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 534 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 739 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 804 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 914 | `style={{}}` | height | `2.375rem` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 915 | `style={{}}` | border-radius | `12px` | `--r-field` | `12px` | 0px | no | both |
| 920 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 929 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 939 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 946 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 949 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 952 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 955 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 1062 | `style={{}}` | margin | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 1067 | `style={{}}` | margin | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 1091 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |

### base.css · .gl

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2430 | `.gl` | width | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2431 | `.gl` | height | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2432 | `.gl` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 2438 | `.gl` | font-weight | `700` | — | — | no weight token | no token | both |
| 3886 | `.gl-card-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 3894 | `.gl-card-pos` | font-weight | `600` | — | — | no weight token | no token | both |
| 3917 | `.gl-num-k` | font-weight | `700` | — | — | no weight token | no token | both |
| 3925 | `.gl-num-v` | font-weight | `800` | — | — | no weight token | no token | both |
| 3933 | `.gl-num-v[data-words]` | font-weight | `700` | — | — | no weight token | no token | both |
| 3942 | `.gl-num-v small` | font-weight | `600` | — | — | no weight token | no token | both |
| 3952 | `.gl-num-ref b` | font-weight | `700` | — | — | no weight token | no token | both |
| 3965 | `.gl-step` | font-weight | `700` | — | — | no weight token | no token | both |
| 3974 | `.gl-step:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 3975 | `.gl-step:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 3998 | `.gl-strip` | font-weight | `600` | — | — | no weight token | no token | both |
| 4003 | `.gl-strip-link` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 4009 | `.gl-strip-link` | font-weight | `700` | — | — | no weight token | no token | both |
| 4020 | `.gl-then-k` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .pc

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10314 | `.pc-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 10325 | `.pc-row-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 10329 | `.pc-row-value` | font-weight | `500` | — | — | no weight token | no token | both |
| 10333 | `.pc-track` | height | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 10341 | `.pc-track::before` | top | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 10342 | `.pc-track::before` | height | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 10343 | `.pc-track::before` | border-radius | `1px` | — | — | no radius step within 2px (nearest --r-control 6px, 5px away) | no token | both |
| 10351 | `.pc-band` | top | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 10352 | `.pc-band` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 10359 | `.pc-median` | width | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 10360 | `.pc-median` | height | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 10361 | `.pc-median` | margin-inline-start | `-1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 10362 | `.pc-median` | border-radius | `1px` | — | — | no radius step within 2px (nearest --r-control 6px, 5px away) | no token | both |
| 10370 | `.pc-marker` | top | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 10371 | `.pc-marker` | width | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 10372 | `.pc-marker` | height | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 10373 | `.pc-marker` | margin-inline-start | `-5px` | `--sp-4` | `4px` | 1px | imperceptible | both |
| 10376 | `.pc-marker` | box-shadow | `2px` | — | — | no shadow token matches this shadow | no token | both |

### src/components/WeekTemplateBuilder/WeekTemplateBuilder.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 165 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 165 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 214 | `style={{}}` | width | `90px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 232 | `style={{}}` | width | `90px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 265 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 267 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 267 | `style={{}}` | padding | `5px` | `--sp-4` | `4px` | 1px | imperceptible | both |
| 267 | `style={{}}` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 285 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 285 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 285 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 291 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 291 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 291 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 297 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 297 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 297 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |

### base.css · .main

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 549 | `.main` | --main-pad | `28px` | — | — | no token family covers --main-pad | no token | both |
| 550 | `.main` | padding | `64px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 16px away) | no token | both |
| 551 | `.main` | max-width | `1240px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 556 | `.main` | --main-pad | `20px` | — | — | no token family covers --main-pad | no token | both |
| 557 | `.main` | padding | `56px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 8px away) | no token | both |
| 562 | `.main` | --main-pad | `16px` | — | — | no token family covers --main-pad | no token | both |
| 567 | `.main` | padding | `64px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 16px away) | no token | both |
| 10932 | `.main table.tbl.roster td a.nm` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 10936 | `.main table.tbl.roster td a.nm` | font-weight | `700` | — | — | no weight token | no token | both |
| 14556 | `.main .reorder-btn` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14559 | `.main .reorder-btn` | min-width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14571 | `.main button:not(.sg-block)` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14577 | `.main button.set-logout` | min-height | `48px` | `--sp-48` | `48px` | 0px | no | both |
| 14580 | `.main .sg-weeknav-btn` | min-width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14581 | `.main .sg-weeknav-btn` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14587 | `.main .btn-ghost-pill` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/components/EntryCorrectionPanel/EntryCorrectionPanel.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 102 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 108 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 264 | `style={{}}` | margin-inline-start | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 290 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 305 | `style={{}}` | padding-inline-start | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 348 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 348 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 348 | `style={{}}` | margin-inline-end | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 357 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 357 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 584 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 591 | `style={{}}` | min-width | `110px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 608 | `style={{}}` | min-width | `110px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 683 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 689 | `style={{}}` | min-width | `110px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 702 | `style={{}}` | min-width | `110px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/TimetableSessionCard/TimetableSessionCard.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 152 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 152 | `style={{}}` | padding | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 174 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 176 | `style={{}}` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 176 | `style={{}}` | padding | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 182 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 182 | `style={{}}` | padding | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 187 | `style={{}}` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 213 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 213 | `style={{}}` | margin | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 223 | `style={{}}` | margin | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 223 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 248 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 248 | `style={{}}` | padding | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 313 | `style={{}}` | max-width | `380px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .sw

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 12196 | `.sw-kpi-label` | font-weight | `500` | — | — | no weight token | no token | both |
| 12203 | `.sw-kpi-value` | font-weight | `700` | — | — | no weight token | no token | both |
| 12213 | `.sw-kpi-trend` | font-weight | `600` | — | — | no weight token | no token | both |
| 12264 | `.sw-load-head` | font-weight | `500` | — | — | no weight token | no token | both |
| 12271 | `.sw-load-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 12275 | `.sw-load-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 12289 | `.sw-load-acwr` | font-weight | `700` | — | — | no weight token | no token | both |
| 12301 | `.sw-avail-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 12305 | `.sw-avail-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 13485 | `.sw-well-num` | font-weight | `800` | — | — | no weight token | no token | both |
| 13499 | `.sw-well-eyebrow` | font-weight | `700` | — | — | no weight token | no token | both |
| 13506 | `.sw-well-pct` | font-weight | `700` | — | — | no weight token | no token | both |
| 13511 | `.sw-well-flagged` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 13520 | `.sw-well-comp` | border-top | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .nav

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 427 | `.nav-item` | font-weight | `600` | — | — | no weight token | no token | both |
| 433 | `.nav-item` | border-left | `3px` | — | — | no border-width token exists | no token | both |
| 445 | `.nav-item .ic` | width | `17px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 446 | `.nav-item .ic` | height | `17px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 455 | `.nav-item[aria-current='page']` | font-weight | `700` | — | — | no weight token | no token | both |
| 480 | `.nav-label` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 481 | `.nav-label` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 482 | `.nav-label` | margin | `-1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 493 | `.nav-foot` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 505 | `.nav-who b` | font-weight | `700` | — | — | no weight token | no token | both |
| 516 | `.nav-signout` | font-weight | `600` | — | — | no weight token | no token | both |
| 527 | `.nav-signout .ic` | width | `17px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 528 | `.nav-signout .ic` | height | `17px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/reports/athlete/[athleteId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 444 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 445 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 445 | `style={{}}` | margin | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 448 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |
| 512 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 608 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 614 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 620 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 681 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 710 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 716 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 722 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 737 | `style={{}}` | margin | `16px` | `--sp-16` | `16px` | 0px | no | both |

### base.css · .wm

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 309 | `.wm-trace` | width | `132px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 310 | `.wm-trace` | height | `36px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 356 | `.wm-mono` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 357 | `.wm-mono` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 358 | `.wm-mono` | margin | `-1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 372 | `.wm-full` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 373 | `.wm-full` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 374 | `.wm-full` | margin | `-1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 409 | `.wm-trace-mono` | width | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 410 | `.wm-trace-mono` | height | `21px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 411 | `.wm-trace-mono` | left | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 412 | `.wm-trace-mono` | bottom | `-10px` | `--sp-10` | `10px` | 0px | no | both |

### base.css · .hist

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1720 | `.hist-row` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 1736 | `.hist-date` | font-weight | `600` | — | — | no weight token | no token | both |
| 1750 | `.hist-value` | font-weight | `700` | — | — | no weight token | no token | both |
| 1768 | `.hist-more` | font-weight | `600` | — | — | no weight token | no token | both |
| 1775 | `.hist-more a` | min-height | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 1783 | `.hist-foot` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 1793 | `.hist-foot a` | font-weight | `600` | — | — | no weight token | no token | both |
| 1808 | `.hist-value[data-missing]` | font-weight | `600` | — | — | no weight token | no token | both |
| 2001 | `.hist-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 2015 | `.hist-delta` | font-weight | `500` | — | — | no weight token | no token | both |
| 2041 | `a.hist-row:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 2042 | `a.hist-row:focus-visible` | outline-offset | `-2px` | `--sp-2` | `2px` | 0px | no | both |

### base.css · .me

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2124 | `.me-stat-value` | font-weight | `800` | — | — | no weight token | no token | both |
| 2171 | `.me-hd .me-avatar` | width | `58px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2172 | `.me-hd .me-avatar` | height | `58px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2174 | `.me-hd .me-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 4230 | `.me-avatar` | width | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4231 | `.me-avatar` | height | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 4236 | `.me-avatar` | font-weight | `700` | — | — | no weight token | no token | both |
| 4251 | `.me-profile .nm` | font-weight | `700` | — | — | no weight token | no token | both |
| 4273 | `.me-row .k` | font-weight | `600` | — | — | no weight token | no token | both |
| 4283 | `.me-row .s` | font-weight | `400` | — | — | no weight token | no token | both |
| 4293 | `.me-row .v` | font-weight | `600` | — | — | no weight token | no token | both |
| 4297 | `.me-row .v[data-off]` | font-weight | `400` | — | — | no weight token | no token | both |

### base.css · .wtp

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 9114 | `.wtp-grid` | min-width | `420px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9121 | `.wtp-corner` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 9125 | `.wtp-head` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 9127 | `.wtp-head` | font-weight | `700` | — | — | no weight token | no token | both |
| 9139 | `.wtp-hour` | right | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 9147 | `.wtp-col` | border-left | `1px` | — | — | no border-width token exists | no token | both |
| 9154 | `.wtp-line` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 9160 | `.wtp-block` | left | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 9161 | `.wtp-block` | right | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 9162 | `.wtp-block` | border-radius | `4px` | `--r-control` | `6px` | 2px | visible | both |
| 9168 | `.wtp-block` | gap | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 9173 | `.wtp-block-name` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .mute

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 11051 | `.mute-switch` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 11071 | `.mute-switch-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 11078 | `.mute-switch-track` | width | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 11079 | `.mute-switch-track` | height | `22px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11080 | `.mute-switch-track` | border-radius | `999px` | `--r-full` | `999px` | 0px | no | both |
| 11089 | `.mute-switch-track::after` | top | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 11090 | `.mute-switch-track::after` | left | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 11091 | `.mute-switch-track::after` | width | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 11092 | `.mute-switch-track::after` | height | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 11094 | `.mute-switch-track::after` | background | `#fff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 11104 | `.mute-switch:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 11105 | `.mute-switch:focus-visible` | outline-offset | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |

### base.css · .pick

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 12016 | `.pick-head` | font-weight | `500` | — | — | no weight token | no token | both |
| 12022 | `.pick-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 12023 | `.pick-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 12049 | `.pick-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 12074 | `.pick-wellness-track` | width | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12075 | `.pick-wellness-track` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 12076 | `.pick-wellness-track` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 12089 | `.pick-wellness-fill` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 12125 | `.pick-group-name` | font-weight | `500` | — | — | no weight token | no token | both |
| 12131 | `.pick-group-rule` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12156 | `.pick-legend i` | width | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12157 | `.pick-legend i` | height | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(athlete)/my-data/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 342 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 549 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 554 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 963 | `style={{}}` | margin-inline-start | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 1002 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 1002 | `style={{}}` | padding-inline-start | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 1159 | `style={{}}` | margin-inline-start | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 1164 | `style={{}}` | margin-inline-start | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 1189 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 1189 | `style={{}}` | padding-inline-start | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 1295 | `style={{}}` | margin-inline-start | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 2028 | `style={{}}` | margin-inline-start | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/components/InjuryCard/InjuryCard.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 96 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 96 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 107 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 118 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 124 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 150 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 163 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 174 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 196 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 241 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 256 | `style={{}}` | margin | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 263 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |

### base.css · .lb

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1263 | `.lb-pos` | min-width | `22px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1268 | `.lb-pos[data-top='true']` | font-weight | `700` | — | — | no weight token | no token | both |
| 11855 | `.lb-head` | font-weight | `500` | — | — | no weight token | no token | both |
| 11861 | `.lb-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 11862 | `.lb-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11882 | `.lb-row[data-top='true'] .lb-rank` | font-weight | `700` | — | — | no weight token | no token | both |
| 11887 | `.lb-name` | font-weight | `600` | — | — | no weight token | no token | both |
| 11913 | `.lb-track` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 11914 | `.lb-track` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 11926 | `.lb-fill` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 11942 | `.lb-stats b` | font-weight | `700` | — | — | no weight token | no token | both |

### src/app/(staff)/dashboard/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 276 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 276 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 285 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 285 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 286 | `style={{}}` | border-inline-start | `3px` | — | — | no border-width token exists | no token | both |
| 479 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 509 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 509 | `style={{}}` | padding | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 582 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 592 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 600 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .avail

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 969 | `.avail` | border | `1px` | — | — | no border-width token exists | no token | both |
| 984 | `.avail .v` | font-weight | `800` | — | — | no weight token | no token | both |
| 993 | `.avail .k` | font-weight | `600` | — | — | no weight token | no token | both |
| 2635 | `.avail-line` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2639 | `.avail-line` | font-weight | `600` | — | — | no weight token | no token | both |
| 2641 | `.avail-line` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2709 | `.avail-banner` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2752 | `.avail-chip` | font-weight | `700` | — | — | no weight token | no token | both |
| 2760 | `.avail-banner .k` | font-weight | `700` | — | — | no weight token | no token | both |
| 14671 | `.avail-audience` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .tbl

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1155 | `table.tbl th` | font-weight | `700` | — | — | no weight token | no token | both |
| 1162 | `table.tbl td` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 1179 | `table.tbl.tbl-cards thead` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1180 | `table.tbl.tbl-cards thead` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1186 | `table.tbl.tbl-cards tr` | border | `1px` | — | — | no border-width token exists | no token | both |
| 1211 | `table.tbl.tbl-cards td::before` | font-weight | `700` | — | — | no weight token | no token | both |
| 1225 | `table.tbl td[data-missing]` | font-weight | `600` | — | — | no weight token | no token | both |
| 1244 | `table.tbl.lb-table th` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 1252 | `table.tbl.lb-table .nm` | font-weight | `600` | — | — | no weight token | no token | both |
| 1256 | `table.tbl.lb-table td.r` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .wk

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2267 | `.wk-towards-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 2316 | `.wk-day` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2317 | `.wk-day` | border-radius | `12px` | `--r-field` | `12px` | 0px | no | both |
| 2342 | `.wk-day .wi` | font-weight | `600` | — | — | no weight token | no token | both |
| 2346 | `.wk-day .wn` | width | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2347 | `.wk-day .wn` | height | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2353 | `.wk-day .wn` | font-weight | `600` | — | — | no weight token | no token | both |
| 2354 | `.wk-day .wn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2366 | `.wk-day .wo` | font-weight | `600` | — | — | no weight token | no token | both |
| 2395 | `.wk-day[data-kind='match'] .wk-day[data-kind='training'] .wk` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .set

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5097 | `.set-body` | max-width | `780px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 5217 | `.set-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5226 | `.set-row-btn` | font-weight | `700` | — | — | no weight token | no token | both |
| 5229 | `.set-row-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5286 | `.set-row-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 5310 | `.set-list-row` | min-height | `52px` | `--hit-md` | `52px` | 0px | no | both |
| 5311 | `.set-list-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5787 | `.set-logout-form` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5790 | `.set-logout` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5798 | `.set-list-row` | min-height | `64px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/settings/club/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 57 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 91 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 105 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 129 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 137 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 140 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 176 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 179 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 200 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 220 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |

### src/components/GroupMemberManager/GroupMemberManager.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 95 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 95 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 101 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |
| 113 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 119 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 127 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 142 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 177 | `style={{}}` | max-height | `280px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 185 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 193 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |

### src/components/UserManagementPanel/UserManagementPanel.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 162 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 162 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 168 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 168 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 267 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 267 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 267 | `style={{}}` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 460 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 460 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 460 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |

### base.css · .sc

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2996 | `.sc` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 3010 | `.sc-l` | font-weight | `700` | — | — | no weight token | no token | both |
| 3014 | `.sc-v` | font-weight | `600` | — | — | no weight token | no token | both |
| 3020 | `.sc-v .n` | font-weight | `600` | — | — | no weight token | no token | both |
| 3103 | `.sc-a > span` | font-weight | `600` | — | — | no weight token | no token | both |
| 3106 | `.sc-a > span` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3114 | `.sc-where` | font-weight | `600` | — | — | no weight token | no token | both |
| 3116 | `.sc-where` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 3118 | `.sc-where` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .signin

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3601 | `.signin-logo` | --lk-trace | `#c5d1e6` | `--border` | `#d4dff5` | ΔE 5.1 | visible | both |
| 3614 | `:root:not([data-theme='light']) .signin-logo` | --lk-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 3615 | `:root:not([data-theme='light']) .signin-logo` | --lk-trace | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 3616 | `:root:not([data-theme='light']) .signin-logo` | --lk-dot | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | light |
| 3624 | `.signin-eyebrow` | font-weight | `600` | — | — | no weight token | no token | both |
| 3632 | `.signin-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 10097 | `.signin-forgot` | font-weight | `600` | — | — | no weight token | no token | both |
| 10103 | `.signin-return` | font-weight | `600` | — | — | no weight token | no token | both |
| 10109 | `.signin-return a` | text-underline-offset | `2px` | — | — | no token family covers text-underline-offset | no token | both |

### base.css · .dark

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3608 | `.dark-tokens .signin-logo` | --lk-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 3609 | `.dark-tokens .signin-logo` | --lk-trace | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 3610 | `.dark-tokens .signin-logo` | --lk-dot | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 11383 | `.dark-tokens .cmpl-track` | background | `rgb(255 255 255 / 0.12)` | — | — | no token near this colour (nearest --wash-good, ΔE 44.6) | no token | both |
| 11407 | `.dark-tokens .cmpl-tick` | background | `rgb(255 255 255 / 0.26)` | — | — | no token near this colour (nearest --band-4-wash, ΔE 55.6) | no token | both |
| 12886 | `.dark-tokens .launch` | --lk-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 12887 | `.dark-tokens .launch` | --lk-trace | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 12888 | `.dark-tokens .launch` | --lk-dot | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |
| 12890 | `.dark-tokens .launch` | --splash-ink | `#e9edfa` | `--bg` | `#e4ebf9` | ΔE 1.4 | imperceptible | both |

### base.css · .setup

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5686 | `.setup-bar-seg` | height | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 5704 | `.setup-step` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5716 | `.setup-n` | width | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 5717 | `.setup-n` | height | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 5719 | `.setup-n` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5722 | `.setup-n` | font-weight | `600` | — | — | no weight token | no token | both |
| 5748 | `.setup-cta` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5764 | `.setup-line` | border-inline-start | `3px` | — | — | no border-width token exists | no token | both |
| 5767 | `.setup-line .btn-ghost` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### base.css · .inj

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 11483 | `.inj-head` | font-weight | `500` | — | — | no weight token | no token | both |
| 11489 | `.inj-row` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 11518 | `.inj-group` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 11521 | `.inj-dot` | width | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11522 | `.inj-dot` | height | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11531 | `.inj-group-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 11546 | `.inj-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 11571 | `.inj-flag` | font-weight | `700` | — | — | no weight token | no token | both |
| 11582 | `.inj-foot` | border-top | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .rsel

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 13537 | `.rsel-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 13549 | `.rsel-wrap` | min-width | `148px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 13550 | `.rsel-wrap` | max-width | `280px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 13560 | `.rsel-wrap select` | border | `1px` | — | — | no border-width token exists | no token | both |
| 13565 | `.rsel-wrap select` | min-height | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 13576 | `.rsel-wrap select:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 13577 | `.rsel-wrap select:focus-visible` | outline-offset | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 13582 | `.rsel-chev` | inset-inline-end | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |
| 13598 | `.rsel[data-stacked='true']` | width | `128px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .safari

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14985 | `.safari-bar` | background | `rgb(234 237 241 / 0.94)` | — | — | no token near this colour (nearest --skeleton, ΔE 7.9) | no token | both |
| 14986 | `.safari-bar` | color | `#101217` | `--text` | `#13161c` | ΔE 2.1 | imperceptible | both |
| 14993 | `.safari-address` | background | `#ffffff` | `--on-group` | `#ffffff` | ΔE 0.0 | no | both |
| 14997 | `.safari-address` | border-radius | `10px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 15001 | `.safari-address` | color | `#484e57` | `--muted` | `#484e57` | ΔE 0.0 | no | both |
| 15013 | `.safari-share` | width | `34px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 15014 | `.safari-share` | height | `34px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 15020 | `.safari-share` | border | `2px` | — | — | no border-width token exists | no token | both |
| 15024 | `.safari-share-label` | color | `#484e57` | `--muted` | `#484e57` | ΔE 0.0 | no | both |

### src/app/(staff)/reports/testing/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 134 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 256 | `style={{}}` | margin | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 256 | `style={{}}` | min-width | `480px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 342 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 348 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 354 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 416 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 427 | `style={{}}` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |
| 427 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |

### src/components/ScheduleGrid/SelectedSessionPanel.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 255 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 255 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 255 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 355 | `style={{}}` | height | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 427 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 427 | `style={{}}` | padding | `5px` | `--sp-4` | `4px` | 1px | imperceptible | both |
| 427 | `style={{}}` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 435 | `style={{}}` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |
| 445 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### base.css · .btn

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 762 | `.btn-primary` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 764 | `.btn-primary` | font-weight | `700` | — | — | no weight token | no token | both |
| 786 | `.btn-ghost` | border | `1px` | — | — | no border-width token exists | no token | both |
| 789 | `.btn-ghost` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 791 | `.btn-ghost` | font-weight | `600` | — | — | no weight token | no token | both |
| 4405 | `.btn-ghost-pill` | border | `1px` | — | — | no border-width token exists | no token | both |
| 4409 | `.btn-ghost-pill` | font-weight | `600` | — | — | no weight token | no token | both |
| 4425 | `.btn-ghost-pill.accent` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .dots

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3037 | `.dots .opt` | height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 3038 | `.dots .opt` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 3060 | `.dots .opt > span` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 3061 | `.dots .opt > span` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 3062 | `.dots .opt > span` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3071 | `.dots .opt > span` | font-weight | `700` | — | — | no weight token | no token | both |
| 3088 | `.dots .opt input:focus-visible + span` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 3089 | `.dots .opt input:focus-visible + span` | outline-offset | `3px` | `--sp-2` | `2px` | 1px | imperceptible | both |

### base.css · .toast

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 4310 | `.toast` | left | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 4311 | `.toast` | right | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 4321 | `.toast` | box-shadow | `rgb(0 0 0 / 0.25)` | — | — | no token near this colour (nearest --tick, ΔE 9.4) | no token | both |
| 4321 | `.toast` | box-shadow | `8px` | — | — | no shadow token matches this shadow | no token | both |
| 4321 | `.toast` | box-shadow | `24px` | — | — | no shadow token matches this shadow | no token | both |
| 4326 | `.toast .msg` | font-weight | `600` | — | — | no weight token | no token | both |
| 4330 | `.toast .dismiss` | font-weight | `700` | — | — | no weight token | no token | both |
| 4337 | `.toast .dismiss` | margin | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### base.css · .plan

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5117 | `.plan-switch-label` | font-weight | `700` | — | — | no weight token | no token | both |
| 5131 | `.plan-switch-track` | width | `54px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 5132 | `.plan-switch-track` | height | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 5133 | `.plan-switch-track` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |
| 5151 | `.plan-switch-knob` | width | `24px` | `--sp-24` | `24px` | 0px | no | both |
| 5152 | `.plan-switch-knob` | height | `24px` | `--sp-24` | `24px` | 0px | no | both |
| 5184 | `.plan-compare-card` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 5186 | `.plan-compare-card` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .cmp

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10416 | `.cmp-card-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 10460 | `.cmp-legend-key` | width | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 10462 | `.cmp-legend-key` | border-top-width | `2px` | — | — | no border-width token exists | no token | both |
| 10482 | `.cmp-picker` | border | `1px` | — | — | no border-width token exists | no token | both |
| 10485 | `.cmp-picker` | min-width | `210px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 10492 | `.cmp-picker-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 10505 | `.cmp-against` | border | `1px` | — | — | no border-width token exists | no token | both |
| 10511 | `.cmp-against-label` | font-weight | `600` | — | — | no weight token | no token | both |

### src/components/AvatarUploadForm/AvatarUploadForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 131 | `style={{}}` | width | `4rem` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 131 | `style={{}}` | height | `4rem` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 131 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |
| 142 | `style={{}}` | height | `4rem` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 145 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |
| 150 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 205 | `style={{}}` | width | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 206 | `style={{}}` | height | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/components/OrgLogoField/OrgLogoField.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 86 | `style={{}}` | width | `3rem` | `--sp-48` | `48px` | 0px | no | both |
| 86 | `style={{}}` | height | `3rem` | `--sp-48` | `48px` | 0px | no | both |
| 86 | `style={{}}` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 86 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |
| 94 | `style={{}}` | height | `3rem` | `--sp-48` | `48px` | 0px | no | both |
| 95 | `style={{}}` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |
| 97 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |
| 102 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .athlete

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1641 | `.athlete-tabbar` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 1645 | `.athlete-tabbar` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |
| 1645 | `.athlete-tabbar` | padding | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 1667 | `.athlete-tab` | font-weight | `600` | — | — | no weight token | no token | both |
| 1679 | `.athlete-tab-glyph` | width | `23px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1680 | `.athlete-tab-glyph` | height | `23px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 2088 | `.athlete-tab[aria-current='page']` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .rd

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1838 | `.rd-value` | font-weight | `800` | — | — | no weight token | no token | both |
| 1855 | `.rd-value-words` | font-weight | `700` | — | — | no weight token | no token | both |
| 1884 | `.rd-delta` | font-weight | `400` | — | — | no weight token | no token | both |
| 1889 | `.rd-delta b` | font-weight | `700` | — | — | no weight token | no token | both |
| 1902 | `.rd-value[data-missing]` | font-weight | `600` | — | — | no weight token | no token | both |
| 1923 | `.rd-unit` | font-weight | `600` | — | — | no weight token | no token | both |
| 1925 | `.rd-unit` | margin-inline-start | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |

### base.css · .subm

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3333 | `.subm` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 3356 | `.subm-count` | font-weight | `700` | — | — | no weight token | no token | both |
| 3364 | `.subm-count[data-complete]` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3386 | `.subm-why summary` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 3400 | `.subm-why-link` | font-weight | `600` | — | — | no weight token | no token | both |
| 3403 | `.subm-why-link` | text-underline-offset | `2px` | — | — | no token family covers text-underline-offset | no token | both |
| 3416 | `.subm .btn-ghost` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .cr10

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3462 | `.cr10-row` | height | `58px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 3464 | `.cr10-row` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3478 | `.cr10-row input:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 3479 | `.cr10-row input:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 3483 | `.cr10-n` | font-weight | `700` | — | — | no weight token | no token | both |
| 3491 | `.cr10-a` | font-weight | `600` | — | — | no weight token | no token | both |
| 3507 | `.cr10-row[data-selected='true'] .cr10-a` | color | `rgb(255 255 255 / 0.8)` | — | — | no token near this colour (nearest --on-group, ΔE 20.0) | no token | both |

### base.css · .prog

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 4200 | `.prog-header h1` | font-weight | `700` | — | — | no weight token | no token | both |
| 5832 | `.prog-item` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5833 | `.prog-item` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 5848 | `.prog-day` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5849 | `.prog-day` | border-radius | `14px` | `--r-tab` | `14px` | 0px | no | both |
| 5866 | `.prog-ex-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5871 | `.prog-ex-head` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .pw

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10069 | `.pw-wrap .field` | padding-inline-end | `52px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 4px away) | no token | both |
| 10075 | `.pw-toggle` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 10076 | `.pw-toggle` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14910 | `.pw-rule-mark` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 14912 | `.pw-rule-mark` | font-weight | `700` | — | — | no weight token | no token | both |
| 14923 | `.pw-rule[data-state='unmet'] .pw-rule-mark` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 14924 | `.pw-rule[data-state='unmet'] .pw-rule-mark` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |

### src/app/(athlete)/my-data/boards/[leaderboardId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 51 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 91 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 120 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 148 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 204 | `style={{}}` | margin-inline-end | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 223 | `style={{}}` | border-inline-start | `3px` | — | — | no border-width token exists | no token | both |
| 230 | `style={{}}` | margin-inline-end | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/app/(staff)/reports/injuries/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 230 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |
| 285 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 444 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 444 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 500 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 500 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 509 | `style={{}}` | width | `110px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/squad/[athleteId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 559 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 780 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 780 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 791 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 791 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 1036 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 1164 | `style={{}}` | margin | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/components/PlayerProfileFlags/PlayerProfileFlags.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 182 | `style={{}}` | border-inline-start | `3px` | — | — | no border-width token exists | no token | both |
| 185 | `style={{}}` | padding | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 185 | `style={{}}` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |
| 189 | `style={{}}` | padding | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 189 | `style={{}}` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |
| 235 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 241 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |

### src/components/TestLogGrid/TestLogGrid.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 157 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 157 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 189 | `style={{}}` | width | `64px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 190 | `style={{}}` | padding | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 190 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 253 | `style={{}}` | padding | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 253 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/components/ThresholdEditorForm/ThresholdEditorForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 156 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 198 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 212 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 234 | `style={{}}` | max-width | `120px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 252 | `style={{}}` | max-width | `120px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 255 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 272 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/TrainingScatter/TrainingScatter.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 84 | `style={{}}` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 84 | `style={{}}` | background | `rgba(16,18,23,0.22)` | `--tick` | `rgba(16, 18, 23, 0.22)` | ΔE 0.0 | no | both |
| 88 | `style={{}}` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 88 | `style={{}}` | background | `rgba(16,18,23,0.22)` | `--tick` | `rgba(16, 18, 23, 0.22)` | ΔE 0.0 | no | both |
| 98 | `style={{}}` | padding | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 98 | `style={{}}` | padding | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 100 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .theme

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 652 | `.theme-seg` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 661 | `.theme-seg-btn` | font-weight | `700` | — | — | no weight token | no token | both |
| 677 | `.theme-seg-btn:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 678 | `.theme-seg-btn:focus-visible` | outline-offset | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 14304 | `.theme-seg-btn[data-active]` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 14305 | `.theme-seg-btn[data-active]` | outline-offset | `-2px` | `--sp-2` | `2px` | 0px | no | both |

### base.css · .empty

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1326 | `.empty` | border | `1px` | — | — | no border-width token exists | no token | both |
| 1336 | `.empty .empty-action` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 1341 | `.empty h2` | font-weight | `700` | — | — | no weight token | no token | both |
| 14623 | `.empty-period` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14630 | `.empty-period-title` | font-weight | `700` | — | — | no weight token | no token | both |
| 14643 | `.empty-period-action` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### base.css · .legend

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1425 | `.legend i` | width | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 1426 | `.legend i` | height | `3px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1427 | `.legend i` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |
| 1431 | `.legend i.sq` | width | `9px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1432 | `.legend i.sq` | height | `9px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1433 | `.legend i.sq` | border-radius | `2px` | — | — | no radius step within 2px (nearest --r-control 6px, 4px away) | no token | both |

### base.css · .sheet

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2852 | `.sheet-head` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 2853 | `.sheet-head` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 2863 | `.sheet-head .t` | font-weight | `800` | — | — | no weight token | no token | both |
| 2875 | `.sheet-x` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2876 | `.sheet-x` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2877 | `.sheet-x` | margin | `-5px` | `--sp-4` | `4px` | 1px | imperceptible | both |

### base.css · .back

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 11121 | `.back-btn` | border | `1px` | — | — | no border-width token exists | no token | both |
| 11126 | `.back-btn` | font-weight | `600` | — | — | no weight token | no token | both |
| 11144 | `.back-btn:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 11145 | `.back-btn:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 11148 | `.back-btn svg` | width | `15px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 11149 | `.back-btn svg` | height | `15px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .lockup

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 12763 | `.lockup-inner` | width | `1001px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12764 | `.lockup-inner` | height | `437px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12770 | `.lockup-word` | left | `40px` | `--sp-40` | `40px` | 0px | no | both |
| 12772 | `.lockup-word` | height | `343.8px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 12781 | `.lockup-word` | font-weight | `800` | — | — | no weight token | no token | both |
| 12782 | `.lockup-word` | font-size | `386px` | — | — | no size step within 1.5px (nearest --fs-48 3rem, 338px away) | no token | both |

### src/app/(staff)/settings/groups/[groupId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 125 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 125 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 127 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |
| 132 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 140 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 152 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |

### src/app/(staff)/settings/groups/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 141 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 141 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 141 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 153 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 154 | `style={{}}` | padding-inline-end | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 176 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |

### src/components/ExportBuilderForm/ExportBuilderForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 132 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 132 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 150 | `style={{}}` | margin | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 159 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 163 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 171 | `style={{}}` | margin | `18px` | `--sp-18` | `18px` | 0px | no | both |

### src/components/PlayerProfileBio/PlayerProfileBio.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 202 | `style={{}}` | min-height | `36px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 216 | `style={{}}` | min-height | `36px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 231 | `style={{}}` | min-height | `36px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 250 | `style={{}}` | min-height | `36px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 275 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 275 | `style={{}}` | padding | `20px` | `--sp-20` | `20px` | 0px | no | both |

### base.css · .pill

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 902 | `.pill` | font-weight | `700` | — | — | no weight token | no token | both |
| 927 | `.pill` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |
| 955 | `.pill-neutral` | border | `1px` | — | — | no border-width token exists | no token | both |
| 956 | `.pill-neutral` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |
| 2469 | `.pill-optional` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .attn

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1054 | `.attn-head` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 1061 | `.attn-head` | font-weight | `700` | — | — | no weight token | no token | both |
| 1072 | `.attn .rank` | font-weight | `700` | — | — | no weight token | no token | both |
| 1078 | `.attn-name` | font-weight | `700` | — | — | no weight token | no token | both |
| 1102 | `.attn-vs .v` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .phone

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1475 | `.phone` | max-width | `480px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1528 | `.phone-body` | --pad-card-x | `18px` | — | — | no token family covers --pad-card-x | no token | both |
| 1529 | `.phone-body` | --pad-card-y | `16px` | — | — | no token family covers --pad-card-y | no token | both |
| 1597 | `.phone-body .card-title` | font-weight | `800` | — | — | no weight token | no token | both |
| 11174 | `.phone-body .back-btn::after` | height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### base.css · .gb

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1954 | `.gb-bar` | min-height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 1955 | `.gb-bar` | border-radius | `7px` | `--r-band` | `7px` | 0px | no | both |
| 1955 | `.gb-bar` | border-radius | `3px` | — | — | no radius step within 2px (nearest --r-control 6px, 3px away) | no token | both |
| 1981 | `.gb-bar[data-zero]` | height | `3px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 1986 | `.gb-label` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .md

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2208 | `.md-seg` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2215 | `.md-seg` | font-weight | `600` | — | — | no weight token | no token | both |
| 2230 | `.md-seg[aria-selected='true']` | font-weight | `700` | — | — | no weight token | no token | both |
| 2233 | `.md-seg:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 2234 | `.md-seg:focus-visible` | outline-offset | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |

### base.css · .flag

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3533 | `.flag-line .v` | font-weight | `700` | — | — | no weight token | no token | both |
| 3537 | `.flag-line .base` | font-weight | `700` | — | — | no weight token | no token | both |
| 3548 | `.flag-dismiss` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 10214 | `.flag-notice-heading` | font-weight | `600` | — | — | no weight token | no token | both |
| 10226 | `.flag-notice-item` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |

### base.css · .consent

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14840 | `.consent-choice` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14844 | `.consent-choice` | font-weight | `700` | — | — | no weight token | no token | both |
| 14854 | `.consent-choice:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 14855 | `.consent-choice:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 14876 | `.consent-block-list dt` | font-weight | `700` | — | — | no weight token | no token | both |

### src/app/(staff)/reports/compliance/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 209 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 215 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 303 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 383 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 475 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/DashboardHeadlineStats/DashboardHeadlineStats.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 328 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 344 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 361 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 373 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 379 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |

### src/components/PlanGate/PlanGate.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 47 | `style={{}}` | width | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 48 | `style={{}}` | height | `30px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 49 | `style={{}}` | border-radius | `9px` | `--r-toggle` | `9px` | 0px | no | both |
| 62 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 65 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/StageLadder/StageLadder.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 72 | `style={{}}` | max-width | `120px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 115 | `style={{}}` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 116 | `style={{}}` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 116 | `style={{}}` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 138 | `style={{}}` | max-width | `120px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .skip

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 105 | `.skip-link` | inset-inline-start | `-9999px` | — | — | no spacing step within 2px (nearest --sp-48 48px, 9951px away) | no token | both |
| 112 | `.skip-link` | border | `1px` | — | — | no border-width token exists | no token | both |
| 115 | `.skip-link:focus` | inset-inline-start | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 116 | `.skip-link:focus` | top | `8px` | `--sp-8` | `8px` | 0px | no | both |

### base.css · .sign

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2153 | `.sign-out` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2157 | `.sign-out` | font-weight | `700` | — | — | no weight token | no token | both |
| 2165 | `.sign-out:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 2166 | `.sign-out:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |

### base.css · .sess

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2484 | `.sess` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2488 | `.sess .tm` | padding-top | `1px` | `--sp-2` | `2px` | 1px | imperceptible | both |
| 2492 | `.sess .ti` | font-weight | `600` | — | — | no weight token | no token | both |
| 2505 | `.sess .state` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .step

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2950 | `.step .btnc` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2951 | `.step .btnc` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2953 | `.step .btnc` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2974 | `.step .val .v` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .disclose

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3135 | `.disclose` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 3141 | `.disclose summary` | font-weight | `600` | — | — | no weight token | no token | both |
| 3148 | `.disclose summary` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 3174 | `.disclose-body .field[aria-invalid='true']` | box-shadow | `3px` | — | — | no shadow token matches this shadow | no token | both |

### base.css · .audit

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5474 | `.audit-filters-open` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5484 | `.audit-sheet-alltime` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5488 | `.audit-sheet-alltime input` | width | `20px` | `--sp-20` | `20px` | 0px | no | both |
| 5489 | `.audit-sheet-alltime input` | height | `20px` | `--sp-20` | `20px` | 0px | no | both |

### base.css · .rep

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10685 | `.rep-card` | min-height | `148px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 10688 | `.rep-dot` | width | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 10689 | `.rep-dot` | height | `7px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 10707 | `.rep-source` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .rfig

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14023 | `.rfig` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14032 | `.rfig-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 14037 | `.rfig-count` | font-weight | `600` | — | — | no weight token | no token | both |
| 14043 | `.rfig-value` | font-weight | `600` | — | — | no weight token | no token | both |

### src/app/(athlete)/rpe/[sessionId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 49 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 83 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 132 | `style={{}}` | width | `56px` | `--hit-lg` | `56px` | 0px | no | both |
| 138 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/app/(staff)/programmes/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 204 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 264 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 264 | `style={{}}` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 269 | `style={{}}` | min-width | `430px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/settings/thresholds/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 73 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |
| 96 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 96 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 96 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/components/NutritionWorkspace/MealLibraryPicker.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 52 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 52 | `style={{}}` | padding | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 53 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |
| 59 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |

### src/components/TestDateNav/TestDateNav.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 52 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 52 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 65 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 65 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |

### base.css · .(element)

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 84 | `:focus-visible` | outline | `2px` | — | — | no border-width token exists | no token | both |
| 85 | `:focus-visible` | outline-offset | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 86 | `:focus-visible` | border-radius | `4px` | `--r-control` | `6px` | 2px | visible | both |

### base.css · .visually

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 121 | `.visually-hidden` | width | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 122 | `.visually-hidden` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 123 | `.visually-hidden` | margin | `-1px` | `--sp-2` | `2px` | 1px | imperceptible | both |

### base.css · .brand

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 290 | `.brand .wm` | width | `132px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 298 | `.brand .wm` | font-weight | `800` | — | — | no weight token | no token | both |
| 402 | `.brand .wm` | width | `40px` | `--sp-40` | `40px` | 0px | no | both |

### base.css · .toggle

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 617 | `.toggle` | border | `1px` | — | — | no border-width token exists | no token | both |
| 620 | `.toggle` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 622 | `.toggle` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .field

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 808 | `.field` | border | `1px` | — | — | no border-width token exists | no token | both |
| 811 | `.field` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14931 | `.field[data-invalid='true']` | box-shadow | `3px` | — | — | no shadow token matches this shadow | no token | both |

### base.css · .squad

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 836 | `.squad-chip` | font-weight | `600` | — | — | no weight token | no token | both |
| 838 | `.squad-chip` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 840 | `.squad-chip` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .hd

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1611 | `.hd` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 1612 | `.hd` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 1621 | `.hd .d` | font-weight | `800` | — | — | no weight token | no token | both |

### base.css · .done

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2514 | `.done-check` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2515 | `.done-check` | height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2525 | `.done-title` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .report

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2782 | `.report-card` | border | `1px` | — | — | no border-width token exists | no token | both |
| 2792 | `.report-card .k` | font-weight | `600` | — | — | no weight token | no token | both |
| 10276 | `.report-note` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |

### base.css · .after

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3257 | `.after-card` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3268 | `.after-heading` | font-weight | `800` | — | — | no weight token | no token | both |
| 3275 | `.after-fact` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .nut

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3698 | `.nut-answer` | min-height | `64px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 3701 | `.nut-answer` | border | `1px` | — | — | no border-width token exists | no token | both |
| 3706 | `.nut-answer` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .reorder

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5070 | `.reorder-btn` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5071 | `.reorder-btn` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5073 | `.reorder-btn` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .um

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5327 | `.um-search` | max-width | `360px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 5330 | `.um-filters .field` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5417 | `.um-change` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### base.css · .dlg

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5520 | `.dlg` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5551 | `.dlg-actions .btn-ghost` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5564 | `.dlg-line-medical` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .pv

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5588 | `.pv-request` | border | `1px` | — | — | no border-width token exists | no token | both |
| 5617 | `.pv-holds li` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5621 | `.pv-cat` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .held

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5648 | `.held-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 5665 | `.held-pick` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 5666 | `.held-pick` | min-width | `200px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .ap

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10549 | `.ap-readout` | border | `1px` | — | — | no border-width token exists | no token | both |
| 10561 | `.ap-series-label` | font-weight | `600` | — | — | no weight token | no token | both |
| 10581 | `.ap-suppressed` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .tst

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 13615 | `.tst-pb-dot` | width | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 13616 | `.tst-pb-dot` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 13652 | `.tst-manage` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .pb

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14763 | `.pb-assign-headline` | font-weight | `700` | — | — | no weight token | no token | both |
| 14775 | `.pb-reads-only` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 14777 | `.pb-reads-only` | font-weight | `500` | — | — | no weight token | no token | both |

### src/app/(athlete)/my-data/gym/[gymSessionLogId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 118 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |
| 162 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 162 | `style={{}}` | padding-inline-start | `18px` | `--sp-18` | `18px` | 0px | no | both |

### src/app/(athlete)/report-problem/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 56 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 87 | `style={{}}` | padding | `13px` | `--sp-12` | `12px` | 1px | imperceptible | both |
| 93 | `style={{}}` | font-size | `0.875rem` | `--fs-14` | `0.875rem` | 0px | no | both |

### src/app/(athlete)/today/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 341 | `style={{}}` | font-size | `1.0625rem` | `--fs-16` | `1rem` | 1px | imperceptible | both |
| 369 | `style={{}}` | font-size | `1.0625rem` | `--fs-16` | `1rem` | 1px | imperceptible | both |
| 380 | `style={{}}` | font-size | `1.0625rem` | `--fs-16` | `1rem` | 1px | imperceptible | both |

### src/app/(staff)/leaderboards/[leaderboardId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 101 | `style={{}}` | max-width | `680px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 229 | `style={{}}` | margin | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 246 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/app/(staff)/reports/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 246 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 247 | `style={{}}` | padding | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 247 | `style={{}}` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |

### src/app/(staff)/schedule/fixtures/[fixtureId]/participation/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 45 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |
| 83 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |
| 112 | `style={{}}` | max-width | `120px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/settings/plan/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 51 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 72 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 77 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |

### src/components/BodyWeightPanel/BodyWeightPanel.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 329 | `style={{}}` | margin | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 329 | `style={{}}` | margin | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 590 | `style={{}}` | min-width | `78px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/BulkInviteForm/BulkInviteForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 170 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 170 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 170 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/components/TestBests/TestBests.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 94 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 104 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |
| 115 | `style={{}}` | font-weight | `800` | — | — | no weight token | no token | both |

### src/components/TestTrendChart/TestTrendChart.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 126 | `style={{}}` | width | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 126 | `style={{}}` | height | `8px` | `--sp-8` | `8px` | 0px | no | both |
| 126 | `style={{}}` | border-radius | `8px` | `--r-toggle` | `9px` | 1px | imperceptible | both |

### src/components/UserDetailPanel/UserDetailPanel.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 324 | `style={{}}` | min-height | `32px` | `--sp-32` | `32px` | 0px | no | both |
| 324 | `style={{}}` | padding | `4px` | `--sp-4` | `4px` | 0px | no | both |
| 324 | `style={{}}` | padding | `8px` | `--sp-8` | `8px` | 0px | no | both |

### base.css · .page

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 593 | `.page-head` | min-width | `260px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 604 | `.page-head h1` | font-weight | `800` | — | — | no weight token | no token | both |

### base.css · .card

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 697 | `.card` | border | `1px` | — | — | no border-width token exists | no token | both |
| 704 | `.card-title` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .chip

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 887 | `.chip-static` | font-weight | `600` | — | — | no weight token | no token | both |
| 890 | `.chip-static` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .arow

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1020 | `.arow` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 1031 | `.arow .lbl` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .load

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1121 | `.load-row` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 1142 | `.load-val` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .pbar

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1355 | `.pbar` | border | `1px` | — | — | no border-width token exists | no token | both |
| 1369 | `.pbar .nmx` | font-weight | `800` | — | — | no weight token | no token | both |

### base.css · .todo

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2057 | `.todo-left` | font-weight | `700` | — | — | no weight token | no token | both |
| 2415 | `.todo` | min-height | `46px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .td

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2565 | `.td-row` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 2574 | `.td-name` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .dir

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2896 | `.dir` | border-bottom | `1px` | — | — | no border-width token exists | no token | both |
| 2900 | `.dir b` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .err

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3185 | `.err-line` | font-weight | `600` | — | — | no weight token | no token | both |
| 3200 | `.err-dot` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .login

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3566 | `.login-wrap` | max-width | `480px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 3571 | `.login-wrap` | padding | `24px` | `--sp-24` | `24px` | 0px | no | both |

### base.css · .form

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 3675 | `.form-error` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |
| 3678 | `.form-error` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .gold

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5202 | `.gold-badge` | font-weight | `700` | — | — | no weight token | no token | both |
| 5204 | `.gold-badge` | border-radius | `20px` | `--r-pill` | `20px` | 0px | no | both |

### base.css · .linklike

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10038 | `.linklike` | font-weight | `600` | — | — | no weight token | no token | both |
| 10041 | `.linklike` | text-underline-offset | `2px` | — | — | no token family covers text-underline-offset | no token | both |

### base.css · .roster

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 10910 | `.roster tr` | min-height | `60px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 10912 | `.roster tr` | border-top | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .week

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 12324 | `.week-nav` | border | `1px` | — | — | no border-width token exists | no token | both |
| 12342 | `.week-nav b` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .absence

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14715 | `.absence-well` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14722 | `.absence-well-k` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .ro

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14738 | `.ro-owner` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14745 | `.ro-owner-k` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .legal

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14792 | `.legal-pending` | border | `1px` | — | — | no border-width token exists | no token | both |
| 14806 | `.legal-pending-ref` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .install

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14972 | `.install-step-n` | height | `24px` | `--sp-24` | `24px` | 0px | no | both |
| 14976 | `.install-step-n` | font-weight | `700` | — | — | no weight token | no token | both |

### src/app/(athlete)/me/status/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 81 | `style={{}}` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |
| 114 | `style={{}}` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/app/(staff)/nutrition/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 355 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |
| 358 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |

### src/app/(staff)/platform/sign-in-probes/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 110 | `style={{}}` | margin | `26px` | `--sp-24` | `24px` | 2px | visible | both |
| 110 | `style={{}}` | margin | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/app/(staff)/programmes/[programmeId]/athlete/[athleteId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 134 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 171 | `style={{}}` | min-width | `480px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/programmes/proposals/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 50 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |
| 109 | `style={{}}` | min-width | `220px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/reports/athlete/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 120 | `style={{}}` | width | `260px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 177 | `style={{}}` | padding | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/app/(staff)/reports/match/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 84 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 170 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |

### src/app/(staff)/reports/squad/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 283 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 284 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |

### src/app/(staff)/reports/training-load/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 105 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 110 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/app/(staff)/settings/subject-access/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 40 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |
| 87 | `style={{}}` | margin-inline-start | `6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/squad/[athleteId]/gym/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 377 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 436 | `style={{}}` | margin | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/app/(staff)/squad/[athleteId]/nutrition/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 308 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 422 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/squad/[athleteId]/wellness/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 250 | `style={{}}` | margin | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 274 | `style={{}}` | margin-inline-start | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/app/(staff)/timetable/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 76 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 76 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/FixtureEditForm/FixtureEditForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 107 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 146 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/FlagCard/FlagCard.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 339 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |
| 352 | `style={{}}` | margin | `6px` | `--sp-6` | `6px` | 0px | no | both |

### src/components/FlagNotice/FlagNotice.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 40 | `style={{}}` | padding | `2px` | `--sp-2` | `2px` | 0px | no | both |
| 40 | `style={{}}` | padding | `9px` | `--sp-8` | `8px` | 1px | imperceptible | both |

### src/components/GroupEditForm/GroupEditForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 84 | `style={{}}` | width | `320px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |
| 112 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/GroupEditorForm/GroupEditorForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 81 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 110 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/MfaEnrollment/MfaEnrollment.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 254 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |
| 266 | `style={{}}` | max-width | `200px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/NewFixtureForm/NewFixtureForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 131 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 170 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/NewSessionForm/NewSessionForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 152 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 242 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/NotificationPreferencesForm/NotificationPreferencesForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 141 | `style={{}}` | padding | `12px` | `--sp-12` | `12px` | 0px | no | both |
| 141 | `style={{}}` | padding | `16px` | `--sp-16` | `16px` | 0px | no | both |

### src/components/ResetConfirmForm/ResetConfirmForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 221 | `style={{}}` | width | `18px` | `--sp-18` | `18px` | 0px | no | both |
| 221 | `style={{}}` | height | `18px` | `--sp-18` | `18px` | 0px | no | both |

### src/components/SessionEditForm/SessionEditForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 140 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |
| 228 | `style={{}}` | margin | `14px` | `--sp-14` | `14px` | 0px | no | both |

### src/components/ThresholdRow/ThresholdRow.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 60 | `style={{}}` | border-top | `1px` | — | — | no border-width token exists | no token | both |
| 76 | `style={{}}` | font-weight | `700` | — | — | no weight token | no token | both |

### src/components/WeekLoadChart/WeekLoadChart.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 37 | `style={{}}` | font-weight | `600` | — | — | no weight token | no token | both |
| 38 | `style={{}}` | font-weight | `400` | — | — | no weight token | no token | both |

### base.css · .body

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 49 | `body` | font-weight | `400` | — | — | no weight token | no token | both |

### base.css · .sidebar

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 256 | `.sidebar` | border-right | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .eyebrow

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 600 | `.eyebrow` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .nm

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 739 | `.nm` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .hr

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 746 | `.hr` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .hair

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 752 | `.hair` | height | `1px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .label

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 823 | `.label` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .row

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1272 | `.row-link` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### base.css · .kv

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1283 | `.kv` | border-top | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .banner

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1310 | `.banner` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .chart

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 1405 | `.chart[data-compact]` | height | `62px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### base.css · .day

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2601 | `.day-name` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .next

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2673 | `.next-up .when` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .sect

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2796 | `.sect` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .sleep

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 2925 | `.sleep-panel .sp-head .k` | font-weight | `700` | — | — | no weight token | no token | both |

### base.css · .target

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 4215 | `.target-bar .th .k` | font-weight | `600` | — | — | no weight token | no token | both |

### base.css · .ret

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 5572 | `.ret-consequence` | border | `1px` | — | — | no border-width token exists | no token | both |

### base.css · .rtable

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 14086 | `.rtable-count` | font-weight | `600` | — | — | no weight token | no token | both |

### src/app/(athlete)/check-in/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 131 | `style={{}}` | margin-inline-start | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/app/(athlete)/consent/guardian/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 128 | `style={{}}` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/app/(athlete)/me/leaderboards/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 37 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/app/(athlete)/me/reminders/install/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 19 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/app/(athlete)/nutrition-check-in/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 129 | `style={{}}` | margin-inline-start | `8px` | `--sp-8` | `8px` | 0px | no | both |

### src/app/(athlete)/programme/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 115 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |

### src/app/(staff)/denied/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 35 | `style={{}}` | max-width | `560px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/flags/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 76 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/app/(staff)/injuries/rehab-groups/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 64 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/app/(staff)/injuries/team-allocation/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 85 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/app/(staff)/leaderboards/manage/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 73 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/schedule/[sessionId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 131 | `style={{}}` | min-width | `260px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/schedule/fixtures/[fixtureId]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 147 | `style={{}}` | min-width | `260px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/app/(staff)/settings/audit/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 141 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/settings/exports/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 67 | `style={{}}` | margin | `16px` | `--sp-16` | `16px` | 0px | no | both |

### src/app/(staff)/settings/retention/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 46 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/settings/setup/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 35 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 40 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/(staff)/settings/users/bulk-invite/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 33 | `style={{}}` | margin-top | `-6px` | `--sp-6` | `6px` | 0px | no | both |

### src/app/guardian/[token]/page.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 28 | `style={{}}` | max-width | `480px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/AddAthleteForm/AddAthleteForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 240 | `style={{}}` | border | `1px` | — | — | no border-width token exists | no token | both |

### src/components/AthleteDomainShell/AthleteDomainShell.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 78 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/components/AvailabilityBanner/AvailabilityBanner.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 175 | `style={{}}` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/components/ClubDetailsEditForm/ClubDetailsEditForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 139 | `style={{}}` | max-width | `100px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/Dial/Dial.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 125 | `svg attribute` | stroke | `rgba(16,18,23,0.4)` | — | — | no token near this colour (nearest --border-strong, ΔE 12.0) | no token | light |

### src/components/EntryLocked/EntryLocked.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 20 | `style={{}}` | width | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/components/InjuryMedicalForm/InjuryMedicalForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 188 | `style={{}}` | margin | `18px` | `--sp-18` | `18px` | 0px | no | both |

### src/components/NewTemplateForm/NewTemplateForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 40 | `style={{}}` | max-width | `480px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/NutritionCheckinForm/NutritionCheckinForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 249 | `style={{}}` | min-height | `56px` | `--hit-lg` | `56px` | 0px | no | both |

### src/components/NutritionWorkspace/NewMealForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 199 | `style={{}}` | min-height | `44px` | `--tap-min` | `44px` | 0px | no | both |

### src/components/NutritionWorkspace/NutritionWorkspace.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 336 | `style={{}}` | margin-top | `-4px` | `--sp-4` | `4px` | 0px | no | both |

### src/components/NutritionWorkspace/TargetsTable.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 66 | `style={{}}` | min-width | `1054px` | — | — | a fixed dimension with no token at this value (layout, out of scope) | no token | both |

### src/components/ProblemReportForm/ProblemReportForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 164 | `style={{}}` | min-height | `56px` | `--hit-lg` | `56px` | 0px | no | both |

### src/components/RpeForm/RpeForm.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 240 | `style={{}}` | min-height | `56px` | `--hit-lg` | `56px` | 0px | no | both |

### src/components/Sidebar/Sidebar.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 231 | `style={{}}` | margin | `10px` | `--sp-10` | `10px` | 0px | no | both |

### src/components/TodayRpeRow/TodayRpeRow.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 116 | `style={{}}` | font-size | `1.0625rem` | `--fs-16` | `1rem` | 1px | imperceptible | both |

### src/components/WeekTemplatePreview/WeekTemplatePreview.tsx

| Line | Selector | Property | Literal | Token | Token value | Difference | Visible | Theme |
|---|---|---|---|---|---|---|---|---|
| 130 | `style={{}}` | border-inline-start | `2px` | — | — | no border-width token exists | no token | both |
