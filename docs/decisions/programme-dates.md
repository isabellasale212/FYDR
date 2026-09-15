# Gym programmes get dates, and the dates live on the assignment

**Decided 15 September 2026 by Isabella.** Opened by PATTERN-S6 C2 (which
session is "the athlete's gym session" today) and settles a gap that reaches
past it: a programme session carries a week number and a day number and
nothing that maps either onto a calendar, so no screen can say a session is
due, and nothing can say one was missed.

Needs a migration. Not built.

## The shape

- **A programme stays a template.** It has a number of weeks and the
  sessions inside them. It carries no dates.
- **An assignment carries a start date**, chosen by the S&C at the moment
  they assign the programme to a squad, a group or one athlete.
- **There is no end date.** The end falls out of the start plus the
  programme's length. Nothing can disagree with anything.
- **Week 1 day 1 is the start date.** Every other session counts forward
  from it.

So the same eight week block is assigned to the forwards starting 22
September and to one returning athlete starting 12 January, from one
template, with no copies and no drift between them. This is the shape
migration 0130 already uses for test assignments.

## Rules that come with it

**Overlap is allowed.** An athlete can hold two live assignments at once,
and should be able to: a forward on a lifting block who picks up a hamstring
joins the Rehab group and gets a rehab programme while the lifting block is
still running. Refusing overlap would break rehab. Today shows a row per
open session, as it already does.

**When the weeks run out the assignment is over**, and the programme screen
says so — the block's name and when it finished — rather than emptying.
An empty screen with no explanation reads as a fault.

**Existing assignments have no start date.** They are left unmapped rather
than given an invented one; the S&C sets a date the next time they touch
each one. All accounts are synthetic.

## What this unlocks, and what it does not

Once a session has a date, a screen can say a session is due today and that
one was missed. That reaches compliance and the schedule as well as Today,
and each of those is its own piece of work, not part of this decision.

Until dates exist, the Today gym row keeps the rule ruled alongside this
one: it appears only for a session the athlete has opened today and not
finished (earliest started, where two are open), which never claims a
session is due and so can never be wrong about it. Once dates exist that
row can gain a due-today form.
