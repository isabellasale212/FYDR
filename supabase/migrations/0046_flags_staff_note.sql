-- 0046_flags_staff_note.sql
--
-- What this does
--   Adds flags.staff_note, a nullable free-text column staff can set when they
--   acknowledge a flag, so the athlete-visible marker this migration's paired
--   application change draws has something human to show alongside the date.
--
-- Which spec sections this implements
--   docs/screens/my-data.md line ~241 ("flags | 'flags' where athlete_visible_at is not
--   null | Dated markers on the chart with the staff note.") and its own carve-out list
--   ("An acknowledged one appears as a dated marker on the relevant chart with the staff
--   note, if any" — "if any" is load-bearing, see the judgement call below).
--   01-roles-and-permissions.md §3 carve-out 2, 04-data-model.md §10/§11.
--
-- The integration-audit finding this closes
--   Acknowledging a flag sets flags.athlete_visible_at (0006, 0012's flags_self_select
--   policy), and that RLS is correct and already live-verified. What was missing is
--   everything above the database: no query, no UI, ever read a visible flag on the
--   athlete side. This migration is the one schema piece that closing gap needs; the
--   application change lives in src/lib/queries/flags.ts (fetchMyVisibleFlags,
--   acknowledgeFlag's new optional note param), src/components/WellnessChart and a new
--   FlagNotice component, src/app/(athlete)/my-data/page.tsx.
--
-- Judgement call, recorded rather than silently made
--   screens/flags.md's full state machine has a separate "Action" step (flag_action(id,
--   type, note), acknowledged -> actioned -> monitoring, a picker of "Load adjusted" /
--   "Spoke to athlete" / "Referred to medical" / "Note only") that is where a free-text
--   note was originally specified to come from. flags.ts's own header comment already
--   records that this codebase never built that step ("Acknowledge and Dismiss cover the
--   two transitions... collapses action and resolve into dismiss here") — there is
--   nowhere in the running app a staff member can currently attach a note to a flag at
--   all, for any of the seven flag_domain values, before or after this migration.
--   Building the full Action picker (a new flag_status transition, a 7-day monitoring
--   window, flag_actions rows of four more types) is a real, separately-scoped feature,
--   not "the in-app visibility gap" this pass is fixing.
--   Rather than ship a marker that can never carry a note until that larger feature
--   lands, or silently build the Action picker to get there, this migration takes the
--   spec at its own word: "with the staff note, if any" says a note is optional, not
--   that Acknowledge must stay silent forever. staff_note is a single nullable column
--   set (optionally) in the same request as flags_staff_update's existing acknowledge
--   write — one field, no new status, no new flag_actions row, no change to the
--   Raised -> Acknowledged transition's shape. It is deliberately NOT sourced from
--   flag_actions.note: that table has no athlete-facing RLS policy at all (only
--   flag_actions_staff_select, coach/medical), and it also carries dismiss_reason and
--   working-note action types (load_adjusted, referred_medical, athlete_spoken_to) never
--   meant for the athlete to read — reusing it would mean either a new, narrow RLS
--   policy carving one action_type out of a staff-working-notes table, or trusting every
--   future flag_actions row to self-censor. A dedicated column on flags, gated by the
--   athlete_visible_at predicate flags_self_select already enforces, needed neither.

alter table public.flags
  add column staff_note text;

comment on column public.flags.staff_note is
  'Optional. Set by staff at acknowledgement (src/lib/queries/flags.ts, acknowledgeFlag). '
  'Readable by the athlete once athlete_visible_at is set, through the same '
  'flags_self_select RLS policy that already gates the row -- no new policy needed here, '
  'since this is an ordinary column on a table that policy already covers end to end. '
  'Never set before acknowledgement: the UI only offers the field on the Acknowledge '
  'action. Not a clinical note -- carve-out 1 (01-roles-and-permissions.md §3) keeps '
  'those in injury_clinical, which this column has no relationship to.';

-- No RLS change. flags_self_select (0012) already reads the full row once
-- athlete_visible_at is not null, so a plain column needs nothing further. flags_staff_
-- update (0012) already allows coach/medical to update any column on an org-scoped row,
-- so staff can set this alongside status/acknowledged_at/acknowledged_by/
-- athlete_visible_at in the same UPDATE. authenticated has no flags UPDATE policy other
-- than flags_staff_update, so an athlete cannot write their own staff_note -- the same
-- protection every other flags column already has.
