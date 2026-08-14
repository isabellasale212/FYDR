-- 0046_training_athlete_participant_check.sql
--
-- What this does
--   Closes the RLS half of the integration-audit Part B finding: an athlete's own
--   self_report insert into training_entries (training_athlete_insert, 0012) checked only
--   org_id + athlete_id = self + source = 'self_report' — never session_id. Any athlete
--   could submit an RPE entry against ANY session id in their org, not only one they were
--   actually scheduled into, by editing the URL (/rpe/[sessionId]). The application layer
--   half of this fix is training.ts's fetchSessionForRpe, which now denies access to a
--   session the athlete is not a participant of before the RPE form even renders — this
--   migration closes the same gap at the RLS layer too, so the rule holds against a direct
--   API call, not only against the page that happens to gate it first.
--
--   Defense in depth, not a substitute for either layer: the application check gives a
--   clean "this session isn't there... or is not one of yours" page instead of a raw
--   insert failure; the RLS check is what actually holds if that application check is ever
--   bypassed, forgotten on a future call site, or reached directly.
--
-- Why this was feasible at the RLS layer (the audit's own escape hatch says it might not be)
--   The audit flagged that RLS enforcement might need "a non-trivial function to resolve
--   group membership inside a policy" and said the application-layer fix alone would be
--   acceptable if so. It turned out not to: session_participants_self_select (0012) already
--   resolves "is this athlete a participant of this session, named directly or via a group
--   they currently belong to" as a plain EXISTS/IN subquery over session_participants and
--   group_memberships, with 0012's own comment confirming that subquery is safe to embed —
--   group_memberships' policies do not reference session_participants (no recursion) and
--   the subquery never touches user_roles (rule 2 at the top of 0012, still respected here).
--   This policy reuses that exact shape rather than inventing a new one.
--
-- session_id is intentionally still allowed to be NULL
--   0004's own comment on training_entries: "session_id is nullable for ad hoc work." No
--   UI path currently submits a null session_id (RpeForm's sessionId prop is required, the
--   only caller of submitTrainingEntry that isn't this migration or the outbox replay), but
--   the schema and this policy both keep that capability intentionally open rather than
--   accidentally closing it — the participant check below only applies when session_id is
--   actually set.
--
-- Which spec sections this implements
--   CLAUDE.md rule 1 (org_id boundary, unaffected — this narrows within it)
--   01-roles-and-permissions.md §2 (an athlete's own write access is to their own
--     scheduled sessions, not the whole org's session id space)
--   04-data-model.md §17.15 (the training_entries write rules this section already covers,
--     extended to the one case it did not yet name)

drop policy training_athlete_insert on public.training_entries;

create policy training_athlete_insert on public.training_entries for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and athlete_id = auth_athlete_id()
    and source = 'self_report'
    and created_by = auth_user_id()
    and (
      session_id is null
      or exists (
        select 1 from public.session_participants sp
        where sp.org_id = auth_org_id()
          and sp.session_id = training_entries.session_id
          and (
            sp.athlete_id = auth_athlete_id()
            or sp.group_id in (
              select gm.group_id from public.group_memberships gm
              where gm.athlete_id = auth_athlete_id()
                and gm.removed_at is null
            )
          )
      )
    )
  );
