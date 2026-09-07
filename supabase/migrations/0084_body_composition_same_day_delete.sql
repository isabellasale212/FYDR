-- A weigh-in can be deleted on the day it was logged, and not after.
--
-- A REVERSAL, and a narrower rule than the one previously refused.
-- body_composition had no DELETE grant and no deleted_at, and
-- lib/queries/bodyComposition.ts recorded the reasoning: a logged weigh-in is
-- permanent, editable but not removable, matching the player profile spec's
-- "Edit entries" wording. Decided otherwise on 2026-09-07, with the window that
-- keeps what that decision was actually protecting: yesterday's history stays
-- permanent, and only today's mistake can be taken back.
--
-- created_at, NOT measured_on. The window is about when the row was LOGGED, not
-- the date it describes. Keying on measured_on would let somebody delete a
-- backdated entry they created weeks ago — exactly the history deletion the
-- original decision forbade — while blocking the case this exists for, which is
-- "I typed that wrong a minute ago". A backfilled entry is deletable on the day
-- it is entered and permanent after, same as any other.
--
-- THE ORG'S TIMEZONE, not the server's. At 00:30 BST a UTC date cast still reads
-- as yesterday, so a club would watch the delete button disappear half an hour
-- before their midnight. auth_org_timezone() is the same helper todayIso() uses
-- on the application side, so both ends agree on which day it is.
--
-- THE REFUSAL IS SILENT, which is why this is only half the work. A DELETE
-- refused by a USING clause raises nothing: it matches no row and reports
-- success. deleteWeighIn goes through mustAffect for that reason, and the screen
-- hides the control on rows it cannot remove rather than letting somebody press
-- a button that quietly does nothing.
--
-- Same four roles as insert and update (0073): the sport scientist, the medic,
-- the S&C and the nutritionist. The coach is excluded here because the coach
-- cannot log or edit a weigh-in either — WEIGH_IN_EDIT, decided 2026-09-06.

create policy body_composition_same_day_delete on public.body_composition
  for delete to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(ARRAY[
      'sport_scientist'::app_role,
      'medic'::app_role,
      'strength_conditioning'::app_role,
      'nutritionist'::app_role
    ])
    and (created_at at time zone auth_org_timezone())::date
        = (now() at time zone auth_org_timezone())::date
  );

grant delete on public.body_composition to authenticated;
