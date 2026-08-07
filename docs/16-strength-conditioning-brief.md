# 16. What a lead strength and conditioning coach actually wants

Written in the voice of the buyer: lead S&C coach at a professional rugby union club, full
time, 45 player squad, one assistant, a shared gym with 8 racks, first session on the floor
at 06:30.

This document exists because the person who writes the programme and the person who runs the
session are the same person, and no S&C product I have used seems to know that.

---

## 0. Read this before designing anything

**Every S&C product I have been shown is built for the author and abandoned by the
deliverer.** The demo is always the programme builder. Blocks, weeks, drag and drop, a nice
library, a progression wizard. All of it aimed at the job I do once.

Writing a programme is a Sunday evening job. Once a block, twelve weeks at a time, sitting
down, laptop, cup of tea, not in a hurry. If your builder takes me two hours instead of ninety
minutes, I will survive.

**Running a session is ninety minutes on the gym floor, four times a week, with 20 athletes,
on an iPad propped on a rack, on bad wifi, with chalk on my hands.** That is 350 sessions a
season, and it is where your product either becomes the thing on the rack or the thing nobody
opened after week three.

**The product lives or dies on the second job, not the first.** Build the delivery surface
first and reverse-engineer the builder from it. Everybody does it the other way round, which
is why I still have a laminated sheet.

**What I actually buy:**

1. **Can I see the whole room without moving?** Twenty athletes, who is on what, who is
   done, who has not started. One screen, from two metres, without touching it.
2. **Can I get to one athlete and back in two taps?** In, change his load, out. If it is four
   taps I will do it in my head and tell you later, which means never.
3. **Does it survive the wifi dropping?** It will drop. The gym is in a basement.

**Two things I will notice in the first session and judge you on:**

- **A completion tick where a number should be.** If your screen tells me he "completed"
  bench press, you have thrown away the only thing I care about.
- **Anything that moves under my finger.** Animated transitions, collapsing rows, a list that
  re-sorts itself when data arrives. My hands are chalked and I am reading at arm's length.
  Motion is a bug on this screen.

---

## 1. The gym floor screen

**This is the screen I use most and it does not exist in your specification.** `gym-logging.md`
is the athlete's phone. `gym-programmes.md` is my Monday morning admin. Neither of them is
me, standing in the middle of the room, running the session.

**When I use it**: 06:30 to 08:00, Tuesday, Wednesday, Friday, Saturday. iPad landscape,
propped on a rack or carried under one arm. I look at it every 90 seconds for four seconds.

**What it answers**: who is in the room, what are they on, who is behind, who needs me.

```
LOWER A   ·  Tue 5 Aug  ·  MD-4  ·  0:42 elapsed        18 in  ·  2 not in

RACK 1   S. ADEYEMI     A1 BACK SQUAT     set 3/4     140     ▓▓▓░
RACK 2   T. BENNETT     A1 BACK SQUAT     set 4/4     125     ▓▓▓▓
RACK 3   M. PRICE       B1 RDL            set 1/3     100     ▓░░
RACK 4   D. RAHMAN      A1 BACK SQUAT     set 2/4      95     ▓▓░░   ⚠ 18 min behind
...
         J. OKAFOR      REHAB             physio-led          not my session
         L. FOX         not started                            ⚠
```

### The rules that make it work

**Big type. One row per athlete. No cards.** A row is 56 pt on a 1024 pt wide iPad, name at
28 pt minimum, current load at 32 pt, read from two metres in bad light. A grid of tiles with
avatars is a design from somebody who has never stood in a gym.

**Live, and I mean live.** Athletes log on their phones and their sets appear here within a
couple of seconds. This is the single feature that changes my day: I stop walking the room to
find out where people are and start walking the room to coach.

**One tap in, one tap out.** Tapping a row opens that athlete's full session, where I can
change a load, add a set, swap an exercise or leave a note. The back control is a persistent
target in the same place every time, and it is large. **Not a swipe. Not a browser back.**
Never a modal that stacks on a modal.

**Behind is computed, not guessed**, and shown as minutes. "18 min behind" is actionable, an
amber dot is not.

**Rack allocation is mine, not the software's.** I assign athletes to racks by dragging before
the session and it stays put. Do not auto-assign, do not optimise, do not suggest. I allocate
racks by who needs watching, which is a coaching decision.

**Everything here works offline.** Reads come from the last sync, writes queue, and the header
carries a small sync dot with a timestamp. Never a banner. A banner mid-session is the same as
a banner mid-set.

**What I do not want here**: a squad average, a session RPE gauge, a progress ring, an
attendance percentage, or any chart at all. This is a live roster, not a dashboard.
Confidence: high, this is the part of the brief I am most certain about.

---

## 2. Programme authoring

Speed matters here, but it is a different kind of speed. Not "fewer clicks per exercise", but
"fewer repetitions of the same decision". What I do twenty times a block:

| Job | What it must cost |
|---|---|
| Duplicate a week | One action, with an optional delta: +5% load, +1 set, -1 rep |
| Duplicate a block | One action, and it keeps the MD-n anchors, not the calendar dates |
| Copy one session into another week | Drag, or a "copy to" picker with multi-select weeks |
| Bulk edit a prescription across a group | Select the exercise, edit once, apply to selected weeks |
| Swap one exercise for another everywhere it appears | One action, with a preview of every affected session |

`programme-builder.md` already has "Apply to this week" and "Apply to all weeks in block".
Add "apply to selected weeks", because deload weeks are the whole reason this matters and
blanket-applying through week 4 is exactly the mistake I make at 22:00 on a Sunday.

**Fourteen clicks per exercise is the failure mode.** The inline editor in
`programme-builder.md` is on the right lines. Keep it a single expanded row with everything
visible at once: sets, reps range, load basis, value, tempo, rest, RIR, notes. Do not put
tempo behind an "advanced" disclosure. Tempo is not advanced, it is Tuesday.

### Percentage of 1RM

Resolve per athlete from their latest 1RM for the linked test, rounded to the equipment's
increment, so 82.5 kg on a barbell and not 82.37 kg. `exercises.load_increment_kg` and
`exercises.one_rm_test_definition_id` in `gym-logging.md` are right and belong in
`04-data-model.md` §6 rather than in a screen spec.

**When an athlete has no 1RM on record, prompt me. Never silently default.** The coverage
check in `programme-builder.md` ("34 of 38 have a result. 4 do not.") is the single most
important interaction in the builder. Extend it: tell me at the point of prescribing rather
than at publish, and give me three actions from that panel. Schedule a test, enter a known
1RM now, or set an absolute load for those four athletes only. If I do none of the three, the
athlete's programme reads "Load not set, see your coach" and I get a flag. It never falls back
to a percentage of anything. A 1RM older than 120 days resolves and is annotated with its age
in both my view and his.

**On estimated 1RMs**: if you calculate an e1RM from a set of five at RPE 8, label it as
estimated everywhere it is used, including on the athlete's phone. An estimate presented as a
measurement is how a returning player ends up under a bar he cannot handle.

### Supersets, tempo, rest, RIR

- **Supersets**: same label, adjacent in sequence, displayed as A1/A2. Rest belongs to the
  round, not to each exercise. The duration estimate must count it once per round or every
  session I write reads 20 minutes longer than it is.
- **Tempo**: four positions, `3-1-X-0`, validated on the pattern. Text on the athlete's phone,
  not a countdown animation.
- **Rest**: seconds. It drives the athlete's timer and it is visible on my floor screen, so I
  know why a rack is idle.
- **RIR and RPE are both real and they are not the same field.** I prescribe RIR on accessory
  work and RPE on main lifts, and `gym_set_logs` already carries both. Let me choose which one
  the athlete is asked for, per exercise. Asking for both is how you get neither.

---

## 3. Prescribed versus completed, per set

**Session-level completion is useless to me.** "Complete" tells me the athlete pressed a
button. It does not tell me what happened.

I need this, on the athlete's row, without opening anything:

```
A1 BACK SQUAT      prescribed  5 x 5 @ 150      completed  3 x 5 @ 140
```

Because that is a coaching conversation. The bar felt heavy, he backed off and cut two sets.
That is either a good decision or a problem he is hiding, and which one depends on him, on the
week, and on what I saw on his face. **The software's job is to put the discrepancy in front of
me. It is not to interpret it.**

`gym_set_logs` already stores one row per set with reps, load, RPE, RIR and side, so the data
model is right. What is missing is the view: nothing in the specification renders prescribed
against completed at set level for a coach. `athlete-profile.md` block 3 does it at session
level, which catches the athlete who is skipping and misses the athlete who is grinding.

**Deviation is normal and must not be styled as failure.** A red cell every time somebody used
140 instead of 142.5 trains me to ignore the colour. Flag only outside a per-exercise
tolerance, default 5% on load and one set on volume, configurable.

**Show it to me by exercise across the squad as well.** "Everybody went lighter on trap bar
deadlift on Friday" is a programming problem, not twenty individual conversations.

---

## 4. Velocity based training

**Be honest about this: most club-level sides do not have the kit.** We have one Gymaware and
we use it on two lifts. Championship and academy sides typically have nothing. If you build
VBT before you build the gym floor screen you have built the wrong thing.

**Premium tier or later, and it gates nothing else.** Confidence: high on the tier placement,
medium on timing, which depends on how many of your first ten clubs own a unit. Ask them.

When a club does have a linear position transducer or an optical unit, what I want is small:

1. **Mean concentric velocity per set**, stored on the set beside load and reps. Peak velocity
   too if the device gives it, but mean concentric is the number that governs.
2. **A load-velocity profile per athlete per lift.** Velocity against load, the regression
   line, the extrapolated velocity at zero load and the load at minimum velocity threshold.
   Show the points, the fit and the R squared. **A profile fitted on three points is not a
   profile and should say so rather than draw a confident line.**
3. **Velocity loss within a set as an autoregulation cue.** Prescribe "stop at 20% velocity
   loss from best rep" and let the athlete's screen tell him when he has hit it. **The cue is a
   cue.** The software does not stop the set and it does not change tomorrow's prescription.

Schema implication, stated so it is designed now rather than retrofitted: `gym_set_logs` needs
`mean_concentric_velocity_ms`, `peak_velocity_ms`, `device_id` and `source`, plus a child
table if you want individual reps. Devices export CSV per session, so reuse
`vendor_profiles.column_map` rather than building a second import mechanism.

---

## 5. Force plate data

Same honesty applies: a force plate is a 10 to 25 thousand pound purchase and about a third of
professional clubs own one. Where we do, it is the best objective data in the building and I
test on it weekly. What I want stored and trended, per athlete:

| Metric | Why I look at it |
|---|---|
| **CMJ height** | The headline, and the least informative of the five |
| **RSI modified** | Jump height divided by time to take-off. Fatigue shows here before it shows in height |
| **Concentric impulse** | The output. Trends with training age and with detraining |
| **Eccentric impulse and eccentric duration** | Where a fatigued athlete changes strategy while keeping the same jump height |
| **Limb asymmetry, percentage** | The number that actually changes what I do |

**Asymmetry is the one that changes my session.** A player back from a knee, jumping at his
pre-injury height, with 19% asymmetry in concentric impulse, is not ready, and everybody in the
room including him thinks he is. That number is the argument I take to the physio and the head
coach. Render it with the direction, the dominant side and the threshold it is judged against,
exactly as `testing.md` does for bilateral tests. Default warn at 10%, configurable per test,
because the literature does not agree and neither do clubs.

**Jump height without strategy is a trap.** Two athletes at 38 cm, one taking 0.72 s to take
off and one 0.94 s, are in different states. Show me height alone and I will draw the wrong
conclusion.

Ingest by CSV with a per-vendor column map. Do not build a device integration for v1.

---

## 6. Testing days

**Three or four times a season I test 30 players in an afternoon.** Two testers, a battery of
five or six tests, and a hard stop when the pitch session starts. Bulk entry speed is the
entire product on that day.

`testing.md` already specifies the right thing and I am reinforcing it, not changing it:

- **A keyboard-driven grid on a laptop.** Enter moves down to the next athlete on the same
  attempt, not across. We run the whole squad through attempt 1, then the whole squad through
  attempt 2. Movement that matches the data shape rather than the afternoon is the classic
  mistake.
- **A fast pad on a tablet** for tests where I am walking: one athlete per screen, big number
  pad, commit and advance.
- **Never a form per athlete.** A modal with a save button, 30 times, is 30 minutes I do not
  have.
- **Multiple attempts with best-attempt marking**, computed direction-aware and overridable,
  because a tester saw the sprint gate misfire and I did not.
- **Bilateral left and right, best per side**, asymmetry computed between the two bests rather
  than within one attempt.
- **Their previous best in the cell, before I type.** If a 10 m sprint comes in 0.4 s faster
  than his best I need to see that at the moment of entry, so I can re-run it while he is still
  standing there. Finding it on Monday is worthless.

**Plausibility warnings, not blocks.** Warn outside physiological bounds and outside a
personal deviation window, and accept the value anyway. A tester who is fighting the software
starts writing numbers on paper, and then you have lost the afternoon. And warn me when the
battery order is wrong: a 1RM before a sprint test invalidates the sprint.

---

## 7. The exercise library

Video, coaching cues and substitutions. The first two are table stakes and every product has
them. **The third one is the one I need and almost nobody ships it properly.**

**The substitution is a mid-session need, not a planning need.** Rack 3 is busy, or an athlete
turns up with a shoulder that will not tolerate an overhead press today. From the exercise row,
in one tap: three or four ranked alternatives with the same movement pattern and available
equipment. Ranking comes from `exercises.category`, `equipment` and `primary_muscle` plus a
club-maintained substitution list, because a back squat swaps to a safety bar squat before it
swaps to a leg press and no attribute model works that out on its own.

**Two kinds of swap and they must be different actions:**

| Action | What it writes | When |
|---|---|---|
| **Just for today** | A note on the logged set, parent prescription untouched | The rack is busy |
| **Until further notice** | A `substitute` override with a reason and an expiry | His shoulder |

Making a permanent change when I meant a one-off is the most likely error on the floor, so the
one-off is the default and the permanent one carries a confirm.

**Video plays without leaving the screen and without sound.** Six seconds, looping, muted, no
player chrome. Cues are three bullet points, not a paragraph. I wrote them and I will not
write a paragraph.

---

## 8. Rehab handover

The physio owns the rehab programme and I own the gym programme. We collide every single week,
usually over an athlete doing my lower body session on Tuesday and her posterior chain rehab
on Wednesday, with nobody adding up the total.

`03-flows.md` §4 has the mechanic: a medical-assigned rehab programme suspends the gym
programme and it resumes on clearance. That is right. What is missing is my side of it.

**What I see:** that he is on a rehab programme, which body area and stage; the exercises,
sets and loads he is prescribed, so I do not double up his hamstring volume; his restrictions
in prescriptive terms, "no lower body loading above 60% bodyweight", "no unilateral landing";
and his rehab compliance, because if he is not doing it his return date moves and my planning
moves with it.

**What I do not see, and should not:** the diagnosis, the imaging, the treatment notes, the
clinician's opinion. `CLAUDE.md` rule 3 already says this and I agree with it. I do not want
that information, I want the restriction.

**What I can edit: nothing in the rehab programme. Not one field.** A shared editable
programme between two people with different duties of care is a governance disaster and I do
not want the argument. What I can do is propose: a "flag a conflict" action on the athlete
that notifies the physio and records the conversation. Confidence: medium on the conflict
action being worth v1, high on the read-only rule.

### Clearance, which is the bit that goes wrong

Today clearance reaches me as a physio saying "he is fine" in a corridor, and I have to
remember to un-suspend him.

**Clearance must be an explicit event with a date, a named clinician and a destination
state**, and it is almost never binary. What I actually get is:

```
J. OKAFOR   cleared for gym programme          6 Aug, K. Doyle
            restrictions remain: no unilateral landing        expires 20 Aug
            load cap 70% on back squat                        expires 20 Aug
            [ Resume gym programme ]
```

The resume action un-suspends `programme_assignments` where
`suspended_reason = 'rehab_active'`, carries any residual restriction across as time-limited
`load_cap` overrides, and puts the athlete back on my floor screen tomorrow morning with the
cap visible on his row.

**A residual cap with no expiry is how a player stays on 70% until March.** Expiry is
prompted, defaults to the end of the block, and expiring caps appear on my Monday list.

---

## 9. Printing

**A printable session sheet is not a nostalgia feature. It is what stops the session
stopping.**

Our gym is a converted sports hall with one access point and a signal that dies whenever the
ice bath pump kicks in. Twice a season the whole thing goes down at 06:25. If my fallback is
"everyone remembers what they did", the session is wasted. Two sheets, A4, PDF, both generated
from the resolved programme:

1. **The squad sheet.** One page, athletes down the left, exercises across the top, each cell
   pre-filled with **that athlete's resolved load**, and empty boxes for reps, load and RPE.
   This is what goes on the clipboard.
2. **The athlete sheet.** One athlete, one session, prescription and blank boxes, for the
   player rehabbing alone at 15:00 with no phone.

**Athlete order on the sheet matches athlete order in the app**, so transcription afterwards
is mechanical and not a matching exercise. `testing.md` makes the same point about its print
sheet.

Black on white, no colour, no logo bigger than 20 mm, 10 pt minimum type, and it fits one page
for a 20 athlete squad. A "print" that produces a screenshot of a dark dashboard across three
pages is worse than nothing.

---

## 10. Gym load next to pitch load

**The head coach adds a session and nobody tells me.** That is not a complaint, it is how a
rugby week works. Somebody has an idea on Wednesday, an extra unit runs Thursday morning, and
my Thursday afternoon lower body session is now the fourth hard exposure in five days. I need
one view, per athlete and per group, with:

- **Gym load**: tonnage, or sets above a threshold intensity, or gym sRPE. All three are
  defensible and clubs disagree, so make the primary series configurable and say which one is
  showing.
- **Pitch load**: session RPE, and GPS load where the club has it.
- **Both on one axis, by day, MD-n labelled**, with the fixture as a vertical rule.

Two y-axes will get the same reaction from me as it does from the sports scientist in doc 14.
One axis, or two stacked charts sharing an x axis.

**And the thing I actually want**: tell me when the plan changed. A session added to the
schedule inside 72 hours, for a group I have athletes in, appears on my Monday list as a
change and not as a fact. "Extra unit added Thu 07:00, 18 of your athletes" is a notification I
will read every time.

---

## 11. What I do not want

Plainly, because these are the things that get proposed in every meeting:

- **A builder that costs 14 clicks per exercise.** If prescribing sets, reps, load, tempo and
  rest requires opening five controls, I will write the block in a spreadsheet and paste it in.
- **Autoregulation the software applies without asking me.** By all means compute that his
  velocity is down 12% and surface it. Do not reduce tomorrow's load. The moment the
  prescription changes without my hand on it, I no longer know what the squad is doing, and
  knowing what the squad is doing is the job.
- **"AI-generated" programmes.** I have never seen one that understood a rugby week, a
  fixture list, or a front rower's knees. Generate a programme and you have told me you think
  my job is typing.
- **A social feed.** Not comments, not likes, not kudos, not a squad activity stream. The gym
  is already social. It is a room with twenty people in it.
- **Athletes editing their own prescription.** He can log what he actually lifted, and he
  should, honestly and without judgement. He cannot change what he was asked to lift. That
  distinction is the whole point of section 3.
- **A completion tick that hides the numbers.** Say it three times, because it is the default
  behaviour of every product in this category.
- **Badges, streaks, and celebration animations on a coach surface.** A PB badge at the moment
  of entry on a testing day is fine and it is earned. A confetti burst when somebody finishes
  a set is not.

---

## 12. Visual rules for a gym floor surface

The gym floor screen has different constraints from every other screen in the product. These
are additional to the rules in `14-sports-science-brief.md` §6, which still hold.

| Do | Do not |
|---|---|
| Name at 28 pt minimum, load at 32 pt | 14 pt table type carried over from the web dashboard |
| Full-width rows, one athlete each | A grid of cards with avatars |
| Legible at two metres in poor light | Legible at 40 cm on a designer's monitor |
| Tap targets 56 pt and 12 pt apart | Anything sized for a mouse |
| Static list, sorted once, at session start | A list that re-sorts itself as data arrives |
| Sync state as a dot with a timestamp | A sync banner, ever, during a session |
| Prescribed and completed side by side | A tick, a percentage, or a progress ring |
| "18 min behind" | An amber dot meaning "behind" |
| Landscape iPad as the design target | A phone layout stretched to a tablet |
| Screen stays awake while a session runs | A face unlock with chalked hands, every four minutes |
| Deviation styled neutrally inside tolerance | Red on every set that was not exactly on prescription |
| Back in the same place on every sub-screen | A modal stacked on a modal |

Status colours stay as `--good`, `--warn` and `--bad` from `06-design-system.md`, always with
a glyph, never colour alone. The gym is lit by a mix of daylight and sodium and half the
squad's colour vision is untested.

---

## 13. Open questions

| ID | Question |
|---|---|
| **O-1020** | The gym floor screen does not exist in the specification. `gym-logging.md` is the athlete's phone, `gym-programmes.md` is coach admin. Is a live coach-facing session screen in scope for v1, and does it get its own spec file? My view: it is the highest-value screen in the S&C area and everything else in section 1 depends on it. |
| **O-1021** | Live set logging from 20 athlete phones to one coach iPad needs Supabase Realtime on `gym_set_logs`, scoped per session. What is the acceptable latency, and what happens on the coach device when the subscription drops mid-session? Polling fallback at 15 s is my assumption. |
| **O-1022** | Prescribed versus completed at set level has no screen. Does it live on the floor screen, on `athlete-profile.md` as a fifth block, or both? Both, in my view, and it is the same component. |
| **O-1023** | Which gym load metric is primary: tonnage, sets above an intensity threshold, or gym sRPE? Clubs genuinely disagree. Configurable per organisation, with the choice recorded against every historical figure, is the only safe answer, and it is the same trap as the HSR threshold in O-991. |
| **O-1024** | VBT: Premium tier, and which phase? It needs `mean_concentric_velocity_ms` and device provenance on `gym_set_logs`, which is a schema change worth making now even if the feature ships later. How many of the first ten clubs own a unit? |
| **O-1025** | Force plate: CSV import via `vendor_profiles.column_map`, or a dedicated ForceDecks and Hawkin ingest? CSV first is my view. Which metrics become first-class `test_definitions` rows rather than free-form results? |
| **O-1026** | Limb asymmetry warn threshold defaults to 10% per `testing.md`. Should it default differently for force plate impulse asymmetry, where 10% is arguably tight, and should the threshold vary by whether the athlete is in a return-to-play pathway? |
| **O-1027** | Rehab handover: is the "flag a conflict" action in v1, or is a read-only view of the rehab prescription enough to start? I can live with read-only, but then the conflict conversation happens off-platform and you never see it. |
| **O-1028** | On clearance, residual restrictions carried across as time-limited `load_cap` overrides: created automatically by the resume action, or proposed for me to confirm? Proposed, in my view. A load cap I did not knowingly accept is a load cap I will not remember to remove. |
| **O-1029** | Estimated 1RM: does the product compute e1RM from logged sets at all, and if so does it feed `percent_1rm` resolution, or only display alongside a tested 1RM? My strong preference is display only, never resolution, unless the coach promotes it explicitly. |
| **O-1030** | The one-off substitution "just for today" has no home in the data model. It is not an `exercise_override` because it does not belong to the prescription, and `gym_set_logs.exercise_id` already differs from the prescribed exercise. Is a `substitution_reason` column on the set log enough, or does the floor screen need its own session-scoped adjustment table? |
| **O-1031** | Printing: server-rendered PDF via an Edge Function, or client-side print stylesheet? The squad sheet needs per-athlete resolved loads, which argues for server-side, and it needs to work when the wifi is already failing, which argues for pre-generation the night before. |
