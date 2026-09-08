-- Close the default privilege gaps 0013 closed, on the four tables created since.
--
-- WHAT IS WRONG, table by table, measured rather than inferred:
--
--   injury_timeline_event   anon AND authenticated hold all seven privileges.
--                           0080 intended authenticated: select, insert.
--   login_attempts          authenticated holds all seven.
--                           0048 intended authenticated: select.
--   sar_requests            authenticated holds all seven.
--                           0032 intended authenticated: select, insert, update.
--   sar_clinical_reviews    authenticated holds all seven.
--                           0032 intended authenticated: select, insert.
--
-- Every one of those intents is written in the migration that created the table,
-- and every one of them is untrue in the database.
--
-- WHY. This is 0013's bug in both of its halves, returned. Supabase provisions
-- the project with default privileges granting anon, authenticated and
-- service_role everything on any table created afterwards in schema public
-- (pg_default_acl, role postgres: anon=arwdDxtm). GRANT is additive rather than
-- a reset, so a narrow grant lands ON TOP OF the wide default instead of
-- replacing it, and the revoke has to come first. 0013 swept the 29 tables that
-- existed then. Since then:
--
--   0032 and 0048 revoked `from public, anon` and stopped there, leaving
--   authenticated exactly as 0012 left it -- which is the specific mistake 0013's
--   own header describes: "0012's revoke loop stripped that default grant from
--   `public` and `anon` on the 29 base tables, but never from `authenticated`".
--
--   0080 wrote no revoke at all, so injury_timeline_event kept the default for
--   both roles. 0045's comment spells the trap out two migrations earlier: "it
--   must be revoked before the narrow grant below means what it says."
--
-- HOW BAD IT IS, stated precisely rather than dramatically. RLS is enabled on
-- all four. No policy on any of them names anon, and none of them has a DELETE
-- policy at all, so a delete reaches no row: it returns zero rows affected
-- rather than a refusal. The data is held by row level security. What is missing
-- is the grant layer that is supposed to sit under it, and on which this
-- repository's own tests insist -- 010's "anon holds no privilege on any table in
-- public" and 400's two grant assertions have been red since 0080 landed. They
-- were not seen because pgTAP could not be run on this machine until psql was
-- installed, and the checks that DO run on every build had no equivalent. That
-- gap is closed separately by scripts/test-default-privileges.ts.
--
-- TRUNCATE deserves its own sentence, because it is the one privilege here that
-- is NOT subject to row level security: a grant holder can empty the table
-- regardless of policy. No PostgREST verb issues a TRUNCATE, so there is no
-- route to it from the API for either role, and this is a latent grant rather
-- than a live hole. It is also exactly the privilege that made a scratch
-- database unrebuildable once already, which is why test 400 names it. Two of
-- these four tables are the subject access request records and the third is the
-- sign in security log, which is to say the three tables whose whole purpose is
-- to be the thing you can still read after something has gone wrong.
--
-- THE FIX is 0013's, applied to the four tables it could not have known about:
-- revoke from public, anon and authenticated, then re-issue exactly the grants
-- the creating migrations already declared. service_role is deliberately not
-- revoked and keeps what 0032, 0048 and 0087 gave it. This changes no intent. It
-- makes the existing intent true.

-- --------------------------------------------------------------- 0080's table
revoke all on public.injury_timeline_event from public, anon, authenticated;
grant select, insert on public.injury_timeline_event to authenticated;

-- --------------------------------------------------------------- 0048's table
revoke all on public.login_attempts from public, anon, authenticated;
grant select on public.login_attempts to authenticated;

-- -------------------------------------------------------------- 0032's tables
revoke all on public.sar_requests, public.sar_clinical_reviews from public, anon, authenticated;
grant select, insert, update on public.sar_requests to authenticated;
grant select, insert on public.sar_clinical_reviews to authenticated;
