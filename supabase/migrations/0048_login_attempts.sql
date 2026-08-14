-- 0048_login_attempts.sql
--
-- What this does
--   Closes login-security checklist item 4: /login has no rate limiting.
--   09-security-and-compliance.md §8.1's "Failed login lockout" row ("Exponential
--   backoff, plus CAPTCHA after 5 failures | Supabase has built-in rate limits; do not
--   rely on them alone") and §9.4's rate limiting table ("Sign in ... | Supabase defaults
--   plus CAPTCHA after 5 failures | Credential stuffing") were both aspirational — nothing
--   in this schema or LoginForm.tsx tracked a failed attempt anywhere. A failed
--   signInWithPassword just showed a generic error and re-enabled the button instantly,
--   Supabase's own (unconfigured, unknown-to-this-repo) platform defaults the only thing
--   standing between an attacker and unlimited password guesses.
--
--   Builds the exponential-backoff half only. CAPTCHA is a deliberate, documented cut —
--   see the note at the bottom of this file — not silently skipped.
--
-- Why a table, not just an in-memory counter or a Supabase Auth setting
--   Vercel's Next.js deployment is stateless across requests/instances, so an in-memory
--   counter resets constantly and is trivially bypassed by hitting a different lambda.
--   A client-reported attempt count is unforgeable-proof in name only: nothing stops a
--   client from simply not sending it. And 09-security-and-compliance.md is explicit that
--   Supabase Auth's own platform rate limits are "not sufficient alone" (§9.4) — real
--   server-side state, checked before the real signInWithPassword call, is the only shape
--   that is actually a control rather than a suggestion.
--
-- Per-account (email), not per-IP
--   This is a small club roster (tens of staff and athletes per organisation), not a
--   public signup surface with the usual botnet-behind-shared-IP problem a per-IP limiter
--   exists to solve. Per-email is what actually protects the account that matters — the
--   one being guessed — and it is what the task brief and 04-data-model.md's tenancy
--   pattern both point at ("keyed by email ... org-scoped if the email maps to a real
--   org"). A per-IP limit would additionally punish an entire club office sharing one
--   NAT'd connection for one person's typos, which per-email does not.
--
-- Why this table is NOT "athlete data" under CLAUDE.md rule 4 (never hard-deleted)
--   login_attempts holds authentication security telemetry — an email string, a failure
--   count, and timestamps — not a wellness/injury/roster/performance record about an
--   athlete. Rows are deleted outright on a successful sign-in (see
--   login_attempt_record_result below): that is the mechanism working as designed, the
--   same way a rate limiter's own counter resetting after a legitimate request is not
--   "deleting a record", and it is analogous to how this schema already treats short-lived
--   operational state (import_batches, retention's own preview rows) rather than to
--   wellness_entries or injuries.
--
-- The DoS-against-a-legitimate-user tradeoff (task brief's own callout)
--   An attacker who cannot guess a real user's password can still fail on purpose to lock
--   that user out. Two choices bound the damage rather than eliminate the vector entirely
--   (eliminating it means removing the lockout altogether, which reopens item 4):
--     1. The cooldown curve is CAPPED at 60 minutes (login_attempt_record_result's
--        v_cooldowns array below), never indefinite. A legitimate user's worst case is a
--        60 minute wait, not a permanent lock a support ticket has to clear.
--     2. An attempt made WHILE a lockout is already active does not extend it. Without
--        this, an attacker could keep the lock topped up forever by continuing to guess
--        every few seconds, turning a bounded 60 minute cooldown into an unbounded one.
--        login_attempt_record_result checks locked_until > now() FIRST and returns
--        early, untouched, before any counter or timestamp is written.
--   The password reset flow (login/reset, untouched by this migration) remains a second,
--   independent escape hatch for the real account owner throughout any lockout.
--
-- The escalation curve
--   30s -> 2min -> 10min -> 30min -> 60min (capped). attempt_count resets to 0 the moment
--   a lock triggers, so the athlete/staff member gets a fresh 5 attempts once the cooldown
--   serves — but lock_count never resets except on a real successful sign-in, so someone
--   who keeps tripping the lock climbs the curve rather than looping the same 30 second
--   wait forever. "Exponential backoff" per the doc's own words, concretely: 30 -> 120 ->
--   600 -> 1800 -> 3600 (seconds), each step roughly 3-5x the last.
--
-- The 30 minute window
--   A failed attempt more than 30 minutes after the previous one starts a fresh count of
--   1 instead of incrementing. Without this, a single mistyped password today and another
--   mistyped password by the same genuine user three weeks from now would silently add up
--   toward a lockout neither attempt, on its own, earned — "5 failures within a window"
--   per the task brief, not "5 failures ever, no matter how far apart".
--
-- Two SECURITY DEFINER functions, called only from the server (src/app/auth/sign-in/
-- route.ts, via the service-role admin client), never through PostgREST RPC — same
-- discipline as retention.nightly_preview() (0033/0034) and
-- generate_compliance_expectations (0044): execute is revoked from public, anon and
-- authenticated explicitly below (this project's default privileges grant EXECUTE to all
-- three automatically at CREATE FUNCTION time, confirmed live before 0034 was written, so
-- the revoke has to be explicit and by name, not implied by omission).
--   login_attempt_gate(email)          -- read-only pre-check, called BEFORE
--                                          signInWithPassword. If locked, the real Supabase
--                                          Auth call is never made at all.
--   login_attempt_record_result(...)   -- called AFTER signInWithPassword resolves.
--                                          Records the failure (and locks if the 5th one
--                                          just landed), or deletes the row outright on
--                                          success.
--
-- Why no CAPTCHA
--   09-security-and-compliance.md §8.1 and §9.4 both specify "CAPTCHA after 5 failures"
--   alongside backoff. That is a real third-party vendor integration decision (which
--   provider, a new API key in .env.example, a client-side widget, a server-side
--   verification call) outside a database migration's scope and outside what this task
--   was briefed to build. Cutting it silently would leave the doc's own "do not rely on
--   [rate limits] alone" warning half-addressed without saying so; this paragraph is that
--   admission. The exponential backoff in this file is real and load-bearing on its own
--   in the meantime — CAPTCHA would raise the cost of a distributed attack further, not
--   replace the account-level lock this migration already provides.

create table public.login_attempts (
  id              uuid primary key default gen_random_uuid(),
  -- citext, matching users.email (0002) — 04-data-model.md §3's case-insensitivity rule
  -- applies just as much to the email an attacker or a fat-fingering athlete types here.
  email           citext not null,
  -- Nullable: an attempt against an email that matches no real account (typo, or a genuine
  -- probe) still needs to be tracked and lockable, but has no organisation to scope to.
  -- Resolved by the caller (src/app/auth/sign-in/route.ts) from public.users, not looked
  -- up inside these functions, so a lookup failure never blocks the lockout check itself.
  org_id          uuid references public.organisations(id),
  attempt_count   integer not null default 0,
  -- Never reset by time or by a served cooldown -- only a real successful sign-in clears
  -- it (the row is deleted outright). This is what makes the curve escalate rather than
  -- loop the same 30 second wait indefinitely.
  lock_count      integer not null default 0,
  locked_until    timestamptz,
  last_attempt_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint login_attempts_email_key unique (email),
  constraint login_attempts_attempt_count_nonneg check (attempt_count >= 0),
  constraint login_attempts_lock_count_nonneg check (lock_count >= 0)
);

comment on table public.login_attempts is
  'Server-side sign-in rate limiting state, per docs/09-security-and-compliance.md §8.1 '
  'and §9.4 (login-security checklist item 4). One row per email currently being tracked; '
  'deleted outright on a successful sign-in. Written only by the SECURITY DEFINER '
  'functions below, called only from src/app/auth/sign-in/route.ts.';

create index login_attempts_org_id_idx on public.login_attempts (org_id)
  where org_id is not null;

alter table public.login_attempts enable row level security;

-- Same privilege shape as every other table in this schema (0012's own loop): anon gets
-- nothing at all, service_role (which these functions run as as SECURITY DEFINER owner,
-- and which src/lib/supabase/admin.ts's client authenticates as for the one direct table
-- read this feature needs -- resolving org_id from users -- not this table) gets full DML.
revoke all on public.login_attempts from public, anon;
grant select, insert, update, delete on public.login_attempts to service_role;

-- authenticated gets SELECT only, narrowed immediately below to admins reading their own
-- organisation -- the audit_log pattern exactly (0012's audit_admin_select): real,
-- low-sensitivity operational visibility ("is this email currently locked out, and why"
-- for a support conversation), no UI built against it in this pass (not asked for, and
-- CLAUDE.md §5 says do not invent product behaviour the spec doesn't call for) but the
-- access-control groundwork is honest and real, not a policy written only to satisfy
-- 010_rls_coverage_test.sql's "every club table's policy mentions auth_org_id" sweep.
grant select on public.login_attempts to authenticated;

create policy login_attempts_admin_select on public.login_attempts for select
  to authenticated
  using (org_id = auth_org_id() and auth_has_any_role(array['admin']::app_role[]));

-- No insert, update or delete policy for authenticated, for any role. The two functions
-- below are the only writers, and they run as the function owner (SECURITY DEFINER), not
-- as authenticated -- so an application role holding zero write privilege on this table is
-- not a gap, it's the design: nobody should be able to forge, inflate or clear their own
-- (or anyone else's) lockout state from the client.


-- ===========================================================================
-- login_attempt_gate(email): read-only pre-check, called before signInWithPassword.
-- ===========================================================================

create or replace function public.login_attempt_gate(p_email citext)
returns table(is_locked boolean, locked_until timestamptz, seconds_remaining integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_locked_until timestamptz;
begin
  select la.locked_until into v_locked_until
    from public.login_attempts la
   where la.email = p_email;

  if v_locked_until is not null and v_locked_until > now() then
    return query select true, v_locked_until,
      greatest(1, ceil(extract(epoch from (v_locked_until - now())))::int);
  else
    return query select false, null::timestamptz, 0;
  end if;
end;
$$;

comment on function public.login_attempt_gate(citext) is
  'Read-only. Called by src/app/auth/sign-in/route.ts BEFORE the real '
  'supabase.auth.signInWithPassword call -- if is_locked, that call is never made at all, '
  'so a locked-out attacker''s repeated guesses never even reach Supabase Auth.';

revoke execute on function public.login_attempt_gate(citext) from public;
revoke execute on function public.login_attempt_gate(citext) from anon;
revoke execute on function public.login_attempt_gate(citext) from authenticated;


-- ===========================================================================
-- login_attempt_record_result(email, org_id, success): called after
-- signInWithPassword resolves. The only writer of this table.
-- ===========================================================================

-- p_org_id is declared LAST, not in the order this file's header prose lists the
-- arguments, because Postgres requires every parameter after the first one carrying a
-- DEFAULT to carry one too. Order is otherwise irrelevant: src/app/auth/sign-in/route.ts
-- calls this exclusively through supabase-js's .rpc(name, { p_email, p_org_id, p_success }),
-- which PostgREST resolves by name, not position.
create or replace function public.login_attempt_record_result(
  p_email   citext,
  p_success boolean,
  -- default null, not just nullable: the caller genuinely may not have resolved an
  -- organisation (an email matching no real account), and this also makes
  -- scripts/gen-types-from-db.mjs emit `string | null` for the generated Args type
  -- instead of a non-nullable `string` a caller would then have to lie to satisfy.
  p_org_id  uuid default null
)
returns table(is_locked boolean, locked_until timestamptz, seconds_remaining integer, attempts_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       public.login_attempts;
  -- "5 failures" per 09-security-and-compliance.md §8.1 and §9.4, both verbatim.
  v_threshold constant integer := 5;
  -- See this file's header, "The 30 minute window".
  v_window    constant interval := interval '30 minutes';
  -- See this file's header, "The escalation curve". Index 1 is the first lockout a given
  -- email ever earns, index 5 (and beyond, via least() below) is the capped ceiling --
  -- the DoS-against-a-legitimate-user bound this file's header explains at length.
  v_cooldowns constant interval[] := array[
    interval '30 seconds', interval '2 minutes', interval '10 minutes',
    interval '30 minutes', interval '60 minutes'
  ];
  v_cooldown  interval;
begin
  -- Row-level lock for the rest of this call, so two failed attempts against the same
  -- email arriving concurrently cannot both read the same pre-increment count and both
  -- miss crossing the lockout threshold. login_attempt_gate() deliberately does NOT take
  -- this lock (it is a plain read, and locking there risks contending with a legitimate
  -- concurrent sign-in for no benefit worth the deadlock surface).
  select * into v_row from public.login_attempts where email = p_email for update;

  if p_success then
    -- A real sign-in clears everything -- attempt_count, lock_count, locked_until -- not
    -- just the failure streak. This is the "reset the counter on a successful sign-in"
    -- requirement, and it is also what stops lock_count's escalation from ever ratcheting
    -- against a genuine, occasionally-mistyping user forever.
    delete from public.login_attempts where email = p_email;
    return query select false, null::timestamptz, 0, v_threshold;
    return;
  end if;

  if v_row.email is null then
    insert into public.login_attempts (email, org_id, attempt_count, last_attempt_at)
    values (p_email, p_org_id, 1, now())
    returning * into v_row;

    return query select false, null::timestamptz, 0, greatest(v_threshold - v_row.attempt_count, 0);
    return;
  end if;

  -- Currently locked: no-op. Do NOT touch attempt_count, lock_count or locked_until. This
  -- is the other half of the DoS bound in this file's header -- repeatedly guessing while
  -- locked must never extend the lock, or an attacker who can never guess the password
  -- could still hold a real user's account locked indefinitely just by continuing to try.
  if v_row.locked_until is not null and v_row.locked_until > now() then
    return query select true, v_row.locked_until,
      greatest(1, ceil(extract(epoch from (v_row.locked_until - now())))::int), 0;
    return;
  end if;

  -- Not currently locked. Count this failure -- as a fresh window if the last one was
  -- more than v_window ago, otherwise as the next in the current streak. All three
  -- expressions below read v_row's PRE-UPDATE values (ordinary Postgres UPDATE semantics),
  -- so the order of the assignments here does not matter.
  update public.login_attempts
     set attempt_count   = case when v_row.last_attempt_at < now() - v_window then 1
                                 else v_row.attempt_count + 1 end,
         org_id           = coalesce(p_org_id, org_id),
         last_attempt_at  = now()
   where email = p_email
   returning * into v_row;

  if v_row.attempt_count >= v_threshold then
    v_cooldown := v_cooldowns[least(v_row.lock_count + 1, array_length(v_cooldowns, 1))];

    update public.login_attempts
       set lock_count    = lock_count + 1,
           locked_until  = now() + v_cooldown,
           attempt_count = 0
     where email = p_email
     returning * into v_row;

    return query select true, v_row.locked_until, ceil(extract(epoch from v_cooldown))::int, 0;
    return;
  end if;

  return query select false, null::timestamptz, 0, greatest(v_threshold - v_row.attempt_count, 0);
end;
$$;

comment on function public.login_attempt_record_result(citext, boolean, uuid) is
  'The only writer of login_attempts. Called by src/app/auth/sign-in/route.ts AFTER the '
  'real supabase.auth.signInWithPassword call resolves, with p_success = whether it '
  'succeeded. p_org_id is resolved by the caller from public.users, not looked up here.';

revoke execute on function public.login_attempt_record_result(citext, boolean, uuid) from public;
revoke execute on function public.login_attempt_record_result(citext, boolean, uuid) from anon;
revoke execute on function public.login_attempt_record_result(citext, boolean, uuid) from authenticated;
