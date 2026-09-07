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

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-02. Should an athlete be able to delete their own account? DECISION and NOT BUILT

**The question.** There is no way for an athlete to delete their own account in either surface. Erasure exists only as an audited staff process.

**Why it matters.** Apple guideline 5.1.1(v) requires in app account deletion for any app with account creation, so this is a hard blocker for a native app. It is also a reasonable expectation for a web one. **The hard part is not the button.** An athlete's injury record is club held data the club may lawfully keep under article 17(3), so 'delete my account' cannot mean 'delete my data', and the screen has to say so honestly without sounding like a refusal.

**Where I looked.** `src/lib/retention/`, `docs/09-security-and-compliance.md` section 5 and its article 17 table, and every screen under `src/app/(athlete)/`.

**What would settle it.** Confirm the specification should require it. Then decide the sentence: what an athlete is told about the records that survive. That sentence is the actual work and it is yours, not mine.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-03. Should the Apple Health toggle stay on screen while there is nothing behind it? DECISION

**The question.** An athlete on a Premium club can turn on Apple Health. It writes a consent row and nothing reads it. There is no HealthKit integration: no native code anywhere, and no table holds device sourced sleep, resting heart rate or HRV.

**Why it matters.** The athlete grants a permission for a feature that does not exist. It is also a rejection risk for a native app: requesting a HealthKit permission for data the app never reads falls under guideline 5.1.1.

**Where I looked.** `src/components/HealthkitConsentToggle/HealthkitConsentToggle.tsx`, `src/app/(athlete)/me/page.tsx:240`, `src/lib/queries/healthkit.ts`, and every table in the schema.

**What would settle it.** Choose: hide it until ingestion exists; keep it and label it plainly as not yet active; or leave it as is. Leaving it as is is the current behaviour and the one that misleads.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-04. Should nutrition guidance stay behind a tab called Gym? DECISION

**The question.** `/programme/nutrition` is reached from `/programme`, and the tab bar labels that tab **Gym**. A player looking for what to eat has to know it lives behind Gym.

**Why it matters.** It is a findability problem rather than a bug. Nutrition guidance is one of the few things the app offers a player who is not currently training.

**Where I looked.** `src/components/AthleteTabBar/AthleteTabBar.tsx`, `src/app/(athlete)/programme/`.

**What would settle it.** Choose: rename the tab to cover both, for example Programme; move nutrition guidance under Me; add a fifth tab; or leave it and rely on the link from Today.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-05. Should an athlete be able to correct their own entry? DECISION

**The question.** They cannot. Wellness, training, nutrition and gym entries are immutable once submitted. A correction creates a new revision row, and migration 0058 made `revise_wellness_entry` and `revise_training_entry` coach and medical only **at a club's request**.

**Why it matters.** An athlete who fat fingers a 2 instead of a 4 has to ask a coach to fix it. The immutability rule itself is sound and is `CLAUDE.md` rule 6: performance data that can be silently edited is worthless for trend analysis. The question is only whether the athlete should be able to file the correction themselves, which the revision mechanism already supports.

**Where I looked.** Migration 0058, `src/lib/validation/entryCorrection.ts`, `src/app/(athlete)/check-in/page.tsx`, `src/app/(athlete)/rpe/[sessionId]/page.tsx`.

**What would settle it.** Confirm whether the current state is the intended end state, or whether an athlete should be able to submit a correction for staff approval. Note that the club asked for the current restriction, so changing it is a conversation with them.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-06. Should the nine athlete routes that lose their destination be fixed? DECISION

**The question.** `/today` and `/check-in` send a signed out visitor to `/login?next=...`. The other nine athlete routes send them to a bare `/login`, so they land on the default screen rather than where they were going. Tested, not inferred.

**Why it matters.** Every push notification and every shared link to a screen other than Today lands in the wrong place if the app has signed the player out.

**Where I looked.** `src/lib/supabase/middleware.ts:19`, and a Run level test of all eleven routes signed out.

**What would settle it.** Choose: add the nine prefixes; leave it; or replace the prefix list with the route group so a new athlete screen is covered without anyone remembering. The third does not decay and is the largest change.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-07. Are the four offline domains the intended set? DECISION

**The question.** Wellness, training, nutrition check in and gym set logs are queued on the phone and retried. **Report a problem is not**, and neither are consent changes, leaderboard opt out or notification preferences.

**Why it matters.** Report a problem is the one an athlete is most likely to submit pitch side with no signal, which is exactly the case the outbox was built for.

**Where I looked.** `src/lib/outbox.ts` and its header, and every athlete form.

**What would settle it.** Confirm the four are intended, or say which others should be queued. Report a problem is the one I would add.

| Your answer |
|---|
|   |
|   |
|   |

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

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-09. The weekly nutrition question and its three answers. UNVERIFIED

**The question.** What is the one question, and what are the three answers? This screen's entire content is one question, and the wording was not found.

**Why it matters.** It is the whole of the product's nutrition commitment from an athlete. `CLAUDE.md` rule 8 is explicit that there is no daily logging and no per meal entry: one question, once a week, three answers. Every nutrition insight a nutritionist gets from athletes comes through this one sentence.

**Where I looked.** `src/app/(athlete)/nutrition-check-in/page.tsx`, `src/lib/validation/nutrition.ts`, `docs/screens/nutrition-checkin.md`.

**What would settle it.** Open `/nutrition-check-in` and write down the question and all three answer labels exactly.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-10. Does the morning check in offer a comment field? UNVERIFIED

**The question.** `wellness_entries.comment` exists and is capped at 1,000 characters by a database constraint. Whether the athlete check in screen actually offers it was not established.

**Why it matters.** If it exists, it is free text an athlete writes about how they feel, which staff read. That has a visibility answer and a wording answer, and neither is currently in the specification.

**Where I looked.** `src/components/CheckInForm/CheckInForm.tsx`, `src/lib/validation/wellness.ts`.

**What would settle it.** Open `/check-in` and say whether there is a text box, and if so what it is labelled and what the placeholder says.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-11. The exact wording shown to a 16 year old on the leaderboard settings. UNVERIFIED

**The question.** An under 18 athlete is off leaderboards by default and must opt in. The screen behaves differently for them. What it says to them was not found.

**Why it matters.** This is the wording that matters most on that screen. It is a consent request to a child under the Children's Code, and the standard expects it to be understandable to them rather than to a lawyer.

**Where I looked.** `src/app/(athlete)/me/leaderboards/page.tsx`, `docs/screens/leaderboards.md`.

**What would settle it.** Sign in as a minor account, or read the branch in the file, and write down what the under 18 state says.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-12. The problem report field wording, and what happens on invalid input. UNVERIFIED

**The question.** What does the report a problem form ask, and what does it do if the athlete submits something it will not accept?

**Why it matters.** This is the screen a player uses to say they are hurt. It writes into a medic's triage queue. The wording sets whether a player reports a niggle early or waits until it is an injury.

**Where I looked.** `src/app/(athlete)/report-problem/page.tsx`, `src/lib/validation/problemReport.ts`.

**What would settle it.** Open `/report-problem` and write down every label, the placeholder, and what an empty submission does.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-13. The gym set logging field labels and invalid input behaviour. UNVERIFIED

**The question.** What are the fields called when an athlete logs a set, and what happens if they type something the app will not take?

**Why it matters.** Gym logging is the highest frequency entry in the app. A confusing label costs a set every session.

**Where I looked.** `src/app/(athlete)/gym/[sessionId]/page.tsx`, `src/lib/validation/gym.ts`.

**What would settle it.** Open a gym session and write down the field labels and what an invalid entry does.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-14. The password change field wording on Me. UNVERIFIED

**The question.** The exact labels for current password, new password and confirmation, and the minimum length message.

**Why it matters.** Low risk, listed for completeness because section 4 of the Me screen specification is otherwise incomplete.

**Where I looked.** `src/app/(athlete)/me/page.tsx`, `src/components/ChangePasswordForm/ChangePasswordForm.tsx`.

**What would settle it.** Read them off the screen.

| Your answer |
|---|
|   |
|   |
|   |

---

---

# Part 3. Product wide unknowns

### Q-15. Do the two nudges named in the compliance document exist at all? UNVERIFIED and probably NOT BUILT

**The question.** `docs/09-security-and-compliance.md:507` names `athlete.wellness.nudge` and `athlete.rpe.nudge`, and constrains them carefully: one per entry, one per day, three per rolling week, stopping after three consecutive missed days, no guilt or streak language, and tighter limits for minors. **Neither appears in the notification catalogue.**

**Why it matters.** Either the catalogue is incomplete, or the compliance document specifies two notifications nobody built and the careful constraints protect nothing. The minors' limits in particular cannot apply to notifications that do not exist.

**Where I looked.** `src/lib/notifications/catalogue.ts`, which carries `athlete.flag.shared`, `athlete.compliance.weekly` and `athlete.leaderboard.weekly` and nothing else. Searched the whole of `src/` for both identifiers.

**What would settle it.** Say whether these were ever built, or whether the compliance document is describing an intention. If it is an intention, the document should say so.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-16. What happens to an athlete's account when they leave the club? UNVERIFIED

**The question.** `athletes.left_at` exists and athlete data is never hard deleted. What happens to the person's login, what they see if they open the app, and whether they keep access to their own history was not found.

**Why it matters.** Every club will ask this, and so will every player. A player who moves clubs and opens the app to a broken screen is a support problem and a trust problem. There is also a live decision inside it: a transfer creates a fresh record with no link to the old one, decided already, so the old account still exists somewhere.

**Where I looked.** `src/lib/retention/`, `docs/09-security-and-compliance.md` section 5, `docs/12-product-tiers.md`, and the athletes table.

**What would settle it.** Describe what should happen: does the login still work, what do they see, and can they still export their own history.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-17. What happens to club data if the club stops paying? UNVERIFIED

**The question.** Nothing was found specifying this. There is no billing surface in the product by design, so it is an operational process rather than a feature, but the data question is still a specification question.

**Why it matters.** It is the question that decides whether a club trusts you with a season of injury records. It also has a legal edge: the club is the controller and Fydr is the processor, and a processor holding data after the contract ends needs a written basis.

**Where I looked.** `docs/12-product-tiers.md`, `docs/09-security-and-compliance.md`, `src/lib/tier.ts`, `src/lib/retention/`.

**What would settle it.** Describe the intended behaviour: a read only period, an export window, a deletion timetable, or something else.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-18. Is the athlete told when staff have read or acted on what they submitted? UNVERIFIED

**The question.** `athlete.flag.shared` exists in the catalogue and fires when staff acknowledge a flag raised about the athlete. It is push only and off by default. Whether anything else closes the loop was not found.

**Why it matters.** An athlete who reports a problem and hears nothing concludes the app does not work. The submission is immutable and they cannot chase it.

**Where I looked.** `src/lib/notifications/catalogue.ts`, `src/app/(athlete)/report-problem/page.tsx`, `src/lib/queries/problemReports.ts`.

**What would settle it.** Say what an athlete should be told, and when, after they report a problem.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-19. Can a problem report be retracted? UNVERIFIED

**The question.** An athlete files a report and it appears below the form. Whether they can withdraw it, and for how long, was not established.

**Why it matters.** A player who reports something in the heat of a session and wants to take it back has no obvious route. Equally, a medic's triage queue that loses entries is worse. There is a real tension here and it needs a decision rather than a default.

**Where I looked.** `src/app/(athlete)/report-problem/page.tsx`, `src/lib/queries/problemReports.ts`, migration 0040.

**What would settle it.** Say whether retraction should exist and, if so, for how long and what the medic sees.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-20. Does MET-036's visibility rule still hold? UNVERIFIED

**The question.** The staff nutrition screen states that the athlete never sees their body mass target range in their own app, and that it is never ranked. But `/programme/nutrition` reads `body_mass_kg`, and the nutrition guidance screen shows targets.

**Why it matters.** This is the one place a written visibility promise and a screen's imports appear to disagree. Either the promise is stale or the screen shows something it should not.

**Where I looked.** `src/app/(athlete)/programme/nutrition/page.tsx`, `docs/metrics.md` MET-036, and the staff nutrition screen's own copy.

**What would settle it.** Open `/programme/nutrition` and say whether a target RANGE is visible, as opposed to the daily targets.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-21. Is an athlete in no positional group told why their comparisons are empty? UNVERIFIED

**The question.** The staff surface says this explicitly: the athlete is not a member of any positional group, so there is no set of players to compare against, and groups are managed in Settings. The athlete side was not found to say anything.

**Why it matters.** An empty chart with no explanation reads as a broken app rather than a missing group.

**Where I looked.** `src/app/(athlete)/my-data/page.tsx`, and the staff equivalents which do carry the copy.

**What would settle it.** Say whether the athlete should be told, and in what words.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-22. Can an athlete account ever require two factor? UNVERIFIED

**The question.** The club policy recorded on the staff Settings screen is that coach, medical and admin accounts carry a second factor. No athlete requirement was found, but `/login/mfa` is shared with the staff app and an athlete could in principle reach it.

**Why it matters.** It changes whether the two factor screen is part of the athlete specification at all, and whether an academy player needs an authenticator app.

**Where I looked.** `src/lib/mfa.ts`, `src/app/login/mfa/page.tsx`, the staff Settings two factor card.

**What would settle it.** Confirm whether athletes are ever required, or ever permitted, to enrol a second factor.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-23. What does an athlete with no working email address do? UNVERIFIED and a real academy risk

**The question.** Password reset is PKCE and only works in the browser that asked for the email. With no email provider configured, the link is not delivered at all. Invite links are different and do forward, because they are verified server side.

**Why it matters.** Academy players may share a parent's email, have no email, or have one they cannot access from the phone they use. If they lose their password there may be no route back into the app at all.

**Where I looked.** `src/app/login/reset/`, `src/components/ResetConfirmForm/ResetConfirmForm.tsx`, `src/lib/email/provider.ts`.

**What would settle it.** Say what the recovery route should be for a player with no usable email. A staff initiated re-invite is the obvious candidate and it is not documented as one.

| Your answer |
|---|
|   |
|   |
|   |

---

---

# Part 4. Things needing an account or a device I do not have

These cannot be answered by reading the code.

### Q-24. The HealthKit usage description strings. NOT BUILT, and my drafts are guesses

**The question.** If a native shell is ever built and reads Apple Health, each data type needs a usage description string. I drafted three in the App Store appendix and **labelled them as guesses**, because the justification is real but nobody has written the sentences.

**Why it matters.** Apple rejects generic strings under guideline 5.1.1. They are also the words an athlete reads at the moment they decide whether to share health data, so they are product copy rather than boilerplate.

**Where I looked.** Nothing in the repository. There is no Info.plist because there is no native project.

**What would settle it.** Write the three sentences, or say that HealthKit is out of scope and the toggle should be removed. Q-03 is the related decision.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-25. Is there a crash reporter or diagnostics collection? UNVERIFIED

**The question.** The privacy nutrition label needs an answer for Diagnostics. No crash reporter, error monitor or analytics SDK was found anywhere in the dependencies.

**Why it matters.** It is a required answer on the App Store privacy label, and answering it wrongly is a compliance problem rather than a cosmetic one. `docs/09-security-and-compliance.md` mentions Sentry as a possible sub-processor with an EU region note, which suggests it was considered.

**Where I looked.** Every dependency in `package.json`, and a search of `src/` for Sentry, LogRocket, Datadog and similar.

**What would settle it.** Confirm that nothing collects diagnostics today, or name what does.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-26. Is there a privacy policy, and is it linked from the app? UNVERIFIED

**The question.** No privacy policy link was found on any athlete screen.

**Why it matters.** Apple requires a privacy policy link for App Store review under guideline 5.1.1, and UK GDPR requires the information be provided to the data subject regardless of the app store.

**Where I looked.** Every athlete screen, and the sign in screen.

**What would settle it.** Say where the privacy policy lives and where it should be linked from. Me is the obvious place.

| Your answer |
|---|
|   |
|   |
|   |

---

### Q-27. Accessibility: text scaling, screen readers and supported browsers. UNVERIFIED across all eighteen screens

**The question.** Section 11 of every screen specification asks for text scaling behaviour, screen reader labels for charts and scales, and a supported browser policy. **None of the three has been tested or written down.**

**Why it matters.** The wellness scales and the readiness chart are the two things a screen reader user would struggle with most, and they are the core of the app. There is also a Children's Code angle: a product used by under 18s that fails at 200 percent text is failing the users least likely to complain about it.

**Where I looked.** `docs/06-design-system.md` covers live regions and focus for the staff app. Nothing equivalent was found for the athlete surface, and no test was run.

**What would settle it.** Say what you want to commit to: a minimum browser set, and whether a screen reader pass is in scope before a real club uses it. I can run the audit once you say what the target is.

| Your answer |
|---|
|   |
|   |
|   |

---

