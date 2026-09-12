-- 0105_training_submitted_at_clamp.sql
--
-- §0ad, Builder Q6 — decided by Isabella 2026-09-12: "send queuedAt from the
-- outbox and use it when it is earlier than the arrival time AND within 24
-- hours of it; otherwise use the arrival time. Reason: an athlete rating
-- pitch-side with no signal shouldn't be marked missing, but device clocks
-- can't be trusted indefinitely."
--
-- WHY. Compliance now counts an RPE only if it was submitted before the end
-- of the following club-local day (rpeClosesAt; the compliance report and the
-- athlete report both judge training_entries.submitted_at). submitted_at was
-- the database's now() at insert — the moment the row ARRIVED — so a rating
-- made in time on a phone with no signal, queued by the outbox and flushed
-- after the cutoff, would have counted as a miss for something the athlete
-- did. The outbox knows when the athlete rated (its queuedAt) and now sends
-- it as submitted_at. This trigger is what makes that safe to accept:
--
--   - a client can only ever move its own submission EARLIER — a value at or
--     after now() (a clock set ahead, or the default itself) is replaced by
--     now(), so nothing can be post-dated;
--   - and by at most 24 hours — older than that is replaced by now(), so a
--     clock set to last month, or a queue item that sat for a week, cannot
--     back-date a rating into a window it missed.
--
-- BEFORE INSERT only. A row's submitted_at is never updated by any path
-- (corrections are new rows — revise_training_entry inserts its own now(),
-- which this trigger leaves alone because it is not earlier than now()).
-- training_entries only: wellness and nutrition compliance are matched on
-- entry_date, which the outbox already carries, so their arrival time is not
-- judged.

create or replace function public.training_entries_clamp_submitted_at()
returns trigger
language plpgsql
as $$
begin
  if new.submitted_at is null
     or new.submitted_at >= now()
     or new.submitted_at < now() - interval '24 hours' then
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists training_entries_clamp_submitted_at on public.training_entries;
create trigger training_entries_clamp_submitted_at
  before insert on public.training_entries
  for each row execute function public.training_entries_clamp_submitted_at();

revoke execute on function public.training_entries_clamp_submitted_at() from public, anon, authenticated;
