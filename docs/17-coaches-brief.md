# 17. What a Head Coach actually wants

Written in the voice of the buyer: head coach at a professional rugby union club, 45 player
squad, three coaches under me, a head of sports science, a physio. Twenty years in the game.
Secondary readers: the Director of Rugby, who signs the cheque, and my forwards and backs
coaches, who will use this more than I do.

This document is the counterweight to `14-sports-science-brief.md`. That document was written
by a man who likes numbers. I do not dislike him. I do not want his screens.

---

## 0. Read this before designing anything

> I do not want data. I want answers. Every one of these systems has been sold to my club by
> someone who loves the numbers, and every one of them has given me a screen full of charts I
> do not read. The head of sports science can have the charts. What I need is one screen that
> tells me who I can pick.

That is the brief. Everything below is detail on it.

Understand what I am and am not. I am not anti-data. I have left a player out of a final on a
physio's word. What I am against is software that tells me what to do and then goes home. I
stand in front of that squad on Monday. Your product does not. That asymmetry is why coaches
switch these things off, and accuracy does not fix it.

Three things about how I work. **I decide in meetings, not at a desk**, four of us round a
table with people talking over each other. **I ask the same question every week**, who can I
pick, and every other question I have is a version of it. **I will use it or I will not**,
there is no middle: if it takes two clicks I will ask the head of sports science instead, and
you have lost the account without anyone cancelling.

---

## 1. The selection screen

This is the whole product for me. If you build this and nothing else, I will use it.

The squad, grouped by positional unit, in this order, because it is the order I think in:
**Front row, Second row, Back row, Half backs, Centres, Back three.** Three states, in plain
English.

```
FRONT ROW
  E. Marsh        1    Available
  R. Doherty      2    Limited      no contact              from Fri 8 Aug
  L. Haruna       1    Out          calf                    back 15 Aug
SECOND ROW
  T. Reeve        4    Out          ankle                   back 22 Aug
  D. Owusu        5    Available
  C. Whelan       5    Limited      protocol, stage 3 of 6  reassessed Thu
```

- **Available.** He can do everything. No qualifier, no shading, no asterisk.
- **Limited.** And immediately, in words, **what the limit is**. "No contact". "No sprinting".
  "Upper body only". A limit I have to click to read is not a limit, it is a puzzle.
- **Out.** And **until when**. A date. If the date is not known, say "date not set". Do not show
  me a blank and do not show me a guess dressed as a date.

**Thirty seconds.** That is the test. Scan the squad before the meeting starts and know my
problem positions. If I have to scroll twice, expand a section, or read a legend, you have
failed it. The exhaustive version is `screens/squad-status.md` and the availability board is
`screens/injury-dashboard.md`. This is the thirty second version.

**No chart. No score. No percentage.** A state, a restriction, a date.

Two extra columns I will accept, because they change selections: **days since last match**, the
first thing I check for a second game in a week, and **position cover**, which is how I pick a
bench. If somebody asks for a ninth column, say no.

---

## 2. On readiness scores

I was shown a product that gave every player a number out of 100. It was the most confidently
wrong thing I have seen in twenty years. It told me a player was an 82 on a day I could see
with my own eyes he was flat. He trained badly. He was an 82.

**Do not put a single composite score next to a player's name.** Not on the selection screen,
not on a squad list, not in a tooltip.

There are only two things I can do with that number, and both are bad. **I ignore it**, in
which case it is noise on the screen I read most, and it teaches me the rest of the product is
noise too. Or **I start picking by it**, which is the one that frightens me: it is a number, it
is easy, and under pressure people reach for easy. A coach drops a player because software said
61 and cannot explain to that player why. I have watched an assistant do exactly that with
another system and I had to unpick it. There is no third outcome.

If the head of sports science wants a composite on his own screen, that is his business and his
judgement. `11-open-questions.md` carries O-10 on readiness weighting and O-430 on whether the
athlete sees their own. My answer for the coach surface is simpler: not here, at any weighting.

What I will accept instead is a **sentence**. "Third night of poor sleep." "Above his usual
load two sessions running." Something I can read out loud, that names what changed. Sentences
start a conversation with the player. Numbers replace it.

---

## 3. The training week

The second screen I want. Not a plan, a comparison. Three things, in this order: **what is
planned**, the week by MD-n from `screens/md-planner.md` and `screens/schedule.md`; **what
actually happened**, the same week filled in; and **whether yesterday was harder than we said
it would be**.

The third is what I will open it for, and it is the one nobody builds. Put it in words at the
top:

```
Tuesday MD-4      planned hard        ran harder than planned
Wednesday MD-3    planned moderate    as planned
```

I want it because I am usually the man who made it harder. We plan a forty minute unit block,
the scrum is going badly, I keep them out for an hour. Nobody logs that. On Friday somebody is
tired and everyone is surprised. Tell me on Wednesday that Tuesday overran and I fix Thursday.

Not a percentage of planned load. Harder, as planned, or easier. Detail behind a click, which I
will usually not use.

---

## 4. Availability trend, and attendance

One number, weekly. Are we getting more available or less.

```
AVAILABLE THIS WEEK   34 of 45        last week 31        4 week trend  up
```

That is the number I report to the board, and I am asked it every month. Today I get it by
asking the physio to count off a whiteboard. Put the season line behind it if you like, small.
No body area breakdown, no days lost by mechanism, and do not call it a KPI. It is a count of
men I can pick.

### Attendance, on the same screen

Attendance is not a science question and I do not want it filed with the science. It is a
selection question and a standards question, and standards are mine. If a player has missed two
gym sessions this week I want to know before I pick him, and before he tells me he has been in
every day.

```
K. Reilly     9    attended 4 of 6 this week      missed Mon gym, Wed gym
```

No commentary, no "compliance risk", no red badge implying a judgement I have not made. There
may be a very good reason and I may already know it. Show me the fact and let me decide.

---

## 5. Fixtures and turnaround

This drives more of my selection than anything a wellness form has ever produced. Two
questions, both about the calendar: **who has played two matches in seven days**, and **who is
on a short turnaround** into this weekend.

`screens/team-allocation.md` already computes days since last match and raises a
`short_turnaround` warning below six days, which is O-805. Six is a sensible default and the
club should be able to set it. Give me names, not a warning icon on a board I have to hover
over. I have never once been helped by "3 warnings".

```
SHORT TURNAROUND INTO SAT 9 AUG
  W. Trent      3 days since last match       second match in 7 days
  S. Okoye      5 days since last match
```

---

## 6. The night before a game, on my phone

I named the team on Thursday. It is Friday night and I am at home. **Tell me one thing: has
anything changed since I picked the team.**

```
FYDR
Since you named the team: 1 change
R. Doherty is now unavailable.
```

If nothing has changed, tell me nothing. Silence is the correct output and most nights it is
the true one. No nightly summary, no "ready for tomorrow" card, no completion rate. This is the
feature most likely to make me open the app voluntarily, because it is the thing I lie awake
about.

---

## 7. Tone: suggest, never instruct

This is not a preference. It is the line between a product I keep and a product I kill.

| Write this | Never this |
|---|---|
| "Three players are above their usual load." | "Do not select these players." |
| "R. Doherty has played twice in seven days." | "R. Doherty is not recommended." |
| "Fourth night of short sleep for J. Barnes." | "J. Barnes is at risk." |
| "No specialist hooker in this team." | "This selection is invalid." |

The left column tells me something I did not know. The right column tells me my job. I have
done my job for twenty years and the software has done it for four months.

It will not kill you on day one, because on day one I ignore it. On day forty I pick a player
the product advised against, he plays well, and an assistant makes a joke about it. On day
sixty he gets injured and someone says the app told us. Now the product is in the room during a
selection argument, it is not on my side, and it does not have to live with the outcome. **I
will switch it off, and I will be the one who does it.** Not the Director of Rugby, not the
analyst. Me.

The head of sports science may set thresholds and get flags. That is his surface. On mine, the
product observes and I decide.

---

## 8. The medical boundary, from my side

Everyone writes this rule from the physio's side. Here it is from mine.

**I do not want a diagnosis and I should not have one.** I want to know what he can do and when
he is back. That is the whole of my interest.

`01-roles-and-permissions.md` §4 already says coaches see availability and never clinical
detail. Keep it, and understand I am not tolerating that rule, I am asking for it. If your
product shows me clinical detail it creates a problem between me and my physio, and **I will
side with my physio.** She has to tell me things I do not want to hear, and that only works if
what she writes down stays hers. Leaking grade or tissue type into my view costs me more than
it gives me.

One exception, and in rugby it is not a small one. **The return to play protocol.** If a player
is in the graduated return to play protocol I need to know, and I need the stage, because it
decides what he does on which day and whether he is available Saturday at all. "Head injury,
cannot train" is not something I can plan a week around. §4 raises this as **O-995** with three
routes. Take route 1: **"protocol, stage 3 of 6"** as a restriction, with the date of the next
assessment. Not the word, not the mechanism, not who signed it off. The stage and the date.
Every club in the country already works this way verbally. You are writing down what the physio
already tells me in the corridor.

---

## 9. What I do not want

- **Charts on my home screen.** Not one. They live behind a click, on the sports science
  surface, where they belong.
- **Jargon.** Acute to chronic ratio, z-score, EWMA, sRPE. These mean nothing to me, and they
  tell me the screen was not built for me, so I stop reading. If a term needs a glossary it does
  not go on a coach screen.
- **Notifications that are not about a player becoming unavailable.** One category. Anything
  more is a reason to turn push off entirely, and then I miss the one that mattered.
- **Being asked to enter anything.** Not session RPE, not a comment, not a rating. A screen
  whose first action is an input field is a screen I close.
- **Any screen that needs training to read.** I get shown once, in pre-season, and never again.
- **A squad average as a headline.** Averages hide the two men who decide my week.
- **Anything with the word "insight" on it.**

---

## 10. Who you are actually selling to

Worth being honest about, because it explains why this document contradicts document 14.

| Person | What they do | What "useful" means |
|---|---|---|
| **Head of sports science** | Usually recommends the purchase. Runs the trial, writes the comparison. | Depth, provenance, exportable rows, the ability to defend a number. |
| **Director of Rugby** | Signs it off. Sees the invoice and the renewal. | One page he can take to the board. Availability, days lost, cost. |
| **Head coach** | Uses it or does not. Cannot buy it. **Can kill it.** | One screen that tells him who he can pick. |

Three definitions of useful, and only one of us can veto by doing nothing. Do not resolve it by
building the average of the three. Build three surfaces off one set of facts. The failure I
have watched twice is a product that pleases the sports scientist at purchase and the coach at
no point afterwards. It renews once out of politeness, then it does not.

---

## 11. Visual rules, for my screens specifically

The rules in `14-sports-science-brief.md` §6 hold. These are the extra ones for coach surfaces.

| Do | Do not |
|---|---|
| Words for status: Available, Limited, Out | A traffic light with no label |
| The restriction spelled out in full on the row | A code, an abbreviation, or an icon I must learn |
| A date for return | "TBC", a percentage, or a probability |
| Positional unit as the grouping, always | Alphabetical, or sorted by a metric |
| Squad numbers next to names | Player IDs, initials only, or photographs |
| One screen, no scroll, at squad size | Tabs, accordions, or a "show more" |
| Plain sentences for anything unusual | A badge whose meaning is in a legend |
| Silence when there is nothing to say | An empty state that congratulates me |
| Print to one sheet of A4, readable at arm's length | A layout that only works on a laptop |
| Blank where there is no data | 0, or an assumed value, where there is no data |

**On colour.** Sparingly, never alone. Half my staff read this printed and pinned to a wall in
bad light, and one of my assistants is colour blind. `screens/injury-dashboard.md` already
specifies glyphs distinguishable by fill in greyscale. Do the same here.

**On density.** Denser than you think. White space reads as a product for a gym, not a club. My
squad is 45 men and I want them on one page.

---

## 12. Open questions

| ID | Question |
|---|---|
| **O-1040** | Does the selection screen live as its own route, or is it a mode of `screens/squad-status.md`? My view is its own route, reachable in one tap from the tab bar, because a screen I use before every selection meeting should not be a filter state on a compliance screen. It duplicates data, not code. |
| **O-1041** | Who owns "position cover"? It is a coaching judgement, not a record. Does a coach set it per athlete, is it inferred from where he has actually played this season, or both? Inferred alone is wrong: my third choice hooker has never played there in a match and I still know he can. |
| **O-1042** | The "harder than planned" comparison needs a source. Planned RPE from `md-planner.md` against actual session RPE is the obvious one, but session RPE is athlete-entered and I will not enter anything. Does it compare against squad median actual RPE, against GPS, or against the coach's own post-session mark, which reintroduces an input I have said I will not do? |
| **O-1043** | O-995, the concussion and return to play carve-out, is still open and it blocks a coach screen, not just a permissions table. I have asked for route 1, protocol stage as a restriction. It needs the physio's sign-off and a note on which competition's protocol wording is used, because the stage count differs. |
| **O-1044** | The short turnaround window is O-805, defaulted to six days. Per organisation is right. Does it also vary by position, given a front rower's recovery from eighty minutes is not a winger's? My instinct is yes and I have no evidence for it. |
| **O-1045** | Does the "since you named the team" notification need the team to have been named in Fydr? If selection lives in `screens/team-allocation.md` and I name my side on a whiteboard, the product has no baseline to diff against. Either it watches the published allocation, or the feature quietly does not work for clubs that do not allocate in the app. |
| **O-1046** | Is the availability trend counted on players available today, or players available for the next fixture? They differ by several every week and the board question is the second one. Pick one and label it, because two definitions of the same headline number is how a coach stops trusting a product. |
