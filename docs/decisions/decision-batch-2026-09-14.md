# Decision batch, 14 September 2026 (night)

Isabella's rulings on the seventeen rows the reviewer's reconciliation found
waiting on her. Worked through one at a time.

| # | Decision |
|---|---|
| 1 | **The premium board (S12) is dropped.** Everything it was for is built without one: the plan page, D-20 without exception, `PlanGateCard`, the tier gate at the database, the downgrade sentence, the audited tier flip. |
| 2 | **"Send now" is added, on the offline queue screen only.** Never per item. The S6 wording stays everywhere else. The platform decision is the later ruling and asked for it explicitly; a person with one bar of signal is better served by a button than by a screen telling them to relax. |
| 3 | **Test assignment gets BUILT**, rather than the sentence being reworded. Tests are assignable to **both groups and individual athletes**. Needs a table linking a test definition to groups and to athletes, an assign control on the definition, and every testing surface scoped by it. The confirmed sentence then reads true as originally written. ⚠ migration. |
| 4 | **Gym per-set RPE and `planned_rpe` stay outside the club setting.** The setting governs session RPE, which feeds load, compliance and the boards. The per-set number is a lifting cue between an athlete and their S&C and feeds none of them. **The setting's own wording must say what it does not cover** ("session RPE after training"), or a club that switches it off and is still asked in the gym reports it as a bug. |
| 5 | **The medic's injury export gets THREE extra columns, not four: diagnosis, mechanism, severity.** Clinical notes stay out of every export. They are free text a physio types: they can carry a third party's name, a guess, or something about a player's family, and an export is the thing that leaves the club. The notes stay on the medic's screen. The catalogue sentence is corrected to name the three. |
| 6 | **The consent backfill (0120) is removed.** Every existing athlete goes through the consent flow on next open. All accounts are synthetic so nothing real is lost, and it is the only way the flow is ever tested before a real club depends on it. Accepted cost: staff screens look empty until athletes are clicked through. |
| 7 | **The third password rule is removed entirely**, not made a checkbox and not made a system tick. A rule software cannot check is theatre. The counter becomes "2 of 2 rules met". **No advice line either** — nothing at all about reuse. |
| 8 | **No tap-target minimum on desktop.** 44px is a touch rule and applies at phone widths. What matters on desktop is keyboard reachability and a visible focus ring, which is being built. |
| 9 | **Faded unavailable controls keep their 45% fade**, recorded as deliberate. The fade signals unavailable, the reason on tap carries the meaning, and darkening the text would make an unavailable control look available. |
| 10 | **Fix: the selected leaderboard row in dark.** Text at 1.09:1 against its background is invisible, not dim. A defect, not a judgement. |
| 11 | **Fix: form placeholder text.** Nothing in the stylesheet sets it, so the browser's own grey is used: 4.03:1 light, 3.36:1 dark. Set it explicitly from a token that passes in both themes. This is why `check:contrast` never saw it — the colour is not in the stylesheet. |
| 12 | **Fix: amber text at 12 to 13px**, by pointing those rules at `--on-warn-strong`, which exists for exactly this. No new colour. |
| 13 | **No S11 board.** Install teaching is S9 frame 6, already drawn. Offline and queue states are PATTERN-S6. The reachability figure is named in S9's notes. "Send now" is one control on an existing screen. What remains is engineering: the shared outbox in IndexedDB, and recording per-athlete install state so the staff figure can be honest. |
| 14 | **Fix: the audit log's own sentence.** It says session and schedule changes are not logged yet. False since `0104`. The screen whose job is being true is telling people it is blind when it is not. Correct it, and name what genuinely is missing: `groups`. |
| 15 | **ATH-ADULT-03's 53px submit is left for the accessibility sweep**, which is measuring every tap target anyway. |
| 16 | **`EMAIL_FROM_ADDRESS` set to `noreply@fydr.app`** in Vercel production, as Config not Secret. It was absent entirely, so the code was falling back to `onboarding@resend.dev` and no club member could have received an invite. Takes effect on the next deploy. |
| 17 | **Supabase Pro waits for a signed club**, unchanged. |

## Also ruled the same night

**ATH-ADULT-10 C2 stays declined, for a second and independent reason.** It was
declined on 12 September because the system had no dialog component. B11 approved
one on the 13th, which removes that reason but does not revive the row: B11 came
with the rule that a dialog exists only where an action is destructive or
irreversible. Finishing a gym session early destroys nothing. Declined twice, for
two different reasons.

## A correction to the advisory chat's own document

`docs/architecture/to-do.md` said audit coverage was 26 of 59 tables. It is **35
of 66**, and `organisations` now has a trigger. The stale figure came from an
8 September note carried forward without re-measuring.
