# 11. Open Questions

Every decision in the specification that needs your input rather than mine. Each is
numbered and linked back to the document that raised it.

The specification is buildable without answering all of these. Questions marked
**blocking** change the schema or a core mechanic and should be answered before the
phase that touches them starts. The rest can be answered as you go.

**Total: 389 open questions.**

---

## How to use this list

Do not try to answer all of these at once. Work through them in this order:

1. The blocking ones in **Product and scope** and **Architecture** below, before Phase 0.
2. Anything in **Design system** once your design photographs are in, since several will
   answer themselves.
3. Screen-level questions when you reach the phase that builds that screen.

---

## Core specification questions

### `docs/00-product-overview.md`

| ID | Question |
|---|---|
| **O-1** | exact price points per tier. |

### `docs/01-roles-and-permissions.md`

| ID | Question |
|---|---|
| **O-2** | should carve-out 2 be configurable per organisation? |
| **O-3** | do you need group-restricted staff, an academy coach who can only ever see academy athletes? |
| **O-4** | acceptable to defer support access to Phase 3, or needed at launch? |
| **O-995** | which of the three? |

### `docs/02-information-architecture.md`

| ID | Question |
|---|---|
| **O-5** | **RESOLVED, 5 August 2026.** "Corner group allocation" means allocating players to specific teams. |
| **O-6** | **RESOLVED, 5 August 2026. |
| **O-7** | Should `Reports` and `Analytics` be one destination? |
| **O-720** | Is `My dashboard` the same screen as 8 `dashboard.md`, or a personalised surface? |
| **O-721** | `Squad overview` is one sidebar item. |
| **O-722** | **CLOSED.** `Flight control` has been removed from the product at the client's instruction (5 August 2026). |
| **O-723** | `Flags` and `Injury dashboard` have no sidebar entry, yet `flags.md` and `injury-dashboard.md` are two of the most detailed screens in the specification and the flag system is described in `00-product-overview.md` as "the product". |
| **O-724** | Fifteen flat sidebar items with no grouping. |
| **O-725** | Restates O-6 and O-24 with new evidence. |
| **O-726** | The sidebar has one `Nutrition` item and one `Gym programme` item. |
| **O-727** | `Fixtures` is top-level in the app and nested under `Schedule` in the specification. |
| **O-728** | The footer reads `Account · Sports s…`, truncated. |
| **O-729** | There is no wellness destination in the sidebar. |

### `docs/03-flows.md`

| ID | Question |
|---|---|
| **O-8** | minimum n before a correlation is displayed. |

### `docs/04-data-model.md`

| ID | Question |
|---|---|
| **O-9** | Academy athletes grow. |
| **O-10** | is a flat unweighted sum acceptable, or do you want configurable per-organisation weights? |
| **O-11** | **RESOLVED, 5 August 2026.** No athlete nutrition logging. |
| **O-12** | **RESOLVED, 5 August 2026. |
| **O-13** | Retention period for athlete data after they leave a club. |
| **O-968** | which timezone computes age? |
| **O-969** | should `athlete_is_minor()` returning `true` for a null date of birth be a hard error instead? |
| **O-971** | . |

### `docs/05-architecture.md`

| ID | Question |
|---|---|
| **O-14** | Staff offline scope. |
| **O-15** | Data residency. |
| **O-16** | Push delivery route. |
| **O-17** | Whether staff web needs a session-replay style debugging tool. |
| **O-18** | Force-upgrade window. |
| **O-19** | Analytics read replica. |
| **O-20** | Android background sync when the app is force-stopped. |
| **O-983** | Staff shell store review accounts. |
| **O-984** | Whether an athlete under 18 may hold a staff role. |

### `docs/06-design-system.md`

| ID | Question |
|---|---|
| **O-601** | Light-theme text contrast. |
| **O-602** | The pill recipe. |
| **O-603** | Focus-visible. |
| **O-604** | Disabled states. |
| **O-605** | Destructive actions. |
| **O-606** | Elevation and sheets. |
| **O-607** | Mobile parity. |
| **O-608** | Chart palette. |
| **O-609** | The `*-rgb` triplets. |
| **O-610** | Empty-state illustrations. |
| **O-611** | "Same as yesterday" prefill on the wellness form. |
| **O-612** | Offline writes for staff. |
| **O-613** | Athlete photographs. |
| **O-614** | Squad grid glyph-only availability. |
| **O-615** | Units. |
| **O-616** | Leaderboard tone. |
| **O-617** | Two internal inconsistencies in the source, which I have resolved one way and want confirming. |

### `docs/07-integrations.md`

| ID | Question |
|---|---|
| **O-40** | Which GPS vendors get prebuilt profiles at launch? |
| **O-41** | Fuzzy match auto-accept. |
| **O-42** | HealthKit first-sync backfill window. |
| **O-43** | Should device-measured sleep duration feed `readiness_score`, replacing the self-reported figure, or sit alongside it? |
| **O-44** | Health Connect reports HRV as RMSSD, HealthKit as SDNN. |
| **O-45** | Minimum device-metric coverage before squad-level device analysis is permitted. |
| **O-46** | Do you want to open a Catapult partner conversation now, on the strength of a named pilot club, or wait until a customer asks? |
| **O-47** | PDF report contents and branding. |
| **O-48** | Premium tier data export: webhooks or read API first? |
| **O-985** | Minors and HealthKit coverage. |

### `docs/08-notifications.md`

| ID | Question |
|---|---|
| **O-49** | Should the morning wellness prompt time be per athlete rather than per organisation? |
| **O-50** | The RPE prompt needs a session end time. |
| **O-51** | Should repeated athlete non-compliance escalate to a staff notification, and after how many consecutive missed days? |
| **O-52** | Weekly digest day and time. |
| **O-53** | Should medical receive wellness soreness flags directly, or only through the coach? |
| **O-54** | Email provider and sending domain. |
| **O-55** | Do notification preferences need to survive an athlete moving between clubs? |
| **O-981** | The children's floor in §5.4 sets two nudges a week and two missed days before cooling-off. |
| **O-986** | Rename `athlete.consent.required` and `staff.consent.declined`. |
| **O-987** | Divergence notice audience (§4.6). |

### `docs/09-security-and-compliance.md`

| ID | Question |
|---|---|
| **O-56** | Do any target clubs have an existing occupational health provider or club doctor who would be a joint controller for the clinical record? |
| **O-57** | Should the leaderboard show an athlete's name to teammates by default, or on opt-in? |
| **O-58** | Retention of `raw` in `gps_records`: keep vendor columns not mapped to a field, or discard at import? |
| **O-59** | What happens to an athlete's data when they transfer between two clubs that both use Fydr? |
| **O-900** | The lawful basis row for **nutrition targets and guidance** in §3 is my reading, not advice, and it is the one row in that table marked `[low]`. |
| **O-950** | are the athletes at your target clubs employees, workers, or genuine amateurs? |
| **O-951** | `athletes.consent_given_at` and `consent_version` should be renamed to `notice_acknowledged_at` and `notice_version` to reflect that the athlete relationship is not consent-based. |
| **O-960** | which age grades are actually in scope, per club? |
| **O-961** | are under-13 athletes in scope? |
| **O-962** | is a parent or guardian login ever wanted? |
| **O-963** | does any club intend to use Fydr output in selection, release, or scholarship decisions? |
| **O-964** | the child-facing notice copy in `screens/onboarding.md` step 5c needs a solicitor's read alongside the adult notice (O-319). |

### `docs/10-roadmap.md`

| ID | Question |
|---|---|
| **O-60** | Are you building this full time or alongside employment? |
| **O-61** | Do you have a pilot club identified? |
| **O-62** | Confirm the phase placement of injury and availability: availability in 1b, clinical record and rehab in Phase 2. |
| **O-63** | Confirm moving support access (`platform_support`) from Phase 3 to Phase 1b. |
| **O-64** | Bulk athlete import is unspecified and success criterion 1 depends on it. |
| **O-65** | **RESOLVED, 5 August 2026. |
| **O-66** | Does the pilot club's season start align with the plan? |
| **O-67** | What is the acceptable ceiling on support load before you cannot take another club? |
| **O-982** | The Children's Code workstream is estimated at 2 weeks inside Phase 1a. |

### `docs/decisions/adr-001-multi-tenancy.md`

| ID | Question |
|---|---|
| **O-21** | Has any prospective club actually asked for a dedicated database, or is this a precautionary preference? |
| **O-22** | Are cross-club benchmarks a product ambition? |
| **O-23** | What is the contractual RTO and RPO offered to clubs? |

### `docs/decisions/adr-003-supabase.md`

| ID | Question |
|---|---|
| **O-25** | Supabase's Article 28 processor terms and subprocessor list need reviewing against what will be promised to clubs about special category health data before the first paid contract is signed. |

### `docs/decisions/adr-004-offline-first.md`

| ID | Question |
|---|---|
| **O-26** | Should an athlete be able to see that an entry is pending at all? |
| **O-27** | The 14-day backdating limit. |

### `docs/decisions/adr-005-immutable-entries.md`

| ID | Question |
|---|---|
| **O-28** | Should a coach be able to see the full revision chain, or only the current value plus an "edited" marker? |

### `docs/decisions/adr-006-programme-override-model.md`

| ID | Question |
|---|---|
| **O-29** | What happens to an active override when the athlete is reassigned to a different programme? |

---

## Screen-level questions

These are numbered from O-200 and are grouped by screen. They are almost all
layout, copy, or behaviour decisions that will be easier to answer once you have
seen the screen built.

### `docs/screens/analytics.md`

| ID | Question |
|---|---|
| **O-200** | Restates `03-flows.md` O-8. |
| **O-201** | Should the within-athlete median correlation be shown always, or only when it differs materially from the pooled figure? |
| **O-202** | Is the ACWR honesty note acceptable to ship? |
| **O-203** | Should analytics be able to correlate against injury at all for coaches, given the re-identification risk in a 25-athlete squad? |
| **O-204** | Lag search is deliberately not offered, to avoid multiple-comparison mining. |
| **O-205** | Should p-values be shown at all to an audience without a statistics background? |
| **O-206** | What row budget should refuse a query outright? |
| **O-207** | Should saved views support parameters, so one view can be re-run for a different group without duplicating it? |
| **O-208** | Should Analytics and Reports merge, per `02-information-architecture.md` O-7? |
| **O-977** | Should a nutrition correlation ship as a preset? |
| **O-978** | The 20-pair minimum was set for daily and weekly metrics generally. |
| **O-979** | Should `nutrition.protein_target_met_weekly` be available in `reports.md` and in scheduled exports at all? |

### `docs/screens/athlete-profile.md`

| ID | Question |
|---|---|
| **O-209** | Eight tabs with horizontal scroll on mobile is my recommendation over a "More" overflow. |
| **O-210** | Is an Overview tab needed at all? |
| **O-211** | Should a coach be able to enter data on behalf of an athlete from this screen? |
| **O-212** | Recurrence detection. |
| **O-213** | Athlete photographs. |
| **O-214** | "Previous athlete" and "Next athlete" navigation on web, moving through the list the profile was opened from. |

### `docs/screens/dashboard.md`

| ID | Question |
|---|---|
| **O-215** | The attention ordering above the fold (exceptions, then squad shape, then next session) is the whole argument of this screen and it is my recommendation, not your decision yet. |
| **O-216** | Attention score weights. |
| **O-217** | Should the attention list show exactly three, or three plus any athlete above a hard severity floor? |
| **O-218** | Medical role additions. |
| **O-219** | "Acknowledge all flags for this athlete" from the dashboard. |
| **O-220** | Period options. |

### `docs/screens/exports.md`

| ID | Question |
|---|---|
| **O-221** | Export file retention defaults to 7 days, maximum 30. |
| **O-222** | Should coaches be able to export squad-wide raw data at all, or only through reports? |
| **O-223** | Should an athlete be notified when a staff member exports data that includes them? |
| **O-224** | Should there be a squad-wide export approval step, so a second staff member authorises a large personal-data export? |
| **O-225** | The API export in the Premium tier is a commitment on the tier table in `00-product-overview.md` and is not specified anywhere. |
| **O-226** | Should exports be schedulable, in the way reports are? |
| **O-227** | Confirms the handling of `09-security-and-compliance.md` §6: the athlete's portability export excludes derived values, staff notes and test results, and the UI tells them those exist and how to get them. |
| **O-228** | Should the SAR request queue live here, on `user-management.md`, or on its own screen? |

### `docs/screens/fixture-detail.md`

| ID | Question |
|---|---|
| **O-229** | Should squad selection be published explicitly, or visible to athletes as soon as it is saved? |
| **O-230** | `fixtures.competition` is free text. |
| **O-231** | `fixtures.result` is free text. |
| **O-232** | `fixture_selections` does not exist in the data model. |
| **O-233** | When a fixture is postponed, should Fydr offer to move the whole week's sessions with it? |
| **O-234** | Expected squad sizes per sport. |
| **O-235** | Do you need opposition detail beyond a name: contact, ground address, travel time, kit clash? |
| **O-236** | Should availability "as at kick off" be the default view rather than "as at today"? |

### `docs/screens/flags.md`

| ID | Question |
|---|---|
| **O-237** | Tab labelling. |
| **O-238** | `flag_domain` has six values (wellness, gym, gps, nutrition, compliance, testing) of which five can fire, and the drawing gives four tabs. |
| **O-239** | Recalibration trigger thresholds. |
| **O-240** | Should a recalibration suggestion ever be applied automatically, with a notification, if a coach ignores the prompt three times? |
| **O-241** | Watch window after an action. |
| **O-242** | Dismiss reason list. |
| **O-243** | Bulk acknowledge is permitted, bulk dismiss is not. |

### `docs/screens/groups.md`

| ID | Question |
|---|---|
| **O-244** | Should athletes see which groups they are in? |
| **O-245** | Should `groups.colour` carry a check constraint restricting it to the palette? |
| **O-246** | `group_memberships` has no `added_by` or `removed_by`, so the change log cannot say who made a change without reading `audit_log`. |
| **O-247** | Palette slots 6 to 12 need the same contrast and colour-vision verification as `06-design-system.md` §4.3 before build. |
| **O-248** | `group_memberships` currently has `on delete cascade` on both foreign keys, which would destroy membership history if a group or athlete were ever hard-deleted. |
| **O-249** | Can a coach edit rehab group membership, or is it medical only? |
| **O-250** | The partial unique index preventing two live memberships of the same group. |
| **O-251** | Backdating and correcting membership dates. |

### `docs/screens/gym-logging.md`

| ID | Question |
|---|---|
| **O-252** | RPE or RIR per set, and which is the default? |
| **O-253** | Should a set require RPE or RIR? |
| **O-254** | `exercises.one_rm_test_definition_id` is a required schema addition and it needs a policy: which exercises get a linked test, and what happens to the ones that do not. |
| **O-255** | Should gym session RPE and training session RPE be one value? |
| **O-256** | Load rounding increments. |
| **O-257** | Rest timer sound. |
| **O-258** | Can an athlete create an exercise? |
| **O-259** | Should the athlete see their estimated 1RM? |

### `docs/screens/gym-programmes.md`

| ID | Question |
|---|---|
| **O-260** | Should medical hold read access to gym programmes on this screen? |
| **O-261** | Should archiving a programme notify the assigned athletes? |
| **O-262** | Do templates need versioning, so that editing a template can offer to update programmes built from it? |
| **O-263** | The adherence match window is `± 2 days` between a prescribed session date and a logged session. |
| **O-264** | Should a programme whose end date has passed auto-archive? |
| **O-265** | Should there be a squad-wide "programme coverage" view showing every athlete and their current gym, nutrition and rehab programme in one grid? |

### `docs/screens/imports.md`

| ID | Question |
|---|---|
| **O-440** | The maximum file size is stated as 25 MB in `07-integrations.md` §3.2 and as 10 MB in `09-security-and-compliance.md` §9.2. |
| **O-441** | Source file retention is 90 days in `07-integrations.md` §3.2 and 30 days in `09-security-and-compliance.md` §9.2. |
| **O-442** | The group filter is inert on this screen, which is an exception to `CLAUDE.md` §3. |
| **O-443** | Should medical staff be able to commit an import? |
| **O-444** | Should an org admin be able to manage vendor profiles and aliases without being able to see athlete data? |
| **O-445** | The 24 hour revert window. |
| **O-446** | Auto-accept of high-confidence fuzzy matches, which is O-41 in `07-integrations.md` restated at the screen level. |
| **O-447** | "Create a session from this file" writes a `sessions` row with no `md_offset` intent, no plan and no RPE expectation, and it will appear on `schedule.md` and `timetable.md` alongside sessions the coach actually planned. |
| **O-448** | Period rows. |
| **O-449** | Multiple files in one drop. |
| **O-450** | Should vendor profiles be shareable across organisations as a Fydr-maintained standard library, so club number two with OpenField never sees the mapping UI at all? |
| **O-451** | How long do `import_batch_rows` live after commit? |
| **O-452** | A duplicate conflict, where the same fingerprint has different values and no ordering decides which is newer, currently blocks the commit. |

### `docs/screens/injury-dashboard.md`

| ID | Question |
|---|---|
| **O-266** | Board and timeline as two views is my recommendation. |
| **O-267** | Should the medical board show clinical columns at all? |
| **O-268** | `last_clinical_update_at` on `injuries`. |
| **O-269** | Does anyone actually plan around the return timeline? |
| **O-270** | Restriction vocabulary. |
| **O-271** | Should coaching staff see how long an athlete has been out (`days_out`)? |

### `docs/screens/injury-record.md`

| ID | Question |
|---|---|
| **O-272** | Two-zone layout with a visible boundary is my strong recommendation and I would argue against changing it even if your designs show fields interleaved by topic. |
| **O-273** | Clinical notes as an append-only chronology versus a single editable text field. |
| **O-274** | Does the athlete see `treatment_plan`? |
| **O-275** | Is an athlete's read of their own clinical detail audited? |
| **O-276** | Subject access requests and clinical notes. |
| **O-277** | Three smaller decisions I have made and would like confirmed together: (a) clinical note deletions are not recoverable, because versioning them would need a separate append-only table; (b) the clinical zone does not auto-collapse after a... |

### `docs/screens/leaderboards.md`

| ID | Question |
|---|---|
| **O-278** | Are leaderboards opt-out or opt-in? |
| **O-279** | Should the athlete-facing default be the full ranking or top 10 plus own position? |
| **O-280** | **Resolved 5 August 2026.** Under-18s are in scope, so they are excluded from every board by default and appear only where they granted `leaderboard_visibility` themselves. |
| **O-281** | **Closed by O-11, 5 August 2026.** Nutrition adherence was eligible here as an org-level opt-in. |
| **O-282** | Should positional context be available, so a prop is ranked against props rather than against wingers? |
| **O-283** | Movement is computed against a weekly snapshot. |
| **O-284** | Should a coach be able to create a private board visible to one athlete, as a personal target? |
| **O-285** | When an athlete opts out, should their prior appearances in snapshots be purged? |

### `docs/screens/md-planner.md`

| ID | Question |
|---|---|
| **O-286** | Should Fydr ship a seeded set of starter templates per sport, or should a club start from an empty screen? |
| **O-287** | `sessions.template_key` and `sessions.applied_template_id` do not exist. |
| **O-288** | `week_templates` has no unique constraint on `(org_id, name)`. |
| **O-289** | Monotony warning threshold. |
| **O-290** | Should the load chart show planned load only, or planned against the squad's recent actual? |
| **O-291** | Do templates need to carry participants at all? |
| **O-292** | Should applying a template be able to create the fixture too? |
| **O-293** | Nutrition targets by MD-n already exist in the schema (`nutrition_targets.md_offset`). |
| **O-294** | What should happen to `md_offset` when a template is applied to a week with no fixture? |

### `docs/screens/my-data.md`

| ID | Question |
|---|---|
| **O-295** | Should the athlete see their readiness baseline and their z-score against it? |
| **O-296** | How much history should an athlete be able to see? |
| **O-297** | Should acknowledged flags appear on the athlete's charts? |
| **O-298** | Does the athlete need a comparison against the squad anywhere other than leaderboards? |
| **O-299** | Should the Boards segment live here at all? |

### `docs/screens/my-programme.md`

| ID | Question |
|---|---|
| **O-300** | How much of the programme should the athlete see ahead? |
| **O-301** | Should the athlete see the block's intent? |
| **O-302** | `exercise_overrides.reason` is shown to the athlete verbatim. |
| **O-303** | Should the athlete be able to see their previous blocks' programmes? |
| **O-304** | Exercise video. |

### `docs/screens/nutrition-checkin.md`

| ID | Question |
|---|---|
| **O-970** | The question is fixed to protein. |
| **O-972** | Three answers or five? |
| **O-973** | Should the question text be organisation-configurable? |
| **O-974** | Should a long-term injured athlete be prompted? |
| **O-975** | What response rate is the floor below which the variable should be withdrawn? |
| **O-976** | Should the athlete see their own history of answers in My Data? |

### `docs/screens/nutrition-entry.md`

| ID | Question |
|---|---|
| **O-305** | Portion constants need a nutritionist's sign-off. |
| **O-306** | Which path is the organisation default? |
| **O-307** | Does nutrition compliance mean "any entry" or "entry within tolerance of target"? |
| **O-308** | Are meal photographs worth the risk? |
| **O-309** | Should fluid have its own reminder? |
| **O-310** | Should supplements be a controlled list? |

### `docs/screens/nutrition-plans.md`

| ID | Question |
|---|---|
| **O-311** | Target resolution precedence: I have specified that scope beats MD-specificity, so a personal any-day target beats a group MD-4 target. |
| **O-312** | Should medical be able to set nutrition targets for injured athletes? |
| **O-313** | Per-kilogram targets are athlete-scoped only, because a group target in g/kg cannot be stored as one number. |
| **O-314** | What tolerance band is right? |
| **O-315** | Should energy have an upper band that bands as unfavourable, for athletes where overconsumption is the concern? |
| **O-316** | Should Fydr warn on nutritionally questionable targets at all, for example protein below 1.2 g/kg? |
| **O-317** | Does the whole-squad grid need a "by meal" dimension, so a coach can see that the squad's post-training protein is the gap rather than the daily total? |

### `docs/screens/onboarding.md`

| ID | Question |
|---|---|
| **O-318** | **Resolved 5 August 2026.** Under-18s are in scope. |
| **O-319** | The notice text itself needs writing and reviewing. |
| **O-320** | Should there be a "decline" path at all? |
| **O-321** | Invite delivery and identity. |
| **O-322** | Should the guided first wellness entry be mandatory? |
| **O-323** | Multi-factor for athletes. Policy was already answered in `09-security-and-compliance.md` §8.1 ("optional, encouraged") before this question was resolved; what remained genuinely open was the build, and login-security checklist item 3 answered the staff half of it but deliberately not the athlete half — `MfaEnrollment.tsx` (the real TOTP enroll/verify/remove UI) is wired into staff Settings only. The sign-in challenge itself (`/login/mfa`) is role-agnostic and would work correctly for an athlete who somehow had a verified factor, because Supabase's `aal` claim doesn't carry a role — but nothing in this build gives an athlete a way to enrol one, so in practice no athlete can turn MFA on yet. Still open: build the equivalent optional enrollment surface somewhere in the athlete shell (`src/app/(athlete)/`), most likely `Me`. Also still open, and separate: `09-security-and-compliance.md`'s own new implementation-status note records that the RLS-level enforcement for the *staff* mandate (`auth_is_aal2()`, migration 0048) is deliberately not wired into any policy yet either — that follow-up is tracked there, not here, since it's a staff question, not an athlete one. |
| **O-324** | Should staff onboarding be web-only? |
| **O-325** | What happens to an athlete who acknowledges the notice and later objects to everything under Article 21? |
| **O-965** | How does a club record parental involvement, and what counts as recording it? |
| **O-966** | Does the child version of the notice need its own acknowledgement age split, so a 13 year old and a 17 year old see different words? |
| **O-967** | Should a minor's decline at step 5c notify a safeguarding contact rather than the club admin? |

### `docs/screens/programme-builder.md`

| ID | Question |
|---|---|
| **O-326** | Should group-level overrides exist? |
| **O-327** | Confirm O-29 from ADR-006: on reassignment, drop overrides with a prompt, or attempt to reapply comparable ones against the new programme's elements? |
| **O-328** | What is the correct staleness window for a 1RM before a `percent_1rm` prescription should stop resolving rather than resolving with a warning? |
| **O-329** | For a unilateral exercise prescribed at `percent_1rm`, should the load resolve from the weaker side, the stronger side, or per side? |
| **O-330** | Should the progression helper offer autoregulation rules, for example "add 2.5 kg when the athlete hits the top of the rep range twice"? |
| **O-331** | Should the builder support a set-level prescription, for example a ramping 70/80/85/85 across four sets, rather than one prescription across all sets? |
| **O-332** | Estimated session duration uses a fixed 8-minute warm-up allowance and derives work time from tempo. |
| **O-333** | Do two coaches editing one programme concurrently need realtime presence and locking, or is the stale-write warning enough? |
| **O-334** | Should a programme be publishable with unresolved `percent_1rm` prescriptions? |

### `docs/screens/rehab-groups.md`

| ID | Question |
|---|---|
| **O-335** | **CLOSED, 5 August 2026.** This screen no longer rests on a reading of "corner group allocation". |
| **O-336** | Is a rehab group a **standing** group that athletes move through, or a **per-programme cohort** created when a programme starts and archived when it ends? |
| **O-337** | Can one athlete be in two rehab groups? |
| **O-338** | Enforcement of the one-rehab-group rule is currently procedural, in the RPC. |
| **O-339** | Should the group phase be settable directly on the group, rather than derived from members? |
| **O-340** | Should coaching staff see rehab group membership at all? |

### `docs/screens/reports.md`

| ID | Question |
|---|---|
| **O-341** | Should PDF attachment delivery exist at all? |
| **O-342** | Athlete reports: should an athlete be able to generate their own, and should staff be able to send one to an athlete? |
| **O-343** | Report file retention defaults to 30 days. |
| **O-344** | Should reports be versioned, so that a definition change does not alter how a past run is interpreted? |
| **O-345** | Is "after every fixture" the right third cadence, or is "before every fixture", for example MD-2, more useful? |
| **O-346** | Should the squad weekly report include a free-text coach's note that carries into the PDF? |
| **O-347** | Should admins receive an aggregate compliance report automatically? |
| **O-348** | Confirms `02-information-architecture.md` O-7 from this side: Reports and Analytics stay separate in this specification. |

### `docs/screens/schedule.md`

| ID | Question |
|---|---|
| **O-349** | Medical write scope on the schedule. |
| **O-350** | Mobile week view shape. |
| **O-351** | MD-n horizon and the MD+n window. |
| **O-352** | Should creating a session while a group filter is active default the participants to that group? |
| **O-353** | Should `planned_load` be independently editable, or always derived from `planned_rpe * duration_min`? |
| **O-354** | Training-week fallback labels. |
| **O-355** | Does the schedule need a "publish" step? |
| **O-356** | Print output. |

### `docs/screens/session-detail.md`

| ID | Question |
|---|---|
| **O-357** | Default tab by time. |
| **O-358** | Restriction vocabulary. |
| **O-359** | Excluding one athlete from a group-assigned session. |
| **O-360** | Who is told when a coach overrides a restriction, and how loudly? |
| **O-361** | Should an override expire? |
| **O-362** | Contact flag on sessions. |
| **O-363** | Should attendance be capturable by an athlete, self-check-in? |
| **O-364** | Actual load for athletes who submit no RPE. |

### `docs/screens/settings.md`

| ID | Question |
|---|---|
| **O-365** | Should coach and medical see organisation settings read-only, as specified, or not at all? |
| **O-366** | Restates `08-notifications.md` O-53 from the settings side: medical cannot set thresholds, per the permission matrix, but a physio is the person most likely to want a soreness rule. |
| **O-367** | Should appearance settings sync across a user's devices? |
| **O-368** | Imperial units are not offered. |
| **O-369** | What exactly happens to a staff account that is also an athlete when the person leaves the club? |
| **O-370** | Should there be an organisation-level "support access" toggle, so a club can grant or revoke Fydr support's read access from Settings rather than by email? |
| **O-980** | Who at a club may turn `children.parental_involvement_required` off? |

### `docs/screens/squad-list.md`

| ID | Question |
|---|---|
| **O-371** | Column configuration. |
| **O-372** | What is the headline readiness indicator, exactly? |
| **O-373** | Should the squad list show an athlete's ACWR? |
| **O-374** | Default sort. |
| **O-375** | Can a coach add an athlete, or is that admin only? |
| **O-376** | Should "left the club" be a coach action? |
| **O-377** | Bulk reminders. |

### `docs/screens/squad-status.md`

| ID | Question |
|---|---|
| **O-378** | Day view as a grouped list and week view as a grid is my recommendation, not a transcription of your drawing. |
| **O-379** | Is wellness expected from an unavailable athlete? |
| **O-380** | **Closed by O-11, 5 August 2026, and it stays closed.** Nutrition compliance has no definition to argue about, because meals and macros are not logged. |
| **O-381** | Sort default. |
| **O-382** | Should this screen allow a coach to waive an expectation inline? |

### `docs/screens/team-allocation.md`

| ID | Question |
|---|---|
| **O-800** | Is the **week** the right unit? |
| **O-801** | **Are teams fixed per season or fluid?** `teams.season_id` is nullable, which currently supports both: a null season means the team persists across seasons, and a set season means it is re-created each year. |
| **O-802** | **Can an athlete be allocated to a team without being selected in a matchday squad?** I have assumed yes: allocation is squad membership for the week and selection is the team sheet, and a 30-man 1st XV squad producing a 23-man matchday ... |
| **O-803** | Who may publish? |
| **O-804** | On publication, does an athlete see **only their own allocation**, or the whole team list? |
| **O-805** | The short-turnaround window. |
| **O-806** | The positional requirement map. |
| **O-807** | `athletes.position` is free text (`04-data-model.md` §3), and positional balance is derived from it. |
| **O-808** | Teams are not groups, so they do not appear in the global group filter for free. |
| **O-809** | Should an available athlete who is deliberately not allocated get an explicit state, "not required this week", rather than sitting in the pool? |
| **O-810** | Should allocation drive session participation automatically, so that allocating an athlete to the 1st XV adds them to that team's training sessions (`session_participants.group_id` has no team equivalent)? |
| **O-811** | A club that fields sides on Saturday **and** Sunday, or runs a midweek cup tie, cannot express two allocations in one week under the current unique index. |
| **O-812** | Correcting a past allocation. |

### `docs/screens/testing.md`

| ID | Question |
|---|---|
| **O-383** | Staff writes are queued offline on this screen, which contradicts `06-design-system.md` §11.4. |
| **O-384** | `test_results` are edited in place rather than revised, which is an exception to `CLAUDE.md` rule 6. |
| **O-385** | How many attempts should each standard test default to? |
| **O-386** | Should a new PB notify the athlete immediately, or wait until the session is marked complete? |
| **O-387** | Should `test_definitions` carry a smallest worthwhile change value, and if so what values for the standard set? |
| **O-388** | Is a 10% asymmetry warning threshold right, and should it differ by test? |
| **O-389** | Should Fydr estimate 1RM from a submaximal set, for example Epley or Brzycki from a 5RM? |
| **O-390** | Should testing sessions support a station rotation, where athletes move between tests in groups rather than the squad completing one test at a time? |

### `docs/screens/thresholds.md`

| ID | Question |
|---|---|
| **O-391** | Are the eleven default thresholds and their parameters right? |
| **O-392** | Medical cannot configure thresholds, per the permission matrix, but receives flags from several. |
| **O-393** | Should a threshold be able to apply to a set of individual athletes rather than a group? |
| **O-394** | Should `cooldown_days` exist as specified, or should the `Monitoring` state in the flag lifecycle carry it entirely? |
| **O-395** | The "one flag per athlete per month" guidance is an assumption, not evidence. |
| **O-396** | Should the recalibration engine be able to apply a change automatically after repeated dismissals, with notification, rather than only suggesting? |
| **O-397** | Should thresholds support a composite rule, for example "readiness down **and** load up"? |
| **O-398** | Should an athlete be able to see the rules that apply to them? |

### `docs/screens/timetable.md`

| ID | Question |
|---|---|
| **O-399** | Attendance capture pattern. |
| **O-400** | Should attendance capture live here at all, or only on `session-detail.md` (screen 16)? |
| **O-401** | Offline attendance. |
| **O-402** | Should the screen warn when one athlete is assigned to two overlapping sessions? |
| **O-403** | The `sessions.tags text[]` column is new and required for restriction conflict detection. |

### `docs/screens/today.md`

| ID | Question |
|---|---|
| **O-404** | Should acknowledged flags appear on Today? |
| **O-405** | Should the all-done state show weekly compliance? |
| **O-406** | How far back should an athlete be able to submit? |
| **O-407** | Should Today show tomorrow? |
| **O-408** | Is "Something not right?" the right label for the report-a-problem action? |
| **O-409** | Does the athlete need a manual "mark as not training today" control on Today? |

### `docs/screens/training-entry.md`

| ID | Question |
|---|---|
| **O-410** | The CR10 anchor wording needs a sports science review. |
| **O-411** | Should half values be offered? |
| **O-412** | Is the 30-minute delay right for a gym session? |
| **O-413** | Should the athlete confirm the duration at all, or should the scheduled value be taken silently? |
| **O-414** | Does a rating need to be per session, or per day? |

### `docs/screens/training-report.md`

| ID | Question |
|---|---|
| **O-700** | Why are `TD` and `RUN` untinted while `HSR`, `HIE`, and `%MAX` are tinted? |
| **O-701** | `%MAX` uses a green ramp and `HIE` uses pink. |
| **O-702** | The group filter is not visible on this screen. |
| **O-703** | Is the shading computed against **this session's** athletes or against a **rolling squad reference**? |
| **O-704** | What is `RUN`? |
| **O-705** | What is `HIE` counting, and above what threshold? |
| **O-706** | `MAXV` displays in km/h and stores in m/s. |
| **O-707** | Where does the personal maximum behind `%MAX` come from? |
| **O-708** | What is the `AVG TD` delta compared against? |
| **O-709** | How many date chips, and how does a coach reach an older session? |
| **O-710** | Should each positional unit have a subtotal or mean row? |
| **O-711** | Are the positional unit headers interactive? |
| **O-712** | Confirm the default row order within a unit. |
| **O-713** | What does `FLAGGED` count? |
| **O-714** | Is there an export on this screen? |
| **O-715** | How are two training sessions on one day handled? |

### `docs/screens/user-management.md`

| ID | Question |
|---|---|
| **O-415** | `users.claims_version` is read by the auth hook in `05-architecture.md` §5 but does not exist in the `users` table in `04-data-model.md` §3. |
| **O-416** | Invitation state columns (`invited_at`, `invited_by`, `invite_sent_count`, `invite_expires_at`, `accepted_at`, `deactivated_at`, `deactivated_by`). |
| **O-417** | A `declined` value on the `user_status` enum. |
| **O-418** | Invite expiry. |
| **O-419** | Bounce handling. |
| **O-420** | One user, one organisation. |
| **O-421** | Seat limits. |
| **O-422** | Should coaches be able to invite athletes? |
| **O-423** | Two-factor authentication for admins. |

### `docs/screens/wellness-entry.md`

| ID | Question |
|---|---|
| **O-424** | Is `sleep_hours` required? |
| **O-425** | Accept one short scroll, or compress the slider row? |
| **O-426** | Does the soreness body map earn its place in v1? |
| **O-427** | Should `soreness_areas` become a Postgres enum array rather than `text[]`? |
| **O-428** | "Same as yesterday" prefill. |
| **O-429** | How long should a correction remain possible? |
| **O-430** | Should the athlete see their own readiness score anywhere? |
| **O-431** | Confirmation timing. |

---

## The ones I would answer first

If you only answer ten, answer these. They change the schema or a core mechanic, so
answering them late means rework rather than a decision.

| ID | Why it matters |
|---|---|
| **O-5** | "Corner group allocation" is ambiguous. My interpretation drives an entire screen. |
| **O-6** | Whether staff need a phone app at launch. Answering "web only" halves the v1 build. |
| **O-11** | Nutrition granularity. Per-meal macro entry every day is a big ask of an athlete, and it decides whether the nutrition feature gets used at all. |
| **O-12** | Menstrual cycle tracking. Well-evidenced performance and injury factor, and special category data with its own consent requirements. In or out. |
| **O-3** | Group-restricted staff. If an academy coach must never see the senior squad, that is access scoping rather than view filtering, and it is a schema change. |
| **O-8** | Minimum sample size before a correlation is displayed. Your sports science judgement, not mine. |
| **O-10** | Readiness score weighting. Flat sum or configurable weights. |
| **O-1** | Price points per tier. Drives the tier feature split. |
| **O-13** | Data retention after an athlete leaves a club. Affects the contract you sign with clubs. |
| **O-9** | Whether height belongs on the athlete record or in the body composition time series. Costs nothing to change now. |
