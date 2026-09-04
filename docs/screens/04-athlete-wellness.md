# 04. Athlete wellness

## 1. Page name and URL

**Wellness**, at `/squad/[athleteId]/wellness`.

One athlete's check-in history in detail: the five scales, how they have moved,
and how today compares with their own normal.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing. This is a reading screen | None | Base | `src/lib/athleteDomain.server.ts:89` then `:93` |
| Coach | Yes | Everything | Nothing | None | Base | Same |
| Medic | Yes | Everything | Nothing | None | Base | Same |
| S&C | Yes | Everything | Nothing | None | Base | Same |
| Nutritionist | Yes | Everything. **Wellness is not injury information** | Nothing | None | Base | Same |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This is the one athlete domain screen a nutritionist keeps in full.** Wellness
is self reported readiness, sleep, soreness, stress and mood. None of it is
medical information and none of it is withheld.

**A role that cannot reach this page sees a named refusal**, not a blank page or
a redirect: a screen headed Wellness saying "Not part of this role" and
explaining that an athlete's wellness detail is named performance data
(`src/components/AthleteDomainShell/AthleteDomainShell.tsx:14`). That is better
than a silent bounce, because the reader learns why.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `loadAthleteDomainContext()` at `src/app/(staff)/squad/[athleteId]/wellness/page.tsx:153`; a shared coach-or-medical check at `src/lib/athleteDomain.server.ts:93`, refused at `src/app/(staff)/squad/[athleteId]/wellness/page.tsx:154`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Wellness chip on the athlete's own profile.
- The squad overview, then the athlete, then the chip.
- A direct link with a period already chosen, for example from a report.

---

## 4. What you see

**A header** naming the athlete, with a breadcrumb back to Squad overview.

**A period selector** offering week, month, season, year and all. A period the
data cannot honestly cover is shown **disabled with its reason**, never hidden,
so the reader can tell the difference between a period that does not apply and
one that is missing.

**A summary card.** The headline read on this athlete's wellness for the chosen
period.

**The scales card.** The five self ratings, each over time, so a coach can see
which one is moving. This matters because a falling readiness caused by sleep is
a different conversation from one caused by soreness.

**A positional context card**, where the athlete's position is known, putting
their figures next to others in the same positional unit rather than the whole
squad.

Each chart carries the athlete's own normal range behind it.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-001 | Readiness | How ready the athlete says they feel, 0 to 100 | Daily, across the chosen period | Blank on a day with no check-in, never zero |
| MET-006 | The shaded band | This athlete's own normal range | 14 days, rolling | No band until 14 days exist, and the days before the window are deliberately fetched so the chart does not open with a bare stretch |
| MET-003 | Sleep hours | Hours slept, the athlete's own estimate | Daily | Blank. Optional on the form, so a day can have readiness and no sleep figure |
| MET-004 | Soreness | How sore, 1 to 5, where **5 is least sore** | Daily | Blank |

The other three scales, fatigue, stress and mood, follow the same rule as
soreness and are recorded as entered.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Period selector | Below the header | Changes the window for every chart | Stays here, period in the address | Nothing | Any staff who can reach the page | None | A period the data cannot express is **disabled with its reason shown**, never hidden |
| Squad overview breadcrumb | Header | Back to the roster | `/squad` | Nothing | Same | None | Never |
| Athlete name breadcrumb | Header | Back to the athlete | `/squad/[athleteId]` | Nothing | Same | None | Never |

**Nothing on this page writes anything.** Corrections to a wellness entry are
made on the athlete's profile, not here.

---

## 7. How this page is built, in plain English

Built on the server through a shared loader used by all three athlete domain
screens, so the permission check, the athlete lookup and the period handling are
written once rather than three times
(`src/lib/athleteDomain.server.ts:77`).

That loader also checks the shape of the athlete identifier **before** asking the
database anything. Without it, a malformed address reached the database and came
back as an unhandled error, which showed a coach a server fault on a URL that
simply does not name anybody.

The wellness read is deliberately bounded rather than paged, and the reason is
proved rather than assumed: the database allows at most one live wellness entry
per athlete per day, so two years of history plus a fourteen day lead-in is at
most 744 rows (`src/lib/queries/playerProfile.ts:130`).

Corrected entries are read from the live view, so a superseded entry never
appears.

---

## 8. States

**Loading.** Renders when ready.

**Empty.** An athlete with no check-ins shows the regions saying so. A brand new
athlete is the normal case here, not an edge case.

**Partial.** A period with some days missing draws those days as gaps, not as
zeroes, and the band thins rather than disappearing.

**Error.** Surfaces as an error.

**No permission.** The named refusal described in section 2.

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **This screen has no entry in the previous specification set.** It was built
  and never documented. This file is its first specification.
- **UNVERIFIED: whether the positional context card appears for an athlete
  whose position is not recorded.** Files searched:
  `src/app/(staff)/squad/[athleteId]/wellness/page.tsx`,
  `src/lib/queries/positionalContext.ts`.
