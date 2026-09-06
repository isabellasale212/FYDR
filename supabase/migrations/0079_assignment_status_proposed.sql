-- Adds 'proposed' to assignment_status.
--
-- ITS OWN MIGRATION ON PURPOSE. Postgres allows ALTER TYPE ... ADD VALUE inside
-- a transaction, but the new label cannot be USED in that same transaction, and
-- supabase db push runs each file as one. 0080 needs 'proposed' in a policy
-- expression, so the value has to land first and separately. The same
-- constraint shaped migration 0063's enum rename.
--
-- What it means: an assignment the S&C has drafted against an open injury, which
-- is not live to the athlete and is waiting on the medic. Every existing
-- assignment keeps its current status; nothing is backfilled.

alter type assignment_status add value if not exists 'proposed';
