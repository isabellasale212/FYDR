-- PATTERN-S9: the athlete consent record, the guardian route and what a
-- decision gates. Isabella, 13 September 2026 (the overnight queue, item 2),
-- built against docs/designs/PATTERN-S9-final/ and the builder's Step 1
-- answers in docs/overnight-records-2026-09-13.md.
--
-- THE RECORD IS TWO, NOT ONE, AND ONLY ONE IS NAMED.
--   Performance data: the existing consent_given_at / consent_version (0002),
--   NOT renamed — the lawful basis is open (docs/decisions/lawful-basis-open.md)
--   and renaming after real data exists would change what the stored rows
--   claim an athlete did. They gain consent_declined_at and
--   consent_withdrawn_at beside them.
--   Health and injury data: named now — health_consent_given_at / _version /
--   _declined_at / _withdrawn_at — because Article 9 needs explicit consent
--   whatever the performance basis turns out to be.
-- Both blocks are answered by one tap on the athlete's screen tonight (the
-- board's "I agree to both blocks"); the columns are separate so a separate
-- health answer lands later without a migration.
--
-- THE VERSION is the identifier the screen showed (LEGAL-3D decides the rule
-- for re-asking; until it is drafted the string names the placeholders, so a
-- reviewer can see what was on screen).
--
-- in_data, ONE PREDICATE THE DATABASE COMPUTES: the performance record is
-- given and neither declined nor withdrawn. Every denominator reads it —
-- generate_compliance_expectations below asks nothing of an athlete not in
-- data, and the headcount reads in the app filter on it (lib/queries/inData).
-- A declined athlete is in the squad, in the lists, has no entries and no
-- readiness, and is dropped from every count rather than counted as a
-- non-submitter (the board's question 4).
--
-- THE GUARDIAN. An athlete under 18 (athlete_is_minor: date of birth, a null
-- one counts) does not decide for themselves: the club records a guardian
-- name and email at invite (guardian_name, guardian_email), the guardian gets
-- a tokenised page with no account (guardian_consent_requests), and the
-- decision lands on the athlete's own columns with parental_consent_method =
-- 'guardian_link'. The admin-recorded offline route stays as the other
-- values of the same enum; the record says which was used.
--
-- WHAT A DECISION GATES, at the database:
--   - the four athlete entry tables (wellness_entries, training_entries,
--     gym_session_logs + gym_set_logs, nutrition_checkins): a RESTRICTIVE
--     insert policy — an athlete's own row lands only while they are in data.
--     Restrictive, so it ANDs with every existing permissive policy and
--     replaces none (check-policy-replacements).
--   - the clinical record (injuries; injury_clinical hangs off it): a
--     restrictive insert policy — no new row for an athlete whose health
--     record is declined or withdrawn. Availability (ADR-008, the coach's operational fact) is not
--     gated; wellness is performance data on this board (sheet item: whether
--     it is Article 9 data — the solicitor's).
--
-- WHO WRITES THE COLUMNS. Nobody directly from an athlete session: the self-
-- update column guard (0028/0029) now refuses every consent and guardian
-- column, and the two athlete functions below are the only path —
-- record_data_consent (adult; a minor is told a guardian answers) and
-- withdraw_data_consent. The guardian's path is guardian_decide(token,
-- decision), anon-callable and security definer, reading nothing but the
-- token. Staff record the offline route through athletes_manage_update as
-- before. Every write leaves an audit row.
--
-- EXISTING ROWS. Every athlete today has no decision recorded and every one is
-- synthetic seed data (the decision batch: "All production data is
-- synthetic"). Linked athletes are backfilled with the performance record
-- (version 'seed-pre-S9') so the staff screens do not empty the moment this
-- lands; the health record is NOT backfilled — nothing ever asked, and a
-- synthetic yes to an Article 9 question is not worth writing. On the sheet.

-- ---------------------------------------------------------------------------
-- 1. The guardian's online route is one value of the existing enum.
-- ---------------------------------------------------------------------------
alter type public.parental_consent_method add value if not exists 'guardian_link';

-- ---------------------------------------------------------------------------
-- 2. The columns.
-- ---------------------------------------------------------------------------
alter table public.athletes
  add column consent_declined_at         timestamptz,
  add column consent_withdrawn_at        timestamptz,
  add column health_consent_given_at     timestamptz,
  add column health_consent_version      text,
  add column health_consent_declined_at  timestamptz,
  add column health_consent_withdrawn_at timestamptz,
  add column guardian_name               text,
  add column guardian_email              text,
  add column in_data boolean generated always as (
    consent_given_at is not null and consent_declined_at is null and consent_withdrawn_at is null
  ) stored;

alter table public.athletes
  add constraint athletes_guardian_email_shape
  check (guardian_email is null or guardian_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

create index athletes_in_data_idx on public.athletes (org_id, in_data) where deleted_at is null;

comment on column public.athletes.consent_given_at is
  'The performance-data decision, given: the date and time the athlete (or their guardian, see parental_consent_method) agreed on the screen whose version is consent_version. NOT renamed to notice_* while the lawful basis is open — docs/decisions/lawful-basis-open.md — because renaming after real data exists changes what the stored rows claim an athlete did. PATTERN-S9, 0120.';
comment on column public.athletes.consent_version is
  'The version identifier the screen showed when the performance-data decision was made (LEGAL-3D decides the re-asking rule). Until the wording is drafted it names the placeholders. docs/decisions/lawful-basis-open.md.';
comment on column public.athletes.consent_declined_at is
  'The performance-data decision, declined (artboard 3B). Set with the date shown on the squad list; the athlete stays in the squad and out of every denominator (in_data).';
comment on column public.athletes.consent_withdrawn_at is
  'The performance-data decision, withdrawn later from Settings › Your data. Submitted entries are left alone pending LEGAL-3E.';
comment on column public.athletes.health_consent_given_at is
  'The health and injury data decision (Article 9, explicit consent), given. Named now whatever the performance basis turns out to be. PATTERN-S9, 0120.';
comment on column public.athletes.health_consent_version is
  'The version identifier shown for the health block (LEGAL-3B / LEGAL-3D).';
comment on column public.athletes.health_consent_declined_at is
  'The health decision, declined: no new injury or clinical row for this athlete (the restrictive policies below).';
comment on column public.athletes.health_consent_withdrawn_at is
  'The health decision, withdrawn later. Existing clinical rows are left alone pending LEGAL-3E.';
comment on column public.athletes.guardian_name is
  'For an athlete under 18: the guardian the club holds, captured at invite on the Add athlete form. Shown to the athlete (artboard 4A) and never asked of them.';
comment on column public.athletes.guardian_email is
  'The guardian''s address the tokenised consent page is emailed to. Shown to the athlete masked (b***@***.com) and never asked of them. Not an account.';
comment on column public.athletes.in_data is
  'Generated: the performance record is given and neither declined nor withdrawn. The one predicate every staff denominator reads (0120). A declined, withdrawn, undecided or guardian-outstanding athlete is in the squad and out of the count.';

-- The amendment: the old comment read "There is no parent login." That stays
-- true — the guardian page is tokenised and accountless — and now says so.
comment on column public.athletes.parental_consent_recorded_by is
  'The staff member who recorded a guardian''s decision given offline (parental_consent_method = club_registration_form, written_confirmation, in_person). Null when the guardian answered on the tokenised page themselves (parental_consent_method = guardian_link, 0120). There is no parent login: the guardian''s page is a single-use link with no account behind it, so this column names a person only for the offline route. 09-security-and-compliance.md §4.7.';
comment on column public.athletes.parental_consent_method is
  'How a guardian''s decision was taken for an athlete under 18: recorded by a staff member from a club process (club_registration_form, written_confirmation, in_person), or answered by the guardian on the tokenised page (guardian_link, 0120). not_required when the athlete is not a minor. The record says which route was used; both are wanted.';

-- ---------------------------------------------------------------------------
-- 3. Helpers: the state of one athlete, for policies and the app.
-- ---------------------------------------------------------------------------
create or replace function public.athlete_in_data(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select a.in_data from public.athletes a where a.id = p_athlete_id), false);
$$;
comment on function public.athlete_in_data(uuid) is 'athletes.in_data for one athlete; false for nobody. 0120.';
revoke all on function public.athlete_in_data(uuid) from public;
grant execute on function public.athlete_in_data(uuid) to authenticated, service_role;

create or replace function public.athlete_health_consent_open(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Open unless the health decision has been declined or withdrawn. An athlete
  -- who has not yet answered is NOT refused here: the clinical tables are the
  -- medic's, a pitch-side injury is recorded before an athlete has opened the
  -- app, and refusing that would be the product refusing to know someone is
  -- hurt. The decision, once made, is what gates. Sheet item.
  select coalesce(
    (select a.health_consent_declined_at is null and a.health_consent_withdrawn_at is null
       from public.athletes a where a.id = p_athlete_id),
    false);
$$;
comment on function public.athlete_health_consent_open(uuid) is
  'False once the health and injury decision is declined or withdrawn; true before it is answered. 0120.';
revoke all on function public.athlete_health_consent_open(uuid) from public;
grant execute on function public.athlete_health_consent_open(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. The gates: restrictive insert policies. Restrictive ANDs with the
--    permissive policies each table already has and replaces none of them.
-- ---------------------------------------------------------------------------
create policy wellness_entries_in_data on public.wellness_entries as restrictive for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.athlete_in_data(athlete_id));
create policy training_entries_in_data on public.training_entries as restrictive for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.athlete_in_data(athlete_id));
create policy gym_session_logs_in_data on public.gym_session_logs as restrictive for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.athlete_in_data(athlete_id));
create policy gym_set_logs_in_data on public.gym_set_logs as restrictive for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.athlete_in_data((select l.athlete_id from public.gym_session_logs l where l.id = gym_session_log_id)));
create policy nutrition_checkins_in_data on public.nutrition_checkins as restrictive for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.athlete_in_data(athlete_id));

comment on policy wellness_entries_in_data on public.wellness_entries is
  '0120: an entry lands only for an athlete in data (the performance decision given, not declined, not withdrawn). Restrictive.';

create policy injuries_health_consent on public.injuries as restrictive for insert
  to authenticated
  with check (org_id = public.auth_org_id() and public.athlete_health_consent_open(athlete_id));
-- injury_clinical carries no policy of its own here: a clinical row hangs off
-- an injuries row, which the gate above refuses, and ADR-007's invariant (010:
-- exactly one policy on injury_clinical, the medic's) stays intact.

comment on policy injuries_health_consent on public.injuries is
  '0120: no new injury row for an athlete whose health and injury decision is declined or withdrawn. Restrictive.';

-- ---------------------------------------------------------------------------
-- 5. The guardian's request: one row per send, a hashed single-use token, an
--    expiry, and the decision when it comes.
-- ---------------------------------------------------------------------------
create table public.guardian_consent_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id),
  athlete_id    uuid not null references public.athletes(id),
  guardian_name  text not null,
  guardian_email text not null,
  token_hash    text not null unique,
  version       text not null,
  sent_at       timestamptz not null default now(),
  sent_by       uuid references public.users(id),
  expires_at    timestamptz not null,
  decided_at    timestamptz,
  decision      text check (decision in ('agree', 'decline')),
  created_at    timestamptz not null default now()
);
comment on table public.guardian_consent_requests is
  'PATTERN-S9 artboard 4B: the guardian''s tokenised page. The token itself is never stored — its sha256 is — and the page reads and writes only through guardian_request_by_token / guardian_decide. Seven-day expiry. 0120.';

alter table public.guardian_consent_requests enable row level security;
-- Default-privilege discipline (0090): revoke, then grant only what the
-- policies govern. Nobody signed in inserts directly — request_guardian_consent
-- does, as definer. anon gets nothing: the page goes through the functions.
revoke all on public.guardian_consent_requests from public, anon, authenticated;
grant select on public.guardian_consent_requests to authenticated;
grant select, insert, update, delete on public.guardian_consent_requests to service_role;

create policy guardian_consent_requests_staff_select on public.guardian_consent_requests for select
  to authenticated
  using (org_id = public.auth_org_id() and public.auth_has_any_role(array['sport_scientist']::public.app_role[]));
create policy guardian_consent_requests_self_select on public.guardian_consent_requests for select
  to authenticated
  using (org_id = public.auth_org_id() and athlete_id = public.auth_athlete_id());

create index guardian_consent_requests_athlete_idx on public.guardian_consent_requests (athlete_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- 6. The writes, as functions. Every one leaves an audit row.
-- ---------------------------------------------------------------------------

-- The athlete's own decision on artboard 3A: one tap answers both blocks.
create or replace function public.record_data_consent(p_decision text, p_version text)
returns public.athletes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete public.athletes;
  v_now timestamptz := now();
begin
  if p_decision not in ('agree', 'decline') then
    raise exception 'decision must be agree or decline' using errcode = '22023';
  end if;
  select * into v_athlete from public.athletes where id = public.auth_athlete_id() and org_id = public.auth_org_id();
  if v_athlete.id is null then
    raise exception 'no athlete for this session' using errcode = '42501';
  end if;
  if public.athlete_is_minor(v_athlete.id) then
    -- Artboard 4A: a guardian answers this one; the athlete's own say is a
    -- LEGAL-4A question and is not recorded as the decision.
    raise exception 'guardian_decides' using errcode = 'P0001';
  end if;

  perform set_config('fydr.consent_write', '1', true);
  if p_decision = 'agree' then
    update public.athletes set
      consent_given_at = v_now, consent_version = p_version, consent_declined_at = null, consent_withdrawn_at = null,
      health_consent_given_at = v_now, health_consent_version = p_version, health_consent_declined_at = null, health_consent_withdrawn_at = null,
      parental_consent_method = 'not_required'
    where id = v_athlete.id;
  else
    update public.athletes set
      consent_declined_at = v_now, consent_version = p_version,
      health_consent_declined_at = v_now, health_consent_version = p_version,
      parental_consent_method = 'not_required'
    where id = v_athlete.id;
  end if;

  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_athlete.org_id, public.auth_user_id(), 'athlete',
          case when p_decision = 'agree' then 'consent.agreed' else 'consent.declined' end,
          'athlete', v_athlete.id, v_athlete.id,
          jsonb_build_object('version', p_version, 'blocks', array['performance', 'health'], 'by', 'athlete'));

  select * into v_athlete from public.athletes where id = v_athlete.id;
  return v_athlete;
end;
$$;
revoke all on function public.record_data_consent(text, text) from public;
grant execute on function public.record_data_consent(text, text) to authenticated;

-- Withdrawal, Settings › Your data › Data consent. Submitted entries are
-- left alone pending LEGAL-3E; new ones stop (in_data flips).
create or replace function public.withdraw_data_consent()
returns public.athletes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete public.athletes;
  v_now timestamptz := now();
begin
  select * into v_athlete from public.athletes where id = public.auth_athlete_id() and org_id = public.auth_org_id();
  if v_athlete.id is null then
    raise exception 'no athlete for this session' using errcode = '42501';
  end if;
  if not v_athlete.in_data then
    raise exception 'nothing_to_withdraw' using errcode = 'P0001';
  end if;
  perform set_config('fydr.consent_write', '1', true);
  update public.athletes set
    consent_withdrawn_at = v_now,
    health_consent_withdrawn_at = case when health_consent_given_at is not null and health_consent_withdrawn_at is null then v_now else health_consent_withdrawn_at end
  where id = v_athlete.id;
  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_athlete.org_id, public.auth_user_id(), 'athlete', 'consent.withdrawn', 'athlete', v_athlete.id, v_athlete.id,
          jsonb_build_object('blocks', array['performance', 'health'], 'by', 'athlete'));
  select * into v_athlete from public.athletes where id = v_athlete.id;
  return v_athlete;
end;
$$;
revoke all on function public.withdraw_data_consent() from public;
grant execute on function public.withdraw_data_consent() to authenticated;

-- Ask the guardian: the athlete (artboard 4A's "Send the link again") or a
-- sport scientist. Returns the raw token ONCE, for the caller to put in the
-- email; only its hash is kept.
create or replace function public.request_guardian_consent(p_athlete_id uuid, p_version text)
returns table (request_id uuid, token text, expires_at timestamptz, guardian_name text, guardian_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete public.athletes;
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  select * into v_athlete from public.athletes where id = p_athlete_id and org_id = public.auth_org_id();
  if v_athlete.id is null then
    raise exception 'no such athlete' using errcode = '42501';
  end if;
  if not (v_athlete.id = public.auth_athlete_id() or public.auth_has_any_role(array['sport_scientist']::public.app_role[])) then
    raise exception 'not yours to send' using errcode = '42501';
  end if;
  if not public.athlete_is_minor(v_athlete.id) then
    raise exception 'not_a_minor' using errcode = 'P0001';
  end if;
  if v_athlete.guardian_email is null or v_athlete.guardian_name is null then
    raise exception 'no_guardian_recorded' using errcode = 'P0001';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.guardian_consent_requests (org_id, athlete_id, guardian_name, guardian_email, token_hash, version, sent_by, expires_at)
  values (v_athlete.org_id, v_athlete.id, v_athlete.guardian_name, v_athlete.guardian_email, encode(extensions.digest(v_token, 'sha256'), 'hex'), p_version, public.auth_user_id(), v_expires)
  returning id into v_id;
  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_athlete.org_id, public.auth_user_id(), (public.auth_roles())[1], 'guardian_consent.requested', 'guardian_consent_request', v_id, v_athlete.id,
          jsonb_build_object('expires_at', v_expires, 'version', p_version));
  return query select v_id, v_token, v_expires, v_athlete.guardian_name, v_athlete.guardian_email;
end;
$$;
revoke all on function public.request_guardian_consent(uuid, text) from public;
grant execute on function public.request_guardian_consent(uuid, text) to authenticated;

-- The page, by token: what artboard 4B shows. anon-callable; returns nothing
-- for an unknown token and says why for an expired or decided one.
create or replace function public.guardian_request_by_token(p_token text)
returns table (state text, athlete_first_name text, club_name text, guardian_name text, expires_at timestamptz, decided_at timestamptz, decision text, version text)
language sql
stable
security definer
set search_path = public
as $$
  select case
           when r.decided_at is not null then 'decided'
           when r.expires_at < now() then 'expired'
           else 'open'
         end,
         a.first_name, o.name, r.guardian_name, r.expires_at, r.decided_at, r.decision, r.version
  from public.guardian_consent_requests r
  join public.athletes a on a.id = r.athlete_id
  join public.organisations o on o.id = r.org_id
  where r.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke all on function public.guardian_request_by_token(text) from public;
grant execute on function public.guardian_request_by_token(text) to anon, authenticated, service_role;

-- The guardian's answer. Lands on the athlete's own columns, both blocks,
-- with parental_consent_method = guardian_link and no recorded-by (there is
-- no person at the club in this route). Single use: a decided or expired
-- request refuses.
create or replace function public.guardian_decide(p_token text, p_decision text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.guardian_consent_requests;
  v_now timestamptz := now();
begin
  if p_decision not in ('agree', 'decline') then
    raise exception 'decision must be agree or decline' using errcode = '22023';
  end if;
  select * into v_req from public.guardian_consent_requests where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if v_req.id is null then
    return 'unknown';
  end if;
  if v_req.decided_at is not null then
    return 'decided';
  end if;
  if v_req.expires_at < v_now then
    return 'expired';
  end if;

  update public.guardian_consent_requests set decided_at = v_now, decision = p_decision where id = v_req.id;

  if p_decision = 'agree' then
    update public.athletes set
      consent_given_at = v_now, consent_version = v_req.version, consent_declined_at = null, consent_withdrawn_at = null,
      health_consent_given_at = v_now, health_consent_version = v_req.version, health_consent_declined_at = null, health_consent_withdrawn_at = null,
      parental_consent_recorded_at = v_now, parental_consent_recorded_by = null, parental_consent_method = 'guardian_link'
    where id = v_req.athlete_id;
  else
    update public.athletes set
      consent_declined_at = v_now, consent_version = v_req.version,
      health_consent_declined_at = v_now, health_consent_version = v_req.version,
      parental_consent_recorded_at = v_now, parental_consent_recorded_by = null, parental_consent_method = 'guardian_link'
    where id = v_req.athlete_id;
  end if;

  insert into public.audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id, athlete_id, metadata)
  values (v_req.org_id, null, null,
          case when p_decision = 'agree' then 'guardian_consent.agreed' else 'guardian_consent.declined' end,
          'guardian_consent_request', v_req.id, v_req.athlete_id,
          jsonb_build_object('version', v_req.version, 'blocks', array['performance', 'health'], 'by', 'guardian', 'guardian_name', v_req.guardian_name));
  return 'ok';
end;
$$;
revoke all on function public.guardian_decide(text, text) from public;
grant execute on function public.guardian_decide(text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. The self-update guard refuses every consent and guardian column from an
--    athlete session: the functions above are the only path. The parental_*
--    and dob_* columns join the list — they were not in it, which was a hole
--    nobody had reached because nothing wrote them.
-- ---------------------------------------------------------------------------
create or replace function enforce_athletes_self_update_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not auth_has_any_role(array['athlete']::app_role[]) then
    return new;
  end if;
  -- 0120: the consent functions (security definer, called from the athlete's
  -- own session) mark their write with a transaction-local flag; the guard
  -- lets that write through and nothing else.
  if current_setting('fydr.consent_write', true) = '1' then
    return new;
  end if;

  if new.org_id            is distinct from old.org_id
     or new.user_id        is distinct from old.user_id
     or new.first_name     is distinct from old.first_name
     or new.last_name      is distinct from old.last_name
     or new.date_of_birth  is distinct from old.date_of_birth
     or new.position       is distinct from old.position
     or new.squad_number   is distinct from old.squad_number
     or new.dominant_side  is distinct from old.dominant_side
     or new.height_cm      is distinct from old.height_cm
     or new.status         is distinct from old.status
     or new.joined_at      is distinct from old.joined_at
     or new.left_at        is distinct from old.left_at
     or new.default_team_id is distinct from old.default_team_id
     or new.deleted_at     is distinct from old.deleted_at
     -- 0120: the decision and the guardian are written by the consent
     -- functions and by staff, never by the athlete's own row update.
     or new.consent_given_at is distinct from old.consent_given_at
     or new.consent_version is distinct from old.consent_version
     or new.consent_declined_at is distinct from old.consent_declined_at
     or new.consent_withdrawn_at is distinct from old.consent_withdrawn_at
     or new.health_consent_given_at is distinct from old.health_consent_given_at
     or new.health_consent_version is distinct from old.health_consent_version
     or new.health_consent_declined_at is distinct from old.health_consent_declined_at
     or new.health_consent_withdrawn_at is distinct from old.health_consent_withdrawn_at
     or new.guardian_name is distinct from old.guardian_name
     or new.guardian_email is distinct from old.guardian_email
     or new.parental_consent_recorded_at is distinct from old.parental_consent_recorded_at
     or new.parental_consent_recorded_by is distinct from old.parental_consent_recorded_by
     or new.parental_consent_method is distinct from old.parental_consent_method
     or new.dob_asserted_by is distinct from old.dob_asserted_by
     or new.dob_asserted_at is distinct from old.dob_asserted_at
     or new.activation_blocked_reason is distinct from old.activation_blocked_reason
  then
    raise exception 'athletes: preferred_name is the only column an athlete may update on their own row'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The generator asks nothing of an athlete not in data.
-- ---------------------------------------------------------------------------
create or replace function public.generate_compliance_expectations(
  p_org_id uuid,
  p_date   date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_tz   text;
  v_collects_rpe boolean;
  v_inserted integer := 0;
  v_n        integer;
begin
  select timezone, collects_rpe into v_org_tz, v_collects_rpe
  from public.organisations
  where id = p_org_id and deleted_at is null;

  if v_org_tz is null then
    raise exception 'org_not_found: %', p_org_id using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------------
  -- Wellness: one row per active athlete, unconditional on the schedule. See this
  -- migration's own header for why this diverges from 03-flows.md's rest-day language.
  -- ---------------------------------------------------------------------------
  insert into public.compliance_expectations
    (org_id, athlete_id, expectation_date, domain, session_id, is_required)
  select p_org_id, a.id, p_date, 'wellness'::public.compliance_domain, null, true
  from public.athletes a
  where a.org_id = p_org_id
    and a.deleted_at is null
    and a.status <> 'left_club'
    -- 0120: an athlete not in data (no decision yet, guardian outstanding,
    -- declined, withdrawn) is asked for nothing — dropped from the
    -- denominator by construction, never counted as a non-submitter.
    and a.in_data
    and not exists (
      select 1 from public.compliance_expectations ce
      where ce.athlete_id = a.id
        and ce.expectation_date = p_date
        and ce.domain = 'wellness'
        and ce.session_id is null
    );
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  -- ---------------------------------------------------------------------------
  -- training_rpe and gym: strictly schedule-driven. day_sessions is this organisation's
  -- non-cancelled, non-deleted sessions falling on p_date in the ORGANISATION'S OWN LOCAL
  -- CALENDAR DAY (starts_at at time zone v_org_tz, not a bare UTC ::date cast — the same
  -- timezone correctness the fix plan's Batch 2 items ask for on the read side, applied
  -- here on the write side from the start). resolved is the participant set per session,
  -- copied from session-detail.md's own CTE. candidates is the union of both domains'
  -- expectation rows before the single anti-joined insert below.
  -- ---------------------------------------------------------------------------
  with day_sessions as (
    select s.id, s.session_type, s.requires_rpe, s.starts_at
    from public.sessions s
    where s.org_id = p_org_id
      and s.deleted_at is null
      and s.status <> 'cancelled'
      and (s.starts_at at time zone v_org_tz)::date = p_date
  ),
  resolved as (
    -- Zero participant rows means the whole squad.
    select ds.id as session_id, ds.session_type, ds.requires_rpe, a.id as athlete_id
    from day_sessions ds
    join public.athletes a
      on a.org_id = p_org_id and a.deleted_at is null and a.status <> 'left_club' and a.in_data
    where not exists (
      select 1 from public.session_participants sp where sp.session_id = ds.id
    )
    union
    select ds.id, ds.session_type, ds.requires_rpe,
           coalesce(sp.athlete_id, gm.athlete_id) as athlete_id
    from day_sessions ds
    join public.session_participants sp on sp.session_id = ds.id
    left join public.group_memberships gm
      on gm.group_id = sp.group_id
     and gm.added_at <= ds.starts_at
     and (gm.removed_at is null or gm.removed_at > ds.starts_at)
    where coalesce(sp.athlete_id, gm.athlete_id) is not null
  ),
  candidates as (
    -- 0118: a club that does not collect session RPE expects no rating of
    -- anybody, so no training_rpe expectation is written — the compliance
    -- denominator is honest by construction, not by a filter downstream.
    select athlete_id, 'training_rpe'::public.compliance_domain as domain, session_id
    from resolved
    where requires_rpe and coalesce(v_collects_rpe, true)
    union
    select athlete_id, 'gym'::public.compliance_domain, session_id
    from resolved
    where session_type = 'gym'
  )
  insert into public.compliance_expectations
    (org_id, athlete_id, expectation_date, domain, session_id, is_required)
  select p_org_id, c.athlete_id, p_date, c.domain, c.session_id, true
  from candidates c
  -- 0120: the participant and group routes above reach athletes without the
  -- athletes join; the in_data rule is applied here for all of them.
  where exists (select 1 from public.athletes a where a.id = c.athlete_id and a.in_data)
    and not exists (
    select 1 from public.compliance_expectations ce
    where ce.athlete_id = c.athlete_id
      and ce.expectation_date = p_date
      and ce.domain = c.domain
      and ce.session_id is not distinct from c.session_id
  );
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  return v_inserted;
end;
$$;


revoke execute on function public.generate_compliance_expectations(uuid, date) from public;
revoke execute on function public.generate_compliance_expectations(uuid, date) from anon;
revoke execute on function public.generate_compliance_expectations(uuid, date) from authenticated;


-- ---------------------------------------------------------------------------
-- 9. Seed backfill: the performance record for linked, synthetic athletes.
--    Not the health record. Sheet item.
-- ---------------------------------------------------------------------------
update public.athletes
   set consent_given_at = now(), consent_version = 'seed-pre-S9'
 where user_id is not null
   and consent_given_at is null
   and consent_declined_at is null
   and deleted_at is null;
