# Stage A1: screen inventory

Generated 6 September 2026. Every screen an athlete can reach, how they reach it,
and where it sits.

**This is a navigation graph, not a route tree.** The same screen reached two ways
appears once, with both ways listed.

**Mode: reconciliation.** Substantial code exists, so this records what is built.
Behaviour the app does not have is marked NOT BUILT. Behaviour I could not trace
is marked UNVERIFIED with the files searched.

**A word on "screen".** This is a web app, so a screen is a page at an address. It
behaves like an app screen: one at a time, a tab bar at the bottom, thumb
reachable. Where the brief asks about modals, sheets and full screen covers, the
answer is in section 4 and it is short.

---

## Counts

| | |
|---|---|
| **Screens an athlete can reach** | **18** |
| Inside the athlete shell, with the tab bar | 15 |
| Outside the shell, shared with staff | 3 |
| Server routes | 1 |
| Tab bar destinations | 4 |
| Screens reachable only in a particular state | 0. See section 5 |
| Modals, sheets or full screen covers | 0. See section 4 |
| Premium only screens | 0. See section 6 |

---

## 1. The four tabs and what sits under each

The tab bar is fixed and always present inside the shell
(`src/components/AthleteTabBar/AthleteTabBar.tsx:24`).

### Tab 1: Today, at `/today`

**The landing screen.** What the athlete owes today, and what is on.

| Screen | Route | File | Reached by | Package |
|---|---|---|---|---|
| Today | `/today` | `today/page.tsx` | Tab 1. Signing in. A notification | Base |
| Wellness check-in | `/check-in` | `check-in/page.tsx` | A to-do item on Today | Base |
| Session rating | `/rpe/[sessionId]` | `rpe/[sessionId]/page.tsx` | A to-do item on Today, per session | Base |
| Nutrition check-in | `/nutrition-check-in` | `nutrition-check-in/page.tsx` | A to-do item on Today, weekly (`today/page.tsx:139`) | Base |
| Gym session | `/gym/[sessionId]` | `gym/[sessionId]/page.tsx` | A to-do item on Today, and from Programme | Base |

**Today is a dispatcher.** Its to-do list is built from what the athlete owes, and
each item carries its own destination (`today/page.tsx:123`). The four
destinations above are the whole set.

### Tab 2: My data, at `/my-data`

**The athlete's own record.** The largest screen in either app at 1,726 lines.

| Screen | Route | File | Reached by | Package |
|---|---|---|---|---|
| My data | `/my-data` | `my-data/page.tsx` | Tab 2 | Base |
| Boards | `/my-data/boards` | `my-data/boards/page.tsx` | A link on My data | Base |
| One board | `/my-data/boards/[leaderboardId]` | `.../[leaderboardId]/page.tsx` | A board in the list | Base |
| One gym session | `/my-data/gym/[gymSessionLogId]` | `.../[gymSessionLogId]/page.tsx` | A logged session on My data | Base |

**My data is divided by domain rather than by page.** Five domains are handled
inside the one screen: **wellness, gym, testing, training and nutrition**
(`my-data/page.tsx:351`). They are regions of one page, not separate screens, and
are specified as such in Stage B3.

### Tab 3: Gym, at `/programme`

| Screen | Route | File | Reached by | Package |
|---|---|---|---|---|
| Programme | `/programme` | `programme/page.tsx` | Tab 3 | Base |
| Nutrition guidance | `/programme/nutrition` | `programme/nutrition/page.tsx` | A link on Programme | Base |

**The tab is labelled Gym and the route is `/programme`**, and nutrition guidance
sits underneath it. That is worth noting in Stage A2: a player looking for their
nutrition guidance has to know it is under a tab called Gym.

### Tab 4: Me, at `/me`

| Screen | Route | File | Reached by | Package |
|---|---|---|---|---|
| Me | `/me` | `me/page.tsx` | Tab 4 | Base |
| My leaderboards | `/me/leaderboards` | `me/leaderboards/page.tsx` | A link on Me | Base |
| Notifications | `/me/notifications` | `me/notifications/page.tsx` | A link on Me | Base |
| Report a problem | `/report-problem` | `report-problem/page.tsx` | A link on Me, **and from Today** | Base |

**Report a problem is reachable from two tabs**, Me and Today
(`today/page.tsx`, `me/page.tsx`). It is one screen with two entrances, which is
correct: telling somebody you are hurt should not require finding a settings
screen.

---

## 2. Screens outside the athlete shell

**Three, and all three are shared with the staff app.** They have no tab bar,
because a person using them is not yet known to be an athlete.

| Screen | Route | File | Reached by | Shared with staff |
|---|---|---|---|---|
| Sign in | `/login` | `src/app/login/page.tsx` | Opening the app signed out | **Yes, the same screen** |
| Two factor | `/login/mfa` | `src/app/login/mfa/page.tsx` | Sign in, when a second factor is required | **Yes** |
| Password reset | `/login/reset` | `src/app/login/reset/page.tsx` | A link on sign in | **Yes** |

**Where the athlete lands after signing in is decided by their roles**, not by a
choice they make (`src/lib/supabase/claims.ts:124`). An athlete goes to `/today`.
A person who is both a player and a coach goes to the staff app, because it is the
larger tool.

**`/` redirects** to whichever home the roles resolve to
(`src/app/page.tsx`).

---

## 3. Server routes

**One.**

| Route | File | What it does | Guard | Audited |
|---|---|---|---|---|
| `/me/export` | `me/export/route.ts` | **Downloads the athlete's own data as a spreadsheet** | The athlete's own session | **Yes**, as report type `my_data` (`:167`) |

**This is the athlete's data export, and it matters for Stage B2.** An athlete can
take their own record with them, in one click, without asking anybody. The file is
named for them and the act is logged the same way a coach's report view is
(`me/export/route.ts:18`).

---

## 4. Modals, sheets, full screen covers, alerts

**None. This is a web app and every screen is a page at an address.**

The brief asks about them because a native app would have them. What this app has
instead:

**Forms are pages.** The wellness check-in is a screen, not a sheet over Today.
That has a real consequence worth keeping: **every action an athlete takes has its
own address**, so a notification can open it directly, and a half completed form
survives being backgrounded in a way a modal often does not.

**Confirmations are inline.** Where the staff app needs a destructive
confirmation it renders one in the page rather than a browser dialogue. **The
athlete app has no destructive actions at all**, so it needs none.

**UNVERIFIED: whether any athlete screen uses a browser `confirm()` dialogue.**
Files searched: `src/app/(athlete)/**`. A Read level check found none, and this
would be a Run level confirmation.

---

## 5. Screens that appear only in a state

**None. Every screen is always reachable by an athlete with an athlete role.**

The brief asks about injured, suspended, no squad assigned, wrong tier, and
account pending. Taking each against the code:

**Injured or unavailable.** **No separate screen.** An injured athlete uses the
same fifteen screens. Whether their availability or restrictions are shown to
them at all is a Stage B2 question and is not yet established.
**UNVERIFIED: whether an athlete can see their own availability status.** Files
searched: `src/app/(athlete)/me/page.tsx`, `my-data/page.tsx`.

**Suspended or deactivated.** A deactivated user has their account disabled at
sign in rather than seeing a different screen. **NOT BUILT: any in-app state for a
suspended athlete.** The `suspended` user status exists in the database and is
unreachable from any screen in either app, which is recorded in
`docs/state-machines.md` §8.

**No squad assigned.** An athlete record with no group membership still reaches
every screen. Their leaderboards and comparisons will be empty. **No screen tells
them why**, which is a Stage A2 item.

**Wrong product tier.** **No athlete screen is tier gated.** See section 6.

**Account pending approval.** **NOT BUILT, and there is no such state.** An
account created by staff is active immediately: it starts life `active`, never
`invited` (`src/lib/queries/userManagement.ts:31`). There is no acceptance step
for an athlete to complete, which connects to decision D-38 in the staff
specification.

---

## 6. Product packages

**No athlete screen or region is Premium gated. Every one of the fifteen is Base.**

I searched the whole athlete tree for the tier helpers the staff app uses
(`isPremium`, `PlanGate`, `requirePremiumRoute`). **No match.**

**The athlete context does carry the club's tier** (`src/lib/session.ts:51`), and
carries the club's **real** tier rather than a staff member's preview, so a coach
previewing the Basic package cannot change what their own athletes may switch on.
**It is carried and, as far as I can find, never read.**

**Two consequences worth raising in Stage A2.**

**A Basic club's athletes see the same app as a Premium club's.** That is either
correct, because everything an athlete does is Base, or a gap, because GPS derived
figures might be expected to disappear.

**UNVERIFIED: whether My data shows GPS derived figures at all**, and if it does,
what a Basic club's athlete sees. Files searched: `my-data/page.tsx`. This is the
one place a tier gate would be expected and none exists.

---

## 7. Deep links and notifications

**UNVERIFIED, and this is the largest gap in this inventory.**

**What exists.** A notifications preferences screen at `/me/notifications`, and
notification preference records with a table behind them. The screen carries a
"not built" marker in its own source.

**What I could not establish.** Which notifications are actually sent, on what
trigger, or which screen each opens. Files searched:
`src/app/(athlete)/me/notifications/page.tsx`,
`src/lib/queries/notificationPreferences.ts`, `src/lib/email/`.

**What I did establish.** Quiet hours have columns in the database and no screen
sets them (`src/lib/queries/notificationPreferences.ts:20`), which is already
decision D-18 in the staff specification.

**Push notifications need a native app.** A `push_tokens` table exists. A browser
can receive web push, but nothing in this codebase registers a service worker,
and there is no web app manifest, so **NOT BUILT** is the honest status for push
on this build.

**This affects Stage B3 directly.** Section 8 of every screen specification asks
for the notifications relating to that screen, with exact copy and timing. **On
current evidence the answer is "none are built", and I will say so per screen
rather than inventing them.**

---

## 8. Which screens appear in the staff specification under another name

**Three pairs, and each is the same underlying data seen from two sides.** These
are where Stage B1's parity work will concentrate.

| Athlete screen | Staff screen | Same data |
|---|---|---|
| My data, wellness region | `04-athlete-wellness.md` | The same wellness entries. **The athlete sees their own; a coach sees anyone's** |
| Programme | `36-programme-athlete-view.md` | **The same resolved programme.** The staff screen is explicitly "one programme as one athlete actually sees it" |
| My data, boards, and My leaderboards | `38-leaderboards.md`, `39-leaderboard-detail.md` | The same boards, subject to the athlete's own opt out |

**One pair is not a pair, and the difference is the point.** Report a problem has
no staff equivalent as a screen: what an athlete writes there lands in a medic's
triage queue on the staff Injuries screen (`25-injuries-list.md`). That is a cross
app flow, and it is the first one Stage B4 will trace.

**Nutrition guidance has no staff twin either.** The staff Nutrition screen
authors rules; this screen shows one athlete the result. The numbers must match,
which is a Stage B1 parity check.

---

## 9. Open items carried into Stage A2

1. **Can a staff member open the thirteen athlete screens missing from the
   middleware list?** Carried from Stage A0 §4. **This is the first thing to test
   at the Run level**, because it is an access question and the specification has
   been wrong about access before by inferring.
2. **Can an athlete see their own availability, restrictions and return to play
   stage?** The single most important visibility question, and Stage B2 turns on
   it.
3. **Does My data show GPS derived figures, and what does a Basic club's athlete
   see?** The only plausible tier gate in the app, and no gate exists.
4. **Which notifications are actually sent, and which screen does each open?**
   Section 7. Affects section 8 of all eighteen screen specifications.
5. **Does an athlete with no group membership get told why their comparisons are
   empty?**

---

**STOP. 18 screens, 1 server route, 4 tabs. Waiting for approval before Stage
A2.**
