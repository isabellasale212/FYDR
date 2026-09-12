import type {
  AvailabilityReason,
  BodyArea,
  BodySide,
  InjurySeverity,
  InjuryStatus,
  OccurrenceContext,
} from '@/lib/types/database';
import { fetchCurrentAvailability, fetchOpenInjuries } from './availability';
import { fetchGroupAthleteIds, type Db } from './groups';
import { mustAffect } from '@/lib/write';
import { restrictionLine } from '@/lib/restrictions';

/* screens/injury-dashboard.md and injury-record.md, screens 12 and 13, cut down hard —
 * see each function's own comment for what and why. No new schema at all: injuries,
 * injury_clinical and availability, plus injury_clinical_athlete_view, have existed
 * since migration 0005/0010 and are already exercised by the tenancy suite
 * (030_medical_and_entry_rules_test.sql §1–3), which is exactly why this was buildable
 * without inventing anything about the clinical boundary — that boundary was already
 * decided, and decided carefully. The read side reuses lib/queries/availability.ts's
 * existing fetchOpenInjuries / fetchCurrentAvailability rather than re-querying the
 * same tables a second way: that file's own header already states the coach-safe
 * contract ("injury_clinical is not selected from, not joined to"), and this file adds
 * only what that one doesn't have — a name attached to each row, a full history for one
 * athlete (fetchAthleteInjuries, already relied on by the squad athlete profile page
 * before this file existed in this form), and every write.
 *
 * What's cut: rehab plans, phases and milestones (no table for any of it), the
 * dedicated read_injury_clinical RPC (this build relies on the same RLS the RPC would
 * have added a second layer on top of — see clinical_medical_only in migration 0012,
 * "ONE POLICY. FOR ALL. MEDICAL ONLY."), rehab-groups and team-allocation (each a real
 * screen of their own), the full status/availability change history and audit trail
 * view, and the athlete's own read-only view of their injury
 * (injury_clinical_athlete_view already exists and is tested for exactly this, but
 * nothing in the athlete shell links to it yet — a real, documented gap). */

export type AthleteInjuryRow = {
  id: string;
  body_area: BodyArea;
  side: BodySide | null;
  onset_date: string;
  status: InjuryStatus;
  expected_return: string | null;
  actual_return: string | null;
  /* Where it happened, for the injury card's onset line ("Onset 21 Jul 2026 ·
     Team run, Pitch 1"). Not clinical: injuries.occurred_in is on the base
     table that every injury role reads, alongside body area and dates. The
     clinical record is injury_clinical, a different table with a medic-only
     policy, and nothing here reaches it. */
  occurred_in: string | null;
};

/** The full history for one athlete, closed injuries included — unlike
 *  fetchOpenInjuries, which exists to answer "who is hurt right now", not "what has
 *  this athlete ever had". Used by the squad athlete profile page. */
export async function fetchAthleteInjuries(db: Db, orgId: string, athleteId: string): Promise<AthleteInjuryRow[]> {
  const { data, error } = await db
    .from('injuries')
    .select('id, body_area, side, onset_date, status, expected_return, actual_return, occurred_in')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('deleted_at', null)
    .order('onset_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type InjurySummary = {
  id: string;
  athlete_id: string;
  first_name: string;
  last_name: string;
  body_area: BodyArea;
  side: BodySide | null;
  onset_date: string;
  expected_return: string | null;
  availability_status: string | null;
};

/** The dashboard list, coach and medical alike: reuses fetchOpenInjuries and
 *  fetchCurrentAvailability, which never touch injury_clinical, so this one function
 *  is safe for both roles with no branch inside it — the same defence the spec asks
 *  for by giving coaches no route to the clinical screen at all, applied here too. */
export async function fetchInjuriesList(db: Db, orgId: string, groupIds: readonly string[]): Promise<InjurySummary[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const [injuries, availability, athletesRes] = await Promise.all([
    fetchOpenInjuries(db, orgId, scope),
    fetchCurrentAvailability(db, orgId, scope),
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      // docs/screens/injury-dashboard.md: "An athlete leaves the club with
      // an open injury -> Excluded from the default board" — every sibling
      // athlete query (fetchScopedAthletes, squad.ts, the rehab board) already
      // excludes left_club; this one didn't, so a former athlete's still-open
      // injury kept showing on the board indefinitely. No "include former
      // athletes" toggle exists in this build (that's a real, separate
      // feature gap, not invented here).
      .neq('status', 'left_club'),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);

  const nameById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a.status]));

  return injuries
    .map((i): InjurySummary | null => {
      const athlete = nameById.get(i.athlete_id);
      if (!athlete) return null;
      return {
        id: i.id,
        athlete_id: i.athlete_id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        body_area: i.body_area,
        side: i.side,
        onset_date: i.onset_date,
        expected_return: i.expected_return,
        availability_status: availByAthlete.get(i.athlete_id) ?? null,
      };
    })
    .filter((r): r is InjurySummary => r !== null)
    .sort((a, b) => b.onset_date.localeCompare(a.onset_date));
}

export type InjuryDetail = {
  id: string;
  athlete_id: string;
  first_name: string;
  last_name: string;
  body_area: BodyArea;
  side: BodySide | null;
  onset_date: string;
  status: InjuryStatus;
  expected_return: string | null;
  actual_return: string | null;
  occurred_in: OccurrenceContext | null;
  availability_status: string | null;
  restrictions: string[] | null;
};

/** Non-clinical detail, safe for coach and medical alike. Reads `injuries` and
 *  `availability` directly rather than through fetchOpenInjuries (which excludes a
 *  closed injury — a closed one must still open here, just read-only for a coach).
 *
 *  The athlete's current open availability row is only attributed to THIS injury
 *  when it is actually linked to it (availability.injury_id = this injury's id) —
 *  integration-audit majors, Bug 3. Before this check, this function joined
 *  whatever the athlete's current open availability row happened to be onto
 *  every injury page unconditionally, which meant a closed, long-healed injury
 *  showed the status and restrictions belonging to that athlete's separate,
 *  current, unrelated injury — live-reproduced. If a closed injury has no
 *  currently-linked availability row (the common case: it closed with the
 *  injury and nothing has referenced it since), availability_status and
 *  restrictions are both null here and the page shows nothing, correctly,
 *  rather than someone else's — or some other injury's — live data. */
export async function fetchInjuryDetail(db: Db, orgId: string, injuryId: string): Promise<InjuryDetail | null> {
  const { data, error } = await db
    .from('injuries')
    .select(
      'id, athlete_id, body_area, side, onset_date, status, expected_return, actual_return, occurred_in, athletes!inner(first_name, last_name)',
    )
    .eq('org_id', orgId)
    .eq('id', injuryId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const availability = await fetchCurrentAvailability(db, orgId, [data.athlete_id]);
  const current = availability[0] ?? null;
  const avail = current && current.injury_id === data.id ? current : null;

  return {
    id: data.id,
    athlete_id: data.athlete_id,
    first_name: data.athletes.first_name,
    last_name: data.athletes.last_name,
    body_area: data.body_area,
    side: data.side,
    onset_date: data.onset_date,
    status: data.status,
    expected_return: data.expected_return,
    actual_return: data.actual_return,
    occurred_in: data.occurred_in,
    availability_status: avail?.status ?? null,
    restrictions: avail ? restrictionLine(avail.restrictions) : null,
  };
}

export type InjuryClinical = {
  diagnosis: string | null;
  mechanism: string | null;
  severity: InjurySeverity | null;
  tissue_type: string | null;
  imaging: string | null;
  referral: string | null;
  clinical_notes: string | null;
  treatment_plan: string | null;
};

/** Medical only, enforced by clinical_medical_only in migration 0012 regardless of
 *  who calls this — a coach calling it gets an empty result from RLS, not an error,
 *  which is why the page itself must never call this for a non-medical viewer: an
 *  empty clinical object rendered by mistake still looks like a broken page, even
 *  though no data actually crossed the boundary. */
export async function fetchInjuryClinical(db: Db, orgId: string, injuryId: string): Promise<InjuryClinical | null> {
  const { data, error } = await db
    .from('injury_clinical')
    .select('diagnosis, mechanism, severity, tissue_type, imaging, referral, clinical_notes, treatment_plan')
    .eq('org_id', orgId)
    .eq('injury_id', injuryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export type NewInjuryInput = {
  athleteId: string;
  bodyArea: BodyArea;
  side: BodySide | null;
  onsetDate: string;
  occurredIn: OccurrenceContext | null;
  expectedReturn: string | null;
};

export async function createInjury(
  db: Db,
  orgId: string,
  userId: string,
  input: NewInjuryInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db
    .from('injuries')
    .insert({
      org_id: orgId,
      athlete_id: input.athleteId,
      body_area: input.bodyArea,
      side: input.side,
      onset_date: input.onsetDate,
      occurred_in: input.occurredIn,
      expected_return: input.expectedReturn,
      reported_by: userId,
    })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export type InjuryFieldsInput = {
  bodyArea: BodyArea;
  side: BodySide | null;
  status: InjuryStatus;
  expectedReturn: string | null;
  actualReturn: string | null;
  occurredIn: OccurrenceContext | null;
};

export async function updateInjuryFields(
  db: Db,
  orgId: string,
  injuryId: string,
  input: InjuryFieldsInput,
): Promise<{ error: string | null }> {
  /* G-36. One row, addressed by id, that the caller was just looking at, so no
     rows changed can only mean the policy refused. injuries UPDATE is the
     medic's alone; §3.2 gives everyone else the limited view and no edit. */
  return mustAffect(
    db
      .from('injuries')
      .update({
        body_area: input.bodyArea,
        side: input.side,
        status: input.status,
        expected_return: input.expectedReturn,
        actual_return: input.actualReturn,
        occurred_in: input.occurredIn,
      })
      .eq('id', injuryId)
      .eq('org_id', orgId)
      .select('id'),
    { refusal: 'Not saved: editing an injury record belongs to the medic.' },
  );
}

export type ClinicalInput = {
  diagnosis: string | null;
  mechanism: string | null;
  severity: InjurySeverity | null;
  tissueType: string | null;
  imaging: string | null;
  referral: string | null;
  clinicalNotes: string | null;
  treatmentPlan: string | null;
};

export async function upsertClinical(
  db: Db,
  orgId: string,
  injuryId: string,
  userId: string,
  input: ClinicalInput,
): Promise<{ error: string | null }> {
  const { error } = await db.from('injury_clinical').upsert(
    {
      injury_id: injuryId,
      org_id: orgId,
      diagnosis: input.diagnosis,
      mechanism: input.mechanism,
      severity: input.severity,
      tissue_type: input.tissueType,
      imaging: input.imaging,
      referral: input.referral,
      clinical_notes: input.clinicalNotes,
      treatment_plan: input.treatmentPlan,
      updated_by: userId,
    },
    { onConflict: 'injury_id' },
  );
  return { error: error?.message ?? null };
}

export type SetAvailabilityInput = {
  status: 'available' | 'modified' | 'unavailable';
  restrictions: string[];
  reasonCategory: AvailabilityReason | null;
  note: string | null;
  injuryId: string | null;
};

/** History preserving, the same interval pattern already used for group_memberships
 *  in this build: close the currently-open row, then open a new one, rather than
 *  updating the status in place. Not atomic (two statements, not one RPC) — a real,
 *  documented gap the same shape as the one already noted for session participant
 *  edits in schedule.ts.
 *
 *  restrictions is forced to null here whenever status is 'available',
 *  regardless of what the client sent (integration-audit majors, Bug 1) — an
 *  athlete who is fully available has nothing to restrict, and this is safe to
 *  enforce unconditionally because neither availability RLS insert policy
 *  (availability_medical_insert, 0012; availability_coach_insert_noninjury,
 *  0042) places any constraint on the restrictions column.
 *
 *  reason_category is deliberately NOT forced to null the same way here, even
 *  though the equivalent bug applies to it too. availability_coach_insert_
 *  noninjury (0042) requires reason_category IS NOT NULL on every coach
 *  insert, with no exception for status = 'available' — confirmed by
 *  200_coach_noninjury_availability_test.sql §3c, which asserts that exact
 *  insert (status 'available', reason_category absent) throws 42501 for a
 *  coach. Forcing it null here unconditionally would make this function
 *  itself throw on every coach-authored "clear to available" write, which is
 *  a functional break, not a fix. The two call sites handle this
 *  independently instead: SetAvailabilityForm (medical, no such RLS
 *  constraint) nulls reasonCategory client-side before calling this function;
 *  SetAvailabilityFormCoach cannot safely do the same and does not, by design
 *  — see that component's own comment. AvailabilityBanner is the actual,
 *  unconditional defense for this one: it checks status === 'available'
 *  first and never reads reasonCategory at all once it does, so a leftover
 *  coach-authored value sitting in this column can never reach an athlete's
 *  screen regardless of what is stored here. */
export async function setAvailability(
  db: Db,
  orgId: string,
  athleteId: string,
  userId: string,
  input: SetAvailabilityInput,
): Promise<{ error: string | null }> {
  const { error: closeError } = await db
    .from('availability')
    .update({ effective_to: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('effective_to', null);
  if (closeError) return { error: closeError.message };

  const isAvailable = input.status === 'available';
  const { error } = await db.from('availability').insert({
    org_id: orgId,
    athlete_id: athleteId,
    status: input.status,
    restrictions: !isAvailable && input.restrictions.length > 0 ? input.restrictions : null,
    reason_category: input.reasonCategory,
    injury_id: input.injuryId,
    set_by: userId,
    note: input.note,
  });
  return { error: error?.message ?? null };
}
