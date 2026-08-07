-- 0017_leaderboards_close_privilege_gaps.sql
--
-- Exactly migration 0013's own gap, repeated: 0016 granted select/insert/update to
-- authenticated on its three new tables and execute on compute_leaderboard, but never
-- revoked the default privileges Postgres hands `public` (and so `anon`, which inherits
-- from it) on every newly created object. Grant is additive, not a reset, so 0016's
-- narrower grants landed on top of the untouched wide-open default, not in place of it.
-- Found the same way 0013's gap was found: running npm run test:tenancy for real,
-- test 114, "anon holds no privilege on any table in public".
--
-- Per CLAUDE.md §5, migrations are additive — 0016 is already applied, so this closes
-- the gap rather than editing it.

do $$
declare
  t text;
begin
  foreach t in array array['metric_definitions', 'leaderboards', 'leaderboard_opt_outs']
  loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

grant select on public.metric_definitions to authenticated;
grant select, insert, update on public.leaderboards to authenticated;
grant select, insert, update on public.leaderboard_opt_outs to authenticated;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, unlike a table's default ACL —
-- a different Postgres mechanism, the same shape of gap.
revoke all on function public.compute_leaderboard(uuid) from public;
grant execute on function public.compute_leaderboard(uuid) to authenticated;
