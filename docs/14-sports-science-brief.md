# 14. What a Head of Sports Science actually wants

Written in the voice of the buyer: head of sports science at a professional rugby union
club, 45 player squad, two S&C staff, a physio, a part-time analyst, Catapult units.

This document exists because "make it visually appealing" is the wrong brief, and following
it will lose the sale.

---

## 0. Read this before designing anything

**I have been sold pretty software before.** Every vendor deck has a dark-mode dashboard
with glowing rings and a hero number. I have bought two of them and stopped using both
within a season. What killed them was never the aesthetics.

**What I actually buy:**

1. **Can I answer the question in front of the coach in under ten seconds?** The Director of
   Rugby asks "who have we got today" at 08:30. If I am scrolling, I have lost.
2. **Do I trust the number?** If I cannot see where it came from, whether it is normal for
   that player, and how many observations it rests on, I will not put my name to it.
3. **Does it survive a bad week?** Signal, no GPS file, a player who did not fill it in.

Beautiful and untrusted is worth nothing. **The visual job is not decoration. It is to make
the important thing unmissable and the uncertain thing visibly uncertain.**

**What makes software look credible in a professional environment**, and this genuinely is
about looks: density, monospaced numerals, restraint, and no decoration. Consumer-friendly
styling reads as "not built for us". Every extra colour, rounded illustration and encouraging
message moves you further from a first-team environment. Your existing training report
screenshot is closer to right than most products I have been shown. Do not soften it.

**Two things I will notice immediately and judge you on:**

- **Averages.** A squad average hides the two players who matter. If your dashboard leads
  with a squad mean, I know you have not worked in a club.
- **A number without its reference.** Sleep 6.2 hours means nothing. Sleep 6.2 against his
  own 7.9 mean means everything. Every metric needs the athlete's own baseline beside it.

---

## 1. Dashboard

**When I use it**: 07:45, on a laptop, coffee in hand. Wellness closes at 08:00. Coaches
meeting at 08:30. I have about ninety seconds on this screen and I will not scroll.

**What I need it to answer**: who have we got, who do I need to look at, and what is the plan
today.

### The order, and it is not negotiable

**1. Availability strip, at the very top. Not a chart.**

```
AVAILABLE 31    MODIFIED 4    UNAVAILABLE 7    UNKNOWN 3
```

Then, directly underneath, **the eleven who are not fully available, by name**, with what
they cannot do:

```
MODIFIED    L. Fox          no contact                  RTP day 9 of 14
            A. Grant        upper body only             RTP day 3 of 21
UNAVAILABLE J. Barnes       calf                        est. return 12 Aug
```

I cannot walk into a meeting with "7 unavailable". I need names and restrictions, because the
next question is always "so can he do the team run".

**Unknown is a real state and it must be shown.** Three players who have not submitted are
not three available players.

**2. Attention list. Maximum five. Ranked.**

Not "flags". Each row is a sentence I could read aloud:

```
J. Barnes    sleep 5.2 h        his 28d mean 7.9 h      4th night down
M. Chapman   ACWR 1.62          his 28d norm 0.95-1.20  2 sessions above
H. Ross      soreness 2/5       posterior thigh          new today
```

Player, what changed, the value, **their own normal**, and how long it has been going on.
Duration is what turns a number into a decision. One bad night is noise, four is a
conversation.

Five is the cap because I will act on three. A list of fifteen is a list of zero.

**3. Today at a glance.**

Sessions with planned duration and planned sRPE load, plus how many players are already
carrying an elevated acute:chronic ratio going into it. That last number is what changes
whether I say something in the meeting.

**4. Compliance. One number.**

This week, as a percentage, with a direction arrow and last week beside it. Not four rings.
I do not need a per-domain breakdown on a screen I read in ninety seconds. Put that a click
away.

### What I do not want on this screen

- A hero "total distance this week" number. It is a vanity metric and it changes nothing.
- Any squad average as a headline.
- My name in 30px, a greeting, or the date rendered decoratively.
- A leaderboard. That is a player-facing toy, not a staff decision surface.
- Pie or donut charts. Anywhere. Ever.
- Sparklines under 20px tall. If it is too small to read, it is decoration.

---

## 2. Player profile

**When I use it**: a flag has fired and I clicked through, or it is Thursday and we are
picking a team.

**Header band**, one line, always visible when scrolling:

```
JAMES BARNES   Hooker · 24 · 1st XV      [ MODIFIED ]  no contact
Last match 6 days ago   ·   RTP day 9 of 14   ·   3 flags open
```

Availability as a pill with a glyph, never colour alone. Days since last match matters more
than people think: it is the first thing I check for a second-match-in-a-week decision.

### Four blocks, stacked, in this order

**Block 1: Load. This is the chart I look at first, every single time.**

- Daily sRPE load as thin bars along the bottom
- 7 day acute and 28 day chronic as two lines, **EWMA not rolling average**
- The acute:chronic ratio as the readable series, with **his own** normal band shaded behind
  it, not a generic 0.8 to 1.3 box
- Match days marked with a vertical rule

One axis. If you put load and ratio on two y-axes I will stop trusting the whole product,
because it means somebody chose a chart that invents relationships.

**On ACWR specifically**: I want it, and I want you to know it is contested. The original
work has been challenged on statistical grounds and the ratio is sensitive to how you compute
it. Compute it EWMA, state the window, and let the interface say it is one input among
several. **A product that presents ACWR as settled science tells me the builder has not read
the literature**, and that is the fastest way to lose a sports scientist.

**Block 2: Wellness. Not raw dots.**

His rolling mean as a line, a ±1SD band, and each day's value as a marker. Days outside the
band marked with a glyph. Five sub-metrics available but collapsed by default: sleep hours,
sleep quality, fatigue, soreness, stress, mood.

The question is never "what did he score". It is "is this normal for him". Raw 1 to 5 dots
cannot answer that and every product that ships them has missed the point.

**Block 3: Prescribed versus completed.**

Recent sessions, with what was prescribed and what was actually done. If he was given five
sets and did three, I need to see it without opening the session. Attendance status alongside.

This is the block that catches the athlete who is quietly not doing the programme, which is a
different problem from the athlete who is fatigued, and they look identical in load data
alone.

**Block 4: Injury and availability history.**

Body area, days lost, and recurrence, as a compact timeline across the season. Before
selection I want "hamstring, twice this season, 34 days lost" available at a glance.

**As a coach I do not need the diagnosis and I should not be shown it.** Body area,
availability and restrictions only. If your product shows me a physio's clinical notes I will
have a problem with my physio, not with you, and I do not want that problem.

**Testing panel**, off to the side: CMJ height, 10m, 30m, and key 1RMs, each as a percentage
of that athlete's best with the date of the best. Asymmetry percentage where the test is
bilateral. A number in isolation is useless; a number as a percentage of his own best is a
decision.

---

## 3. Analytics

**When I use it**: Monday morning, or when the Director of Rugby asks a question I cannot
answer from memory.

**Do not put a drag-and-drop builder as the front door.** I have used those. I use them
twice, build something wrong, and never come back. Lead with presets that answer the
questions I actually ask, and put the builder behind them for when I want something specific.

### The four questions I actually ask

1. **Who is drifting from their own baseline?** A multi-metric comparison against each
   athlete's own 28 day norm, ranked. This is the single most useful analytical output in a
   monitoring system and almost nobody ships it.
2. **Does our week match the plan?** Planned versus actual load by MD-n, across the squad.
   This is how I find out that MD-3 has quietly become the hardest day of the week.
3. **What was the load pattern in the two to four weeks before each soft-tissue injury?**
   Not a causal claim. A pattern I can look at.
4. **Who is detraining?** Testing decline and load decline together. Usually a returning
   player nobody has re-loaded.

### Non-negotiables

- **Sample size and window on every output.** Not in a tooltip. On the chart.
- **Refuse, do not caveat.** Below the minimum n, show me the refusal, not a faint chart with
  a warning. A weak chart gets screenshotted into a coaches meeting and becomes fact.
- **Provenance visible.** Self-reported, device, or file import. Sleep from a wellness form
  and sleep from a watch are not the same measurement and must not be silently pooled.
- **Let me export the rows behind any chart.** If I cannot check your arithmetic I will not
  present your output to a Director of Rugby. This single feature buys more trust than any
  amount of design.
- **Small multiples for positional comparison**, not six lines on one chart. Front row and
  back three do not belong on the same axis, and six coloured lines is unreadable regardless
  of palette.

---

## 4. GPS import and export

**The reality you are designing for**: after every pitch session my analyst exports from
Catapult. Thirty to forty rows, forty-plus columns, and the player names come through as
`BARNES, James` or `J Barnes` or sometimes a unit number. The file is different after a
software update. This happens four times a week and it must take under two minutes.

### Import

**Drag the file in. Then show me only the exceptions.**

```
catapult_20260805_MD-2.csv      Catapult · 38 rows · session matched: Tue 5 Aug, Training

  ✓ 34 ready
  ⚠ 3 unmatched players            [ resolve ]
  ⚠ 1 duplicate, already imported  [ review ]
```

I do not want to see the 34 that worked. I want the 4 that did not, and a way to fix them in
the same screen.

**Name matching**: fuzzy match, but show me the confidence and let me confirm. Once I confirm
`BARNES, James` is James Barnes, remember it forever. I should resolve each name once per
career, not once per file.

**Units are where wrong data enters a system.** Metres versus kilometres, m/s versus km/h.
Detect it, tell me what you detected, and let me override. A silent unit error produces a
number that is wrong by a factor of 3.6 and looks completely plausible, and it will end up in
a report to the board.

**Never silently drop a row.** Accept the good ones, list the bad ones with the reason, and
let me fix and re-run. A partial import that does not tell me it was partial is worse than a
failed one.

**Let me undo a whole import.** I will get the session wrong at some point.

### Export

Two different jobs, and do not make me choose between them:

- **The Director of Rugby wants one page.** PDF, squad summary, our badge on it, the four
  numbers that matter. He will not open a spreadsheet.
- **The analyst wants everything.** CSV, every column, every row, no rounding, no formatting.
  Rounding an export is a real thing products do and it makes the file useless.

---

## 5. Training report

This is the screen I put on a projector in front of coaches, which makes it the most
important screen you have. Your existing version is close.

### Structure

Rows grouped by positional unit, in this order, because it is the order a rugby coach thinks
in: **Front row, Second row, Back row, Half backs, Centres, Back three.**

Columns:

| Column | Meaning | Notes |
|---|---|---|
| **TD** | Total distance, m | |
| **HSR** | High speed running, m | Above 5.5 m/s for rugby union. Make the threshold configurable, clubs disagree. |
| **Sprint** | Sprint distance, m | Above 7.0 m/s |
| **HIE** | High intensity efforts | Accels and decels above 2.5 m/s². Configurable. |
| **MAX V** | Maximum velocity, m/s | Display in km/h if the club prefers, store in m/s |
| **% MAX** | Percentage of **that athlete's** maximum | See below. This is the important one. |
| **sRPE** | Session RPE load | Internal load, next to the external. |

### The two things that decide whether this screen is any good

**1. Percentage of his own maximum, never the squad maximum.**

A prop hitting 85% of his own top speed has worked hard. 85% of the squad maximum, which
belongs to a winger, is meaningless and makes every forward look lazy for their whole career.
Individual maximum, rolling over a sensible window, is the only version of this metric worth
showing.

**2. Shade against his own normal for that session type, not against the squad.**

Squad-relative shading tells me a front rower is "low" in every single session. That is not
information, it is anatomy. Shade each cell against that player's own distribution for that
session type, so a dark cell means "unusual for him" rather than "he is a forward".

If you only take one thing from this document, take this one. It is the difference between a
report a coach reads and a report a coach nods at once and never opens again.

### And the comparison that actually matters

**Same MD-n, week on week.** Not yesterday, not the squad mean. "This Tuesday MD-2 versus
last Tuesday MD-2" is the comparison that tells me whether the week is drifting. Put last
week's value as a faint reference behind or beside each cell.

### Session header

Squad size, average TD, total HSR, and how many players are flagged. Four numbers, mono, no
decoration. That is what your screenshot already does and it is right.

---

## 6. Visual rules, since you asked about appearance

These make it look like professional sport software rather than a consumer fitness app.

| Do | Do not |
|---|---|
| Tabular monospaced numerals everywhere | Proportional figures in a numeric column |
| Dense tables, tight row height | Cards with one number and a lot of white space |
| One accent colour, used sparingly | Six colours because six things exist |
| Status as colour **plus** a glyph | Colour alone, ever |
| Units on the column header, not every cell | `5,969 m` repeated forty times |
| Hairline rules, one shade off the surface | Heavy borders, dashed gridlines |
| Sequential shading for magnitude, one hue | A rainbow heat map |
| Small multiples per unit | Six lines on one chart |
| Empty states that say what is missing and why | Illustrations of people doing yoga |
| Blank where there is no data | 0 where there is no data. These are different and confusing them is a serious bug. |

### Validated chart palettes

Computed and checked against colour vision deficiency, not chosen by eye. `--good`, `--warn`
and `--bad` from `06-design-system.md` are **status colours and are never series colours**.

**Categorical, light theme, five slots, assigned in fixed order and never cycled:**

```
1  #1f6fea   2  #d97706   3  #0d9668   4  #a21caf   5  #c2265b
```

Passes lightness band, chroma floor, normal-vision separation and 3:1 contrast. Slots 2 and 3
sit at ΔE 7.8 under protanopia, which is in the floor band, so **series must be directly
labelled**, not identified by legend alone. Five is the ceiling: a sixth slot cannot be added
without failing. Six positional units therefore use **small multiples**, not six colours.

**Sequential, light theme, five steps, for heat maps and magnitude:**

```
#8fb2e4  →  #6a92d5  →  #4674c2  →  #2a55a4  →  #173a75
```

Monotone lightness, one hue, light end clears the surface at 2.12:1.

**Dark theme is not a flip of these.** It needs its own steps validated against `--surf`
`#171e36`. Not yet derived. O-990.

---

## 7. What would make me switch from a spreadsheet

Bluntly, because you should know what you are competing with. It is not Catapult or
Smartabase. It is Excel, and Excel is free, flexible, and already trusted.

You beat it on exactly four things:

1. **Athletes entering their own data**, so I stop chasing wellness forms.
2. **The join**, so I can see load next to wellness next to availability without three
   lookups.
3. **The exception list**, so I stop reading forty rows to find three problems.
4. **It is there on Monday when I am not.** A spreadsheet lives on one laptop.

Everything else in the product is table stakes. If those four are not obviously better than
my spreadsheet in the first week, I will drift back, and you will never know because I will
be too polite to tell you.

---

## 8. Open questions

| ID | Question |
|---|---|
| **O-990** | Dark theme chart palettes need deriving and validating against `--surf` `#171e36`. The light set is done. |
| **O-991** | HSR and sprint thresholds: 5.5 and 7.0 m/s are rugby union conventions and clubs disagree. Per-organisation configurable, per-position, or fixed? Configurable is right and it means every historical figure must record the threshold it was computed under. |
| **O-992** | Individual maximum velocity: rolling window, season best, or career best? Rolling 12 months is my view, because a 34 year old prop's career best is not a fair reference. |
| **O-993** | Does the heat map shade against the athlete's own distribution for that session type, which is what I have specified, or squad-relative, which is simpler and what `training-report.md` currently says? Mine costs more compute and is the reason a coach would use the screen twice. |
| **O-994** | Does the club want maximum velocity in m/s or km/h? Store m/s, display either, per organisation. |
