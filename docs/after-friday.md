# After Friday — everything deferred for the 18 September meeting

Frozen 15 September. Nothing on this list is worked on before the Scottish
Rugby meeting on Friday 18 September. Added to, not worked from, until then.

The Friday plan itself is in `docs/friday-demo-checklist.md`.

## Product and code

- **The shell costs 217–456ms before anything paints**, in the same region
  as the database, and is now the largest single cost on most screens.
  Bigger prize than any remaining render work. `decisions/skeleton-gate.md`,
  final section.
- **The `$RT` react-dom internal** used by the skeleton floor's hard-load
  path. Pinned by guard; confirm the guard's failure mode degrades to "floor
  not enforced on a hard load" and never to a crash.
- **The 23 tap targets short at 1440 only.** Not defects under ruling #8
  (44px is a touch rule). On record if that ruling ever changes.
- **Accessibility "other findings", 7.** None of the three classes.
- **The five remaining Class 3 defects** (colour as the only carrier) if
  step 2 does not reach them.
- **`--muted-on-tint` on the athlete's tinted grounds** — measure properly
  rather than swapping to `--text` by default.
- **The LEGAL-\* placeholder refs are 10px.** Too small whatever the
  contrast. They may disappear when the legal text lands.
- **PATTERN-S3's board files still say the coach's pitch-side form carries
  availability**, contradicting the confirmed database rule. Design folders
  are read-only to the builder — Isabella or the design manager.
- **The remaining open rows on `docs/design-decisions-outstanding.md`.**
- **The reviewer session** has been idle since 14 September.

### Deferred from the evening queue, 16 September (cosmetic-first: appearance now, behaviour after Friday)

- **A supplements line under Fuelling today.** Dropped from 1.1; a possible
  small feature: the day's supplement guidance beneath the four targets,
  from the nutritionist's plan. Nothing in the schema carries it yet.
- **The gym logger's timer pausing when the app is backgrounded.** Not built
  (1.6 said not to). Since 16 September the logger shows no running clock at
  all — "Started 07:05" in its place (Isabella's ruling after the second
  walkthrough), so nothing runs away while the pause is deferred. Building
  the timer would mean a client-side "away since" and a rule for what a
  paused minute means to the session's minutes; the summary's minutes
  (`minutesBetween(startedAt, completedAt)`) are unchanged by this.
- **The gym logger's edit-restricted-to-current-day rule.** Not built (1.6
  said not to). Today a set is correctable from the logger while the session
  is open and from My data's session page afterwards, on any day. The rule
  to decide: corrections only on the day the session was logged, with staff
  the route after that — then enforced in `revise_gym_set_log`, not only in
  the interface.
- **The Programme tab on a day with no session.** 1.4 asked for today's
  session only. On a rest day the block says "No session today" and names
  the next session by its date — as words, not a row — so the athlete cannot
  open a future session's plan from Programme. My recommendation: make the
  next session a row (read-only plan, no logging until its day), which is
  what a player wanting to see what is coming on Thursday would tap for.
- **The supplement / anti-doping sentence on Meal ideas.** Removed under
  "meals only" (1.5). It fitted none of the six text categories; it is a
  responsibility statement, not helper prose. My recommendation: it belongs
  on the consent or privacy pages under Me, once, not under every list of
  meals.

## Data and infrastructure

- **34 `healthkit_sync` consent rows on production**, recording consent for
  an integration removed from the product. Raise with the solicitor before
  deleting; they are evidence of what was agreed.
- **The region move**, Ireland (`eu-west-1`) to London (`eu-west-2`),
  rebuilt from migrations, clean, no synthetic data.
- **A full club onboarding by hand**, end to end through the interface.
  Never done. Not attempted this week.

## Legal and company — the only real gate on a pilot

None of this is code and none of it moves without Isabella.

- **The lawful basis question.** Six questions in
  `decisions/lawful-basis-open.md`. This is the single thing standing
  between Fydr and a real club.
- Form a limited company.
- ICO registration.
- The DPIA.
- The Children's Code assessment.

## Database enforcement to follow — hidden by role on 16 September, not yet refused

Isabella's ruling, 16 September (the overnight queue): where a control or a
screen is hidden by role for Friday, that is PRESENTATION — recorded as
"hidden", never "not permitted" — and the database enforcement follows after
Friday. Each line below is a hide that the RLS and the write paths do not yet
back. Added as they were built; `docs/access-matrix.md` §8 carries the same
list with the routes.

- **2.3 Nutrition at phone width is the nutritionist's.** The More sheet
  carries no Nutrition row for any other role and `/nutrition` shows a notice
  below 768px; the page still answers, and `NUTRITION_EDIT` (sport scientist
  and nutritionist) still writes. To enforce: narrow the nutrition read/write
  to the nutritionist, or decide the sport scientist keeps it.
- **2.4 Gym programme at phone width is the S&C's.** The sheet carries no Gym
  programme row for any other role and `/programmes` shows a notice below
  768px; `PROGRAMME_EDIT` (sport scientist and S&C) still writes, and the
  medic still authors rehab (`REHAB_PROGRAMME`). To enforce: decide whether
  the phone rule is the rule.
- **3.1 The athlete's nutrition and gym pages, within the profile buttons.**
  Only the nutritionist is shown the edit ways on `/squad/[id]/nutrition`
  (Set a manual target, Edit plans) and only the S&C the override editor on
  a gym programme's per-athlete page (`/programmes/[id]/athlete/[id]`); the
  sport scientist, whom `NUTRITION_EDIT` and `PROGRAMME_EDIT` still admit at
  the RPC, reads. To enforce: narrow those two sets, or rule that the sport
  scientist keeps them.
- **3.2 Tabs by role.** The sidebar's Nutrition row is the nutritionist's
  and Gym programme the S&C's and the medic's (`Sidebar/rows.ts`); every
  other role reaches both through the player profile. The routes answer for
  every staff role. To enforce: decide whether a coach opening `/nutrition`
  by address should be refused.
- **3.2 The medic's creation is a return-to-play protocol.** The medic's
  "+ New programme" reads "+ New return-to-play protocol" and ProgrammeForm
  holds them to the rehab type (`REHAB_PROGRAMME`, migration 0067) — that
  part is enforced. Not yet decided: whether a rehab programme and an injury's
  stage protocol (`injury_protocols`, 0123) should be one thing.
- **3.4 The dashboard's Match tab is the coach's.** The tab is drawn for the
  coach only and the allocate and publish controls on `/dashboard/match` are
  the coach's alone; `SESSION_EDIT` still admits the sport scientist at the
  RPC (`/injuries/team-allocation` still offers them the controls). To
  enforce: narrow the team-allocation writes to the coach, or rule that the
  sport scientist keeps them.

The evening queue, 16 September (Section 2, staff at phone width):

- **2.8 The nutritionist views plans at phone width and does not edit or
  create.** New plan, Duplicate, Assign, the four rate steppers, Manual
  target, Set a manual target and Edit plans are hidden below 768px
  (`data-desktop-only`); `assignPlan` / `versionRule` and the manual-target
  write still answer the nutritionist at every width. To enforce: decide
  whether the rule is "no writes from a phone" (a device rule the database
  cannot see) or "no writes at all for this role" (which would also take the
  desktop's controls).
- **2.8 The S&C views the programmes they made at phone width and does not
  edit, add or create.** Another author's programme rows, every builder
  control, Publish/Archive, the override editor and Remove are hidden below
  768px; `PROGRAMME_EDIT`'s RPCs still answer. The "they made" filter is
  `programmes.created_by = auth.uid()` in presentation only; to enforce it
  would be a new policy on programmes for the S&C, and a ruling on whether
  the sport scientist (who also writes) is bound by it.
- **2.4 The player's Gym, Nutrition and Wellness at phone width.** Only the
  day's session, the day's calories and today-against-usual are drawn; the
  rest of each page is in the DOM under `data-desktop-only`. Nothing to
  enforce — the same role reads the same rows at every width — recorded so
  nobody reads the phone view as a narrower permission.
