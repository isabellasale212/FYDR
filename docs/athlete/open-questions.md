# Open questions and decisions: the workbook

Generated 7 September 2026. **This is the part of the specification you fill in.**

Everything the specification could not establish is here, one numbered entry at a
time, with a box to write the answer in. Nothing in this file is a guess dressed
up as a fact: where something could not be traced it says where the search
looked, so you can tell the difference between "not built" and "not found".

**How to use it.**

- **Answer in the boxes.** Each one is a real Word table cell, so you can type or
  handwrite into it depending on how you are reading this.
- **Anything you answer here changes the specification**, not just this file.
  Hand it back and the screen specification, the metrics registry or the
  visibility document gets updated to match, in the same commit.
- **You do not have to answer all of them.** They are ordered so that the ones
  that affect a real person come first.

**Three labels, and they mean different things.**

| Label | Meaning |
|---|---|
| **DECISION** | Something with more than one defensible answer. It needs your call, not more research. |
| **UNVERIFIED** | Something factual I could not trace. It has a right answer and I did not find it. |
| **NOT BUILT** | Something specified that no code implements. It needs building, not deciding. |

---

# Part 1. The decisions

Fourteen. Two of the original entries turned out to be answerable and were
answered; they are recorded in `decisions-required.md` rather than repeated here.

### Q-01. Should an athlete be able to see their own availability and injury status in the app? DECISION, and the most important one here

**The question.** The database already permits it. An athlete can read their own injuries, their own availability and restrictions, and their own diagnosis, mechanism, severity, imaging, referral and treatment plan. Only the physio's private clinical notes are withheld. **No athlete screen reads any of it.**

**Why it matters.** A player who is made unavailable currently finds out from a person, or by noticing they have disappeared from the leaderboards without explanation. This is the single largest gap in the athlete app, and it is a screen rather than a permission: the access was deliberately built and nothing asks for it.

**Where I looked.** All fifteen athlete pages under `src/app/(athlete)/`, `injuries_self_select` and `availability_self_select` in `supabase/migrations/0012_rls_policies.sql:656` and `:725`, and `injury_clinical_athlete_view` in `0010_helper_functions_and_triggers.sql`.

**What would settle it.** Say which of these you want, and on which screen: availability status only; status plus restrictions; the full clinical detail the database already allows; or none of it, with a reason to record. If you want it, Today and My data are the two candidates.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** status plus restrictions on Today, as a card that only appears when relevant, since that is where a player would otherwise hear it from a person instead. Keep the full clinical detail (diagnosis, mechanism, imaging, referral, treatment plan) on My data rather than Today, one tap further away, so Today stays a quick daily screen and My data stays the place you go to look closely. The database already allows all of it; this only decides what a screen shows and where. 

**Confirmed by Isabella, 8 September 2026.

---

### Q-02. Should an athlete be able to delete their own account? DECISION and NOT BUILT

**The question.** There is no way for an athlete to delete their own account in either surface. Erasure exists only as an audited staff process.

**Why it matters.** Apple guideline 5.1.1(v) requires in app account deletion for any app with account creation, so this is a hard blocker for a native app. It is also a reasonable expectation for a web one. **The hard part is not the button.** An athlete's injury record is club held data the club may lawfully keep under article 17(3), so 'delete my account' cannot mean 'delete my data', and the screen has to say so honestly without sounding like a refusal.

**Where I looked.** `src/lib/retention/`, `docs/09-security-and-compliance.md` section 5 and its article 17 table, and every screen under `src/app/(athlete)/`.

**What would settle it.** Confirm the specification should require it. Then decide the sentence: what an athlete is told about the records that survive. That sentence is the actual work and it is yours, not mine.

**Decided by Isabella, 8 September 2026: no.** Players cannot delete their own account, and cannot create one either: accounts are staff-created via invite, which the specification already documents. A player can change their own password and use the email-linked reset flow, and nothing else affecting the account itself. Erasure stays an audited staff process only, which already satisfies the UK GDPR article 17 right to erasure without needing a self-service button.

**Correction, 8 September 2026: the Apple risk is dormant, not active.** An earlier version of this answer accepted an App Store rejection risk on guideline 5.1.1(v), because native iOS had been committed to. That commitment was reversed the same day — see Q-24 — so no app is being submitted and there is no active rejection risk. The reasoning stays on record for whenever native work actually starts, since the same conflict will exist then.

---

### Q-03. Should the Apple Health toggle stay on screen while there is nothing behind it? DECISION

**The question.** An athlete on a Premium club can turn on Apple Health. It writes a consent row and nothing reads it. There is no HealthKit integration: no native code anywhere, and no table holds device sourced sleep, resting heart rate or HRV.

**Why it matters.** The athlete grants a permission for a feature that does not exist. It is also a rejection risk for a native app: requesting a HealthKit permission for data the app never reads falls under guideline 5.1.1.

**Where I looked.** `src/components/HealthkitConsentToggle/HealthkitConsentToggle.tsx`, `src/app/(athlete)/me/page.tsx:240`, `src/lib/queries/healthkit.ts`, and every table in the schema.

**What would settle it.** Choose: hide it until ingestion exists; keep it and label it plainly as not yet active; or leave it as is. Leaving it as is is the current behaviour and the one that misleads.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** hide it until ingestion exists. There is no native app to read HealthKit from at all today, so the toggle cannot mislead an athlete more cheaply than by removing it. Bring it back the day a native build actually reads something. 

**Confirmed by Isabella, 8 September 2026, no preference, going with the recommendation.

---

### Q-04. Should nutrition guidance stay behind a tab called Gym? DECISION

**The question.** `/programme/nutrition` is reached from `/programme`, and the tab bar labels that tab **Gym**. A player looking for what to eat has to know it lives behind Gym.

**Why it matters.** It is a findability problem rather than a bug. Nutrition guidance is one of the few things the app offers a player who is not currently training.

**Where I looked.** `src/components/AthleteTabBar/AthleteTabBar.tsx`, `src/app/(athlete)/programme/`.

**What would settle it.** Choose: rename the tab to cover both, for example Programme; move nutrition guidance under Me; add a fifth tab; or leave it and rely on the link from Today.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** rename the tab from Gym to Programme. It already contains both the gym programme and the nutrition guidance link, so the name should describe what is actually behind it rather than the larger of the two things. 

**Confirmed by Isabella, 8 September 2026. Tab renamed Gym to Programme.

---

### Q-05. Should an athlete be able to correct their own entry? DECISION

**The question.** They cannot. Wellness, training, nutrition and gym entries are immutable once submitted. A correction creates a new revision row, and migration 0058 made `revise_wellness_entry` and `revise_training_entry` coach and medical only **at a club's request**.

**Why it matters.** An athlete who fat fingers a 2 instead of a 4 has to ask a coach to fix it. The immutability rule itself is sound and is `CLAUDE.md` rule 6: performance data that can be silently edited is worthless for trend analysis. The question is only whether the athlete should be able to file the correction themselves, which the revision mechanism already supports.

**Where I looked.** Migration 0058, `src/lib/validation/entryCorrection.ts`, `src/app/(athlete)/check-in/page.tsx`, `src/app/(athlete)/rpe/[sessionId]/page.tsx`.

**What would settle it.** Confirm whether the current state is the intended end state, or whether an athlete should be able to submit a correction for staff approval. Note that the club asked for the current restriction, so changing it is a conversation with them.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** leave it as built. The club asked for this restriction, it matches CLAUDE.md rule 6, and immutable entries with a staff-only revision path are the correct shape for data that feeds trend analysis. Revisit only if a specific club asks to change it, and treat that as a conversation with them, not a specification change made alone. 

**Confirmed by Isabella, 8 September 2026.

---

### Q-06. Should the nine athlete routes that lose their destination be fixed? DECISION

**The question.** `/today` and `/check-in` send a signed out visitor to `/login?next=...`. The other nine athlete routes send them to a bare `/login`, so they land on the default screen rather than where they were going. Tested, not inferred.

**Why it matters.** Every push notification and every shared link to a screen other than Today lands in the wrong place if the app has signed the player out.

**Where I looked.** `src/lib/supabase/middleware.ts:19`, and a Run level test of all eleven routes signed out.

**What would settle it.** Choose: add the nine prefixes; leave it; or replace the prefix list with the route group so a new athlete screen is covered without anyone remembering. The third does not decay and is the largest change.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** replace the prefix list with the route group, as the document itself steers toward. It is the only option that stays correct automatically the next time an athlete screen is added, rather than depending on somebody remembering to update a list. 

**Confirmed by Isabella, 8 September 2026.

---

### Q-07. Are the four offline domains the intended set? DECISION

**The question.** Wellness, training, nutrition check in and gym set logs are queued on the phone and retried. **Report a problem is not**, and neither are consent changes, leaderboard opt out or notification preferences.

**Why it matters.** Report a problem is the one an athlete is most likely to submit pitch side with no signal, which is exactly the case the outbox was built for.

**Where I looked.** `src/lib/outbox.ts` and its header, and every athlete form.

**What would settle it.** Confirm the four are intended, or say which others should be queued. Report a problem is the one I would add.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** add Report a problem as a fifth queued domain. It is the one form an athlete is most likely to submit with no signal, pitch side, which is exactly the situation the outbox exists for. 

**Confirmed by Isabella, 8 September 2026. Report a problem added as a fifth queued outbox domain.

---

# Part 2. Exact wording an athlete reads

**These are the highest value unknowns in the whole specification**, and they are
the cheapest for you to answer: you can read them off a phone in two minutes.

The brief is right that wording changes what the data means. A scale labelled
"Soreness: 1 very sore, 5 no soreness" and one labelled "Soreness: 1 none, 5
severe" produce opposite datasets under the same column name. The wellness scales
are specified exactly, because they are in the code as data. The others are laid
out in markup and were not found.

### Q-08. The RPE question and its scale labels. UNVERIFIED

**The question.** What exactly does the session rating screen ask, and what are the labels at each end of the scale? The screen is titled 'How hard was it?'. The stored value is 1 to 10.

**Why it matters.** RPE is one of only four things an athlete ever types, and it drives session load, which drives acute and chronic load, which drives the acute to chronic ratio. If the scale reads 1 hardest to 10 easiest on screen while the database assumes the reverse, every load figure in the product is inverted and nothing would catch it.

**Where I looked.** `src/app/(athlete)/rpe/[sessionId]/page.tsx`, `src/lib/validation/training.ts`, and `docs/screens/` for a training entry screen document.

**What would settle it.** Open `/rpe/<any session>` on a phone and write down the question and both end labels exactly as they appear, including capitalisation.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/rpe/[sessionId]/page.tsx, src/components/RpeForm/RpeForm.tsx, src/components/CR10List/CR10List.tsx and src/lib/validation/training.ts.

There is no separate question sentence. The screen title IS the question: “How hard was it?” — an <h1> at page.tsx:43, and the same string in the page <title>.

Instruction under it, RpeForm.tsx:133: “Rate the whole session, not the hardest bit.”

Accessible name for the scale, CR10List.tsx:25, class visually-hidden so it reaches screen readers only: “Session rating, 1 to 10”.

END LABELS. Not literal JSX — they are values in the CR10_ANCHORS constant in src/lib/validation/training.ts, rendered by CR10List.tsx:41. Resolved: 1 = “Very easy”, 10 = “Maximal”.

The full anchor set, since only some steps carry one: 1 “Very easy”, 2 “Easy”, 3 “Moderate”, 4 none, 5 “Somewhat hard”, 6 none, 7 “Hard”, 8 “Very hard”, 9 “Extremely hard”, 10 “Maximal”. Steps 4 and 6 render a middle dot instead, marked aria-hidden.

Also on the screen, since the specification asks for exact wording an athlete reads: the duration question “How long were you training?” (RpeForm.tsx:140), the unit “MINUTES”, the helper “Scheduled for {n} min” or, with no scheduled length, “No scheduled length. Set how long you trained.”, and the optional note label “Add a note”.

Note the scale ordering carries a written caution in the source: training.ts records that the anchor wording “wants a sports science review before this ships past a thin slice” (O-410). That review has not happened and is not tracked anywhere in this workbook.

---

### Q-09. The weekly nutrition question and its three answers. UNVERIFIED

**The question.** What is the one question, and what are the three answers? This screen's entire content is one question, and the wording was not found.

**Why it matters.** It is the whole of the product's nutrition commitment from an athlete. `CLAUDE.md` rule 8 is explicit that there is no daily logging and no per meal entry: one question, once a week, three answers. Every nutrition insight a nutritionist gets from athletes comes through this one sentence.

**Where I looked.** `src/app/(athlete)/nutrition-check-in/page.tsx`, `src/lib/validation/nutrition.ts`, `docs/screens/nutrition-checkin.md`.

**What would settle it.** Open `/nutrition-check-in` and write down the question and all three answer labels exactly.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/nutrition-check-in/page.tsx, src/components/NutritionCheckinForm/NutritionCheckinForm.tsx and src/lib/validation/nutrition.ts.

Screen title, page.tsx:49: “Weekly check-in”.

The question, NutritionCheckinForm.tsx:144: “Did you hit your protein target most days this week?”

THE THREE ANSWERS. Not literal JSX — they are the label values of the ANSWERS constant at NutritionCheckinForm.tsx:13-17, mapped to buttons at line 148. Resolved, in the order they appear: “Yes”, “Roughly”, “No”. The stored values are yes / roughly / no, matching z.enum in validation/nutrition.ts.

Optional note label: “Add a note”, capped at 280 characters.

ONE INCONSISTENCY WORTH RECORDING. The to-do item that links here from Today reads “Did you hit your protein target most days?” — without “this week” (today/page.tsx). The question on the screen itself has it. Same question, two wordings, and the shorter one is the one an athlete reads first. Not a defect, but if the wording is being fixed anywhere it should be fixed in both.

---

### Q-10. Does the morning check in offer a comment field? UNVERIFIED

**The question.** `wellness_entries.comment` exists and is capped at 1,000 characters by a database constraint. Whether the athlete check in screen actually offers it was not established.

**Why it matters.** If it exists, it is free text an athlete writes about how they feel, which staff read. That has a visibility answer and a wording answer, and neither is currently in the specification.

**Where I looked.** `src/components/CheckInForm/CheckInForm.tsx`, `src/lib/validation/wellness.ts`.

**What would settle it.** Open `/check-in` and say whether there is a text box, and if so what it is labelled and what the placeholder says.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/components/CheckInForm/CheckInForm.tsx and src/lib/validation/wellness.ts.

YES. The screen renders it. CheckInForm.tsx:254-262, a <textarea> inside a <label class="ci-comment">.

Label: “Comment or injury issue (optional)”

Placeholder: “Anything you want your coach or medical staff to know.”

CORRECTION TO THIS WORKBOOK'S PREMISE. The question says the field is “capped at 1,000 characters”. That is the DATABASE cap and it is real — wellness_entries carries CHECK ((comment IS NULL) OR (char_length(comment) <= 1000)). But the application caps it at 500, in two independent places: z.string().trim().max(500) in validation/wellness.ts:34, and maxLength={500} on the textarea itself. So the effective limit an athlete meets is 500, not 1,000, and the screen specification's “up to 1,000 characters” row (docs/athlete/screens/02-morning-check-in.md:42) overstates it by double.

The same 500-against-1000 gap exists on the session rating note: training_entries has the identical 1,000 CHECK, and validation/training.ts caps at 500. Both are documented as 1,000 in this workbook. Neither is a data-loss risk — the tighter limit is the one enforced first — but the number in the specification is not the number an athlete meets.

---

### Q-11. The exact wording shown to a 16 year old on the leaderboard settings. UNVERIFIED

**The question.** An under 18 athlete is off leaderboards by default and must opt in. The screen behaves differently for them. What it says to them was not found.

**Why it matters.** This is the wording that matters most on that screen. It is a consent request to a child under the Children's Code, and the standard expects it to be understandable to them rather than to a lawyer.

**Where I looked.** `src/app/(athlete)/me/leaderboards/page.tsx`, `docs/screens/leaderboards.md`.

**What would settle it.** Sign in as a minor account, or read the branch in the file, and write down what the under 18 state says.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/me/leaderboards/page.tsx and src/components/LeaderboardConsentToggle/LeaderboardConsentToggle.tsx.

The under-18 branch is chosen by isMinor at page.tsx:23, computed as age === null || age < 18 — an unknown date of birth counts as a minor, matching athlete_is_minor() in the database.

Card heading, page.tsx:38: “Being named on a leaderboard”.

Body, page.tsx:42, quoted as rendered (the source writes ’ and — as HTML entities): “Because you’re under 18, you are never named on a leaderboard unless you choose to be — that choice is yours alone, and nobody at your club can turn it on for you. Turning it off again is just as easy, any time.”

THE NOT-YET-OPTED-IN CONTROL, which is the state the question asks about. LeaderboardConsentToggle.tsx:47, a button with aria-pressed=false: “Off — tap to appear on leaderboards”. Once opted in it reads “On — tap to turn off”, and while the write is in flight “Working…”.

For contrast, the 18-and-over branch shows the same heading with different body text: “You appear on any leaderboard your club publishes and includes you in, unless you leave it. Leave one from the board itself, or leave every board at once below.” So the minor sees opt-in language and the adult sees opt-out language, which is the intended split.

---

### Q-12. The problem report field wording, and what happens on invalid input. UNVERIFIED

**The question.** What does the report a problem form ask, and what does it do if the athlete submits something it will not accept?

**Why it matters.** This is the screen a player uses to say they are hurt. It writes into a medic's triage queue. The wording sets whether a player reports a niggle early or waits until it is an injury.

**Where I looked.** `src/app/(athlete)/report-problem/page.tsx`, `src/lib/validation/problemReport.ts`.

**What would settle it.** Open `/report-problem` and write down every label, the placeholder, and what an empty submission does.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/report-problem/page.tsx, src/components/ProblemReportForm/ProblemReportForm.tsx and src/lib/validation/problemReport.ts.

Screen title: “Report a problem”. Standing notice above the form: “Goes to your club’s medical staff. Not a substitute for emergency care — if this is urgent, contact emergency services or your GP.”

Category label, ProblemReportForm.tsx:69: “What kind of thing is this? (optional)”

Category chips. Not literal JSX — label values of the CATEGORIES constant at ProblemReportForm.tsx:10-14. Resolved: “Injury or pain”, “Wellbeing”, “Something else”. Tapping a selected chip clears it; no category is a real answer, not defaulted to other.

Free text label, line 84: “What’s going on?”  Placeholder, line 94: “Tell us what you're noticing and when it started.”  A live counter under it reads “{n}/1000”.

INVALID OR EMPTY SUBMISSION. Empty cannot be submitted at all: the button carries disabled={mutation.isPending || body.trim().length === 0}, so it is inert until something is typed. If a submission still fails the schema, onSubmit shows the first Zod message inline in a <p class="form-error" role="alert">. The messages are: for an empty body, “Tell us what’s going on.”; for over-length, “Keep it under 1,000 characters — medical will follow up.”; and a fallback if neither matched, “Something on this didn’t check out. Try again.” Nothing is submitted and nothing is lost from the box.

ONE INCONSISTENCY WORTH RECORDING. The third category is labelled “Something else” when entering a report, but the list of already-submitted reports on the same screen renders it from PROBLEM_REPORT_CATEGORY_LABEL (src/lib/queries/problemReports.ts:23), where the same value is labelled “Other”. An athlete files a report under “Something else” and then sees it listed as “Other”. Two labels, one value, one screen.

---

### Q-13. The gym set logging field labels and invalid input behaviour. UNVERIFIED

**The question.** What are the fields called when an athlete logs a set, and what happens if they type something the app will not take?

**Why it matters.** Gym logging is the highest frequency entry in the app. A confusing label costs a set every session.

**Where I looked.** `src/app/(athlete)/gym/[sessionId]/page.tsx`, `src/lib/validation/gym.ts`.

**What would settle it.** Open a gym session and write down the field labels and what an invalid entry does.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/gym/[sessionId]/page.tsx, src/components/GymSessionLogger/GymSessionLogger.tsx and src/lib/validation/gym.ts.

THE QUESTION'S PREMISE NEEDS CORRECTING FIRST. In the normal logging flow there are no weight and reps fields at all. The screen shows one tappable key per set (GymSessionLogger.tsx:452), and a tap logs the PRESCRIBED reps and the resolved weight rather than asking the athlete to type what they did. The component's own header gives the reason: the prescription is right on the overwhelming majority of sets, and the athlete is standing under a bar with cold hands.

So the only wording in the primary path is the keys' accessible names, both built from template literals. Unlogged: “Log set {n} of {total}, {exercise name}”. Logged: “Set {n} logged, {reps} reps at {load} kg. Correct it.” — with “no” substituted for a null reps value and “no load” for a null load.

THE LABELS THE QUESTION ASKS FOR EXIST ONLY IN THE CORRECTION PANEL, which opens when an already-logged key is tapped. Heading: “Correcting set {n}”. Field labels, GymSessionLogger.tsx:507 and 525: “Reps” and “Load (kg)”. Not “Weight”.

Also present, at the end of the session: “Session RPE (optional)”, a number input bounded 1 to 10.

INVALID INPUT. Both inputs are type="number" (reps inputMode numeric, load inputMode decimal with step 0.5), so the keypad itself refuses most bad input. Beyond that, every write is built through buildSetInput, which safeParses against GymSetLogInput and returns null on failure rather than sending anything. The visible result on the primary path is one inline message: “Something on this set did not check out. Try again.” The schema bounds are reps_completed 0–100 and load_kg 0–500, both nullable, so a blank field is a legitimate value and not an error.

---

### Q-14. The password change field wording on Me. UNVERIFIED

**The question.** The exact labels for current password, new password and confirmation, and the minimum length message.

**Why it matters.** Low risk, listed for completeness because section 4 of the Me screen specification is otherwise incomplete.

**Where I looked.** `src/app/(athlete)/me/page.tsx`, `src/components/ChangePasswordForm/ChangePasswordForm.tsx`.

**What would settle it.** Read them off the screen.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/me/page.tsx (which renders <ChangePasswordForm /> at line 175) and src/components/ChangePasswordForm/ChangePasswordForm.tsx.

Labels, in order: “Current password”, “New password”, “Confirm new password”.

Helper under the new password field: “At least 12 characters.” Built from the MIN_LENGTH constant (ChangePasswordForm.tsx:11), not a literal; resolved value 12, which is what docs/09-security-and-compliance.md §8 specifies.

MINIMUM-LENGTH MESSAGE, shown inline in a <p class="form-error" role="alert">: “Use at least 12 characters.” Also from MIN_LENGTH, so the two numbers cannot drift apart.

The other two messages on the same form, since they are the rest of what an athlete can hit: “Choose a different password.” when the new password equals the current one, and “The new password and its confirmation do not match.”

The three inputs carry autoComplete="current-password", “new-password” and “new-password”, so a password manager fills and offers to save correctly. No placeholder text on any of them.

---

---

# Part 3. Product wide unknowns

### Q-15. Do the two nudges named in the compliance document exist at all? UNVERIFIED and probably NOT BUILT

**The question.** `docs/09-security-and-compliance.md:507` names `athlete.wellness.nudge` and `athlete.rpe.nudge`, and constrains them carefully: one per entry, one per day, three per rolling week, stopping after three consecutive missed days, no guilt or streak language, and tighter limits for minors. **Neither appears in the notification catalogue.**

**Why it matters.** Either the catalogue is incomplete, or the compliance document specifies two notifications nobody built and the careful constraints protect nothing. The minors' limits in particular cannot apply to notifications that do not exist.

**Where I looked.** `src/lib/notifications/catalogue.ts`, which carries `athlete.flag.shared`, `athlete.compliance.weekly` and `athlete.leaderboard.weekly` and nothing else. Searched the whole of `src/` for both identifiers.

**What would settle it.** Say whether these were ever built, or whether the compliance document is describing an intention. If it is an intention, the document should say so.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

Answered within this document already, Claude, 8 September 2026: they were never built. DECISION 12 and Gap G-A5 both confirm the catalogue holds only athlete.flag.shared, athlete.compliance.weekly and athlete.leaderboard.weekly, and neither wellness.nudge nor rpe.nudge exists anywhere in src/. The compliance document is describing an intention that was never implemented. Recommend the compliance document say so explicitly, or the two nudges get built, rather than leaving a careful policy protecting nothing. 

**Decided by Isabella, 8 September 2026:** build them. athlete.wellness.nudge and athlete.rpe.nudge get added to the notification catalogue and actually sent, as push, per the limits already specified in docs/09-security-and-compliance.md:507: one per entry, one per day, three per rolling week, stopping after three consecutive missed days, no guilt or streak language, tighter limits for under 18s. This is what moved Q-30's push decision up; see there for the sequencing change.

---

### Q-16. What happens to an athlete's account when they leave the club? UNVERIFIED

**The question.** `athletes.left_at` exists and athlete data is never hard deleted. What happens to the person's login, what they see if they open the app, and whether they keep access to their own history was not found.

**Why it matters.** Every club will ask this, and so will every player. A player who moves clubs and opens the app to a broken screen is a support problem and a trust problem. There is also a live decision inside it: a transfer creates a fresh record with no link to the old one, decided already, so the old account still exists somewhere.

**Where I looked.** `src/lib/retention/`, `docs/09-security-and-compliance.md` section 5, `docs/12-product-tiers.md`, and the athletes table.

**What would settle it.** Describe what should happen: does the login still work, what do they see, and can they still export their own history.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** the login is disabled at the point left_at is set, rather than staying live indefinitely. Before that point, while still marked as leaving, the athlete keeps access to export their own history through the existing /me/export route, so nobody loses their own record on the way out. This needs a real decision from you, since it also has a legal answer: check it against the retention table in docs/09-security-and-compliance.md section 5 before treating it as settled. 

**Confirmed by Isabella, 8 September 2026:** login disabled at left_at, export access kept until then.

---

### Q-17. What happens to club data if the club stops paying? UNVERIFIED

**The question.** Nothing was found specifying this. There is no billing surface in the product by design, so it is an operational process rather than a feature, but the data question is still a specification question.

**Why it matters.** It is the question that decides whether a club trusts you with a season of injury records. It also has a legal edge: the club is the controller and Fydr is the processor, and a processor holding data after the contract ends needs a written basis.

**Where I looked.** `docs/12-product-tiers.md`, `docs/09-security-and-compliance.md`, `src/lib/tier.ts`, `src/lib/retention/`.

**What would settle it.** Describe the intended behaviour: a read only period, an export window, a deletion timetable, or something else.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** a defined read only period after a club stops paying, for example 60 to 90 days, during which the club can export everything and settle up, followed by archival rather than deletion given the article 17(3) retention duties already documented for injury records. This is a commercial and legal decision as much as a product one; treat it as part of the Data Processing Agreement work already on your list, not a standalone specification question. 

**Confirmed by Isabella, 8 September 2026:** 60 to 90 days read only with export access, then archive. Final wording still needs to be checked against the Data Processing Agreement once drafted.

---

### Q-18. Is the athlete told when staff have read or acted on what they submitted? UNVERIFIED

**The question.** `athlete.flag.shared` exists in the catalogue and fires when staff acknowledge a flag raised about the athlete. It is push only and off by default. Whether anything else closes the loop was not found.

**Why it matters.** An athlete who reports a problem and hears nothing concludes the app does not work. The submission is immutable and they cannot chase it.

**Where I looked.** `src/lib/notifications/catalogue.ts`, `src/app/(athlete)/report-problem/page.tsx`, `src/lib/queries/problemReports.ts`.

**What would settle it.** Say what an athlete should be told, and when, after they report a problem.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** once push notifications actually exist (see Q-30), tell them their report was seen, not what was decided about it, the moment a medic acknowledges it. Until push exists this cannot be built at all, so the honest interim answer is that nothing tells them, and that gap should be stated rather than left silent. 

**Confirmed by Isabella, 8 September 2026. Since push infrastructure has since moved up to now rather than later (see Q-15 and Q-30), this notification can be built alongside the wellness and RPE nudges rather than waiting on a separate future push effort.

---

### Q-19. Can a problem report be retracted? UNVERIFIED

**The question.** An athlete files a report and it appears below the form. Whether they can withdraw it, and for how long, was not established.

**Why it matters.** A player who reports something in the heat of a session and wants to take it back has no obvious route. Equally, a medic's triage queue that loses entries is worse. There is a real tension here and it needs a decision rather than a default.

**Where I looked.** `src/app/(athlete)/report-problem/page.tsx`, `src/lib/queries/problemReports.ts`, migration 0040.

**What would settle it.** Say whether retraction should exist and, if so, for how long and what the medic sees.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** allow retraction within a short window, for example one hour, before it is likely to have been triaged. After that window, or once a medic has opened it, it should stand, with the medic seeing that it was later marked resolved by the athlete rather than seeing it vanish from the queue. 

**Confirmed by Isabella, 8 September 2026:** one hour window.

---

### Q-20. Does MET-036's visibility rule still hold? UNVERIFIED

**The question.** The staff nutrition screen states that the athlete never sees their body mass target range in their own app, and that it is never ranked. But `/programme/nutrition` reads `body_mass_kg`, and the nutrition guidance screen shows targets.

**Why it matters.** This is the one place a written visibility promise and a screen's imports appear to disagree. Either the promise is stale or the screen shows something it should not.

**Where I looked.** `src/app/(athlete)/programme/nutrition/page.tsx`, `docs/metrics.md` MET-036, and the staff nutrition screen's own copy.

**What would settle it.** Open `/programme/nutrition` and say whether a target RANGE is visible, as opposed to the daily targets.

**ANSWERED by Claude Code, 8 September 2026** against the live repository. The recommendation that preceded it, and Isabella's decision where there was one, are in `archive/2026-09-08-athlete-spec-review-record.docx`.

Answered by Claude Code, 8 September 2026, from src/app/(athlete)/programme/nutrition/page.tsx and a whole-repository search for the range table.

NO LEAK. MET-036's rule holds. The screen does not render the body mass target range anywhere.

What it does render, page.tsx:66-79, is the athlete's own last recorded weight, used to scale portion sizes: “Portions below are scaled to your last recorded weight, {n} kg, on a {day type}.” And when there is no weigh-in on file: “We don’t have a recent weigh-in on file for you, so portions are shown at a standard reference weight ({REFERENCE_MASS_KG} kg) until your club’s staff log one.” REFERENCE_MASS_KG is a constant, resolved value 110. Both lines close with “Reference only — nothing here is logged or tracked.”

That is the athlete's own weight, which they entered themselves at the morning check-in, and a fixed constant. Neither is the staff-authored target range.

HOW THIS WAS ESTABLISHED, since a negative needs its method stated. The range lives in body_mass_target_ranges (migration 0060), read only through src/lib/queries/bodyMassTargetRange.ts. Every importer of that module is a staff surface: (staff)/nutrition, (staff)/squad/[athleteId], (staff)/squad/[athleteId]/nutrition, BodyWeightPanel, nutritionWorkspace and playerProfile. No route under src/app/(athlete) references the table or the module, directly or by import.

One transitive path was checked rather than assumed: the athlete page imports DAY_TYPES from src/lib/nutritionRules.ts, and that file does appear in a text search for the table name. It mentions bodyMassTargetRange only in a comment (line 149) and does not import it, and DAY_TYPES is a plain constant array of three day types. So there is no route from this screen to the range.

---

### Q-21. Is an athlete in no positional group told why their comparisons are empty? UNVERIFIED

**The question.** The staff surface says this explicitly: the athlete is not a member of any positional group, so there is no set of players to compare against, and groups are managed in Settings. The athlete side was not found to say anything.

**Why it matters.** An empty chart with no explanation reads as a broken app rather than a missing group.

**Where I looked.** `src/app/(athlete)/my-data/page.tsx`, and the staff equivalents which do carry the copy.

**What would settle it.** Say whether the athlete should be told, and in what words.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** yes, tell them, using the same wording the staff surface already carries, adapted to speak to the athlete directly, for example "You are not in a group yet, so there is nothing to compare you against. Ask your coach to add you to one." Reuse the staff copy's reasoning rather than writing a new explanation from nothing. 

**Confirmed by Isabella, 8 September 2026.

---

### Q-22. Can an athlete account ever require two factor? UNVERIFIED

**The question.** The club policy recorded on the staff Settings screen is that coach, medical and admin accounts carry a second factor. No athlete requirement was found, but `/login/mfa` is shared with the staff app and an athlete could in principle reach it.

**Why it matters.** It changes whether the two factor screen is part of the athlete specification at all, and whether an academy player needs an authenticator app.

**Where I looked.** `src/lib/mfa.ts`, `src/app/login/mfa/page.tsx`, the staff Settings two factor card.

**What would settle it.** Confirm whether athletes are ever required, or ever permitted, to enrol a second factor.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** no, not required. The club policy that requires it for coach, medical and admin accounts exists because those roles can write and change clinical and administrative data; an athlete account cannot. The added friction is not worth it for the risk it would reduce. Leave /login/mfa reachable only because it is shared infrastructure with staff, not because an athlete is expected to use it. 

**Confirmed by Isabella, 8 September 2026.

---

### Q-23. What does an athlete with no working email address do? UNVERIFIED and a real academy risk

**The question.** Password reset is PKCE and only works in the browser that asked for the email. With no email provider configured, the link is not delivered at all. Invite links are different and do forward, because they are verified server side.

**Why it matters.** Academy players may share a parent's email, have no email, or have one they cannot access from the phone they use. If they lose their password there may be no route back into the app at all.

**Where I looked.** `src/app/login/reset/`, `src/components/ResetConfirmForm/ResetConfirmForm.tsx`, `src/lib/email/provider.ts`.

**What would settle it.** Say what the recovery route should be for a player with no usable email. A staff initiated re-invite is the obvious candidate and it is not documented as one.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** a staff initiated re-invite, reusing the same invite link mechanism already built for onboarding, rather than a new recovery path. This matters far less once Q-30's email provider decision is settled, since most of this problem is currently caused by no email being delivered at all, to anyone, not specifically to academy players. 

**Confirmed by Isabella, 8 September 2026.

---

---

# Part 4. Things needing an account or a device I do not have

These cannot be answered by reading the code.

### Q-24. The HealthKit usage description strings. NOT BUILT, and my drafts are guesses

**The question.** If a native shell is ever built and reads Apple Health, each data type needs a usage description string. I drafted three in the App Store appendix and **labelled them as guesses**, because the justification is real but nobody has written the sentences.

**Why it matters.** Apple rejects generic strings under guideline 5.1.1. They are also the words an athlete reads at the moment they decide whether to share health data, so they are product copy rather than boilerplate.

**Where I looked.** Nothing in the repository. There is no Info.plist because there is no native project.

**What would settle it.** Write the three sentences, or say that HealthKit is out of scope and the toggle should be removed. Q-03 is the related decision.

**Decided by Isabella, 8 September 2026: out of scope**, consistent with DECISION 5 and Q-03. There is no native app to hold these strings, and the Apple Health toggle should be hidden until ingestion exists, so nothing needs writing today. The three drafts stay in Appendix E as a starting point for whenever a native build and real HealthKit ingestion are both actually underway.

**This answer was reversed and then restored on 8 September 2026**, and the round trip is worth recording rather than tidying away. It was briefly moved back **in** scope on the strength of a commitment to build native iOS starting immediately; Isabella corrected that the same day — the commitment was a misunderstanding — and her original answer stands. **The three strings in Appendix E are Claude's guesses and remain unwritten.** Nobody should treat a plausible draft as final copy.

---

### Q-25. Is there a crash reporter or diagnostics collection? UNVERIFIED

**The question.** The privacy nutrition label needs an answer for Diagnostics. No crash reporter, error monitor or analytics SDK was found anywhere in the dependencies.

**Why it matters.** It is a required answer on the App Store privacy label, and answering it wrongly is a compliance problem rather than a cosmetic one. `docs/09-security-and-compliance.md` mentions Sentry as a possible sub-processor with an EU region note, which suggests it was considered.

**Where I looked.** Every dependency in `package.json`, and a search of `src/` for Sentry, LogRocket, Datadog and similar.

**What would settle it.** Confirm that nothing collects diagnostics today, or name what does.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

Answered within this document already, Claude, 8 September 2026: nothing collects diagnostics today. Section 2 of Appendix E states plainly that no crash reporter was found, and Stage A0 section 7 confirms no App Store artefacts of any kind exist. The Sentry mention in the compliance document is a named possible future sub-processor, not something wired in. Answer Diagnostics as No on the privacy label until Sentry, or anything like it, is actually added, at which point this answer and that label both need revisiting together.

---

### Q-26. Is there a privacy policy, and is it linked from the app? UNVERIFIED

**The question.** No privacy policy link was found on any athlete screen.

**Why it matters.** Apple requires a privacy policy link for App Store review under guideline 5.1.1, and UK GDPR requires the information be provided to the data subject regardless of the app store.

**Where I looked.** Every athlete screen, and the sign in screen.

**What would settle it.** Say where the privacy policy lives and where it should be linked from. Me is the obvious place.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

Partly answerable from outside this document, Claude, 8 September 2026: no privacy policy exists yet. In an earlier conversation you and I established that drafting the privacy policy is blocked on deciding whether Fydr or the club is the data controller, and that decision was still open there. So the honest state is not just "not linked", it is "not written", and the missing link on this screen is a symptom rather than the actual gap. Answering "where it should be linked from": Me is right, next to Export my data. Answering "where it lives": nowhere yet, and cannot be finalised until the controller question is settled.

---

### Q-27. Accessibility: text scaling, screen readers and supported browsers. UNVERIFIED across all eighteen screens

**The question.** Section 11 of every screen specification asks for text scaling behaviour, screen reader labels for charts and scales, and a supported browser policy. **None of the three has been tested or written down.**

**Why it matters.** The wellness scales and the readiness chart are the two things a screen reader user would struggle with most, and they are the core of the app. There is also a Children's Code angle: a product used by under 18s that fails at 200 percent text is failing the users least likely to complain about it.

**Where I looked.** `docs/06-design-system.md` covers live regions and focus for the staff app. Nothing equivalent was found for the athlete surface, and no test was run.

**What would settle it.** Say what you want to commit to: a minimum browser set, and whether a screen reader pass is in scope before a real club uses it. I can run the audit once you say what the target is.

**Decided during the 8 September 2026 review.** Ported from `archive/2026-09-08-athlete-spec-review-record.docx`, which holds the same text as tracked changes with the order it was reached.

**Claude's recommendation, pending your confirmation:**** commit to the last two versions of Safari and Chrome on mobile, since that is realistically what a squad's phones run, and commit to correct semantic HTML and ARIA labelling on the five wellness scales and the readiness chart specifically, since Q-27's own reasoning is right that those two are both the core of the app and the hardest for a screen reader user. Do not commit to a full audit before a first real club, given everything else already gating that launch. Revisit the full audit once there is a real club and real usage to test against, and flag this as a real, not cosmetic, gap given the Children's Code exposure named above.

**Decided by Isabella, 8 September 2026:**** drop it entirely. Section 11 is removed from every screen specification in this document. Claude raised the point that this covers more than eyesight, including colour blindness, temporary conditions like glare or a cracked screen, and reading differences unrelated to vision, before this was decided. Isabella held the decision. No further accessibility work is committed to in this specification.

---

# Part 5. Added during the 8 September review

Three questions were raised while reviewing this workbook rather than while
writing it, so they have no equivalent in the earlier drafts. Q-28 and Q-30 were
decided by Isabella the same day; Q-29's leaderboard half was answered against
the repository.

### Q-28. Should the athlete specification keep a Package column at all? DECISION, added 8 September 2026

**The question.** No athlete screen or region is Premium gated: every one of the
eighteen is Base. Should the specification drop the Package column entirely, or
keep it with every row marked Base so the column exists the day a gate is added?

**Why it matters.** The staff specification carries a Package column on every
screen. If this document drops it, the two no longer look like one family, and
whoever adds the first Premium athlete feature has to remember to add a column
rather than a row.

**Decided by Isabella, 8 September 2026: keep the column.** Every athlete screen
is Base until a Premium athlete feature exists. It costs nothing to keep and
something to re-add.

### Q-29. Is any athlete number GPS derived, and what does a Basic club's athlete see? Added 8 September 2026

**The question.** GPS is explicitly a Premium upsell (`docs/12-product-tiers.md`
§2: "The client put it behind Premium explicitly"). A club paying for Premium GPS
analysis has a reason to complain if a Basic club's athletes see the same
numbers.

**The My data half was settled during the review:** no figure on My data is
GPS-derived on any tier today.

**The leaderboard half needed the repository**, and is answered below.

LEADERBOARD HALF answered by Claude Code, 8 September 2026, from metric_definitions on the live database, src/lib/queries/leaderboards.ts, both (athlete)/my-data/boards screens and the three (staff)/leaderboards surfaces. The My data half was already settled in this document and is not re-opened here.

1. CAN A GPS BOARD EXIST? YES. Nine metrics in metric_definitions are sourced from gps_records and every one is leaderboard_eligible = true, with min_population 3 and no ineligible_reason: gps.total_distance_m, gps.running_distance_m, gps.high_speed_distance_m, gps.sprint_distance_m, gps.high_intensity_efforts, gps.max_speed_ms, gps.player_load, gps.accelerations, gps.decelerations. By comparison the four wellness metrics are all leaderboard_eligible = false with a written reason. So a sport scientist can configure a board around distance covered.

2. IS IT TIER GATED? ON THE STAFF SIDE YES, ON THE ATHLETE SIDE NO. This is the finding.

The staff side gates twice. (staff)/leaderboards/new filters every gps.* metric out of the catalogue for a Basic club, marking it ineligible with the reason “GPS metrics are part of the Premium plan. Your club is on Basic, so GPS data cannot be ranked yet — the same reason the training report and GPS import are unavailable. Everything else on this list still can be.” And (staff)/leaderboards/[leaderboardId] refuses to display an existing GPS board on a Basic club, returning a PlanGate reading “This board ranks a GPS metric, and GPS is part of the Premium plan. The board and its results are still here — they are not shown while the club is on Basic.” Its comment names the exact scenario it defends: a board “created while the club was Premium, or inserted directly”.

The athlete side has no such check. Neither (athlete)/my-data/boards/page.tsx nor (athlete)/my-data/boards/[leaderboardId]/page.tsx imports isPremium, references tier, or tests metric_key for a gps. prefix. src/lib/queries/leaderboards.ts contains no tier logic either. The value is available and simply not consulted: requireAthlete() already selects organisations.tier (src/lib/session.ts:257), and (athlete)/me/page.tsx uses it to print the plan name.

SO A BASIC CLUB'S ATHLETES WOULD SEE A GPS BOARD WITH NO GATE, in precisely the two situations the staff view already defends against — a club that created the board while Premium and then downgraded, or a direct PostgREST insert. leaderboards/new's own header concedes the second is possible: “a direct PostgREST insert could still create a GPS board on a Basic org”, and says closing it properly needs the tier inside compute_leaderboard.

LATENT, NOT LIVE. Checked against production on 8 September 2026: two organisations, Marlow Vale RUFC on core (Basic) and Ashcombe Rugby Club on performance (Premium); one leaderboard in total, “Total session load”, a training metric, owned by the Premium club. Zero GPS boards exist on a Basic org, so no athlete is seeing this today. It becomes live the first time a Premium club with a GPS board downgrades.

RECOMMENDATION, for Isabella. Mirror the staff gate on the two athlete board screens, which is a small change and makes the behaviour symmetrical. Then consider the deeper fix the staff code already names — the tier inside compute_leaderboard — so the rule holds for any caller rather than per screen. Neither is urgent while no such board exists, but the first one costs little and removes the downgrade trap.

**Closed 8 September 2026.** Isabella greenlit the page-level fix, which shipped
as commit `77cdf20`, and the function-level fix followed as migration `0094`,
which moved the tier check inside `compute_leaderboard` so a direct call cannot
bypass it. Both are deployed.

### Q-30. When does push and email delivery actually get built? DECISION, added 8 September 2026

**The question.** Nothing in this codebase sent a push notification or an email.
No Expo push credentials, no email provider account. Every "an invite was sent"
and every password reset wrote the correct rows and delivered nothing.

**Decided by Isabella, 8 September 2026: split it in two.**

**Email first, and it is done.** Both flows now send and both were confirmed
landing in a real inbox on 8 September. They are two different systems, which the
original framing of this question missed: invites go through
`getEmailProvider()` to the Resend API, configured with `RESEND_API_KEY` and
`EMAIL_FROM_ADDRESS` in Vercel; password resets go through
`supabase.auth.resetPasswordForEmail()` and Supabase's own mailer, configured as
custom SMTP in the Supabase dashboard. Bulk invite sends nothing by design and
returns a link for staff to copy.

**One constraint that is easy to mistake for done:** until a domain is verified
in Resend, `EMAIL_FROM_ADDRESS` can only be `onboarding@resend.dev`, which sends
only to the Resend signup address. Invites cannot reach a real player until
`fydr.app` is verified.

**Push is ON HOLD, by Isabella's decision of 8 September 2026**, and not for lack
of a decision to build it — the wellness and RPE nudges are confirmed. It is held
because nobody knows how many athletes it could reach. iOS Safari delivers Web
Push only to a site added to the Home Screen, there is no `beforeinstallprompt`
on Safari so the install cannot be triggered in code, and the reach without that
flow is zero rather than low. The device split is unknown and cannot be estimated
from this build: `push_tokens` holds 43 rows all saying `platform=ios`, but no
code has ever written that table — they encode the abandoned Expo plan. Revisit
in early October 2026, once `audit_log.metadata->>'user_agent'` has a few weeks
of real sign-ins.

**And the mechanism named in the original decision is wrong now.** "Expo
credentials" presupposed the native app, which was reversed the same day. For a
responsive web app the equivalent is Web Push: a service worker plus a VAPID key
pair, with subscriptions stored where `push_tokens` already is. None of it
exists — no service worker, no registration code, no `web-push` dependency. The
manifest is the one part already correct.
