# 15. What a performance nutritionist actually wants

Written in the voice of the buyer: performance nutritionist, SENr registered, consulting to
the club **two days a week**. I also work with two other clubs. I am not on site most days, I
do not sit in the coaches meeting, and I find out about most changes to the week after they
have happened.

Companion to `14-sports-science-brief.md`. That one was written by somebody who is in the
building every day. I am not, and almost every requirement below follows from that.

---

## 0. The uncomfortable part, first

**You have decided athletes do not log food.** `CLAUDE.md` rule 8, O-11 resolved 5 August.
Guidance only, plus one weekly three-level check-in. Nobody asked me before that was decided,
so let me be plain about what it costs, and then tell you I probably still agree.

**What I lose, and there is no way to soften this:**

| Lost | What it means on a Tuesday |
|---|---|
| Individualised intake analysis | I cannot tell you what any single player eats. Not roughly. Not at all. |
| The energy availability question | "Is he actually eating enough" is the most important question I answer, and I now answer it by asking him. |
| Evidence for any intervention I make | I change a plan, something happens, and I cannot attribute it. There is no exposure variable. |
| Protein intake against lean mass | Named in the analytics presets. Gone, and `nutrition-guidance.md` §9 already says so. |
| The ability to defend my own work | When a Director of Rugby asks what I have delivered for my two days a week, I have opinions and no data. |

**What I keep**: targets, guidance, matchday plans, body composition, hydration proxies,
supplement declarations, catering numbers, one weekly ordinal. That is a real job. It is not
the job I would design.

**And I still land on accepting it.** I have watched daily food logging die at three clubs.
The pattern is identical: eighty per cent adherence in week one, forty by week four, under
fifteen by Christmas, and by February the only players still logging are the three who least
need to. That leaves a dataset biased towards the conscientious, which is worse than none
because it looks like evidence. Meanwhile the coach has spent his goodwill chasing food photos
instead of wellness forms, and wellness is the one I need submitted.

**So: agreed, with one condition, and this is the whole brief.** If intake is not logged then
**body composition is my primary outcome measure**, not a nice-to-have in a testing tab. It is
the one objective nutrition number I collect. Build it properly and the trade is fine. Build
it as three columns on a testing screen and the no-logging decision is not a trade, it is a
hole.

---

## 1. When I use it, and how much time I have

**Tuesday and Thursday, on site.** Tuesday is measurement and individual conversations,
Thursday is matchday and travel prep. The other five days I am at another club or at home, and
I will open Fydr on a phone for ten minutes at a time.

Three consequences you must design for:

1. **Publish once, reach everyone.** I cannot brief 45 players individually twice a week.
   Everything I set has to propagate without me being in the room.
2. **Tell me what changed while I was away.** On Tuesday morning I want the delta since last
   Tuesday, not the current state. Who has moved, who is new, what the week looks like now
   versus when I left.
3. **Somebody else has to act on my output.** The team manager books the hotel, the kitchen
   orders the food, the S&C staff run the sessions. A plan that only works when I am present
   does not work.

**On my account**: `01-roles-and-permissions.md` §6 puts multi-org users in Phase 3. I work at
three clubs. Three logins is survivable, but the part-time practitioner is the normal case in
nutrition, not an edge case. O-1006.

---

## 2. The squad target grid

**Athletes down, MD-n across.** This already exists as the staff web layout in
`nutrition-guidance.md` and it is right. It is where I spend most of Tuesday.

- **Set at group level, override at athlete level.** Front five get one carbohydrate
  prescription, back three another, then six individuals get their own. The resolution order,
  athlete then group then org default, is correct.
- **Show me which cells are inherited and which are explicit.** A grid where I cannot tell
  them apart is one I will not trust after four weeks of editing.
- **Show grams per kilogram beside absolute grams.** I prescribe in g/kg. 180 g of protein is a
  lot for a scrum half and thin for a tighthead. Store absolute, display both, compute against
  the most recent body mass, and show the date of that mass.
- **Bulk edit a column.** "Every forward, MD-1, carbohydrate up" is one action, not 24.
- **Effective dating I can see.** `nutrition_targets` has `effective_from` and `effective_to`.
  Surface them. Targets set in pre-season and never revisited are the normal failure.

**What the grid must not become**: 45 rows by 8 columns of raw numbers with no exception
marking. Shade cells not reviewed in twelve weeks. That is the only automatic flag I want here.

---

## 3. Body composition, now the centre of the product for me

Because intake is unlogged, this is my outcome measure. Specify it like one.

| Field | Why it is not optional |
|---|---|
| **Sum of skinfolds, mm** | The raw measure. This is what I track. |
| **Site count and site list**, 7 or 8 | Sum of 7 and sum of 8 are different numbers. One column with no site count makes the series meaningless. `body_composition.sum_skinfolds_mm` has no site count. That is a bug. |
| **Individual site values** | Triceps, subscapular, biceps, supraspinale, abdominal, front thigh, medial calf, plus iliac crest for the 8. One site moving tells me what the sum hides. |
| **Body mass, kg** | With time of day and fed or fasted state. Morning fasted is the standard and frequently not what happened. |
| **Method** | `skinfold`, `DEXA`, `BIA`. Already in the schema. |
| **Measurer, and ISAK level if known** | `recorded_by` exists. Surface it, do not just store it. |
| **Lean mass estimate, and the equation** | An estimate from skinfolds is not a measurement. Label it derived and name the equation. |

**1. Methods are not interchangeable and must never share a series.** DEXA and skinfolds
disagree by several percentage points in the same person on the same morning. A chart plotting
a DEXA point and a skinfold point on one line is fiction. Split by method, or refuse to plot a
mixed history and say why. Same argument doc 14 makes about pooling watch sleep with
self-reported sleep, and more severe here.

**2. Same practitioner where possible, and show me when it was not.** Inter-tester error on
skinfolds routinely exceeds the change I am looking for. If Tuesday's measurement was mine and
last month's was the S&C intern's, I need to see that before I interpret the difference.

**3. Never show body fat percentage as the headline.** It is derived from the sum through an
equation with wide limits of agreement, and athletes treat it as a fact about their body. Sum
of skinfolds and body mass are the primary display. Percentage is one click away, labelled as
an estimate. `[high, standard practice in professional sport]`

**4. A change is not a change until it clears measurement error.** Shade the non-meaningful
band behind the series. My working figures are roughly 5 mm on a sum of 7 and 2% of body mass.
`[medium, practical rather than derived. A club with its own technical error of measurement
should use that, which means the field must exist]`

---

## 4. The screen I want most: unintentional mass change against load

A forward who loses 2 kg during a heavy block is a problem. It is almost always energy
availability, almost never intentional, and nobody notices until he pulls a hamstring in week
six and everybody calls it bad luck. I am not on site enough to spot it by looking at him, and
he will not tell me, because losing weight feels like working hard.

One athlete, three series on a shared time axis:

```
Body mass, kg           ────────  his own points, method glyph on each
Weekly load             ▁▃▅▇▇▅▃▁  bars, sRPE or GPS total, whichever the club runs
Sum of skinfolds        ────────  second panel, same x axis, never the same y axis
```

Marked on it: measurement dates, match days, and any period he was unavailable. Two panels
stacked sharing an x axis, never two y axes on one panel, for the reason doc 14 gives.

**And a squad version, because that is how I will find them.** A ranked list on my Tuesday
screen of athletes whose mass has moved more than a threshold over a rolling window, **with
their load direction beside it**:

```
T. Okafor     -2.3 kg over 5 wk    load +18% over same window     prop
L. Marsh      -1.8 kg over 6 wk    load  +9%                      flanker
D. Ellis      +2.9 kg over 4 wk    load -40%   (unavailable 19 d)  lock
```

Mass down with load up is what I act on that day. Mass up with load down is the returning
injured player, §9, and a different conversation.

**Rank it, cap it at eight, and let me mark a row as intentional.** A player in a planned mass
gain block drops off the list until the block ends, otherwise I learn to ignore the list.
Intentional or unintentional is a property of his current plan and it needs a field. O-1009.

---

## 5. Matchday and travel fuelling

**Away trips are where nutrition falls apart.** Not through carelessness: the hotel serves
breakfast at 08:00, the coach leaves at 07:45, and no plan survives that.

A matchday plan is keyed to **kick-off**, not to clock time:

| Anchor | Content |
|---|---|
| KO minus 3 to 4 h | Pre-match meal, composition, portions by position group |
| KO minus 2 h | Fluid volume, and the stop point |
| KO minus 60 to 90 min | Top-up, and who takes what |
| Half time | What is on the bench, and who has a specific requirement |
| KO plus 30 min | Recovery, including players going straight onto a coach |
| Evening | The meal that determines Monday |

Kick-off moves for broadcast, sometimes late in the week. Authored against clock times, every
change is a manual rewrite of 45 athletes' guidance. Author against the anchor, render times
from `fixtures.kick_off`, and when kick-off moves every plan follows.

**What the team manager needs, and this part must exist.** He is not a Fydr power user. One
page, exportable, that he can act on or send to a hotel:

```
AWAY  v Bristol  Sat 14 Mar  KO 15:00        Travel Fri, hotel Bristol Marriott

  Fri 19:30  Evening meal      42 covers    see requirements below
  Sat 08:30  Breakfast         42 covers    open by 08:00, hot carbohydrate available
  Sat 11:00  Pre-match meal    23 covers    matchday 23 only
  Sat 17:15  Post-match        42 covers    coach departs 18:00, food travels

  REQUIREMENTS
    4  halal              2  vegetarian        1  no dairy
    1  coeliac            1  nut allergy, severe, see note
```

Counts, times, requirements. No macros, no meal ideas, no athlete detail beyond what the
kitchen must know. This page is the highest-value output of my role and it currently lives in
a WhatsApp message.

---

## 6. The supplement register, and treat it as a compliance object

**This is an anti-doping matter and it is the most serious thing in this document.** If a
player returns an adverse analytical finding, the first question the club is asked is "what was
he taking". A club that cannot answer that, with dates, has a serious problem, and so does the
player. At most clubs the answer today is somebody's memory and a photograph of a tub.

| Field | Notes |
|---|---|
| Athlete, dose, frequency, start and end date | An open-ended row is a live declaration. |
| Product name and manufacturer | Free text. Athletes buy things you have never heard of. |
| **Batch tested** | `Informed Sport`, `Informed Choice`, `other scheme`, `not tested`, `unknown`. Not a boolean. |
| Batch or lot number | The point of batch testing is the batch. A product name with no lot number evidences nothing. |
| Reason | Recovery, iron, vitamin D, whatever the athlete says. |
| **Who authorised it** | Named person and role, or `not authorised, athlete declared`. |
| Declared on | Timestamp, immutable. |

- **Immutable with revisions**, `CLAUDE.md` rule 6, and it matters more here than anywhere
  else. A register that can be quietly back-dated is worse than no register, because it looks
  like evidence and is not.
- **Fydr records what the athlete declares. It verifies nothing.** Say that in the interface,
  on the record, and in the terms.
- **Fydr is not an anti-doping compliance system.** Not a whereabouts tool, no TUE handling, no
  checking products against a prohibited list, and it must not imply that it does. Link out to
  Global DRO and the club's anti-doping lead. Do not build a lookup. Getting that wrong once,
  in either direction, ends somebody else's career.
- **Never name a branded product in club-authored guidance.** `nutrition-guidance.md` §10
  already says this and it stands.
- **Who sees it**: me, medical, and the club's anti-doping lead. Not the coach by default. A
  supplement list is health-adjacent and a coach does not need it to pick a team.
- **Prompt, do not chase.** An annual declaration at the start of the season, a reminder when a
  row's end date passes, and a route to add one at any time. Not a weekly nag.

---

## 7. Hydration

I have no direct intake measure, so I use proxies and I need them labelled as proxies.

**Pre and post session body mass change**, as a percentage of pre-session mass. More than 2%
lost is the conventional flag. It needs the same scales, minimal clothing and consistent
timing, and it is confounded by anything drunk during the session, which in rugby is a lot.
Record session fluid intake as one field if the club will collect it. If not, the number is
directional only and the screen should say so.

**Urine specific gravity, if the club measures it.** Morning first void, refractometer, 1.020
as the common threshold. Most clubs will not do this, so it is optional, off by default, and
absent from the interface when off. Do not put an empty USG column in front of a club that has
never owned a refractometer.

Pre and post mass are session-scoped, not daily, so they do not belong in `body_composition`,
which is `measured_on` a date. They need their own table keyed to `session_id`. O-1002.

---

## 8. Dietary restrictions, allergies and religious requirements

O-891 is open and should not be. This is a safety and inclusion requirement, not a
personalisation nicety, and it is the field the kitchen page in §5 reads from.

| Type | Consequence of getting it wrong |
|---|---|
| **Allergy** | Anaphylaxis. Record severity and whether the athlete carries adrenaline. Clinical, and medical staff own it. |
| **Intolerance** | Discomfort and a bad session. Not clinical. |
| **Religious requirement** | Halal, kosher, fasting observance. Non-negotiable and not a preference. |
| **Preference** | Vegetarian, vegan, dislikes. Accommodate, but rank below the three above when the kitchen can only do so much. |

### Ramadan

Ramadan falls during the season and will do for years. It is a recurring, planned piece of
work, not an edge case:

- Fasting players eat before dawn and after sunset. Suhoor and iftar times move daily.
- Training and fixture times do not move for them. Late-day sessions land at the worst point of
  the fasting day, and where staff can shift an individual's gym slot they will, so they need
  to know who to shift.
- Fluid, not energy, is usually the binding constraint.
- A daylight fixture in Ramadan needs an individual plan agreed weeks in advance, and some
  players will fast through it. That is their decision.

**What Fydr needs**: an observance field with a date range, a squad view of who is observing,
and somewhere to attach an individual plan. What Fydr must not do is decide anything on the
athlete's behalf, or surface observance to anybody who does not need it.

**Consent.** Allergies are health data. Religious belief is special category data under UK GDPR
in its own right, separately from health. Both need an explicit lawful basis, both should be
athlete-declared rather than staff-inferred, and both must reach the kitchen carrying the
requirement without the reason. The hotel needs to know "no pork". It does not need to know
why. O-1003.

---

## 9. Injured and returning players

**The group most likely to gain unwanted mass, and the group I see least.**

- Energy expenditure falls, sometimes by 30% or more with a lower limb injury and crutches.
- Protein requirement per kilogram goes **up**, not down, because the job is preserving lean
  mass during immobilisation.
- Appetite follows neither.
- Four weeks later he is 3 kg heavier, 2 kg of it is not muscle, and that lengthens his return
  and raises his re-injury risk.

**What I need on the day he is injured**: a notification that availability changed, his body
area and restriction, and his current targets flagged for review. Not the diagnosis.
`01-roles-and-permissions.md` §4 is right and I do not want it relaxed for me.

**On return to play**, the reverse: he is being re-loaded and his targets are still the
injured-player set. The screen in §4 catches this, which is why the squad list must show mass
up with load down as well as mass down with load up.

`nutrition-guidance.md` says medical-authored guidance replaces coach guidance for rehab
athletes. Fine, except I am neither coach nor medical in your role model. O-1005.

---

## 10. Academy and under-18 athletes

Under-18s are in scope, confirmed 5 August, `09-security-and-compliance.md` §4. That changes
what I will accept in the product.

- **They are growing.** A 17 year old who gains 4 kg has probably grown. Height is static on the
  athlete record and should not be. O-9 already asks whether it moves to `body_composition`.
  For academy athletes it must, or every derived index is wrong. Record height at every
  measurement session for under-19s.
- **RED-S risk is real here**, and it presents as stalled growth, poor recovery, frequent
  illness, bone stress injury and flat performance, not as anybody saying they are not eating.
- **Body image pressure is what I am most careful about.** A 16 year old back rower told he
  needs to add 6 kg, and a 16 year old winger who overhears the word "skinfolds", are both one
  careless interface away from a problem that outlasts their playing career.
- **Measuring a minor** is governed by the club's safeguarding policy: consent, chaperone,
  private space. Fydr does not enforce that, but it should record that consent exists and who
  gave it, and it should not make measuring a child feel like routine data entry.

**My rule for under-18s**: measure less often, display less, and never derive a body fat
percentage for display. Sum of skinfolds and mass against growth is the whole of it.

---

## 11. RED-S and disordered eating

Short section, and the most important one here.

Relative energy deficiency in sport is not rare, and rugby has weight-sensitive positions. A
tool that surfaces body composition to the wrong person, or ranks it, is a genuine safeguarding
risk, and not a theoretical one: a leaderboard of body fat percentage is a mechanism for
producing eating disorders in a squad.

**The rules. These are not preferences.**

1. **Body composition is never leaderboarded.** `leaderboards.md` already forces
   `leaderboard_eligible` false for `test_category = 'body_comp'` and blocks it at validation.
   That is correct. Do not add an override, not even an admin one.
2. **No athlete ever sees another athlete's body composition.** Not ranked, not as a named squad
   distribution, not as a percentile, not in an export.
3. **No comparison of one athlete's body composition to another's, anywhere.** Positional norms,
   if shown at all, are a shaded band, not a list of people.
4. **Coaching staff see a trend, not a number**, unless the club has a written, recorded policy
   saying otherwise. The coach's decision is whether a player is trending the wrong way for his
   position. He does not need the millimetres.
5. **The athlete always sees their own.** Withholding a player's own body composition is
   paternalistic, damages trust, and does not stop him weighing himself. He sees it, with
   context, with the error band, and without a target line unless one has been agreed with him.
6. **No streaks, goals, progress rings or encouragement copy on anything to do with body mass.**
   `nutrition-checkin.md` already gets this right by refusing to colour Yes green. Same reason.

If a coach asks for the leaderboard anyway the answer is no, and the product should make that
answer for me, so I do not have to make it every season at every club.

---

## 12. The weekly check-in, and how weak it is

I read `nutrition-checkin.md`. The design is careful and I have no complaint about the
execution. My complaint is what it can carry: one question, once a week, three levels,
self-reported, about protein.

| What I wanted to know | Does it answer it |
|---|---|
| Is he eating enough energy | No. Protein is the question, energy availability is the risk. |
| Is he eating enough on the right days | No. Weekly grain, and the point of MD-n targets is that days differ. |
| Did the intervention work | Barely. Three levels, weekly, 45 athletes, unknown coverage. |
| Is anything going wrong | Sometimes. A player moving from Yes to No for three weeks is worth a phone call. |

**What I actually use it for**: a prompt list. Show me the athletes whose answer has moved down
two weeks running and I will ring them on Wednesday when I am not on site. That does not
require the variable to be better than it is.

**What I want instead, when you are ready**: option 3 from `nutrition-guidance.md` §9. A
three-day weighed intake record, twice a season, run as a testing session with the squad in a
room. It produces better data in two weekends than a year of half-hearted daily logs, and it
is a calendar event rather than a habit to sustain. Keeping `nutrition_entries` dormant rather
than dropping it is right for exactly this reason. O-1000.

---

## 13. Catering and kitchen numbers

Unglamorous, and half my administrative load. The kitchen needs a number by Thursday for
Friday, and it depends on who is in the 23, who is travelling, and who has a requirement.

```
MD-1 MEAL   Fri 13 Mar 19:30   Squad + staff

  Covers            42     ( 23 matchday squad, 8 non-travelling, 11 staff )
  High carbohydrate 23     matchday 23 only
  Standard          19
  Halal              4     Vegetarian  2     Gluten free  1
  Nut allergy        1     SEVERE, see athlete note
```

It is a count query over team allocation joined to dietary requirements. What makes it
non-trivial is that the 23 changes on Thursday night and the kitchen ordered on Wednesday, so
the export needs a timestamp and a diff against the previous version. Send the change, not a
new list: a kitchen given a second full list will cook from the wrong one.

---

## 14. What I do not want, and I will judge the product on these

- **A calorie counting interface.** Any of it. Rings, budgets, calories remaining today.
- **A food database.** Not licensed, not built, not scraped. It is the front door to logging, it
  is an ongoing content liability, and the moment it exists somebody asks why athletes cannot
  search it.
- **Gamified eating.** No streaks, no badges, no nudges implying a moral quality to a meal.
- **Body fat percentage on a leaderboard.** §11. The fastest way to make me tell other clubs
  not to buy this.
- **Any comparison of one athlete's body composition to another's**, including a well-meant
  "squad average skinfolds" tile.
- **Photographs of meals.** `nutrition_entries.photo_url` exists in the dormant table. If option
  3 is ever built, leave it out. Food photographs invite judgement and analyse to nothing.
- **Progress photographs of athletes.** Never. Not optional, not opt-in, not for academy.
- **An AI meal suggestion feature.** I will be asked for one. The answer is no: liability for a
  suggestion containing an allergen sits with whoever generated it.

---

## 15. Visual rules

Consistent with `14-sports-science-brief.md` §6, plus what is specific to this domain.

| Do | Do not |
|---|---|
| Sum of skinfolds and mass as the primary numbers | Body fat percentage as the headline |
| Method as a glyph on every body composition point | One continuous line across mixed methods |
| Measurement error band shaded behind the series | A trend line through three points |
| Two stacked panels sharing an x axis for mass and load | Two y axes on one panel |
| g/kg beside absolute grams, with the mass date | Absolute grams alone |
| Requirement counts as a plain table for the kitchen | A chart of dietary requirements |
| Neutral typography on every body-related number | Green for down, red for up, on body mass |
| "Estimated" on every derived value, on the chart | The estimate presented as a measurement |
| Blank where a measurement was not taken | Interpolation between measurement dates |
| Allergy severity always adjacent to the allergen | An allergen in a list of preferences |

**Colour.** Body mass and body composition series use the neutral sequential ramp from doc 14
§6, never `--good` and `--bad`. There is no good direction for body mass. A forward gaining 2 kg
and a winger gaining 2 kg are opposite events and the interface must not editorialise.

---

## 16. Open questions

| ID | Question |
|---|---|
| **O-1000** | Is option 3, the twice-yearly weighed intake audit, ever in scope? It is the only route back to a real intake variable and it does not reintroduce daily logging. My view: commission it for a later phase and say so now, so `nutrition_entries` has a stated future rather than being dormant indefinitely. |
| **O-1001** | `body_composition` has no site count, no individual site values, no equation reference and no measurement time. Sum of 7 and sum of 8 in one column is silent data corruption. Does the schema change now, or does the first club's data get imported wrong and stay wrong? |
| **O-1002** | Pre and post session mass is session-scoped and does not fit `body_composition`. A new table keyed to `session_id`, or a generic session-metric table? The generic one probably serves more cases. |
| **O-1003** | Dietary restrictions, allergies and religious observance. O-891 asks whether to model them; I am saying they must be. Allergy severity is clinical, religious belief is special category data in its own right, and the kitchen export must carry the requirement without the reason. Where does the field live, and who owns it, medical or me? |
| **O-1004** | Supplement register in v1 or Phase 2? My view is v1: a club with a positive test and no register has a problem the product could have prevented for two weeks of work. It also needs a visibility rule that none of the four existing roles gives cleanly. |
| **O-1005** | There is no nutritionist role. I am not a coach, not medical, not an admin. I need to author targets and guidance, record body composition, and see availability, with no business setting thresholds or editing gym programmes. Fifth role, permission bundle on coach, or do I log in as a coach and everybody accepts the over-grant? |
| **O-1006** | `01-roles-and-permissions.md` §6 puts multi-organisation users in Phase 3. Part-time practitioners across several clubs are the normal staffing model in nutrition and physiotherapy. Is three separate logins acceptable at launch, or does this move? |
| **O-1007** | What is the meaningful-change threshold for skinfolds and for body mass, and is it per organisation or per practitioner? I have used 5 mm and 2%. A club computing its own technical error of measurement should use that, which means the field must exist. |
| **O-1008** | Does a coach see body composition as a trend only, per §11 rule 4, or as numbers where the club has a written policy? If the latter, where is that policy recorded and who can change it? An admin toggle with no policy attached is not a control. |
| **O-1009** | Intentional mass change needs a field on the athlete's current plan and there is not one. Without it the mass-change list fills with players who are deliberately gaining and I stop reading it. |
| **O-1010** | Ramadan observance: athlete-declared with a date range, or a club-managed group? Athlete-declared is more respectful and less reliable. My view is athlete-declared with a staff view, and no automatic inference from anything, ever. |
