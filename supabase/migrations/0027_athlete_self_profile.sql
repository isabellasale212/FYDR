-- 0027_athlete_self_profile.sql
--
-- What this does
--   Gives an athlete a write path onto exactly one column of their own
--   athletes row: preferred_name. Every other write path onto athletes
--   still belongs to coach/admin (athletes_manage_update, migration 0012)
--   — this migration adds a second, narrower policy alongside it, not a
--   replacement.
--
-- Which spec sections this implements
--   screens/settings.md, "Profile": "Editable by the user themselves:
--   display name, phone, avatar, and for athletes the fields they own. Not
--   editable here: email, roles, squad number, groups, position." For an
--   athlete, "the fields they own" is preferred_name — squad_number and
--   position are explicitly staff-set squad structure in the same
--   paragraph, and date_of_birth is carved out separately as needing staff
--   confirmation (an audited, two-party change this pass does not build —
--   see lib/queries/profile.ts's header for the rest of what this pass
--   does and does not cover).
--
-- Why a column-level grant, not just a row-scoped RLS policy
--   RLS decides which *rows* a policy applies to; it says nothing about
--   which *columns* an UPDATE may touch. A `for update` policy scoped to
--   `id = auth_athlete_id()` alone would still let an athlete's own client
--   attempt to set squad_number or position on their own row — the request
--   would need the query layer to be the only thing stopping it, the same
--   pattern already relied on for users_self_update (migration 0012).
--   Postgres column privileges enforce it a layer earlier and more
--   strongly here: `grant update (preferred_name)` means any SET clause
--   naming a different column is rejected before RLS is even evaluated,
--   regardless of what the query layer sends.

grant update (preferred_name) on public.athletes to authenticated;

create policy athletes_self_update on public.athletes for update
  to authenticated
  using (org_id = auth_org_id() and id = auth_athlete_id())
  with check (org_id = auth_org_id() and id = auth_athlete_id());
