-- Widen the audit triggers to the programme authoring chain, all six tables.
--
-- Batch four. 0085 did the clinical three, 0086 did seven more, 0088 did five
-- configuration tables. This takes the authoring chain whole rather than in
-- pieces, because a half audited chain is worse than an unaudited one: a reader
-- who can see that a block was added but not that the session inside it was
-- rewritten will draw the wrong conclusion from a complete looking record.
--
--   exercises            the movement itself, and the club's library of them.
--   programmes           the plan. Gym authoring is the S&C's, rehab the medic's.
--   programme_blocks     a phase within a plan.
--   programme_sessions   a day within a phase.
--   programme_exercises  the prescription an athlete actually reads and performs.
--   exercise_overrides   one athlete excused, substituted or capped, and why.
--
-- WHY VOLUME IS NOT A PROBLEM HERE, and it was checked rather than assumed,
-- because volume is exactly what kept the scheduling tables out of 0088. Live
-- counts: 5 programmes, 7 blocks, 6 sessions, 15 programme exercises, 15
-- exercises, 2 overrides. Every write in src/lib/queries/programmes.ts is a
-- single row insert, not a bulk array, so one audit row is one thing a person
-- did. Compare `group_memberships`, which took 17,692 inserts over the
-- statistics window against 47 live rows; that one still needs a decision.
--
-- NO SHAPE CHANGE NEEDED, but ONE SHAPE IS DIFFERENT AND IT MATTERS.
-- `exercises.org_id` IS NULLABLE. Every other table in the chain requires an
-- org; exercises allows a global movement belonging to no club. The generic
-- function copies the row's org_id straight through, so a global exercise
-- produces an audit row with a null org_id, and audit_log's select policy is
-- `org_id = auth_org_id()`, which no null satisfies. The row is recorded and
-- then cannot be read by anybody.
--
-- That is left as it is, deliberately, and pinned by test 460 in both
-- directions so it is a known limitation rather than a later mystery. It is the
-- same shape as the org-less failed sign in row already on the to do list: a
-- correctly recorded event with no org-scoped reader. Both want the same answer,
-- which is a platform level read path, and that answer is not one to invent
-- quietly inside a migration. There are no global exercises in the data today,
-- and the exercises insert policy requires `org_id = auth_org_id()`, so only a
-- service role can create one at all.
--
-- ONE MORE THING THIS BATCH PROVES, in 460 rather than here: every staff written
-- audit row in the suite so far came from a sport scientist, because that is the
-- role permitted to read audit_log and so the role the tests are driven as. A
-- function that returned 'sport_scientist' unconditionally would have passed
-- 430, 440 and 450 alike. The authoring chain is the S&C's work, so 460 writes
-- it as the S&C and asserts the recorded role follows the person.

drop trigger if exists exercises_audit on public.exercises;
create trigger exercises_audit
  after insert or update or delete on public.exercises
  for each row execute function public.audit_row_change();

drop trigger if exists programmes_audit on public.programmes;
create trigger programmes_audit
  after insert or update or delete on public.programmes
  for each row execute function public.audit_row_change();

drop trigger if exists programme_blocks_audit on public.programme_blocks;
create trigger programme_blocks_audit
  after insert or update or delete on public.programme_blocks
  for each row execute function public.audit_row_change();

drop trigger if exists programme_sessions_audit on public.programme_sessions;
create trigger programme_sessions_audit
  after insert or update or delete on public.programme_sessions
  for each row execute function public.audit_row_change();

drop trigger if exists programme_exercises_audit on public.programme_exercises;
create trigger programme_exercises_audit
  after insert or update or delete on public.programme_exercises
  for each row execute function public.audit_row_change();

drop trigger if exists exercise_overrides_audit on public.exercise_overrides;
create trigger exercise_overrides_audit
  after insert or update or delete on public.exercise_overrides
  for each row execute function public.audit_row_change();
