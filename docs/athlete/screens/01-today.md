# Today

## 1. Where it sits

Tab 1 of 4. Route `/today`. File `src/app/(athlete)/today/page.tsx`, 452 lines.
The landing screen after sign in.

## 2. Who reaches it and when

Every athlete, every time they open the app. Base package: there is no tier gate
anywhere in the athlete shell. Guarded by `requireAthlete()`, so a staff member
who is not also an athlete is redirected to `/dashboard`.

## 3. What you see

Top to bottom on a phone:

1. **Who you are and what day it is**, with the matchday label for the week
   (`mdLabel`, `mdExplainer`).
2. **What you owe today**, as a to-do list. This is the screen's real job.
3. **What is on today**, the sessions from the schedule.
4. **What the club is working towards**, the next fixture (`fetchNextFixture`).

**Above the fold: the to-do list.** Everything else can be scrolled to.

## 4. What the athlete enters here

**Nothing.** Today is a dispatcher, not a form. Each to-do item carries its own
destination (`today/page.tsx:123`) and the entry happens on the screen it opens.

## 5. Every number shown

| Metric ID | Label on screen | Meaning | Window | When missing |
|---|---|---|---|---|
| MET-014 | The MD label, for example MD-2 | How many days until the next match | The week | No fixture, no label |
| MET-024 | Session times and durations | What is scheduled today | Today | "Nothing scheduled" |

Formulas live in `docs/metrics.md`.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A to-do item | The list | Opens the entry screen for that item | `/check-in`, `/rpe/[id]`, `/nutrition-check-in`, `/gym/[id]` | nothing | no | the item is not owed |
| Report a problem | Below the list | Opens the problem form | `/report-problem` | nothing | no | never |
| Tab bar | Fixed, bottom | Switches tab | the tab | nothing | no | never |

**Gestures.** UNVERIFIED: no pull to refresh, swipe or long press found.

## 7. Offline and sync

Today shows what is owed and stores nothing itself. The entries it dispatches to are saved on the phone first and sent when there is signal
(`src/lib/outbox.ts`). Its own header states the rule: an athlete standing in a
gym with no bars must never be shown a network error for something they have
already done.

- **Queued in `localStorage`**, one key per domain.
- **Retried on the next load** of the app.
- **If the app is closed before sync completes**, the entry is still in the queue
  and goes on the next open.

**UNVERIFIED: what the athlete sees while an entry is queued**, and what happens
if the same day is submitted twice from two devices. Looked in
`src/lib/outbox.ts` and the screen's own component.

## 8. Notifications

`docs/09-security-and-compliance.md:507` names `athlete.wellness.nudge` and
`athlete.rpe.nudge` and caps them: one per entry, one per day, three per rolling
week, stopping after three consecutive missed days, and no guilt or streak
language. **Tighter limits are specified for under 18s and NOT BUILT.**

**UNVERIFIED: the exact copy, the send time, the timezone, and which screen each
opens.** DECISION 12.

## 9. Permissions

None required. Push notification permission would be required by whatever sends
the nudges above, and that could not be located.

## 10. States

Loading, empty (nothing owed and nothing scheduled), error, offline, no squad,
first run with no history. **UNVERIFIED: which of these are distinctly designed.**

## 11. Accessibility and device

Stage A0 recorded the decision to translate this section for a web app rather
than drop it.

- **Text scaling.** UNVERIFIED: no test at 200 percent browser zoom.
- **Screen reader.** UNVERIFIED per element.
- **Supported browsers.** UNVERIFIED: no browser support policy found.
- **Thumb reach.** The primary action sits at the bottom of the screen on the
  entry forms, which is the reachable third on a phone.

## 12. Open issues

- **UNVERIFIED:** notification copy and timing. DECISION 12.
- **UNVERIFIED:** whether Today tells an athlete they are unavailable. DECISION 8.
- Deep links to Today survive sign out; eight other athlete screens do not.
  DECISION 1.
