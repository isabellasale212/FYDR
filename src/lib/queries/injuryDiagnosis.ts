import type { Db } from './groups';

/* The athlete's own diagnosis, and nothing else from the clinical record.
 *
 * ONE COLUMN, AND THAT IS A PRODUCT DECISION RATHER THAN A PERMISSION.
 * `injury_clinical_athlete_view` exposes seven fields — diagnosis, mechanism,
 * severity, tissue_type, imaging, referral and treatment_plan — and withholds
 * only clinical_notes. The club decided that permission long ago. Isabella's
 * decision of 2026-09-08, taken after looking at diagnosis-only on screen, is
 * that the SCREEN shows the diagnosis and no more for now: imaging and the
 * detailed treatment plan are held back, and mechanism is pending a look at the
 * real text before it is decided either way. Not a no, a separate decision.
 *
 * SO THE DATABASE IS DELIBERATELY MORE PERMISSIVE THAN THIS QUERY, and the gap
 * is the point rather than an oversight. It means the restraint lives here, in
 * one select list, where it can be read and changed by whoever holds the next
 * decision — and it means a test of this file has to assert the columns that are
 * NOT selected. Asserting that `diagnosis` appears would pass just as well if
 * all seven were fetched. See scripts/test-injury-diagnosis.ts.
 *
 * THE AGE GATE IS NOT HERE, and could not be. Migration 0093 puts it in the
 * view: an athlete under 18 matches no row, and a linked athlete cannot have a
 * null date of birth (athletes_dob_required_when_linked). Doing it a second time
 * in this file was considered and rejected — `athlete_is_minor()` is SECURITY
 * DEFINER and `authenticated` cannot execute it, so the only application-level
 * check available would be a second round trip to `athlete_age_view` that can
 * change no outcome. The view is the gate. Test 490 is what holds it.
 */

/**
 * The diagnosis for one injury, or null when there is none, when there is no
 * injury, or when the reader is a minor — which are indistinguishable here, and
 * deliberately so. The screen renders nothing in every one of those cases.
 *
 * Returns null rather than throwing. A clinical line failing to load must not
 * take down the screen an athlete uses to log their morning wellness.
 */
export async function fetchAthleteDiagnosis(
  db: Db,
  injuryId: string | null | undefined,
): Promise<string | null> {
  if (!injuryId) return null;

  try {
    const { data, error } = await db
      .from('injury_clinical_athlete_view')
      .select('diagnosis')
      .eq('injury_id', injuryId)
      .maybeSingle();
    if (error) return null;
    return data?.diagnosis ?? null;
  } catch {
    return null;
  }
}
