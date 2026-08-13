-- 0040_availability_reason_categories.sql
--
-- What this does
--   Adds three values to availability_reason: 'academic', 'representative', 'other'.
--   Own migration file on purpose — Postgres will not let a transaction both add an
--   enum value and use that value in the same transaction ("unsafe use of new value
--   of enum type"), and each migration file runs as one transaction. Same reasoning,
--   same fix, as 0015_flag_domain_training.sql.
--
-- Why
--   Audit governance finding 2 / gameplan 2.6: a coach needs to record a real,
--   non-injury reason an athlete is unavailable — exam leave, representative honours,
--   a personal or family matter — without a clinical record existing anywhere. The
--   enum already had 'illness' and 'personal' (migration 0001); it had no category
--   for education or representative call-ups, so 'personal' was the only fit and it
--   was a bad one. 0041 is the migration that actually lets a coach write these rows;
--   this one only widens the vocabulary they write.
--
--   'other' exists so the short, non-clinical reason picker
--   (components/SetAvailabilityFormCoach) always has a safe default rather than
--   forcing a guess between 'personal' and 'illness' for a case that is neither.
--
-- What is deliberately not here
--   'suspension' and 'load_management' already existed (migration 0001) and are
--   unchanged. See ADR-008 for why the coach-facing picker does not surface every
--   value this enum holds.

alter type availability_reason add value if not exists 'academic';
alter type availability_reason add value if not exists 'representative';
alter type availability_reason add value if not exists 'other';
