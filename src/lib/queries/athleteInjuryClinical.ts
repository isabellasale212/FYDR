import type { Db } from './groups';

/* The athlete's own diagnosis and mechanism, and nothing else from the clinical
 * record.
 *
 * TWO COLUMNS OF SEVEN, AND THAT IS A PRODUCT DECISION RATHER THAN A PERMISSION.
 * `injury_clinical_athlete_view` exposes diagnosis, mechanism, severity,
 * tissue_type, imaging, referral and treatment_plan, and withholds only
 * clinical_notes. The club decided that permission long ago. The SCREEN shows
 * two of them, each confirmed separately by Isabella after looking at the real
 * text on a real record: diagnosis on 2026-09-08, then mechanism the same day
 * after reading every mechanism on file rather than one sample.
 *
 * SEVERITY, TISSUE_TYPE, IMAGING, REFERRAL AND TREATMENT_PLAN ARE HELD BACK.
 *
 * MECHANISM IS FREE TEXT with no length limit and no format. Today's entries are
 * short factual phrases — "Inversion in a ruck", "Gradual onset, overload" —
 * but Selby's reads "Head to hip contact making a tackle, no loss of
 * consciousness", which carries a clinical assessment finding rather than a
 * description of the event. Eight tidy entries are not a guarantee about the
 * ninth, and nothing in this file can make them one. It is written down because
 * the next person to widen this should know what kind of field it is.
 *
 * SO THE DATABASE IS DELIBERATELY MORE PERMISSIVE THAN THIS QUERY, and the gap
 * is the point rather than an oversight. It means the restraint lives here, in
 * one select list, where it can be read and changed by whoever holds the next
 * decision — and it means a test of this file has to assert the columns that are
 * NOT selected. Asserting that the two shown fields appear would pass just as
 * well if all seven were fetched. See scripts/test-injury-clinical.ts.
 *
 * THE AGE GATE IS NOT HERE, and could not be. Migration 0093 puts it in the
 * view: an athlete under 18 matches no row, and a linked athlete cannot have a
 * null date of birth (athletes_dob_required_when_linked). Doing it a second time
 * in this file was considered and rejected — `athlete_is_minor()` is SECURITY
 * DEFINER and `authenticated` cannot execute it, so the only application-level
 * check available would be a second round trip to `athlete_age_view` that can
 * change no outcome. The view is the gate. Test 490 is what holds it.
 */

export type AthleteInjuryClinical = {
  diagnosis: string | null;
  mechanism: string | null;
};

const NOTHING: AthleteInjuryClinical = { diagnosis: null, mechanism: null };

/**
 * The two shown fields for one injury, both null when there is no clinical
 * record, no injury, or the reader is a minor — which are indistinguishable
 * here, and deliberately so. The screen renders nothing in every one of those
 * cases and explains none of them.
 *
 * EACH FIELD IS INDEPENDENTLY NULLABLE and that is a real state rather than a
 * defensive type: Viliami Tameifuna has an open hamstring injury and no
 * injury_clinical row at all, and a row can carry a mechanism with no diagnosis
 * or the reverse. The component guards them separately for the same reason.
 *
 * Returns nulls rather than throwing. A clinical line failing to load must not
 * take down the screen an athlete uses to log their morning wellness.
 */
export async function fetchAthleteInjuryClinical(
  db: Db,
  injuryId: string | null | undefined,
): Promise<AthleteInjuryClinical> {
  if (!injuryId) return NOTHING;

  try {
    const { data, error } = await db
      .from('injury_clinical_athlete_view')
      .select('diagnosis, mechanism')
      .eq('injury_id', injuryId)
      .maybeSingle();
    if (error) return NOTHING;
    return { diagnosis: data?.diagnosis ?? null, mechanism: data?.mechanism ?? null };
  } catch {
    return NOTHING;
  }
}
