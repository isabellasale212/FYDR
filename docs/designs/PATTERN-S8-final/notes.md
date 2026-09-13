# PATTERN-S8 · FINAL: settings, users and club setup, notes

Fourteen artboards: eleven staff desktop at 1440 × 900, three phone at 375 × 812. Artboard 0 is the setup checklist a club lands on the first time it signs in; 1 to 10 are the settings a running club uses. Signed in as Jane Pemberton (sport scientist, club admin) except artboard 10, which is Ruth Callaghan (medical). Ashcombe Rugby Club, 30 athletes, 7 staff. Board instant: Friday 11 September 2026, 09:12 Europe/London.

**The gap this closes.** A row that looks pressable is pressable across all of it.
**Scope before action.** Who it touches, how many, and whether it can be undone.
**What this board refuses.** No table that scrolls sideways on a phone, no 5,000px hub.

## Artboards

| # | Screen | Size |
|---|---|---|
| 0 | Club setup, the first screen a new club sees | 1440 × 900 |
| 1 | Settings hub, four groups, one screen | 1440 × 900 |
| 2 | Users and roles, seven staff, one invitation outstanding | 1440 × 900 |
| 3 | Change a role, what it grants, what it removes | 1440 × 900 |
| 4 | Groups, five groups, thirty athletes | 1440 × 900 |
| 5 | Thresholds, the lines under every colour | 1440 × 900 |
| 6 | Integrations and imports: Catapult, Apple Health, GPS imports | 1440 × 900 |
| 7 | Audit log, filters on one line, entries below | 1440 × 900 |
| 8 | Exports, the file reads its own filters back | 1440 × 900 |
| 9 | Data retention, what falls out and when | 1440 × 900 |
| 10 | Subject access, medical role, Ruth Callaghan | 1440 × 900 |
| 11 | Settings hub, phone | 375 × 812 |
| 12 | Audit log, phone: filters in a sheet, entries as cards | 375 × 812 |
| 13 | Athlete notifications, mute everything at the top | 375 × 812 |

## What changed, and on which token

**FIXED. Log out is a button, not a row with a 5px target.**
On the running hub, Log out is a 742×71px `.set-list-row` whose only submitting element is a 4.8px chevron. Here it is a bordered 44px button with its own label, set apart from the lists, with the session it ends named beside it. The phone board uses the same button at 48px.
`component: button.ghost · min-height 44px (48 on phone) · --accent border · not a list row`

**FIXED. Eight sequential sections become four groups.**
The hub measured 3,772px at desktop and 5,089 at phone, with the list at the bottom of both. Four columns of related destinations fit one 900px screen; at 375 the same four are cards with counts, and the long lists sit one level down.
`layout: 4× grid at 1440 · stacked cards at 375 · --gap-card`

**FIXED. Every settings row is one target for its whole width.**
Rows are 52px on desktop and 64px on phone, with the icon, both lines of text and the chevron inside the same control. Nothing on this board relies on a chevron to be the hit area.
`row: min-height 52px / 64px · negative margin so the wash reaches the card edge`

**FIXED. No table scrolls sideways at 375.**
Subject access (433px) and Retention (491px) overflow a 375 viewport on the running app. At phone width a row becomes a card carrying the same fields stacked, which is what artboard 12 shows for the audit log.
`pattern: table at ≥900px · card stack below · no horizontal scroll container`

**FIXED. The audit log's filters are a sheet, not 6,287px of page.**
Twelve chips, two dates, two selects and a search field pushed the entries below the fold at phone. The sheet holds the same controls, the button reads back the count it will show, and the header carries the active filter count.
`component: sheet · --scrim · chips at 40px · apply button reads the result count`

**FIXED. "Coach access" no longer greets a sport scientist.**
The exports intro names the role that is actually signed in and what that role may export, and states the one thing it may never export, medical records, rather than leaving it to be discovered.
`copy: role-derived string · no hardcoded role name in an intro`

**NEW. Consequence before the button, on every destructive screen.**
Retention names 2,184 rows across 11 athletes and which two are current athletes. A role change names what is gained and lost. Thresholds name the four extra athletes who would be flagged. The count is computed before the action, in the same card as the button.
`pattern: preview card · --bad border for permanent, --warn for reversible`

**NEW. The log says what it cannot show.**
The type chips are derived from what is in the log, so an absent kind is invisible. A line under the table names sessions and schedule changes as not yet written, so nobody concludes from an empty filter that nothing happened.
`copy: coverage sentence under the table · --muted at --t-body-sm`

**NEW. An import holds what it cannot match rather than guessing.**
Two rows with ambiguous names are held and named on screen; the other 26 are already in. Matching once teaches the vendor's spelling. Nothing silently drops.
`row state: --wash-warn · pill --pill-warn / --on-warn`

**NEW. A setup checklist that is a list of defaults, not a gate.**
Artboard 0 orders the five steps by what saves the most rework and states outright that none of them blocks the app. The step most likely to be skipped, thresholds, carries the consequence of skipping it: the club is flagging athletes against lines nobody there chose.
`card: --wash-warn row for outstanding · --pill-good for done · progress bar --accent / --track-off`

**NEW. Apple Health states an impossibility rather than offering a button.**
It reads "not available yet · needs the Fydr iOS app" with the reason on the card and no control at all. An integration that cannot be built is worse dressed as one that merely has not been set up.
`card: state pill --surf2 / --muted · action removed, not disabled`

**KEPT. Mute everything sits at the top of the athlete's notification screen.**
It is the reason most athletes open the screen. One switch, no confirmation, and the sentence that matters: nothing stops being recorded and no coach is told.
`card: --blue-100 / --blue-200 · toggle 52×30 · --track-off when off`

**KEPT. Two-factor stays prompted, not enforced.**
The hub row states "required for your role · not enrolled" as a fact rather than a block. This is the recorded boundary pending the RLS follow-up and is not re-raised here.
`status row · O-323 · no blocking interstitial`

**KEPT. Every control on this board is at least 44px.**
Including the reorder arrows on Groups (44×44, previously 22), the row actions, the chips (36 desktop / 40 phone) and the date fields.
`sweep: STAFF-SHELL · min-height 44px · no .tiny links as sole actions`

## Open against code

**Session and schedule changes are not written to the audit log.**
Nothing writes an entry when a session is created, moved or deleted, so the log cannot answer "who moved Thursday". The board names the gap on screen, which is a mitigation, not a fix.
`source: audit write sites · no session/schedule emitters · §0al`

**Retention has a preview but no record of a preview having been run.**
Whether a preview run is itself logged, and whether the downloaded row list is retained, are open.
`source: retention run · preview path · audit emitter unknown`

**A revoked invitation's link lifetime is unverified.**
The board states that revoking kills the link immediately. Whether the token is invalidated server-side or only hidden from the list needs confirming.
`source: invitation revoke · token invalidation`

**Export link expiry is stated as seven days and not confirmed.**
If the file is served from storage with a longer-lived URL, the sentence is wrong and should be removed rather than softened.
`source: export storage · signed URL TTL`

**Role change timing is stated as "next page load".**
If permissions are cached in a session, a demoted user may keep a screen open. The real boundary needs measuring.
`source: role cache · session claims refresh`

**Apple Health cannot be built at all until there is a native iOS app.**
HealthKit releases sleep and resting heart-rate data only to an app installed on the athlete's device; there is no web or server API, and no Fydr iOS app exists. The design-system guide lists Apple Health as a Premium feature, which is currently a promise the product cannot keep.
`source: HealthKit · iOS-only framework · no Fydr native client`

**Catapult is shown as a live connection and is currently a file drop.**
The card says "Connected · Sync now", implying Fydr pulls from a Catapult account. Whether an API credential exists, or whether every file is uploaded by hand, needs confirming before this copy ships.
`source: integration credential store · import trigger`

**The setup checklist's completion rules are designed, not observed.**
Whether the app records "default" against a threshold, or only its value, decides whether the third step can be computed at all.
`source: threshold rows · no is_default column seen`

**Group deletion's effect on saved reports is designed, not observed.**
The board says a saved report reverts to the whole squad and says so in its heading. No such reversion was seen on the running app.
`source: group delete · saved report scope fallback`
