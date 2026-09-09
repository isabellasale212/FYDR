-- A corrected comment is measured, not quoted.
--
-- WHAT 0100 CHANGED AND WHY THIS FILE IS SEPARATE FROM 540. Since 0058,
-- entry_revision.created recorded {"comment": {"from": "...", "to": "..."}} with
-- both texts in full, in a table sport_scientist can read. 0096 took the
-- opposite decision for gym comments and 0099 followed it, which left the schema
-- saying two different things about the same kind of field: a CORRECTED comment
-- was readable and a DELETED one was not. 540 asserts 0099's half. This asserts
-- 0100's, and asserts the half of these functions that must NOT have moved.
--
-- THE SECOND HALF IS THE POINT. 0100 regenerated two SECURITY DEFINER bodies
-- from pg_get_functiondef() and edited them programmatically. The narrowing is
-- easy to verify and easy to get right; the risk is what else moved in a
-- hundred lines nobody retyped. So this file spends as many assertions on the
-- rules that were already there — staff-only, no athlete branch, linear chain,
-- tenancy — as on the change itself.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
begin
  insert into wellness_entries (id, org_id, athlete_id, entry_date, sleep_hours,
                                sleep_quality, fatigue, comment, source)
    values (tests.uid('orga','w1'), o, a1, current_date, 6.5, 3, 2,
            'Slept badly, left hamstring tight all morning', 'self_report');
  insert into training_entries (id, org_id, athlete_id, entry_date, rpe, duration_min,
                                comment, source)
    values (tests.uid('orga','t1'), o, a1, current_date, 7.0, 65,
            'Pulled up after the shuttles', 'self_report');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on, so the refusals below measure something');

-- ------------------------------------------- 1. the comment is not quoted
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"comment": "Slept fine", "sleep_hours": 8.0}'::jsonb)$q$,
         tests.uid('orga','w1'), tests.uid('orga','w2')),
  'a coach corrects a wellness comment and a number in the same revision'
);
select lives_ok(
  format($q$select revise_training_entry(%L, %L, '{"comment": "Calf, not hamstring"}'::jsonb)$q$,
         tests.uid('orga','t1'), tests.uid('orga','t2')),
  'and a training comment'
);

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));   -- only they may read audit_log

select ok(
  (select metadata -> 'changed' ? 'comment' from audit_log where entity_id = tests.uid('orga','w2')),
  'the comment IS named, so a reader knows the text was rewritten and by whom'
);
select is(
  (select metadata -> 'changed' -> 'comment' ->> 'from_length' from audit_log where entity_id = tests.uid('orga','w2')),
  '45', 'with how long it was'
);
select is(
  (select metadata -> 'changed' -> 'comment' ->> 'to_length' from audit_log where entity_id = tests.uid('orga','w2')),
  '10', 'and how long it became'
);
select ok(
  (select not (metadata -> 'changed' -> 'comment' ? 'from')
      and not (metadata -> 'changed' -> 'comment' ? 'to')
     from audit_log where entity_id = tests.uid('orga','w2')),
  'but neither the old text nor the new one'
);
select is(
  (select metadata -> 'changed' -> 'comment' ->> 'from_length' from audit_log where entity_id = tests.uid('orga','t2')),
  '28', 'the same on a training entry, which is the other function 0100 changed'
);
select ok(
  (select not (metadata -> 'changed' -> 'comment' ? 'from')
     from audit_log where entity_id = tests.uid('orga','t2')),
  'and it is not quoted there either'
);

/* THE NUMBERS MUST STILL CARRY THEIR VALUES. A narrowing that swept up every
   field would make the audit log useless and would pass a test that only looked
   at the comment. */
select is(
  (select metadata -> 'changed' -> 'sleep_hours' ->> 'from' from audit_log where entity_id = tests.uid('orga','w2')),
  '6.5', 'sleep_hours still records the value it was'
);
select is(
  (select metadata -> 'changed' -> 'sleep_hours' ->> 'to' from audit_log where entity_id = tests.uid('orga','w2')),
  '8.0', 'and the value it became'
);
select ok(
  (select not (metadata -> 'changed' -> 'sleep_hours' ? 'from_length')
     from audit_log where entity_id = tests.uid('orga','w2')),
  'and is not measured instead — only the free-text field changes shape'
);

/* THE WHOLE POINT, stated as the property rather than the mechanism. */
select ok(
  not exists (
    select 1 from audit_log
    where metadata::text like '%hamstring tight%'
       or metadata::text like '%shuttles%'
       or metadata::text like '%Slept fine%'
       or metadata::text like '%not hamstring%'),
  'no audit row in this transaction contains a word either of them actually typed'
);

-- ------------------- 2. and nothing ELSE in these two functions moved
/* 0100 regenerated two SECURITY DEFINER bodies. These are the rules that were
   already there, and a regeneration that quietly dropped one would be a far
   worse bug than the disclosure it set out to fix. */
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"fatigue": 1}'::jsonb)$q$,
         tests.uid('orga','w2'), tests.uid('orga','w3')),
  'P0001', 'not_permitted',
  'the S&C still may NOT correct a wellness entry — 0075 narrowed this and 0100 kept it'
);
select throws_ok(
  format($q$select revise_training_entry(%L, %L, '{"rpe": 5}'::jsonb)$q$,
         tests.uid('orga','t2'), tests.uid('orga','t3')),
  'P0001', 'not_permitted',
  'nor a training entry, which is where an RPE score lives'
);
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"fatigue": 1}'::jsonb)$q$,
         tests.uid('orga','w2'), tests.uid('orga','w3')),
  'P0001', 'not_permitted',
  'and an athlete cannot revise their own entry — 0058 removed that branch'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"fatigue": 1}'::jsonb)$q$,
         tests.uid('orga','w1'), tests.uid('orga','w4')),
  'P0001', 'entry_not_revisable',
  'a superseded row cannot be revised again — the chain stays linear'
);
select throws_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"fatigue": 1}'::jsonb)$q$,
         tests.uid('orgb','w1'), tests.uid('orga','w5')),
  'P0001', 'entry_not_revisable',
  'and an entry in another organisation is not reachable at all'
);

/* THE LONGEST COMMENT THAT CAN EXIST. Written first with 9000 characters to
   exercise the 8192-byte overflow branch, which raised 23514: both tables carry
   CHECK (char_length(comment) <= 1000). So the overflow branch was never
   reachable through a comment even before 0100 — two maximum-length comments
   come to roughly 2KB — and after it a comment contributes two integers. Worth
   asserting the real bound rather than deleting the case: it is the edge a
   length-only record has to survive, and 1000 is where it actually sits. */
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$select revise_training_entry(%L, %L, %L::jsonb)$q$,
         tests.uid('orga','t2'), tests.uid('orga','t4'),
         jsonb_build_object('comment', repeat('x', 1000))::text),
  'a 1000-character comment — the longest the CHECK permits — is accepted'
);
/* Back to the sport scientist to READ. The first version of this file left the
   coach's JWT in place here and the three assertions below returned NULL rather
   than failing — a coach cannot read audit_log at all, which is correct, and is
   exactly how a reading assertion goes quiet instead of red. */
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select ok(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga','t4')) = 1,
  'canary: the reader can actually see the row these assertions are about'
);
select is(
  (select metadata -> 'changed' -> 'comment' ->> 'to_length' from audit_log where entity_id = tests.uid('orga','t4')),
  '1000', 'and is recorded as its length'
);
select ok(
  (select not (metadata -> 'changed' ? 'fields')
     from audit_log where entity_id = tests.uid('orga','t4')),
  'without tripping the 8192-byte overflow branch, which a length-only record cannot reach'
);
select ok(
  (select length(metadata::text) < 400 from audit_log where entity_id = tests.uid('orga','t4')),
  'and the row stays small: a 1000-character comment costs the audit log two integers'
);

select * from finish();
rollback;
