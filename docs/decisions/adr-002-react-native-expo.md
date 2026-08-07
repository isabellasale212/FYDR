# ADR-002: React Native with Expo for the mobile app

## Status

**Amended 5 August 2026.** The client confirmed staff need a phone app in addition to the
web dashboard, so the Expo app now carries two shells, athlete and staff, resolved from the
authenticated user's roles. This roughly doubles the mobile surface area. The Expo choice is
reinforced by it: one codebase carrying two shells is the argument for React Native over
native Swift, which would have meant building the staff app twice. O-24 is resolved as
"both". See `02-information-architecture.md` §4.6 for the cost.

**ACCEPTED.** 2026-08.

---

## Context

Fydr's athlete experience is the product. `00-product-overview.md` states the thesis plainly:
if submission takes more than 45 seconds, compliance collapses within three weeks, and every
other feature becomes decoration on a dataset nobody is filling in. So the athlete client has
to be genuinely good, on a phone, one-handed, in a changing room, with poor signal.

The constraints on how to build it:

- **One developer.** Two native codebases is not a trade-off, it is a decision to ship half
  the product or take twice as long.
- **iOS and Android both required at launch.** A semi-professional squad of 40 is roughly
  split between the two. Shipping iOS only excludes half the athletes, which excludes half the
  data, which makes squad-level analysis meaningless.
- **Offline-first is mandatory** (ADR-004). That needs local SQLite, background tasks, and
  reliable app-lifecycle hooks.
- **Push notifications are load-bearing.** The 07:00 wellness prompt is the mechanism that
  makes compliance happen (`08-notifications.md`).
- **HealthKit in phase 3.** Sleep, resting heart rate, and HRV from Apple Watch. That is a
  native integration with no web equivalent.
- **Staff also get a phone app.** Confirmed 5 August 2026, and it is the same binary: one
  Expo app carrying two shells, athlete and staff, resolved server-side from roles. It is
  built after staff web, as roadmap Phase 2m. The staff dashboard stays web as well; the
  phone app is for the pitchside subset, not a replacement.
- **Frequent small releases.** Fixing a copy error or a validation bug should not require a
  three-day App Store review, because the fastest way to lose a pilot club is to be unable to
  fix something they reported on Monday until Thursday.

---

## Decision

**React Native via Expo, managed workflow with `expo-router`, TypeScript, distributed through
the App Store and Google Play, with EAS Build, EAS Submit, and EAS Update.**

Specifically:

| Concern | Choice |
|---|---|
| Framework | React Native, New Architecture enabled |
| Toolchain | Expo SDK, managed workflow with `expo prebuild` available as an escape hatch |
| Routing | `expo-router`, file-based, mirroring the two role shells in `02-information-architecture.md` |
| Local database | `expo-sqlite` (async API), hand-written SQL and migrations |
| Secure storage | `expo-secure-store` for the refresh token |
| Notifications | `expo-notifications` over Expo Push Service (subject to O-16) |
| Background work | `expo-background-task` for sync, best effort |
| Health data | `react-native-health` behind a config plugin, phase 3, requires a development build |
| Builds and releases | EAS Build, EAS Submit, EAS Update for over-the-air JavaScript updates |
| Development | Development builds, not Expo Go, because native modules are used from day one |

The runtime version policy is `appVersion`, so an OTA update can only reach a binary whose
native surface matches. See `05-architecture.md` §14.

---

## Consequences

**Good:**

- One codebase, two platforms, one developer. This is the whole argument and it is sufficient
  on its own.
- Types, validation, and domain logic are shared with the staff web dashboard through
  workspace packages (`05-architecture.md` §2). The readiness calculation and threshold
  evaluation exist once and run in the app, on the web, and in Edge Functions.
- **EAS Update means a JavaScript fix reaches athletes within hours, not days.** For a product
  in pilot with a handful of clubs, this materially changes how quickly problems get fixed and
  therefore how a pilot goes.
- EAS Build removes the need to maintain Xcode and Android Studio toolchains, certificates, and
  provisioning profiles by hand. That is days per year recovered.
- Config plugins keep native configuration in TypeScript and in version control rather than in
  `Info.plist` and `AndroidManifest.xml` edits that get lost on regeneration.
- Recruiting help later is easier. React developers are common; React Native is a short step.

**Bad, and accepted:**

- **Expo Go is unusable from day one**, because `expo-sqlite` with custom native config and
  later `react-native-health` require a development build. Onboarding a second developer means
  building a dev client first. This is a mild inconvenience that surprises people.
- **The SDK upgrade treadmill.** Expo ships roughly every six months and support for old SDKs
  lapses. Budget two to four days per upgrade, twice a year, indefinitely. Skipping upgrades
  compounds and eventually forces a large one.
- **Performance ceiling on list-heavy screens.** A squad status grid of 40 athletes by 28 days
  is a lot of cells. Mitigations are `FlashList`, memoisation, and pushing aggregation to
  materialised views rather than computing in the client. If a screen still cannot hit the 250
  ms transition budget (`05-architecture.md` §11), that specific screen moves to a native view,
  not the whole app.
- **HealthKit background delivery is fiddly** through a community module. Phase 3 should budget
  a week for it rather than a day, and the fallback (a foreground sync on app open) is
  acceptable because daily sleep data does not need to arrive at 04:00.
- **Larger binary.** Roughly 25 to 40 MB versus perhaps 15 MB native. Irrelevant to the user,
  worth knowing.
- **Dependency on Expo as a company.** EAS is a paid hosted service. If it disappeared, the
  app would still build: `expo prebuild` produces standard iOS and Android projects that build
  with Xcode and Gradle. The loss would be OTA updates and hosted builds, roughly a week to
  replace with self-hosted CI. This is a contained risk, unlike a framework with no ejection
  path.
- **Some vendor SDKs have no React Native binding.** Relevant in phase 4 if a GPS vendor offers
  only native SDKs. Phase 4 is planned around APIs rather than SDKs, which sidesteps it.

---

## Alternatives considered

### 1. Native Swift and Kotlin

Two codebases, written properly for each platform.

| | Native | Expo |
|---|---|---|
| Time to a two-platform v1 | Roughly 2× | 1× |
| HealthKit integration | Direct, first-class | Community module, workable |
| Offline SQLite | Direct | `expo-sqlite`, fine |
| Fix turnaround | Days, store review both platforms | Hours via OTA |
| Shared logic with the web dashboard | None. Readiness and threshold logic written three times. | Shared package |
| Long-term ceiling | Higher | Adequate |
| Feasible for one developer | **No** | Yes |

Rejected on the last row. The rest of the table is a genuine advantage for native and it does
not matter, because the alternative to a React Native app is not a native app, it is half a
native app on one platform. Athlete compliance across a whole squad is the product; excluding
Android athletes destroys the dataset the analytics thesis depends on.

The specific thing given up is HealthKit fidelity. That is real, it lands in phase 3, and it
is a week of extra work rather than a blocker.

### 2. Progressive web app

A responsive web app, installed to the home screen, no app stores.

Rejected. Individually each gap is arguable; together they remove the athlete experience the
product depends on.

| Requirement | PWA reality |
|---|---|
| Reliable offline writes | Service worker plus IndexedDB is workable, but iOS evicts storage from home-screen web apps after periods of disuse. Losing an athlete's queued entries is unacceptable. |
| Background sync | `Background Sync` is not available on iOS Safari. Entries sync only while the app is open. |
| Push notifications | Supported on iOS 16.4+ only for home-screen-installed apps, and the install step is a multi-tap Safari flow most athletes will not complete. The 07:00 prompt is the compliance mechanism, so unreliable delivery is fatal. |
| HealthKit | Not available at all. Removes a Premium-tier feature entirely. |
| Discoverability and legitimacy | "Search the App Store for Fydr" is a sentence a coach can say to a squad. "Open Safari, go to this URL, tap share, tap add to home screen" is not. |
| Perceived quality | Clubs are being asked to pay per athlete. An app store presence is part of what they think they are buying. |

The install and notification friction alone would cost more compliance than every UX
optimisation in the product gains.

### 3. Flutter

Genuinely good for this: strong offline story, excellent performance, single codebase, mature
tooling.

Rejected on ecosystem alignment rather than merit. The staff dashboard is Next.js and shares
types, Zod schemas, and domain logic with the app. Choosing Dart means that shared layer
cannot exist, so readiness scoring, ACWR, MD-n labelling, override resolution, and threshold
evaluation get written twice, in two languages, and drift. The Supabase Dart client is also
less mature than the TypeScript one, particularly around realtime and auth edge cases.

If the staff dashboard were native mobile too, this would be a much closer call.

### 4. Capacitor or Ionic

A web app in a native shell, with plugins for native capability.

Rejected. It solves the store presence and push problems but keeps a web rendering layer, and
the athlete entry screens are exactly the kind of gesture-heavy, animation-dependent UI where
that shows. It also puts a plugin bridge between the app and SQLite for the one subsystem
where reliability matters most.

---

## Open questions

- ~~**O-24**: Does staff need the phone app at launch?~~ **Closed 5 August 2026: both.** The
  app carries two shells and the staff shell is roadmap Phase 2m, 10 weeks, built after staff
  web. What remains open is the staff offline scope, which is O-14 in `05-architecture.md`.
