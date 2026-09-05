-- 0064_gps_no_duplicate_rows.sql
--
-- G-25 / D-42: re-uploading a GPS file duplicated every row it contained.
--
-- WHAT WAS WRONG
--   lib/queries/gpsImport.ts commitGpsImport() always INSERTs, and nothing in
--   the schema stopped it: the three indexes on gps_records (0023:99-101) are
--   ordinary, not unique. Upload the same file twice and every distance in it
--   doubles. Silently, and invisibly to the coach who did it, on the data that
--   feeds the whole GPS half of the app. 0023's own header says re-uploading
--   "is a real thing coaches do", which makes the absence of a constraint the
--   more striking.
--
-- THE STATE THIS APPLIES OVER, checked before writing rather than assumed
--   Queried against production on 2026-09-05, read-only:
--     597 gps_records rows
--     0 duplicate groups under (org_id, athlete_id, record_date, session_id)
--     0 surplus rows
--     0 rows with a null session_id
--   So the constraint goes on clean and no de-duplication step is needed. If
--   that had come back non-zero this migration would have had to delete rows,
--   which is a different and much more careful piece of work.
--
-- WHY NULLS NOT DISTINCT
--   session_id is nullable: a GPS row can be filed against a date with no
--   session. Postgres treats NULLs as distinct in a unique index by default, so
--   a plain constraint would let unlimited duplicates through for exactly those
--   rows — the same bug, surviving in the one case nobody would test. NULLS NOT
--   DISTINCT (Postgres 15+, and this database is 17.6) makes two rows with the
--   same athlete and date and no session collide, which is what a coach means.
--
-- WHY org_id IS IN THE KEY
--   It is redundant, because athlete_id already implies an org. It is included
--   anyway so the index is directly usable by the org-scoped reads that every
--   RLS policy forces, and so the constraint cannot be satisfied across a
--   tenant boundary even if an athlete_id were ever reused. Tenancy first, per
--   CLAUDE.md rule 1.

alter table gps_records
  add constraint gps_records_one_per_athlete_session
  unique nulls not distinct (org_id, athlete_id, record_date, session_id);

comment on constraint gps_records_one_per_athlete_session on gps_records is
  'One GPS row per athlete per session, or per athlete per date where no '
  'session is named. Re-importing a corrected file must REPLACE the row it '
  'replaces, not add a second one — see commitGpsImport(), which upserts onto '
  'this constraint. NULLS NOT DISTINCT is load-bearing: session_id is '
  'nullable and default NULL handling would let the original bug survive for '
  'sessionless rows. G-25.';
