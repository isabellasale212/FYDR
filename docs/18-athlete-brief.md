# 18. What an athlete actually wants

Written in the voice of the user: professional rugby union player, 23, fourth season in a
senior squad, back row, roughly 30 appearances. Has been given two of these apps before and
stopped using both.

This document exists because the athlete side of Fydr is where the data comes from, and
every argument in `14-sports-science-brief.md` collapses if the entries are made up.

---

## 0. Read this before designing anything

**Here is what happens to every one of these apps.**

Someone from the performance team introduces it at a pre-season meeting. There is a slide.
We download it in the room. For about three weeks it gets filled in properly, because it is
new and because pre-season is boring enough that a phone task is a small event. Then a
Tuesday comes where we are on a bus at 07:20, someone says "have you done the app", and four
lads fill it in for the week off the top of their heads. After that it is done on the bus
every week until it quietly stops.

**Nobody is trying to sabotage it.** There is no rebellion. I do not have a view on your
company. It just stops being worth the forty seconds, and the moment it stops being worth
forty seconds it becomes a thing I do badly rather than a thing I stop doing, which is worse
for you than if I deleted it.

So the design question is not "how do we make athletes engage". It is:

1. **How few seconds can this take**, measured in a changing room, not on a sofa.
2. **What do I get back**, in a form I can see without being told to look.
3. **What happens to it**, which is section 1 and is the whole product.

Everything else is decoration. I do not care about the colours. I have never once thought
about the colours.

---

## 1. Who sees this, and does it affect whether I get picked?

This is the section that matters. If you get this wrong, nothing else in the app is worth
building.

> **Who sees this, and does it affect whether I get picked?**
>
> That is the only question that matters in the changing room and no app has ever answered it
> honestly. If I put down that I slept badly and I am sore, and then I am not in the 23 on
> Thursday, I will never put that down again. Neither will anyone else, because we talk. Once
> a squad decides the wellness form is a selection input, you get 45 players entering fours
> and fives every morning and your data is worthless.

### It only has to happen once, to one player

That is the part people outside a squad underestimate. It does not need to be true. It needs
to be believed by one senior player on one Thursday, and the belief spreads through the
group by Friday, because we talk about selection constantly and about very little else.

Nobody announces it. The scores just drift upwards. Everyone is sleeping seven and a half
hours and everyone is a four for fatigue. The compliance number on your dashboard stays at
94% and looks like a success, and the sports scientist in doc 14 is reading a chart of
nothing. **Honest-looking data that is fiction is worse than a blank column**, because a
blank column tells him he does not know.

### So the app has to answer it, in words, at onboarding

`onboarding.md` step 5 already does most of this and it is the best screen in the spec. Two
lines in it are doing the real work:

```
It is only a heads up. A person always decides what happens next, never the app.
It is not there to decide who gets picked, and your club has promised not to use it that way.
```

That sentence currently sits in the under-18 version. **Put it in the adult version too, in
those words.** A 23 year old needs it more than a 17 year old does, because the 23 year old
is the one on a contract.

What the notice must say plainly, in the order I would ask it:

| My question | What the screen has to say |
|---|---|
| Who reads my morning entry? | Coaches and S&C, by name of role. Not "authorised personnel". |
| Does the physio see it? | Yes, and the physio sees things the coaches do not. |
| Does the office see it? | They see whether I filled it in, not what I put. |
| Do my teammates see it? | Nothing, unless I turn on a leaderboard. |
| Does another club ever see it? | No. Say it flatly. |
| Is it used for selection? | No, and here is what the club has committed to. |
| What if I stop? | Say what actually happens, which is a conversation, not a punishment. |

### The club has to say it out loud as well

The app cannot carry this alone. A screen at onboarding that nobody reads is not what
changes squad behaviour. What changes squad behaviour is the Head of Sports Science standing
up in the same pre-season meeting and saying, in front of the coaches, that this is not a
selection input and the coaches nodding. **Ship that as part of the product.** Give the club
the paragraph to read out and make it a term of the sale, not a suggestion. If a club will
not say it, you should want to know that before they buy, because their data will be junk
and they will blame you.

### The failure mode is a flag reaching a coach before anyone speaks to me

This is the specific mechanism by which trust dies, and it is a timing problem, not a
permissions problem.

If I submit at 06:50 and a coach has a red badge with my name on it at 06:51, then the first
conversation I have about my own body that day is a coach knowing something about me that I
have not told him. That feels like surveillance even when the intent is care. Two weeks of
that and I am entering fours.

`01-roles-and-permissions.md` carve-out 2 has the right instinct, delaying flag visibility to
me until staff acknowledge it. **I want the same idea applied in the other direction.** A
flag should route to the person who is going to have the conversation, S&C or medical, and a
coach should hear it from that person, not from a phone. I do not need the flag hidden from
the coach forever. I need a human between the alert and the selection meeting.

```
Keeps me filling it in          Stops me filling it in
06:50  I submit, sleep 5        06:50  I submit, sleep 5
07:05  S&C sees the list        06:51  Coach's phone: WILLIAMS readiness 42
08:10  S&C: "how's the back"    08:30  Coach, in front of people: "you're a 42"
08:30  "modified, no wrestle"
```

Same data. One of them I keep filling in.

### This is a data quality feature, not a privacy feature

I am not asking for privacy as a comfort. I am telling you the mechanism by which your
product stops working. Wellness is self-reported, which means I decide the number. If I have
any reason to believe the number affects my week, I will report the number that gets me the
week I want, and so will everyone else, and none of us will think of it as lying. **A system
that cannot answer the selection question honestly does not get bad compliance. It gets
excellent compliance on invented data**, which is undetectable from the inside and takes a
season to find out.

---

## 2. The morning entry

**When I use it**: 06:45, standing, one hand, phone in the other hand or in my teeth, either
in a kitchen with the kettle on or in a basement changing room with one bar of signal and
usually none.

**Forty-five seconds is generous. Thirty is the target.** The wellness spec has 45 seconds as
the success criterion and I understand why, but 45 seconds is what it takes on the day you
resent it, and the day you resent it is the day it stops.

What that means concretely:

- **One thumb, standing up.** I am not sitting down for this and I am not using two hands.
- **No scrolling if it can be helped.** `wellness-entry.md` accepts one short scroll at the
  390 pt target and offers a shorter row as O-425. Take the shorter row.
- **Big targets.** The five-dot sliders are fine. Make the dots bigger than looks right.
- **It works with no signal.** In our gym there is none at all. Save it locally, tell me it
  saved, send it later without asking me anything. If it spins, that is the end of it.
- **It opens to the thing I have to do.** Tapping the notification should put the first
  slider in front of me. Not a home screen. Not a menu. Not a "good morning" card.

**No default slider positions**, which the spec already has right. A pre-filled form is a
form I submit without reading.

**Do not show me a score while I am moving the sliders.** If I can see the number going up
and down, I will start aiming at it within a fortnight. Not deliberately. It is just what
happens when you show someone a number they control.

**"Same as yesterday" is the one shortcut worth having**, O-428, and only if it is honest: I
tap it because it is true, and the entry is marked as having been prefilled so nobody builds
a trend on it thinking it was considered.

---

## 3. Today

**When I use it**: three or four times a day, for about six seconds each time.

Here is my entire relationship with this screen. What is on, what time, where, what am I
lifting, and am I in the team. That is the whole app for me. Everything else in the product
is something you want, not something I want, and I mean that without any edge.

So the top of Today is:

```
Wed 5 Aug   MD-1
17:00   Lower A            Main gym        60 min
18:30   Captain's run      Pitch 2         45 min
```

Time, what, where. The location line matters more than it looks: half the messages in our
squad WhatsApp are "which pitch". If the app kills that question it has earned its place
before it has collected a single data point.

**"Am I in the team"** is the honest fifth item and the hardest one, because selection is a
coach's decision and not all of it is public. If the club publishes a 23, put it here. If
they do not, say nothing rather than showing me something adjacent to it.

**The all-done state is right.** "You're up to date. Wellness and RPE submitted today." It
confirms the app received the work and it does not congratulate me. Do not add to it.

**The availability banner should never be dismissible**, which it is not, and it should say
what I cannot do in plain words. "No contact, no sprinting" is useful. "Modified" alone is
not.

---

## 4. The gym screen

**When I use it**: for 50 minutes, standing over a bar, with chalk on my hands, phone
propped against a plate stack or on the floor.

The difference between a good gym app and a bad one is entirely mechanical.

- **Huge numbers.** I am reading this from a metre away at an angle. Weight and reps should
  be the biggest things on the screen.
- **What I did last time, visible without tapping.** `Last time 5 × 100.0 kg · RPE 8` under
  the exercise. This is the most useful thing in a gym app and the reason I open it at all.
  If it is behind a history screen I will use the notes app instead, which is what I did for
  two years.
- **A rest timer that starts itself** when I log a set and is readable from the floor without
  unlocking the phone. Screen stays awake, which the spec has.
- **One tap when I hit the prescription.** If it says 5 at 105 and I did 5 at 105, that is
  one tap and the row is done. **Do not make me type three fields per set.** Three fields
  times 24 sets is a workout spent on data entry, and what actually happens is I log nothing
  and reconstruct it badly afterwards, or not at all.
- **Typing only when I deviate.** Got 4 instead of 5, let me change one number. Common case
  one tap, uncommon case one tap plus one stepper.
- **No swipes, no long presses.** Wet hands do not do gestures. The spec knows this.
- **Do not lose my session** if I take a call or the app is backgrounded for 20 minutes.

RPE per set is fine. RPE per set plus reps plus load typed manually is not.

---

## 5. Being injured

I have had two injuries that cost me more than six weeks. The physical part is manageable.
**The thing that actually gets to you is not knowing when you are back.** The answer lives in
the physio's head and you get it in fragments, in corridors, when you remember to ask.

So the injured version of the app has one job: show me where I am and what is next.

```
Left hamstring          Phase 2, loading          started 22 Jul

✓ Pain-free walking                     met 24 Jul
✓ Single-leg bridge × 20                met 29 Jul
○ 80% eccentric strength                target 8 Aug
○ Return to running                     target 15 Aug
```

That is what `my-programme.md` already specifies and it is the best thing in the athlete app.
Four lines and I stop asking the physio the same question three times a week, which he will
also appreciate. Three rules about it:

**Milestones are criteria, not dates alone.** "80% eccentric strength" tells me what I have
to do. "Target 8 Aug" alone tells me to be disappointed on the 9th.

**When a target slips, say so and say why.** A date that silently moves is worse than no date.
"Moved to 15 Aug, strength test not met" is fine. I have had a hamstring before.

**I should not be able to tick my own milestones**, and I do not want to be able to. That is
medical's call and if it were mine I would tick them early.

---

## 6. My own numbers

**I do want to see them.** The idea that athletes are not interested is wrong. I check my top
speed after every session the GPS units are on, and so does everyone.

What I want: my load and sessions over the last month, so I can see whether the week I just
had was as heavy as it felt. My lifts over time, squat, bench, chin-ups, which is the number
I actually care about. My testing results against **my own best**, with the date of that
best. My sleep, honestly, because occasionally it is the thing that explains a bad fortnight.

What I do not want is **a score out of 100 that goes down.** A readiness score of 61 on a
Monday tells me nothing I did not know from getting out of bed, and it makes me feel worse
about a day I have not started. It is also a number I cannot argue with, which is a bad
combination in a squad where everything else is earned.

Show me a trend of how I have felt, fine. Show me a composite with a name that sounds like a
verdict and I will read it as a verdict, because that is what it looks like. O-295 and O-430
both circle this. My answer: show the components, not the score.

**And do not judge me with it.** My own soreness trend is useful. Being told my soreness is
"above squad average" is not information, it is a comment.

---

## 7. Leaderboards

Honest in both directions, because the spec is a bit too keen to solve this in one move.

**The case for.** The top speed board is genuinely good. It goes on the wall as well as in the
app, everyone knows where they are on it, and it makes people run properly in running drills,
which is otherwise the part of the session people cruise. It is the only feature of any of
these apps that has ever made the squad open it voluntarily, and it is fair: you cannot fake
a top speed.

**The case against.** It is the thing in the product most likely to make somebody hide an
injury. If I am second on the board and my hamstring is tight, there is a version of me that
does not mention the hamstring on Tuesday. I have watched that happen with a wall chart and
no app involved at all.

**Where I land.** Keep them, narrowly.

| Rule | Why |
|---|---|
| Performance metrics only: top speed, distance, lifts, test results | Things I chose to do in front of people anyway |
| **Wellness never. Not one field, not the composite** | It is how I feel, it is self-reported, and ranking it guarantees gaming |
| **Body composition never** | Ranking a squad by body fat is a way of producing an eating disorder, and I have seen the start of one |
| Opt out in one tap, and leaving is silent | If leaving is announced, nobody leaves |
| Minimum three people ranked | Otherwise a two-man board is a public accusation |
| No board on whether I filled in the app | See below |

The spec currently makes `compliance.wellness_pct` rankable. **Do not.** A leaderboard of who
fills in the wellness form is the club using the squad to chase compliance for them, and it
tells everyone that submitting is the point rather than being honest when you submit. It is
the compliance version of the selection problem.

`leaderboards.md` also has the under-18 rule right, opt-in rather than opt-out. It will make
the academy board sparse for a season. That is a fair price.

---

## 8. Notifications

**One a day. Two if it is a match week. Three and I turn them off.**

And that is permanent. Nobody has ever gone back into settings and turned an app's
notifications back on. Once they are off the app is off, and I will still have it installed,
so it looks to you like a dormant user rather than a lost one.

The one I want is the morning wellness prompt. That is it. Everything else can wait until I
open the app.

The current budget is three a day and twelve a week. **Three a day is not a budget, it is a
ceiling nobody should get near.** And a nudge for something I have already decided not to do
today is the most annoying notification in software.

Never send me: a congratulation, a streak, a reminder that I am on a leaderboard, a weekly
summary I did not ask for, or anything at all between 21:00 and 07:00 unless my availability
has changed.

---

## 9. The weekly nutrition question

One question a week. "Did you hit your protein target most days this week? Yes, roughly, no."

**I will do that.** It takes two seconds, it does not require me to remember anything
precisely, and "roughly" is an honest answer that most surveys do not let you give.

I will do it **as long as it stays one question.** The moment it becomes two, or one plus "and
how many meals", or a photo of my plate, I am out, and I will not come back when you revert
it. Every nutrition feature in every app I have used started as one question.

Do not colour the answers. Green for yes and red for no tells me which one you want, and I
will give you the one you want, which makes the whole thing pointless.

---

## 10. Being under 18

I came through an academy, so briefly, on behalf of the 17 year old version of me.

**What he needs to be told, in words he will actually read:** who sees his soreness score,
that his parents do not have a login, that his teammates see nothing, and that the alerts go
to a person and not to a selection meeting. `onboarding.md` step 5c does this and the copy is
good.

**Why high-privacy defaults matter more than they sound.** A 17 year old in an academy will
agree to anything you put in front of him, because he is chasing a contract and he is not
going to be the one who says no to the club. Consent from someone in that position is not
really consent. So the defaults have to protect him rather than ask him: the leaderboard off
until he turns it on, not on until he opts out. He will not opt out. None of us would have.

What he will actually ask is section 1 in a younger voice: **does this affect whether I get
in the team on Saturday.** Answer it on the screen.

---

## 11. What I do not want

Direct, because these are the things that make me delete an app rather than merely ignore it.

- **Streaks.** A 40 day streak makes me enter something false on day 41 when I am hungover or
  on holiday, and then it is broken and I stop entirely.
- **Badges, points, levels, confetti.** I am a professional. This is my job.
- **A motivational message from a coach**, written by the app or written by the coach. If he
  has something to say to me he can say it in the gym.
- **Being compared to teammates on anything I did not opt into.** Including gently. Including
  "you are in the top third for sleep".
- **An app that nags.** Two prompts for one thing is one too many.
- **Anything more than two taps** from opening the app to what I need.
- **A greeting with my name in large text**, or the date rendered decoratively. I know my name.
- **Being asked to rate the app.**

---

## 12. What would make me use it in week 12

Week 1 is not a test of anything. Everyone uses everything in week 1. Week 12 is February, we
have lost two in a row, I am carrying a knee, and there is a bus.

My honest answer is that there are only two things, and it needs one of them:

**1. It tells me something about myself I did not know.** Not a score. Something like: my
top speed is 3% down over four weeks and I had not noticed, or my squat has gone up 12 kg
since November, or every time I sleep under six hours for three nights my soreness the
following week is up. Something specific, about me, that I could not have worked out in my
head. Once the app has told me one true thing like that, I will forgive it a lot.

**2. It saves me a conversation with a coach.** Where do I need to be, what am I lifting,
when am I back, what did I do last Tuesday. Every question the app answers is a question I do
not have to find someone to ask. That is worth more than any chart.

If it does neither of those by week 12, I will still have it installed, I will still be
technically compliant, and everything I enter will be a four.

---

## 13. Visual rules, athlete side

Different job from the staff screens in doc 14. Those are read at a desk. These are read
standing up, in a hurry, with one hand.

| Do | Do not |
|---|---|
| One thumb reachable: every primary action in the bottom third | A confirm button in the top right corner |
| Tap targets bigger than they need to be, 56 pt and up | 44 pt minimums on a screen used with wet hands |
| Numbers large enough to read from the floor | A weight rendered at body text size |
| State what was completed: "Wellness and RPE submitted today" | "Nothing to do", which reads as "we lost it" |
| Blank where there is no data, with the word "Missing" | 0, or a gap in a line that looks like a real value |
| Plain words: "no contact, no sprinting" | "Modified" alone, or any status word without its meaning |
| Saved locally and said so, before the network is involved | A spinner in a basement with no signal |
| One accent colour, status as colour plus a glyph | Traffic lights on a self-report, which teach me the right answer |
| Confirmation that lasts long enough to read and then goes | A celebration, a tick animation, a "well done" |
| Show my own history against my own previous | My value against the squad, anywhere I did not opt in |

---

## 14. Open questions

| ID | Question |
|---|---|
| **O-1060** | Does the club commit in writing that wellness and readiness are not selection inputs, and is that commitment shown in the app with the club's name on it? The under-18 notice already promises it. My view: it belongs in the adult notice and in the contract, because a promise the club has not made is a promise the app should not display. |
| **O-1061** | Flag routing, not just flag visibility. Carve-out 2 delays a flag reaching me. Should a flag also route to S&C or medical first and reach a coach only after acknowledgement? I think yes, and I think it is the single highest-value change in this document. It costs a notification hop and it is the difference between honest and invented data. |
| **O-1062** | Is `compliance.wellness_pct` really leaderboardable? `leaderboards.md` says yes. I say no: it ranks obedience, not performance, and it makes submitting the point instead of being honest. |
| **O-1063** | When a rehab milestone target date slips, who changes it and is the athlete told why? Currently the milestone list can silently move. A slipped date with no reason is the thing that erodes trust in the plan. |
| **O-1064** | One-tap "as prescribed" set logging: does the row record that it was logged as prescribed rather than entered? Same argument as O-428 for the wellness prefill. Without the column, a genuine 5 at 105 and a lazy tap are indistinguishable. |
| **O-1065** | Athlete push budget is 3 a day and 12 a week. Should the athlete default be 1 a day and 5 a week, with 2 a day permitted in a match week? Once an athlete turns notifications off they never return, so the budget should be set below the annoyance threshold, not at it. |
| **O-1066** | Does the athlete ever see a composite readiness score? O-295 and O-430 ask this from the data and screen side. From my side the answer is no: show the components, never the composite. A number I control becomes a target, and a number I do not control becomes a verdict. |
| **O-1067** | "Am I in the 23" on Today. If the club publishes a matchday squad, does Fydr surface it, and does it come from the club or from a Fydr team-allocation screen? It is the most-wanted item on the screen and it is also the most sensitive, so it needs an explicit answer rather than drifting in. |
| **O-1068** | What does the app do when an athlete stops submitting for a fortnight? Currently it nudges. A nudge is the wrong response to a person who has decided something. My view: after three missed days it stops nudging and tells S&C to have a conversation, which is what would have fixed it anyway. |
