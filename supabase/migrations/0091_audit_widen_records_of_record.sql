-- Widen the audit triggers to the records you reach for after something has
-- already gone wrong.
--
-- Batch five. 0085 did the clinical three, 0086 seven more, 0088 five
-- configuration tables, 0089 the programme authoring chain. These five are the
-- documents somebody asks for during a dispute, a data request or an
-- investigation, and until now none of them recorded who touched them:
--
--   sar_requests           a subject access request, and its status as it moves.
--   sar_clinical_reviews   the medic deciding what is withheld from one, and why.
--   injury_timeline_event  the shared injury record the medic and S&C both write.
--   rehab_assignments      who put an athlete into rehab, and when.
--   users                  the account list. Created, renamed, suspended.
--
-- Three of those five are tables whose grants 0090 has just corrected, and that
-- is not a coincidence. They kept turning up as the ones nobody had looked at.
--
-- VOLUME, checked rather than assumed. Live counts: 1, 2, 1, 5, 46. Every write
-- path in src/ is a single row insert or a single row update -- users is touched
-- by settings/users/create, bulk-invite/send, userManagement (status), avatar and
-- profile, and nothing else. `users.last_seen_at` is READ by three components and
-- WRITTEN by nothing at all, in src/ or in any migration, so it is not the
-- per-request update it looks like and does not make this table high volume.
-- (It also means every account reads "Never signed in" on screen, which is a
-- separate bug and is written down as one rather than fixed here.)
--
-- NO SHAPE CHANGE NEEDED, and one path gets its first real exercise. All five
-- carry id and org_id. sar_requests and rehab_assignments carry athlete_id
-- directly. injury_timeline_event and sar_clinical_reviews carry NEITHER, but
-- both carry injury_id, and audit_row_change() already resolves an athlete
-- through public.injuries in that case -- a special case written for 0085's
-- injury_clinical and used by nothing else since. These are its second and third
-- users, and 470 asserts both, because a path with one user is a path that has
-- only ever been proven for one shape.
--
-- users IS THE OTHER SHAPE WORTH SAYING OUT LOUD. It carries no user_id column,
-- so the identity allowlist finds nothing to copy and metadata comes back empty
-- apart from the changed list. That is correct and not a gap: the entity IS the
-- identity. entity_id is the account, actor_id is the person who acted on it,
-- and suspending somebody is therefore fully attributable with an empty
-- metadata object. 470 pins that so nobody widens the allowlist to fill a hole
-- that is not one.
--
-- ORGANISATIONS IS DELIBERATELY NOT HERE. It has no org_id column at all -- it
-- IS the org -- so the generic function would write an audit row with a null
-- org_id, which audit_log's own select policy (org_id = auth_org_id()) can never
-- return. Auditing it needs the same special case athletes has, where the row's
-- own id becomes the org. That is a function change rather than a trigger, and
-- it belongs in its own migration with its own test.

drop trigger if exists sar_requests_audit on public.sar_requests;
create trigger sar_requests_audit
  after insert or update or delete on public.sar_requests
  for each row execute function public.audit_row_change();

drop trigger if exists sar_clinical_reviews_audit on public.sar_clinical_reviews;
create trigger sar_clinical_reviews_audit
  after insert or update or delete on public.sar_clinical_reviews
  for each row execute function public.audit_row_change();

drop trigger if exists injury_timeline_event_audit on public.injury_timeline_event;
create trigger injury_timeline_event_audit
  after insert or update or delete on public.injury_timeline_event
  for each row execute function public.audit_row_change();

drop trigger if exists rehab_assignments_audit on public.rehab_assignments;
create trigger rehab_assignments_audit
  after insert or update or delete on public.rehab_assignments
  for each row execute function public.audit_row_change();

drop trigger if exists users_audit on public.users;
create trigger users_audit
  after insert or update or delete on public.users
  for each row execute function public.audit_row_change();
