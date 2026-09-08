/* A local-only look at one clinical field, so a decision can be made by looking
 * rather than by imagining.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. Isabella wants to see diagnosis-only on their
 * own screen, against a real record, before deciding whether that is the right
 * level of detail to put in front of a player. This is that window and nothing
 * more. It is NOT Tier 2: there is no age gate, no mechanism, no route of its
 * own, and no test of the athlete's own experience. It exists to be looked at
 * and then deleted, and Tier 2 should be written from scratch beside it.
 *
 * WHY FOUR LOCKS RATHER THAN A FLAG. This is the first code in the repository
 * that puts a clinical field on an athlete's screen, and the thing being
 * previewed is precisely the thing not yet approved. A single flag read the
 * wrong way in a deployed environment is a disclosure, so this refuses unless
 * every one of four independent conditions holds. Two of them are about the
 * environment and two are about the database, because the environment ones are
 * the ones that can be wrong without anybody noticing:
 *
 *   NODE_ENV !== 'production'      a Vercel build sets it, so this alone stops
 *                                  it in every deployed environment
 *   FYDR_PREVIEW_DIAGNOSIS === '1' explicit, exact, and off even locally until
 *                                  somebody types it
 *   the URL names scratch          and
 *   the URL does not name production
 *
 * THE LAST TWO ARE THE ONES THAT MATTER when the first two are wrong. A local
 * dev server pointed at the production database — which has happened on this
 * project, and is recorded in the to-do list as the reason an audit trail could
 * not tell two clients apart — refuses here regardless of NODE_ENV. Both are
 * checked separately: "names scratch" alone would pass a string carrying both
 * refs, and "not production" alone passes a typo that names neither.
 *
 * THE REFS ARE REPEATED FROM scripts/lib/scratch-guard.mjs, which a Next server
 * module cannot import. Duplicated constants drift, so test-diagnosis-preview
 * pins the two files to each other, the same way the SQL and TypeScript audit
 * role orderings are pinned.
 */

import type { Db } from '@/lib/queries/groups';

/** Scratch. Must match scripts/lib/scratch-guard.mjs. */
const SCRATCH_REF = 'stfgzkuvczbpxyevxkak';
/** Production. Must match scripts/lib/scratch-guard.mjs. */
const PRODUCTION_REF = 'asbxorjytxsvrzefwzqp';

type PreviewEnv = {
  NODE_ENV?: string | undefined;
  FYDR_PREVIEW_DIAGNOSIS?: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
};

/** True only on a local machine, explicitly asked for, against scratch. */
export function diagnosisPreviewEnabled(env: PreviewEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.FYDR_PREVIEW_DIAGNOSIS !== '1') return false;

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (url.includes(PRODUCTION_REF)) return false;
  if (!url.includes(SCRATCH_REF)) return false;

  return true;
}

/* The repository's own client type, not a structural one written here. A
   hand-written shape for a four-link chain (.from().select().eq().maybeSingle())
   pushes tsc past its instantiation depth limit against PostgREST's real
   builder — the same TS2589 the sign-in audit hit on a two-link chain — and
   every other query module in lib/queries takes `Db` anyway. What stops a
   caller reaching this is the gate, not the parameter type. */

/**
 * The diagnosis for one injury, or null.
 *
 * ONE COLUMN. `injury_clinical_athlete_view` exposes seven — diagnosis,
 * mechanism, severity, tissue_type, imaging, referral and treatment_plan — and
 * withholds only clinical_notes. Isabella's decision of 2026-09-08 is that
 * imaging and the detailed treatment plan are held back pending a proper look,
 * so this asks for the one field being previewed and nothing else. The database
 * being more permissive than the product is the whole reason to be explicit
 * here: a select star would quietly hand over all seven and pass every test
 * that only checks diagnosis is present.
 *
 * THE GATE IS RE-CHECKED, not assumed. The page asks it too, so this is the
 * second check of the same thing — deliberately, because the next caller of
 * this function will not necessarily be the page, and a fetch that trusts its
 * caller is a fetch that leaks the first time somebody forgets.
 *
 * Returns null on any error rather than throwing: a preview must never be able
 * to take down the screen it is previewed on.
 */
export async function fetchDiagnosisPreview(
  db: Db,
  injuryId: string | null | undefined,
): Promise<string | null> {
  if (!diagnosisPreviewEnabled()) return null;
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
