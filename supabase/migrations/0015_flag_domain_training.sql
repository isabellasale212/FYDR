-- A new flag_domain value, 'training', split into its own migration on purpose:
-- Postgres will not let a transaction both add an enum value and use that value in the
-- same transaction ("unsafe use of new value of enum type"), and each migration file
-- runs as one transaction. Used by migration 0016 (leaderboards), whose own header
-- explains why the value is needed: screens/leaderboards.md's own eligibility table
-- already labels `training.total_session_load` and `training.sessions_attended` with
-- domain "training", the enum just never had the value.

alter type flag_domain add value if not exists 'training';
