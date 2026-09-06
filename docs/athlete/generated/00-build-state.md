# Stage A0: what the athlete app actually is

Generated 6 September 2026. What exists today, before any specification is
written. Every claim carries the file it came from.

---

## The headline, which contradicts the brief

**The athlete app is not an iOS app.** It is a responsive web app, running in a
browser, sharing one codebase and one deployment with the staff app.

The brief describes "the iOS app used by players". **There is no iOS app.** There
is no Xcode project, no Swift, no React Native, no Expo, no Capacitor, no Cordova
and no Ionic. I searched the whole repository, and the Desktop copy, for
`.xcodeproj`, `.xcworkspace`, `Package.swift`, `Info.plist`, `*.swift`,
`PrivacyInfo.xcprivacy`, `app.json`, `app.config.*`, `eas.json` and
`metro.config.*`. **Nothing matched.**

The only application dependency set is Next.js 16.3 and React 19.2.8
(`fydr/package.json`). No mobile framework appears in it.

**This is not a discovery. It is recorded in the project's own contract**, which
says the athlete app "**exists, is not mobile, and is not greenfield**", and is
"responsive mobile web, not the React Native/Expo app §4 describes: that native
shell has not been started" (`CLAUDE.md` §8).

### What this changes about the brief

Six of the twelve screen specification sections, and one whole stage, assume a
native app. They cannot be answered as written:

| Brief asks for | Status |
|---|---|
| Native language and navigation library | **Neither exists.** Next.js App Router, browser navigation |
| Bundle ID, provisioning | **Do not exist.** No native project to hold them |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | **Does not exist** |
| App privacy answers, age rating | **Never submitted.** No App Store Connect presence found in the repo |
| HealthKit data types | **Not integrated.** See section 5 |
| OS permissions: camera, photos, notifications | **Browser permissions only**, and see section 5 |
| Stage B5, App Store readiness | **Cannot be written against this build.** See section 7 |
| Section 11, minimum iOS version, one handed reachability | **Not applicable.** Applies to browsers and viewports instead |

**I have not guessed at any of these.** They are reported as absent rather than
described as if a native app existed.

---

## 1. Where it lives

**In this repository**, at `src/app/(athlete)/`, inside the same Next.js
application as the staff app.

**There is no second repository.** `~/Developer/` contains only `Fydr`. A copy
exists at `~/Desktop/Fydr`, kept as a precaution and never written to, and it
contains no native artefacts either.

**One deployment serves both surfaces.** The athlete app is not separately
deployed and has no separate address: an athlete signs in at the same domain as a
coach and is routed by their role.

---

## 2. What it is built in

| | |
|---|---|
| Framework | **Next.js 16.3**, App Router |
| UI library | **React 19.2.8** |
| Navigation | **The Next.js App Router.** No navigation library: URLs and links |
| Styling | The same design tokens as the staff app (`src/styles/tokens.css`) |
| Server state | TanStack Query |
| Shell | A four item tab bar, `src/components/AthleteTabBar/AthleteTabBar.tsx` |

**The tab bar has four destinations** (`AthleteTabBar.tsx:24`):

| Label | Route |
|---|---|
| Today | `/today` |
| My data | `/my-data` |
| Gym | `/programme` |
| Me | `/me` |

**A note on the word "app".** It behaves like an app on a phone: a tab bar, one
screen at a time, thumb reachable. It is a web page. Nothing installs it, nothing
appears on a home screen unless the athlete adds it manually, and **there is no
web app manifest** in the repository, so even the browser's own "add to home
screen" behaviour is unconfigured.

---

## 3. Which screens exist

**Fifteen screens. None is a stub.** Every one is a real, working screen with real
queries behind it. Line counts are given as a rough measure of substance, not as
a quality judgement.

| Screen | Route | Lines |
|---|---|---|
| Today | `/today` | 452 |
| Wellness check-in | `/check-in` | 134 |
| Session rating | `/rpe/[sessionId]` | 168 |
| Nutrition check-in | `/nutrition-check-in` | 97 |
| Report a problem | `/report-problem` | 101 |
| My data | `/my-data` | **1726** |
| Boards | `/my-data/boards` | 94 |
| One board | `/my-data/boards/[leaderboardId]` | 186 |
| One gym session | `/my-data/gym/[gymSessionLogId]` | 56 |
| Programme | `/programme` | 210 |
| Nutrition guidance | `/programme/nutrition` | 138 |
| Gym session | `/gym/[sessionId]` | 86 |
| Me | `/me` | 270 |
| My leaderboards | `/me/leaderboards` | 98 |
| Notifications | `/me/notifications` | 49 |

**One server route** exists in the athlete area. It is inventoried in Stage A1.

**Three screens carry a "not built" marker in their own source**: Today, Me, and
Notifications. Each names something adjacent that was deliberately cut, rather
than being a stub itself. Those are read properly in Stage A1.

**So this is reconciliation mode, not intent mode.** Substantial code exists,
Stages A1 and A2 both apply, and unbuilt behaviour will be marked NOT BUILT while
untraceable behaviour is marked UNVERIFIED.

---

## 4. Backend, schema and authentication

**Shared completely, and this is the single most important fact for the
specification.**

**One Supabase project.** One set of environment variables
(`.env.example`), one client factory used by both surfaces
(`src/lib/supabase/client.ts`, `server.ts`, `admin.ts`).

**One schema.** The athlete app reads and writes the same tables a coach does:
`wellness_entries`, `training_entries`, `gym_session_logs`, `nutrition_checkins`,
`athlete_consents`, `problem_reports`.

**One authentication system, one middleware, one set of role claims.** The same
file routes both surfaces (`src/lib/supabase/middleware.ts`), and roles come from
the same signed token.

**Which is why this specification shares the metrics registry rather than
duplicating it.** A number an athlete sees and a number a coach sees are, in most
cases, literally the same column read by two screens. Where they are not, that is
a parity break and Stage B1 will find it.

### One thing found while checking this, which is a real finding

**The middleware's athlete route list covers only two of the fifteen screens.**

```
const ATHLETE_PREFIXES = ['/today', '/check-in'] as const;
```
`src/lib/supabase/middleware.ts:19`

Thirteen athlete screens are not in it: `/my-data`, `/programme`, `/me`, `/rpe`,
`/gym`, `/nutrition-check-in`, `/report-problem` and their children.

**What that does and does not mean.** The middleware uses this list to bounce a
**staff member** out of athlete screens. So a coach can currently open
`/my-data` and `/programme` and will not be redirected, where they would be
bounced from `/today`.

**Whether they see anything is a separate question.** The athlete layout calls
`requireAthlete()` (`src/app/(athlete)/layout.tsx:21`), which redirects anyone
without the athlete role. So there are two locks and only one has the full list.

**This needs a Run level check before it is called a defect**, per
`docs/verification-standard.md`: the layout guard probably catches it, and
reporting a hole that does not exist would be the fourth time this project has
done that. **Carried into Stage A2 as the first thing to test by hand.**

---

## 5. HealthKit

**Not integrated. The consent is real; the data flow does not exist.**

**What is built.** An athlete can grant and withdraw consent to Apple Health sync
on their own Me screen. It is stored as a real, revocable consent record against
a versioned privacy notice (`src/lib/queries/healthkit.ts`), and **only the
athlete can see or change it**: a consent state is not performance data, and
knowing that an athlete declined tells a coach nothing they are entitled to act
on (`supabase/migrations/0012` as quoted in that file).

**What is not.** Any reading of health data. The file says so directly:

> "Granting consent does not make sleep data appear. The read itself needs the
> native iOS app that 08-notifications.md and CLAUDE.md §8 both record as not
> built. This build is responsive web, and a browser cannot reach HealthKit."
> `src/lib/queries/healthkit.ts:27`

**No data types are requested**, because nothing requests any. There are no
HealthKit usage description strings, because there is no native app to hold them.

**The screen says so rather than implying data is flowing**, which is the right
handling of a half built feature and is worth preserving in the specification.

**Status: NOT BUILT**, deliberately and honestly, with the half that is
implementable in a browser, the consent, actually implemented.

---

## 6. Product packages

Both packages apply to the athlete app, inherited from the club's plan rather than
set per athlete. The athlete context carries the club's **real** tier, never a
staff member's preview, so that a coach previewing the Basic package cannot change
what their own athletes are allowed to switch on (`src/lib/session.ts:51`).

**UNVERIFIED: which athlete screens or regions are Premium.** Files searched:
`src/app/(athlete)/**`. Established in Stage A1.

---

## 7. App Store

**Nothing exists, and Stage B5 cannot be written against this build.**

No bundle identifier. No provisioning profiles. No privacy manifest. No evidence
in the repository of any App Store Connect record, submission, age rating, or app
privacy questionnaire. No Sign in with Apple.

**This is not a gap in the app. It is a consequence of there being no app to
submit.**

**What Stage B5 could usefully become instead**, if you want it: a specification
of what would be required **before** a native app is started, written now while
the data collection is fresh. The privacy nutrition label answers, for instance,
are derivable today from the tables the web app already writes, and would not
change when a native shell wraps them. Account deletion inside the app is an
Apple requirement and **is a real gap now**, because an athlete currently has no
way to delete their own account in either surface.

**That is a decision for you at the Stage A0 stop**, and it is question 2 below.

---

## 8. What I could not establish

- **UNVERIFIED: whether any athlete screen is Premium gated.** Stage A1.
- **UNVERIFIED: whether a staff member can actually open the thirteen athlete
  screens absent from the middleware list.** Section 4. Needs a Run level check.
- **UNVERIFIED: what the three "not built" markers on Today, Me and Notifications
  refer to.** Read properly in Stage A1.
- **NOT BUILT: account deletion by the athlete.** No such control exists in either
  surface. Erasure is an audited staff process.

---

## 9. Questions before Stage A1

**Question 1. The brief's premise is wrong. Which specification do you want?**

- **A. Specify what exists.** The responsive web athlete app, fifteen screens, as
  built. Sections about native concerns are dropped rather than answered
  hypothetically. **This is the accurate document and I recommend it.**
- **B. Specify the native app you intend to build**, using the web app as the
  statement of behaviour and marking everything native as NOT BUILT. This is a
  design document for work not started, and most of it would be invention, which
  your own hard rules forbid.
- **C. Both, separated.** Specify what exists, and add one appendix on what a
  native shell would additionally need. **This is A plus about a day.**

**My recommendation is C.** A is the honest core, and the appendix captures the
App Store thinking while the data collection is fresh, without pretending an app
exists.

**Question 2. Stage B5.** If you take A or C, do you want App Store readiness
rewritten as "what a native app would need", or dropped until one is started?

**Question 3. Account deletion.** An athlete cannot delete their own account. That
is an Apple requirement for a native app and a reasonable expectation for a web
one. Should the specification require it? It is currently NOT BUILT in both
surfaces.

**Question 4. Section 11 of the screen specification format** asks for Dynamic
Type, VoiceOver, minimum iOS version and one handed reachability. For a web app
the equivalents are text scaling, screen reader labels, supported browsers and
thumb reach at common viewport sizes. **Do you want that section translated, or
dropped?** I would translate it: the underlying concerns are real on a phone
browser.

---

---

## 10. Your answers, recorded 6 September 2026

**Question 1: both, separated.** The specification describes the responsive web
app that exists. A separate appendix covers what a native shell would
additionally need. Option C.

**Question 2: Stage B5 stays, rewritten as what a native app would need.** It
becomes forward looking rather than a readiness check on something that cannot be
submitted. The privacy label answers are derivable now from the tables the web app
already writes, and will not change when a native shell wraps them.

**Questions 3 and 4 were not answered, so I have taken my own recommendations and
am flagging them rather than burying them.**

**Question 3, account deletion: the specification will require it.** An athlete
currently cannot delete their own account in either surface. It is an Apple
requirement for a native app and a reasonable expectation for a web one. Carried
as a decision in Stage A2 rather than assumed into a screen specification. **Say
if you would rather it stayed out.**

**Question 4, the accessibility section: translated, not dropped.** Section 11 of
each screen specification becomes text scaling, screen reader labels for charts
and scales, supported browsers, and thumb reach at common phone viewport sizes.
The underlying concerns are real on a phone browser; only the Apple specific
framing was not.

---

**Stage A0 is closed. Proceeding to Stage A1.**
