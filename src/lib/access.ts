import type { AppRole } from '@/lib/types/database';

/** The role sets every route gate in the staff app is built from.
 *
 *  docs/access-matrix.md §3 is the specification. This file is that grid, in the
 *  one form the code can actually share: a named constant per distinct column
 *  pattern, so a screen's permission is a reference rather than a fresh opinion.
 *
 *  WHY THIS EXISTS. Before it, 27 route gates each wrote their role literals
 *  inline, and the results disagreed with each other and with the matrix. The
 *  four injury screens are the worked example: two had no role check at all and
 *  two hand-rolled `coach || medic`, which was narrower than the grid on one row
 *  and wider on another. And when the enum grew from four roles to six, not one
 *  of the 114 role checks in this app mentioned strength_conditioning or
 *  nutritionist, because there was no single place that had to be updated.
 *
 *  A set is named for what it means, not for who is in it. Two sets with the
 *  same members today stay separate when the matrix gives them different
 *  reasons, because they will not move together.
 *
 *  NO LONGER WIDEN ONLY. The five-role migration was carried out widen-only,
 *  because the matrix's stricter cells would have taken abilities away from
 *  people using them and that was not a decision to take inside a migration.
 *  All five were put to the owner as G-33 and all five came back decided, on
 *  2026-09-05, with reasons that are worth keeping next to the code:
 *
 *    New and edit session   narrowed. The medic loses scheduling. Not an
 *                           intentional permission, the same "coach or medic
 *                           actually meant not-admin" artefact 0066 found
 *                           everywhere else.
 *    Leaderboard            SPLIT, not taken as written. The medic loses
 *                           create, same artefact. The coach KEEPS it, because
 *                           that one is a real permission somebody chose. The
 *                           matrix itself was corrected to say so.
 *    Nutrition targets      narrowed as written. Coach and medic become
 *                           read-only. Specialist territory in the original
 *                           spec, not a casualty of the four-role bug.
 *    Programme builder      narrowed as written.
 *    Import GPS             narrowed as written.
 *
 *  THE LEAN CLUB IS ANSWERED BY ROLES, NOT BY A WIDER DEFAULT. A club whose one
 *  coach also does the S&C work does not need `coach` to carry programme
 *  authoring for everybody. That person's account holds both roles. Roles are
 *  additive and always have been, which is the same property §2 of the matrix
 *  warns about from the other direction for the nutritionist. Asserted rather
 *  than assumed: supabase/tests/070_programmes_test.sql carries a fixture user
 *  holding coach and strength_conditioning together, and checks they can author
 *  a gym programme that neither a plain coach nor a plain medic can.
 *
 *  ALWAYS AN ALLOW LIST, never a deny list. Roles are additive: the matrix says
 *  so at §2, "Giving a nutritionist any second role that can see injury
 *  information will let them see it". A test written as "not a nutritionist"
 *  would refuse a person who is a nutritionist and a coach, which is the
 *  opposite of how every gate here behaves. */

/** §3.6, the administration block. "Everything in this block belonged to the
 *  removed `admin` role and now belongs to the sport scientist alone."
 *  Users, audit log, retention, club details, subject access release, and GPS
 *  import. */
export const SETTINGS_ADMIN = ['sport_scientist'] as const;

/** §3.6 Clinical review of a request: the one row in the whole grid where the
 *  sport scientist is X. The screen shows the clinical record, which the
 *  database restricts to the medic, so "everything" does not reach it. */
export const CLINICAL_ONLY = ['medic'] as const;

/** §3.1 New and edit session (VEC VEC X X X) and week templates, plus §3.6
 *  Thresholds where the C belongs to the same pair. The people who decide what
 *  the squad is asked to do. */
export const SESSION_EDIT = ['sport_scientist', 'coach'] as const;

/** §3.3 Programme builder and exercise library (VEC V V VEC V) and §3.4
 *  Leaderboard (VECD V V VECD V). Physical development: the S&C builds it, the
 *  coach and the medic read it. */
export const PROGRAMME_EDIT = ['sport_scientist', 'strength_conditioning'] as const;

/** Who may create a REHAB programme, as opposed to a gym one. Migration 0022
 *  split programme writes by type and 0067 kept that split: rehab is clinical
 *  prescription, so it belongs to the medic, plus the sport scientist. */
export const REHAB_PROGRAMME = ['sport_scientist', 'medic'] as const;

/** Anyone who may author a programme of SOME type. The union of PROGRAMME_EDIT
 *  and REHAB_PROGRAMME, and the correct gate for /programmes/new.
 *
 *  Not PROGRAMME_EDIT on its own, which was the first version of this and was
 *  wrong: it would have opened the page to the sport scientist and the S&C and
 *  shut a medic out of the only screen that creates a rehab programme, while
 *  the database still allowed them to write one. A gate narrower than the
 *  policy behind it does not fail closed, it fails confusing. */
export const PROGRAMME_AUTHOR = [
  'sport_scientist',
  'strength_conditioning',
  'medic',
] as const;

/** §3.3 New nutrition target (VC X X X VC). The only set where the nutritionist
 *  has a write the coach does not. */
export const NUTRITION_EDIT = ['sport_scientist', 'nutritionist'] as const;

/** §3.6 Thresholds: VECD VECD V V X. Writing, which today is the coach alone. */
export const THRESHOLD_EDIT = ['sport_scientist', 'coach'] as const;

/** §3.6 Import GPS: VC X X X X. Today the gate is coach or medic, and the
 *  matrix would remove both. See the WIDEN ONLY note at the top of this file:
 *  they keep it and the sport scientist joins them. */
export const GPS_IMPORT = ['sport_scientist'] as const;

/** §3.4 Leaderboard: VECD V V VECD V. Creating a board, which today is the
 *  coach or the medic. */
export const LEADERBOARD_EDIT = [
  'sport_scientist',
  'coach',
  'strength_conditioning',
] as const;

/** §3.2, every row. The nutritionist is X on all of them, which is D-01, the
 *  highest ranked decision in the queue. Everyone else sees the limited view of
 *  §4.1; the clinical record itself is medic only and is enforced in the
 *  database rather than here. */
export const INJURY_ACCESS = [
  'sport_scientist',
  'coach',
  'medic',
  'strength_conditioning',
] as const;

/** Who may LOG or edit a weigh-in. The one rule in the matrix the documents
 *  could not settle between them, decided 2026-09-06 as the union of what both
 *  claim rather than by picking one.
 *
 *  §3.1 gives the S&C and the nutritionist VP on the athlete profile, which
 *  argues neither should write here. But a weigh-in is the input to the
 *  nutrition target the nutritionist owns at VECD in §3.3, and the
 *  specification's own screen table lists "logs a weigh in" among what the sport
 *  scientist does. The medic keeps it too: body mass is clinical context during
 *  a return to play, and §3.1 gives the medic VE on the athlete profile outright
 *  rather than the VP the S&C and nutritionist have.
 *
 *  The coach is the only staff role excluded. Decided 2026-09-06.
 *
 *  READING a weigh-in is a different question and stays open to every staff
 *  role: body mass is not injury data, and the athlete profile is V or better in
 *  all five columns. The page keeps the two apart. */
export const WEIGH_IN_EDIT = [
  'sport_scientist',
  'strength_conditioning',
  'nutritionist',
  'medic',
] as const;

/** Who may set an athlete's availability. Three roles, and the shape is worth
 *  stating because it is not "any staff" and not "the medic" either.
 *
 *  D-35 is explicit that availability belongs to the medic, and 0042's
 *  non-injury path is the documented exception for the coach: an absence or a
 *  rest day is not a clinical judgement. 0068 added the sport scientist to that
 *  coach path. So the union of who can actually write the table is the medic
 *  through availability_medical_*, and the coach and the sport scientist through
 *  availability_coach_*_noninjury. The S&C and the nutritionist hold neither.
 *
 *  The screen was `coach || medic`, which was right before 0068 and left the
 *  sport scientist unable to reach a write the database had already granted
 *  them. Approved 2026-09-06 rather than assumed, because "add the role that has
 *  everything" and "availability is the medic's" are both true here and only one
 *  of them can win. */
export const AVAILABILITY_EDIT = ['sport_scientist', 'coach', 'medic'] as const;

/** §3.2 Rehab groups: VE VP VE VE X. Who may ALLOCATE an athlete to a rehab
 *  group, as opposed to reading the board. The medic and the S&C both do real
 *  rehab work, and the sport scientist has everything; the coach reads it (VP)
 *  and the nutritionist is X with the rest of §3.2.
 *
 *  Matches what 0068 already granted on rehab_assignments. The screen was medic
 *  only, so it was narrower than its own policy: an S&C could allocate through
 *  the database and not through the page. Approved 2026-09-05 as a real access
 *  decision rather than an artefact. */
export const REHAB_ALLOCATION = [
  'sport_scientist',
  'medic',
  'strength_conditioning',
] as const;

/** §3.5. Deliberately the same members as INJURY_ACCESS and deliberately a
 *  separate name: these rows move for different reasons.
 *
 *  This is the BROAD set: the roles that see the whole reports shelf. It is no
 *  longer the whole story, because a nutritionist sees two of the six and not
 *  the other four. REPORT_VISIBILITY below is the per-report grid; this set
 *  remains the answer for every report that has no narrower rule, and for the
 *  export surfaces outside the reports hub. */
export const REPORT_ACCESS = [
  'sport_scientist',
  'coach',
  'medic',
  'strength_conditioning',
] as const;

/** Which roles may open which report. G-30, closed 2026-09-06.
 *
 *  WHY A MAP RATHER THAN A SET. REPORT_ACCESS could not express the
 *  nutritionist, so the code took the only option a single set leaves and
 *  refused that role at the door — all six reports, including the two the
 *  matrix plainly gives them. The fix is not a wider set, which would hand over
 *  the four they should not see; it is a grid, because the specification is a
 *  grid.
 *
 *  THE NUTRITIONIST'S INJURY REPORT IS NOT A NEW REDACTION TIER, and that is
 *  the load-bearing part. /reports/injuries never selects injury_clinical: it
 *  is not joined to, not selected from, and not in the Database type this
 *  client is built against (see queries/availability.ts's header). Body area,
 *  status, restrictions and expected return are the whole of what the page can
 *  reach, for every role that opens it. So admitting the nutritionist gives
 *  them the same censored view a coach and an S&C already get, by construction
 *  rather than by a filter somebody has to remember to apply. Diagnosis stays
 *  medic-only in the database, in injury_clinical's own policy, which this does
 *  not touch.
 *
 *  This DOES reverse D-01 ("nutritionist excluded from all injury and
 *  availability data, everywhere"), and reversing it needs the database to
 *  agree, not just this file — see migration 0074. Decided 2026-09-06.
 *
 *  The S&C is in every row here. §3.5 gives that role the same report set as
 *  the coach, and the coach's own injury view is the censored one above, so
 *  "every report except the medic's clinical detail" is already what the pages
 *  hand them. Nothing narrows for the S&C; what was broken was the hub. */
export type ReportKey = 'compliance' | 'injuries' | 'training' | 'athlete' | 'squad' | 'testing';

export const REPORT_VISIBILITY: Record<ReportKey, readonly AppRole[]> = {
  compliance: ['sport_scientist', 'coach', 'medic', 'strength_conditioning', 'nutritionist'],
  injuries: ['sport_scientist', 'coach', 'medic', 'strength_conditioning', 'nutritionist'],
  training: REPORT_ACCESS,
  athlete: REPORT_ACCESS,
  /* SQUAD WEEKLY IS CLOSED TO THE NUTRITIONIST ON PURPOSE, and this note exists
     because the obvious "correction" is to open it. docs/access-matrix.md §3.5
     lists Squad weekly as VP for that role. The matrix is STALE on this row: the
     decision was taken twice, most recently 2026-09-06, and both times it went
     the other way. Do not widen this to match the document. If the document is
     ever regenerated, this row is the one to check rather than trust. */
  squad: REPORT_ACCESS,
  testing: REPORT_ACCESS,
};

/** §3.4 Analytics and Build an analytics view: V/VEC for the sport scientist and
 *  X for everyone else, which is the tightest restriction in the product.
 *
 *  D-02 in the architecture to-do list, and the five-role migration briefly moved
 *  it the WRONG WAY: running widen-only meant the sidebar row ended up admitting
 *  all five roles, so the tightest restriction became the loosest. Confirmed and
 *  narrowed 2026-09-05. */
export const ANALYTICS = ['sport_scientist'] as const;

/** §3.1 Athlete profile, and the spec's own 2026-09-04 front page, edit 1
 *  (resolves D-26): "Medics can now edit an athlete's biographical details, the
 *  same as coaches. Previously coach-only, medics were explicitly excluded."
 *
 *  Two roles were missing, not one. The screen gated on coach alone and the
 *  policy admitted coach and sport scientist, so a medic was refused by the
 *  database and a sport scientist by the UI. G-37. */
export const ATHLETE_BIO_EDIT = ['sport_scientist', 'coach', 'medic'] as const;

/** Every staff role. Not a gate on its own: `requireStaff()` already guarantees
 *  it, and a screen that admits all five needs no further test. Exported for the
 *  screens that must name the set explicitly, such as the athlete domain pages
 *  where one domain narrows it. */
/** Who may CORRECT a wellness entry or a training entry, decided 2026-09-06.
 *
 *  training_entries.rpe is where an RPE score lives, so "cannot edit wellness
 *  reports or RPE scores" is this one set: the S&C is out, and so is the
 *  nutritionist, whose player-profile writes are bodyweight and the nutrition
 *  plan and nothing else.
 *
 *  This mirrors revise_wellness_entry and revise_training_entry, which migration
 *  0075 narrows to the same three. The RPC is the authorisation and this
 *  constant is the tidiness, per CLAUDE.md §2 rule 2 -- but they must agree, or
 *  the panel offers a control the database will refuse. */
export const ENTRY_CORRECTION = ['sport_scientist', 'coach', 'medic'] as const;

/** Acting on a flag: the first rule in this file that is not a role set.
 *
 *  WHY IT CANNOT BE ONE. "The nutritionist may edit a flag only when it involves
 *  nutrition information" makes the answer depend on the ROW, not only on the
 *  person: the same nutritionist may act on a nutrition flag and not on the
 *  wellness flag beside it in the same list. Every other rule here answers
 *  "which roles"; this one answers "which roles, for which rows", so it is a
 *  function taking the row's domain rather than an array to be membership-tested.
 *
 *  WHAT COUNTS AS NUTRITION is the flag's own domain and nothing looser. A
 *  compliance flag about missed wellness check-ins is not a nutrition flag even
 *  though the nutritionist reads compliance; the domain column is the product's
 *  own answer to "what is this flag about", and second-guessing it here would
 *  put a different definition in the app from the one in the database. */
export const FLAG_EDIT_ANY_DOMAIN = [
  'sport_scientist',
  'coach',
  'medic',
  'strength_conditioning',
] as const;

/** The domain a nutritionist is confined to. Named rather than inlined so the
 *  policy in 0075, the UI and the tests can be seen to mean the same thing. */
export const NUTRITIONIST_FLAG_DOMAIN = 'nutrition';

/** The domains this viewer may act on: 'all', or the explicit list.
 *
 *  Exists because a Client Component cannot be handed a predicate. The obvious
 *  shape for a per-row rule is a function, and PlayerProfileFlags loops over its
 *  own rows so it wants one -- but passing a function across that boundary is a
 *  runtime error in Next, not a type error, so it fails when the page is opened
 *  rather than when it is built. Returning DATA keeps the rule here and lets the
 *  component do its own membership test. */
export function editableFlagDomains(roles: readonly AppRole[]): readonly string[] | 'all' {
  if (hasAnyRole(roles, FLAG_EDIT_ANY_DOMAIN)) return 'all';
  if (roles.includes('nutritionist')) return [NUTRITIONIST_FLAG_DOMAIN];
  return [];
}

export function canEditFlag(roles: readonly AppRole[], domain: string): boolean {
  const allowed = editableFlagDomains(roles);
  return allowed === 'all' || allowed.includes(domain);
}

export const ALL_STAFF = [
  'sport_scientist',
  'coach',
  'medic',
  'strength_conditioning',
  'nutritionist',
] as const;

/** §3.1 Athlete gym: VE V V VE X. The one athlete domain screen a nutritionist
 *  cannot open, because the matrix says so and because it is the screen where
 *  rehab work shows. Its siblings, wellness and nutrition, are V for all five. */
export const ATHLETE_GYM = [
  'sport_scientist',
  'coach',
  'medic',
  'strength_conditioning',
] as const;

/** True when the caller holds any role in the set.
 *
 *  Takes the roles rather than the claims so it is usable from a Server
 *  Component, a Route Handler and a plain helper without any of them agreeing on
 *  a context shape first. */
export function hasAnyRole(
  roles: readonly AppRole[],
  allowed: readonly AppRole[],
): boolean {
  return allowed.some((r) => roles.includes(r));
}

/** The order audit_log.actor_role is chosen in when somebody holds more than
 *  one role. Roles are additive and that column takes a single value, so a
 *  choice has to be made and it should be made in one place.
 *
 *  Medic first, which is the precedence the export and PDF routes already used
 *  when they wrote `includes('medic') ? 'medic' : 'coach'`: if a download could
 *  have been authorised by medical access, that is the fact worth having in the
 *  audit log. The rest follow in order of how much the role can reach.
 *
 *  This exists because the old expression had no honest fallback. It ended in
 *  `: 'coach'`, so once the enum grew, a sport scientist or a nutritionist
 *  exporting a leaderboard was recorded in the audit log as a coach. Not a
 *  leak, but a false entry in the one table whose entire job is being true. */
const AUDIT_PRECEDENCE = [
  'medic',
  'sport_scientist',
  'coach',
  'strength_conditioning',
  'nutritionist',
] as const;

/** The role to record for an action, given every role the actor holds.
 *
 *  Falls back to whatever they do hold if none of the five matches, which can
 *  only be an athlete, and an athlete cannot reach any caller of this. The
 *  fallback exists so the audit write cannot throw: losing the row would be
 *  worse than recording an odd one. */
export function actingRole(roles: readonly AppRole[]): AppRole {
  return AUDIT_PRECEDENCE.find((r) => roles.includes(r)) ?? roles[0] ?? 'athlete';
}
