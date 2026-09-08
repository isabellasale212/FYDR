# Start here: the state of this document, 8 September 2026

**This page replaces the "Start here" page that existed only in the reviewed Word
document.** That document is now archived at
`docs/athlete/archive/2026-09-08-athlete-spec-review-record.docx` and its content
has been absorbed into the markdown, which is the single source. If the two ever
disagree, the markdown wins.

## The athlete app is the responsive web app. Native iOS is not being built.

Stage A0's original position, Option C, and it stands. The athlete app is the
route group at `src/app/(athlete)/`, sharing one codebase, one deployment and one
Supabase project with the staff app.

**A commitment to build native iOS was made and withdrawn on 8 September 2026.**
It is recorded here because its consequences were briefly written into this
document as live work, and anyone reading an older copy will find them:

- **Do not start Apple Developer enrolment.** The Organisation-type account and
  its D-U-N-S number are a someday item, not a blocker.
- **Appendix E, App Store readiness, is hypothetical.** Read it as a checklist
  for work that is not scheduled.
- **The three HealthKit usage strings stay drafts.** See Q-24 — that answer was
  reversed and then restored the same day, and the strings remain Claude's
  guesses rather than written copy.
- **The Apple guideline 5.1.1(v) account-deletion risk is dormant, not
  accepted.** See Q-02. No app is being submitted, so nothing needs flagging in
  submission notes that do not exist. Q-02's decision — no self-service deletion,
  accounts staff-provisioned by invite — stands on its own merits for a web app.

## What is settled, and what is not

**Appendix A has no open questions left.** All thirty are answered or decided.
Nine were closed on 8 September against the live repository: Q-08 through Q-14
(the exact on-screen wording), Q-20, and the leaderboard half of Q-29.

**Five of those nine came back as real problems rather than clean answers.** Each
is written up in its own Appendix A entry:

1. **Q-29.** Nine GPS metrics are leaderboard-eligible, and the athlete board
   screens had no tier gate while the staff screens did. Fixed at page level
   (`77cdf20`) and then inside `compute_leaderboard` (migration `0094`). Both
   deployed.
2. **Q-10, and the session-rating note.** Both comment fields are documented at
   1,000 characters — the database limit — and enforced at 500 by the
   application. The number in the specification is double the number an athlete
   meets.
3. **Q-12.** The third problem-report category reads "Something else" when filing
   and "Other" in the list of reports already filed, on the same screen.
4. **Q-09.** The Today to-do drops "this week" from the question the nutrition
   screen itself asks.
5. **Q-13.** The question's premise was wrong: the normal gym logging path has no
   weight or reps fields at all. It logs the prescribed values on one tap.

**Q-20 is a clean answer, not a leak.** `/programme/nutrition` renders the
athlete's own last recorded weight and a fixed reference weight, never the
staff-authored target range. MET-036's visibility rule holds.

## Two things still waiting on somebody

**Push notifications are on hold** until there is real device data — see Q-30.
Revisit early October 2026.

**Resend needs `fydr.app` verified** before an invite can reach a real player.
Email works, and was confirmed in a real inbox, but only to the Resend signup
address until a domain is verified.

## One recurring trap, worth knowing before a demo

`supabase/seed.sql` authors dates as offsets from `current_date`, so seeded data
goes stale as a database ages. On 8 September every open injury carried an
expected-return date between 9 and 31 days in the past, and because the athlete
view correctly suppresses past dates, **no athlete saw a return date at all**.
Both databases were corrected. It will drift again. Re-check before any demo.
