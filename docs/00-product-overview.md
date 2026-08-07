# 00. Product Overview

## What Fydr is

Fydr is an athlete performance management platform sold to sports teams. It gives a club
one place to collect, monitor, and act on the daily data that determines whether athletes
are training well, eating well, recovering well, and available to play.

It replaces the spreadsheet-and-group-chat system that most small and mid-tier clubs
currently run on.

> **The stated positioning has changed and the two versions are not compatible.** The client's
> own design system opens with "Athlete-management platform · for professional rugby". This
> document was written targeting small and mid-tier semi-professional clubs. Those are different
> products at different prices against different competitors. Nothing below has been silently
> rewritten to match. The conflict is set out in full in "Who it is for" and raised as **O-750**,
> and it needs answering before Phase 1 scope is fixed.

## The problem it solves

A typical club below the elite tier collects athlete data in fragments: a wellness
questionnaire in Google Forms, gym programmes in a shared spreadsheet, GPS exports sitting
in a folder from the vendor's own software, injury status in the physio's notebook, and
nutrition tracked nowhere at all.

The consequence is not that the data doesn't exist. It is that no one can answer a
question that spans two of those sources. "Is our loading pattern in the week before a
match associated with our soft-tissue injuries?" requires joining three systems by hand,
so nobody asks it.

Fydr's value is the join.

## Core product thesis

Three claims, in order of confidence:

1. **Collection must be trivially easy or compliance collapses.** An athlete who takes
   more than 45 seconds to submit a wellness entry will stop submitting it within three
   weeks. Every design decision on the athlete side is subordinate to this.
2. **Staff need exceptions, not dashboards.** A coach does not want to read 30 athletes'
   numbers. They want to be told which three athletes need attention this morning, and
   why. The flag system is the product, the dashboard is the packaging.
3. **The cross-domain correlation is the durable differentiator, with one axis much weaker
   than the rest.** Wellness apps exist. Gym apps exist. GPS platforms exist. Very few
   affordable products correlate wellness against session RPE and load against gym output
   against testing against injury incidence for the same athlete over an adjustable window.
   That join is still the thing worth buying and it is still uncommon at this price point.

   State the resolution plainly rather than let it be discovered in a demo. This claim used to
   lead with **nutrition** meaning logged intake, and that is gone. Athletes do not log meals
   or macros: Fydr provides guidance, targets and meal ideas and training-day fuelling
   (`screens/nutrition-guidance.md`). What came back, when **O-890** was resolved on 5 August
   2026, is a single weekly question answered in one tap: did you hit your protein target most
   days this week, Yes, Roughly or No (`screens/nutrition-checkin.md`).

   **That is a real variable and it is a poor one, and both halves of that sentence have to
   survive contact with a buyer.** Real: it is a nutrition axis, it correlates, it trends over
   a season, and no competitor at this price point has one either. Poor: it is one
   self-reported ordinal value per athlete per week on three levels, its response rate will sit
   well below 100% because answering is deliberately optional, and it cannot support a claim
   about grams, days, or "protein intake against lean mass". Per-meal macros are not coming
   back and nothing in the plan will bring them back.

   The correct sentence to a buyer is "we have a weekly self-reported nutrition signal, and it
   is coarse", said in that order, with the analytics screen's coarseness note visible. Selling
   the old sentence and then being asked to show the protein chart is a worse outcome than not
   having the axis at all.

## Who it is for

**This is unresolved. Two positions are on the table and they are being asserted at the same
time by the same project.**

### Position A: professional rugby

**Source**: the client's design system, `docs/source/design-system-content.txt`, line 1 of the
page body: "Athlete-management platform · for professional rugby". This is the client's own
published framing of the product, sitting above a design system that is described as pulled
straight from a working codebase. It is the most recent statement of intent and it is the one
attached to shipped software.

The screenshot supports it. A per-athlete GPS board with positional units, high speed running,
high intensity efforts, and percentage of maximum velocity is a professional sports science
artefact. Semi-professional clubs mostly do not have GPS units for the whole squad, and the ones
that do have five sets shared between thirty players.

### Position B: small to mid-tier clubs

**Source**: this document, as originally written, and every downstream document that inherited
it. Buyer is a small to mid-tier club, semi-professional rugby, football, and similar squad
sports. Typically 25-60 athletes, one or two S&C staff, a part-time physio, and no dedicated
data analyst. Elite professional clubs with existing Catapult, Kitman, and Smartabase contracts
and in-house sports science departments were **explicitly excluded** as an initial target,
because they would demand integrations and compliance guarantees that do not exist.

`10-roadmap.md`, `05-architecture.md`, `09-security-and-compliance.md`, and ADR-002 were all
written on Position B. ADR-002 justifies React Native partly on "a semi-professional squad of 40
is roughly split between the two platforms".

### What changes in each direction

Not a summary. These are the decisions that actually move.

| | **Professional rugby** | **Small to mid-tier clubs** |
|---|---|---|
| **Squad size** | 40 to 60 senior, plus academy. Multiple squads per organisation is normal. | 25 to 60, usually one squad. |
| **Competitors** | Catapult, Kitman Labs, Smartabase, Teamworks, Edge10. All incumbent, all embedded, all with existing contracts. | Spreadsheets, Google Forms, WhatsApp, and cheap point tools. |
| **The sale** | Displacement, not greenfield. You are asking a club to drop or sit alongside a system their analyst already knows. | Greenfield. Nobody is being displaced. |
| **Sales cycle** | Six to eighteen months. Procurement, a pilot, a security review, a DPA negotiation, and usually a committee. | Weeks. One coach with a budget line. |
| **Who you sell to** | Head of athletic performance, head of medical, sometimes a data lead. They will ask about data ownership and export before they ask about features. | The S&C coach, who is also the physio, who is also the person doing it in a spreadsheet. |
| **Integrations** | **Mandatory at launch, not Phase 4.** A professional club already has Catapult or STATSports and will not double-enter. Vendor APIs move from "sell it first" to table stakes, and that is 3 weeks per vendor plus commercial access you may not be granted. | CSV import is genuinely acceptable, which is what `07-integrations.md` assumes. |
| **GPS** | Central and daily. The training report screen is the product's face. | A Premium-tier upsell, which is what the tier table below assumes. |
| **In-house analysts** | Present. They will want raw export, an API, and their own queries. "Limited presets" will not survive first contact. | Absent. Presets are the product; a query builder is a liability. |
| **Compliance burden** | A full security questionnaire, a negotiated DPA, penetration test evidence, ISO 27001 or a credible substitute, sub-processor disclosure, and medical data scrutiny from an actual club doctor. `09-security-and-compliance.md` is currently written for a one-developer product. | GDPR done properly, a plain DPA, and honest answers. Achievable solo. |
| **Feature expectations** | Availability integrated with a medical team, load management against a periodised plan, match data, RTP protocols, multi-squad, audit depth. | The compliance loop, flags, and the cross-domain join. |
| **Price** | Per club, four to five figures per season, or a per-athlete rate an order of magnitude above the current anchor. The **£1 per athlete per week** figure in O-1 is roughly £2,000 a season for a 40-athlete squad, which is below what a professional club spends on GPS vests, let alone software. | The £1 anchor is plausible and is what the tier table is built for. |
| **Support** | Named contact, response commitments, in-season urgency. Losing a professional club's data on a Friday before a fixture is a contract event. | Best effort. |
| **What v1 has to be** | Credible against an incumbent on day one, in the areas the buyer cares about. | The cheapest thing that proves athletes will submit a wellness entry. |

### The honest reading

They are not reconcilable by splitting the difference. Position A and Position B disagree about
the riskiest assumption in the project. Position B says the risk is athlete compliance, which is
why `10-roadmap.md` §10 argues for a nine-week thin slice to test it. Position A says the risk is
credibility against incumbents, which the thin slice does not test at all, because a
professional club's athletes already submit wellness data every morning for whoever their
current supplier is.

There is a middle path, and it should be named rather than assumed: **professional rugby as the
design target and reference customer, semi-professional as the volume market**, on the argument
that a product built to satisfy a professional sports science department is over-specified but
still usable for a semi-professional club, while the reverse is not true. That path costs more,
takes longer, and needs the compliance work early. It is a real option, not a compromise that
avoids the decision.

> **Open question O-750, blocking.** Which is it? This changes the target market, the price
> point, the competitor set, the integration roadmap, the compliance burden, the sales cycle,
> and whether `10-roadmap.md` §10's thin slice is the right first move. It is the highest-value
> unanswered question in the specification, above every schema question, because the schema is
> broadly the same either way and the plan is not. Answer it before Phase 1 scope is fixed.
>
> Answer it with three specifics rather than a label: name the first club you expect to pay,
> state what they currently use, and state what you would charge them.

## Commercial model

Per-athlete subscription, billed to the organisation. Two tiers, **Club** and **Premium**,
renamed from Core and Performance per `12-product-tiers.md` §2 on the client's own wording.

**`12-product-tiers.md` is the source of truth for the split.** The table that stood here listed
every feature and had gone stale in three ways at once: it used the old tier names, it carried a
"Nutrition tracking" row for a capability that does not exist, and it duplicated a split that is
maintained in full elsewhere. Condensed to the shape of the decision only:

| | **Club** | **Premium** |
|---|---|---|
| The daily loop: wellness, gym, compliance, availability, scheduling, flags, testing, leaderboards | Yes | Yes |
| Nutrition guidance: targets, meal ideas, matchday fuelling. Read-only, no meal or macro logging | Yes | Yes |
| Weekly nutrition check-in: one question, one tap, three levels | Yes | Yes |
| GPS data import | No | Yes |
| Apple HealthKit sync | No | Yes |
| Cross-domain analytics builder | Limited presets | Full custom builder |
| Data export | CSV | CSV and API |

Screen by screen and feature by feature, see `12-product-tiers.md` §3. Enforcement is §7 of the
same document and is not optional.

> **Open question O-1**: exact price points per tier. The £1/athlete/week figure discussed
> previously is a Club-tier anchor, not a confirmed price. See `11-open-questions.md`.
>
> **O-1 is now downstream of O-750.** The tier split above puts GPS import, HealthKit, and the
> custom analytics builder behind the Premium tier. Under Position A that is wrong on its
> face: GPS is the first thing a professional club uses, it is a top-level item in the built
> app's sidebar, and gating it makes the Club tier unsellable to the stated market. Under
> Position B the split is sound. Do not set prices before answering O-750.

## The four users

Summarised here, specified fully in `01-roles-and-permissions.md`.

- **Athlete**: submits their own data, follows their programme, sees only themselves plus
  any leaderboard they appear on.
- **Coach / S&C**: sees the whole squad, builds and assigns programmes, sets thresholds,
  reads analytics.
- **Medical / Physio**: owns injury records and availability status. Sees clinical detail
  no one else does.
- **Admin / Club owner**: manages users, groups, billing, and organisation settings.

## Success criteria for v1

Concrete, measurable, and the basis for deciding whether v1 is finished:

1. A squad of 40 athletes can be onboarded by an admin in under 30 minutes.
2. Median athlete wellness submission takes under 45 seconds, measured in-app.
3. Weekly wellness compliance exceeds 80% across a pilot club after four weeks.
4. A coach can go from opening the app to identifying the three athletes needing attention
   in under 15 seconds, without applying a filter manually.
5. An S&C coach can build a gym programme and assign it to a group of 15 athletes in under
   10 minutes.
6. Zero cross-organisation data leaks under automated permission testing.

## Design principles

Applied when the spec is silent and a judgement call is needed.

1. **Exceptions over exhaustiveness.** Surface what is wrong first. Detail is available on
   demand, never by default.
2. **One-thumb athlete UX.** Every athlete action must be completable one-handed on a
   phone, standing up, in a changing room, on poor signal.
3. **Offline is normal, not an edge case.** Training grounds have bad signal. Entries queue
   locally and sync when possible. The app never blocks on the network.
4. **The schedule is the spine.** Almost everything in the product hangs off the session
   calendar and the MD-n position within a week. When in doubt, anchor a feature to the
   schedule.
5. **Data has provenance.** Every value knows where it came from: self-reported, staff
   entered, device synced, or file imported. Display it. Analysis that mixes sources
   without distinguishing them produces confident nonsense.
6. **Nothing is silently overwritten.** Corrections create revisions. History is preserved.

## Non-goals for v1

Deliberately excluded. Do not build these without an explicit instruction.

- Video or tactical analysis
- In-app messaging or chat
- Direct vendor API integrations (Catapult, StatSports, Polar): Phase 4
- Android-specific health platform sync (Google Fit / Health Connect), Phase 4
- Multi-sport templating beyond squad sports
- Athlete-to-athlete social features
- Payments taken in-app (billing is handled out of band in v1)
- White-labelling per club

**Two of these are conditional on O-750.** Direct vendor API integrations and multi-squad
support are defensible non-goals for a semi-professional club and are not defensible for a
professional one, which already has a vendor contract and usually more than one squad. If
Position A is chosen, both move into scope and the roadmap lengthens accordingly. Do not treat
this list as settled until O-750 is answered.

## Related documents

- Navigation and screen inventory → `02-information-architecture.md`
- How the app behaves end to end → `03-flows.md`
- Build order → `10-roadmap.md`
