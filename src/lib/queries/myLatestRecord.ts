/* The athlete's most recent entry in one domain, whatever period is chosen —
 * ATH-ADULT-12 C6 (2026-09-12). An empty period on My data says when the
 * last entry was and that it is still on record, rather than "nothing", and
 * the honest answer needs a read the period does not bound.
 *
 * Athlete-scoped by `athlete_id` on purpose, the same stance as the page's
 * own fetchMyEarliestRecord: RLS would scope it anyway, but a query whose
 * correctness rests on a policy the file does not mention is a query waiting
 * to be copied somewhere the policy does not apply. One `.limit(1)` read on
 * an indexed column, only when a tab is empty. The four branches are written
 * out rather than parameterised for the reason analytics.ts gives: a dynamic
 * table name loses supabase-js's row typing entirely. Nutrition's column is
 * `week_start`, not `entry_date`.
 */
import type { Db } from './groups';

export type LatestRecordDomain = 'wellness' | 'gym' | 'training' | 'nutrition';

export async function fetchMyLatestRecord(db: Db, athleteId: string, domain: LatestRecordDomain): Promise<string | null> {
  if (domain === 'nutrition') {
    const { data, error } = await db
      .from('nutrition_checkins_current')
      .select('week_start')
      .eq('athlete_id', athleteId)
      .not('week_start', 'is', null)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.week_start ?? null;
  }
  if (domain === 'gym') {
    const { data, error } = await db
      .from('gym_session_logs_current')
      .select('entry_date')
      .eq('athlete_id', athleteId)
      .eq('status', 'complete')
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.entry_date ?? null;
  }
  if (domain === 'training') {
    const { data, error } = await db
      .from('training_entries_current')
      .select('entry_date')
      .eq('athlete_id', athleteId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.entry_date ?? null;
  }
  const { data, error } = await db
    .from('wellness_entries_current')
    .select('entry_date')
    .eq('athlete_id', athleteId)
    .not('entry_date', 'is', null)
    .order('entry_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.entry_date ?? null;
}
