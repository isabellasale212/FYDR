-- Widen the audit triggers to five configuration and authoring tables.
--
-- Batch three. 0085 did the clinical three, 0086 did seven more, this is the
-- first of the remaining set. Deliberately five and not fifteen: the last round
-- turned up two row shapes the function had not met, and neither failed loudly.
--
-- WHY THESE FIVE AND NOT THE OTHERS IN THE SAME DOMAINS. Every one is written by
-- a person, rarely, and changes what the product does for everybody in the club:
--
--   thresholds            the rules that decide what raises a flag. Change one
--                         and the squad's flag list changes overnight.
--   leaderboards          which board exists, over which metric.
--   leaderboard_opt_outs  who is on a board and who is not. Consent adjacent.
--   week_templates        the shape a week gets when a template is applied.
--   fixtures              the match a whole week's MD spine is built around.
--
-- The scheduling and programme tables named alongside them are NOT here, and
-- that is a volume decision rather than an oversight. `session_participants` and
-- `session_attendance` are written a row per athlete per session, so publishing
-- one session for a squad of twenty nine writes twenty nine audit rows.
-- `group_memberships` took 17,692 inserts on production over the statistics
-- window against 47 live rows. Those need a decision about whether an audit row
-- per row is what anybody wants, and that decision is not mine to take quietly
-- inside a migration.
--
-- NO SHAPE CHANGE NEEDED, and that was checked rather than assumed. All five
-- carry `id` and `org_id`; `leaderboard_opt_outs` also carries `athlete_id` and
-- the generic function picks it up. The other four resolve a null athlete, which
-- is correct: a threshold is not about an athlete, exactly as a role grant is
-- not (0086's `user_roles` case).
--
-- ONE GENUINELY NEW CASE, and it is the reason leaderboard_opt_outs is in this
-- batch rather than a later one. `leaderboard_opt_outs_self_insert` lets an
-- ATHLETE write their own opt out. Every audited row until now has been written
-- by staff. `audit_acting_role()` walks the five staff roles and returns NULL
-- when none matches, so an athlete's own opt out is recorded with a real actor
-- and a null role. That is correct, and it is pinned by test 450 so nobody later
-- "fixes" the null by defaulting it to 'athlete'.

drop trigger if exists thresholds_audit on public.thresholds;
create trigger thresholds_audit
  after insert or update or delete on public.thresholds
  for each row execute function public.audit_row_change();

drop trigger if exists leaderboards_audit on public.leaderboards;
create trigger leaderboards_audit
  after insert or update or delete on public.leaderboards
  for each row execute function public.audit_row_change();

drop trigger if exists leaderboard_opt_outs_audit on public.leaderboard_opt_outs;
create trigger leaderboard_opt_outs_audit
  after insert or update or delete on public.leaderboard_opt_outs
  for each row execute function public.audit_row_change();

drop trigger if exists week_templates_audit on public.week_templates;
create trigger week_templates_audit
  after insert or update or delete on public.week_templates
  for each row execute function public.audit_row_change();

drop trigger if exists fixtures_audit on public.fixtures;
create trigger fixtures_audit
  after insert or update or delete on public.fixtures
  for each row execute function public.audit_row_change();
