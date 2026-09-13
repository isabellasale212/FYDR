-- 0112_access_denial_log.sql
--
-- PATTERN-S6 C7 — the denial log. Isabella, 2026-09-13: "build it, including
-- the migration and the reference codes. This reverses my earlier deferral. I
-- deferred it because there was no support desk to read the codes. Under a v1
-- that gets sold, a denial a user cannot describe is a support call that
-- cannot be resolved."
--
-- WHAT WAS FOUND. A route refusal (requireReport, requireReportAccess,
-- requireInjuryAccess, requireSubjectAccess, requirePlatformStaff, the
-- analytics gate, the three subject-access routes) redirected and wrote
-- nothing, so there was no reference an administrator could look up. The
-- copy half of C7 (the /denied screen) shipped 2026-09-13 without a code.
--
-- WHAT THIS DOES. One security-definer function any signed-in user may call:
--   log_access_denial(p_gate text, p_path text) returns text
-- It writes one audit_log row — the club's existing append-only log, readable
-- by the sport scientist in Settings › Audit log — for the caller's own org as
-- themselves: action 'access.denied', entity_type 'route', metadata {gate,
-- path (capped at 512), roles (from the token, never from the caller),
-- reference}. It returns the reference: "D-" followed by the row's id in
-- base 36, upper case — short enough to read out on the phone, unique per
-- row, and stored on the row so the audit screen can search for it. No new
-- table, no new policy: the audit log's own rules (0007 append-only, 0012
-- select for the sport scientist, insert as self) already say everything a
-- denial log needs to say.
--
-- Not a plain insert from the app because the reference must be derived from
-- the row's id by one rule at the database, and the row must carry it: the
-- audit log refuses UPDATE for everyone (0007's per-statement trigger), so the
-- id is taken from the sequence first and the row is written with its
-- reference in one INSERT. Test: 680_access_denial_log_test.sql.

create or replace function public.reference_base36(p bigint)
returns text
language plpgsql
immutable
strict
as $$
declare
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  n bigint := p;
  out text := '';
begin
  if n < 0 then
    raise exception 'reference_base36: negative id' using errcode = 'P0001';
  end if;
  if n = 0 then
    return '0';
  end if;
  while n > 0 loop
    out := substr(digits, (n % 36)::int + 1, 1) || out;
    n := n / 36;
  end loop;
  return out;
end;
$$;

comment on function public.reference_base36(bigint) is
  'PATTERN-S6 C7 (0112): an audit_log id as an upper-case base-36 string, the body of a denial reference "D-…".';

create or replace function public.log_access_denial(p_gate text, p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   uuid := public.auth_org_id();
  v_user  uuid := public.auth_user_id();
  v_roles public.app_role[] := public.auth_roles();
  v_id    bigint;
  v_ref   text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_id := nextval('public.audit_log_id_seq');
  v_ref := 'D-' || public.reference_base36(v_id);

  insert into public.audit_log (id, org_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    v_id,
    v_org,
    v_user,
    case when cardinality(v_roles) > 0 then v_roles[1] else null end,
    'access.denied',
    'route',
    null,
    jsonb_build_object(
      'gate', left(coalesce(p_gate, ''), 64),
      'path', left(coalesce(p_path, ''), 512),
      'roles', to_jsonb(v_roles),
      'reference', v_ref
    )
  );

  return v_ref;
end;
$$;

comment on function public.log_access_denial(text, text) is
  'PATTERN-S6 C7 (0112): writes one access.denied audit_log row for the caller, as themselves, and returns its reference "D-<id in base 36>". The reference is stored on the row.';

revoke all on function public.reference_base36(bigint) from public;
grant execute on function public.reference_base36(bigint) to authenticated;
revoke all on function public.log_access_denial(text, text) from public;
grant execute on function public.log_access_denial(text, text) to authenticated;
