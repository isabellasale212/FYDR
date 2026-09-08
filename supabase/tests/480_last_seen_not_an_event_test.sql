-- users.last_seen_at is bookkeeping, not an event.
--
-- WHY THIS FILE EXISTS. 0091 attached the audit trigger to `users` on the same
-- day the sign-in path started writing `users.last_seen_at`. Those two changes
-- are individually right and together wrong: every sign-in would write a
-- `users.update` audit row saying that somebody's last_seen_at moved, next to
-- the `auth.signed_in` row already written by recordSignIn that says the same
-- thing with the address, the method and the session on it. One event, two rows,
-- and the second one is the useless one.
--
-- audit_row_change() already refuses to record a write in which only
-- `updated_at` moved, for exactly this reason. `last_seen_at` is the same kind
-- of column -- written by machinery, never by a person choosing to change it --
-- and 0092 adds it to the same exclusion.
--
-- THE HALF THAT MATTERS MORE IS THE NEGATIVE ONE. An exclusion is a hole in an
-- audit trail, so this file asserts both directions: a sign-in writes no row,
-- AND suspending an account still writes one, AND a write that moves both still
-- records the half a person chose. An exclusion that swallowed a real change
-- would be worse than the noise it was added to prevent.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

do $$
declare adm uuid := tests.uid('orga','user_admin');       -- sport_scientist
        nut uuid := tests.uid('orga','user_nutritionist');
        n   integer;
        base integer;
begin
  perform tests.set_jwt(adm);
  select count(*) into base from audit_log where action = 'users.update' and entity_id = nut;

  -- 1. THE SIGN-IN. Only last_seen_at moves, which is what recordSignIn does.
  update users set last_seen_at = now() where id = nut;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the last_seen_at write changed % rows, not 1', n; end if;

  -- 2. A REAL CHANGE, so the exclusion is measured against something.
  update users set status = 'suspended' where id = nut;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the suspension changed % rows, not 1', n; end if;

  -- 3. BOTH AT ONCE, which is the case an exclusion gets wrong.
  update users set status = 'active', last_seen_at = now() + interval '1 minute' where id = nut;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the combined write changed % rows, not 1', n; end if;

  if base <> 1 then
    raise exception 'expected exactly one pre-existing users.update row (the claims_version bump), saw %', base;
  end if;
end $$;

select tests.set_jwt(tests.uid('orga','user_admin'));

-- ---------------------------------------------------------------------- reads
/* Four writes happened to this account in total: the fixtures' claims_version
   bump from being granted a role, then the three above. Three audit rows are
   expected, because the sign-in is not one. */
select is(
  (select count(*)::int from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')),
  3,
  'four writes, three audit rows: the sign-in touch is not an event'
);

select ok(
  not exists (
    select 1 from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["last_seen_at"]'::jsonb
  ),
  'no audit row anywhere names last_seen_at as a column that moved'
);

-- --------------------------------------------- and the exclusion is not a hole
select is(
  (select count(*)::int from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["status"]'::jsonb),
  2,
  'both status changes are still recorded, including the one written alongside a last_seen_at'
);

select is(
  (select count(*)::int from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' = '["status"]'::jsonb),
  2,
  'and the combined write records status ALONE — the half a person chose, without the bookkeeping'
);

select ok(
  exists (
    select 1 from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["claims_version"]'::jsonb
  ),
  'and the role grant is still on the account, so the exclusion took nothing else with it'
);

/* THE RULE THIS PROTECTS, restated on another table so the change is known to be
   narrow. updated_at was already excluded; adding a second name must not become
   a general licence to drop columns from the changed list. */
select is(
  (select count(*)::int from (
     select jsonb_array_elements_text(metadata -> 'changed') as k from audit_log
     where action ~ '\.update$' and metadata ? 'changed'
   ) c where k in ('updated_at', 'last_seen_at')),
  0,
  'across every audited table, no changed list names either excluded column'
);

select * from finish();
rollback;
