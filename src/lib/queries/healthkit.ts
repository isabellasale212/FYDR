import type { Db } from './groups';

/* Apple Health (HealthKit) sync consent.
 *
 * WHY THIS LIVES ON THE ATHLETE SIDE, NOT IN CLUB SETTINGS. The connection is
 * to one person's phone, so only that person can make it: a coach pressing
 * "Connect" in club settings could never produce a connected phone, and the
 * staff Settings row that used to offer it was a button that could not work by
 * construction. What the club's plan controls is whether the feature is
 * available at all; what the athlete controls is whether their own phone
 * actually sends anything.
 *
 * It is a real consent, not a preference. Migration 0002 created
 * athlete_consents "for genuinely optional processing only", HealthKit sync
 * being one of its two purposes, and 0012's own comment sets the visibility
 * rule this module has to respect:
 *
 *   "A consent is the athlete's, so the athlete grants and withdraws it...
 *    Coach and medical get nothing: a consent state is not performance data
 *    and knowing that an athlete declined HealthKit sync tells a coach nothing
 *    they are entitled to act on."
 *
 * So there is deliberately no fetch-for-staff function here and no count. RLS
 * enforces it (athlete_consents_self_select plus an admin-only policy), and
 * this module simply does not offer the shape that would tempt a caller to try.
 *
 * WHAT IT DOES NOT DO. Granting consent does not make sleep data appear. The
 * read itself needs the native iOS app that 08-notifications.md and CLAUDE.md
 * §8 both record as not built — this build is responsive web, and a browser
 * cannot reach HealthKit. The toggle records a real, revocable permission
 * ahead of that, which is the half that is genuinely implementable now and the
 * half GDPR actually requires be in the athlete's hands. The UI says so rather
 * than implying data is flowing.
 */

/** Kept in step with the leaderboard consent's own constant deliberately: both
 *  are the same privacy notice, and a consent record states which version of it
 *  the athlete agreed to. */
const NOTICE_VERSION = '2026.1';

export type HealthkitConsent = { granted: boolean; grantedAt: string | null };

/** The athlete's own consent row. Self-scoped by RLS — an athlete can only ever
 *  read their own, and this is never called from a staff route. */
export async function fetchHealthkitConsent(db: Db, athleteId: string): Promise<HealthkitConsent> {
  const { data, error } = await db
    .from('athlete_consents')
    .select('granted_at, withdrawn_at')
    .eq('athlete_id', athleteId)
    .eq('purpose', 'healthkit_sync')
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Withdrawn beats granted: withdrawal is recorded by stamping withdrawn_at,
  // not by deleting the row, so a row with both timestamps is a consent that
  // was given and taken back.
  const granted = data !== null && data.granted_at !== null && data.withdrawn_at === null;
  return { granted, grantedAt: granted ? data.granted_at : null };
}

export async function grantHealthkitSync(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<{ error: string | null }> {
  const { error } = await db.from('athlete_consents').upsert(
    {
      org_id: orgId,
      athlete_id: athleteId,
      purpose: 'healthkit_sync',
      granted_at: new Date().toISOString(),
      withdrawn_at: null,
      notice_version: NOTICE_VERSION,
    },
    { onConflict: 'athlete_id,purpose' },
  );
  return { error: error?.message ?? null };
}

/** Withdrawal stamps withdrawn_at rather than deleting the row: GDPR Art. 7(3)
 *  gives the right to withdraw at any time, and the club has to be able to show
 *  WHEN processing stopped, which a deleted row cannot. Same shape as the
 *  leaderboard consent's withdraw for the same reason. */
export async function withdrawHealthkitSync(db: Db, athleteId: string): Promise<{ error: string | null }> {
  const { error } = await db
    .from('athlete_consents')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('athlete_id', athleteId)
    .eq('purpose', 'healthkit_sync');
  return { error: error?.message ?? null };
}
