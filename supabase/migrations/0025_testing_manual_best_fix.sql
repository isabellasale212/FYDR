-- 0025_testing_manual_best_fix.sql
--
-- What this does
--   Closes a real gap in 0024's mark_best_attempt, found by testing the
--   manual-override path directly before anything shipped, the same way
--   0020 and 0022 closed gaps found the same way. CLAUDE.md §5, migrations
--   are additive.
--
-- The gap
--   0024's trigger, copied faithfully from screens/testing.md's own SQL,
--   updates is_best on every row in the (athlete, test, date, side) group
--   EXCEPT rows where is_best_manual is true — correct, so a manual pick is
--   never overwritten. But the spec's own SQL never checks whether a manual
--   pick already exists in the group before computing the auto best among
--   the rest. Proved live: mark attempt 2 best manually, then insert a
--   higher attempt 4. Attempt 2 correctly stayed best (untouched, as
--   intended) — and attempt 4 ALSO became best, because it legitimately won
--   the auto-best computation among the non-manual rows, which the trigger
--   then applied regardless of the manual pick sitting right next to it.
--   Two rows with is_best = true in the same group is exactly the ambiguity
--   the natural key and every downstream PB/leaderboard/percent_1rm query
--   assumes cannot happen.
--
-- The fix
--   Check for an existing manual best in the group first. If one exists,
--   every other row's is_best is forced false and the auto-best computation
--   does not run at all — a manual pick, once made, is the only best in its
--   group until someone unmarks it, not merely "not overwritten by the
--   trigger's own hand". If none exists, the original computation runs
--   unchanged.

create or replace function public.mark_best_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_higher boolean;
  v_manual_exists boolean;
begin
  select higher_is_better into v_higher
  from test_definitions where id = new.test_definition_id;

  select exists (
    select 1 from test_results x
    where x.athlete_id = new.athlete_id
      and x.test_definition_id = new.test_definition_id
      and x.test_date = new.test_date
      and x.side is not distinct from new.side
      and x.deleted_at is null
      and x.is_best_manual = true
  ) into v_manual_exists;

  if v_manual_exists then
    update test_results tr
    set is_best = false
    where tr.athlete_id = new.athlete_id
      and tr.test_definition_id = new.test_definition_id
      and tr.test_date = new.test_date
      and tr.side is not distinct from new.side
      and tr.deleted_at is null
      and tr.is_best_manual = false
      and tr.is_best = true;
  else
    update test_results tr
    set is_best = (tr.id = (
      select id from test_results x
      where x.athlete_id = new.athlete_id
        and x.test_definition_id = new.test_definition_id
        and x.test_date = new.test_date
        and x.side is not distinct from new.side
        and x.deleted_at is null
      order by
        case when v_higher then x.value end desc nulls last,
        case when not v_higher then x.value end asc nulls last,
        x.attempt_number asc
      limit 1))
    where tr.athlete_id = new.athlete_id
      and tr.test_definition_id = new.test_definition_id
      and tr.test_date = new.test_date
      and tr.side is not distinct from new.side
      and tr.deleted_at is null;
  end if;

  return new;
end;
$$;
