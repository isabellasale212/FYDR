-- Screen 63, Add athlete. The two rules the database now carries.
--
-- Until 0077 there was no unique constraint on a squad number at all, and the
-- INSERT policy admitted the coach as well as the sport scientist. Both are
-- asserted here rather than in the form, because the form is the courtesy and
-- these are the rule: an application check on a squad number cannot survive two
-- people saving at once, and a screen gate cannot survive somebody with a
-- session and a terminal.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Creating an athlete is the sport scientist's
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth, position, squad_number)
            values (%L, 'Iestyn', 'Probert', '2001-03-14', 'Hooker', 77)$q$,
         tests.uid('orga','org')),
  'the sport scientist adds an athlete'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth, squad_number)
            values (%L, 'Not', 'Allowed', '2001-03-14', 78)$q$,
         tests.uid('orga','org')),
  '42501', null,
  'the COACH cannot: creating is an administration action, narrowed 2026-09-06'
);

/* But the coach keeps editing one that exists, which is the distinction screen
   63 §2 draws and the reason this is not simply "athletes belong to the sport
   scientist". If this ever fails, the two rules have been collapsed into one. */
select lives_ok(
  format($q$update athletes set position = 'Lock' where org_id = %L and id = %L$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1')),
  'and the coach still edits an athlete who already exists'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth)
            values (%L, 'Not', 'Allowed', '2001-03-14')$q$, tests.uid('orga','org')),
  '42501', null,
  'nor the medic'
);
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth)
            values (%L, 'Not', 'Allowed', '2001-03-14')$q$, tests.uid('orga','org')),
  '42501', null,
  'nor the nutritionist'
);


-- ===========================================================================
-- 2. A squad number cannot be taken twice
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth, squad_number)
            values (%L, 'Second', 'Claimant', '2002-05-02', 77)$q$,
         tests.uid('orga','org')),
  '23505', null,
  'a second athlete cannot take squad number 77 -- 23505, the ROW refused, not the person'
);

-- Two clubs, one number, no conflict: the index is per organisation.
select tests.set_jwt(tests.uid('orgb', 'user_admin'));
select lives_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth, squad_number)
            values (%L, 'Same', 'Number', '2002-05-02', 77)$q$,
         tests.uid('orgb','org')),
  'but orgb may use 77 too -- the number is unique within a club, not across the platform'
);

-- No number at all is allowed, and more than one athlete may have none. The spec
-- makes the squad number a field rather than a requirement.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth)
            values (%L, 'No', 'Number', '2003-01-09')$q$, tests.uid('orga','org')),
  'an athlete may be added with no squad number'
);
select lives_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth)
            values (%L, 'Also', 'Numberless', '2003-02-09')$q$, tests.uid('orga','org')),
  'and so may a second -- the index is partial, so NULLs do not collide'
);

-- A departed athlete's number frees up. This is why the index excludes
-- soft-deleted rows rather than covering the whole table.
select lives_ok(
  format($q$update athletes set deleted_at = now() where org_id = %L and squad_number = 77$q$,
         tests.uid('orga','org')),
  'an athlete leaves'
);
select lives_ok(
  format($q$insert into athletes (org_id, first_name, last_name, date_of_birth, squad_number)
            values (%L, 'Takes', 'Seventyseven', '2004-04-04', 77)$q$,
         tests.uid('orga','org')),
  'and their number can be reissued'
);

select * from finish();
rollback;
