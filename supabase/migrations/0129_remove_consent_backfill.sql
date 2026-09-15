-- 0129_remove_consent_backfill.sql
--
-- What this does
--   Reverses 0120's seed backfill of the performance-data record. Decision
--   batch, 14 September 2026 (#6, Isabella): "The consent backfill (0120) is
--   removed. Every existing athlete goes through the consent flow on next
--   open. All accounts are synthetic so nothing real is lost, and it is the
--   only way the flow is ever tested before a real club depends on it.
--   Accepted cost: staff screens look empty until athletes are clicked
--   through."
--
-- Why a new migration and not an edit to 0120
--   0120 is applied; migrations are additive (CLAUDE.md §5). This one undoes
--   exactly the rows that backfill wrote and nothing else: the backfill
--   stamped consent_version = 'seed-pre-S9', so that version is the mark. An
--   athlete who has since gone through the real flow carries a real version
--   ('2026.1') and is untouched; a fixture row ('fixture') is untouched; a
--   declined athlete was never backfilled (the backfill skipped
--   consent_declined_at) and is untouched.
--
-- What changes for those athletes
--   consent_given_at and consent_version return to null, so athletes.in_data
--   (generated from them, 0120 §in_data) becomes false: they are asked
--   nothing by the generator, their entry forms are closed by the restrictive
--   in_data policies, they leave every denominator, and the athlete app's
--   first-run consent screen (docs/athlete/screens/21-consent-first-run.md)
--   opens on their next visit. Saying yes there restores all of it with a
--   real version. The health record was never backfilled and is not touched.
--
-- The self-update guard (0120: an athlete cannot change consent_given_at on
-- their own row) is a trigger on the athlete's own UPDATE; this statement runs
-- as the migration's owner and is the same kind of write the backfill was.

update public.athletes
   set consent_given_at = null, consent_version = null
 where consent_version = 'seed-pre-S9'
   and deleted_at is null;
