import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/* 09-security-and-compliance.md §7: "Implementation: a nightly Edge
 * Function that applies the schedule per organisation, redacts rather
 * than deletes, writes a summary row to audit_log, and refuses to run
 * without a dry-run mode." This build has no Edge Function deployment
 * and no scheduler wired to one — the same reduced-scope shape every
 * other "the spec wants an async worker" feature in this build already
 * has — so this is an admin-triggered action instead of a nightly job,
 * the same trade this build already made for the SAR pack. What's not
 * reduced: the actual retention math, the redact-not-delete instinct
 * everywhere the schema supports it, and the mandatory dry-run the spec
 * insists on — runRetention refuses to touch anything unless dryRun is
 * explicitly false.
 *
 * Why this reaches for the service-role admin client
 *   Retention is inherently a cross-cutting system operation, not
 *   something scoped to one role's ordinary session — the same category
 *   of case lib/queries/sarPackAssembly.ts's own header already
 *   explains for the SAR pack's release step. An admin cannot read
 *   injury_clinical (medical-only, migration 0012) yet retention has to
 *   redact it; a plain RLS-gated client cannot do this job at all.
 *
 * What this pass actually redacts for real, and why only these two
 *   `import_batches` past 30 days: genuinely deleted, not redacted —
 *   these are reconciliation metadata, never athlete data, so
 *   CLAUDE.md rule 4 does not apply to them at all.
 *   `injuries` (and, transitively, `injury_clinical`) past the clinical
 *   window: both already exist and the injuries table already has
 *   deleted_at, the same column every other read path in this build
 *   already filters on — redacting through it is consistent with the
 *   whole schema, not a new pattern invented for this file.
 *   Everything else this build's own retention schedule names —
 *   wellness/training/gym/GPS/body composition — has no deleted_at
 *   column to redact through today. Adding one to five more tables and
 *   auditing every read path in this app that queries them for the
 *   filter is real, larger, separate work; this pass computes and shows
 *   an honest count for those categories without ever touching a row,
 *   which is safer than a redaction that only half-works. */

const MS_PER_DAY = 86_400_000;

function yearsAgo(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString();
}

export type RetentionPreviewCategory = {
  category: string;
  count: number;
  cutoffDescription: string;
  automated: boolean;
};

export type RetentionPreview = {
  orgId: string;
  computedAt: string;
  categories: RetentionPreviewCategory[];
};

/** Read-only. Every count here is a real query against the real schema —
 *  nothing estimated, nothing invented — but nothing here writes
 *  anything, including for the two categories runRetention can act on
 *  for real. */
export async function computeRetentionPreview(orgId: string): Promise<RetentionPreview> {
  const admin = createAdminClient();

  const importCutoff = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();
  const { count: importCount } = await admin.from('import_batches').select('id', { count: 'exact', head: true }).eq('org_id', orgId).lt('created_at', importCutoff);

  const eightYearsAgo = yearsAgo(8);
  const { data: closedInjuries } = await admin
    .from('injuries')
    .select('id, athlete_id, updated_at, athletes!inner(date_of_birth)')
    .eq('org_id', orgId)
    .eq('status', 'closed')
    .is('deleted_at', null)
    .lt('updated_at', eightYearsAgo);

  // The minor extension needs each athlete's age at closure, not a flat
  // cutoff — computed in application code rather than a single query
  // because "until their 25th birthday" is a per-row comparison, not a
  // fixed date every row shares.
  const eligibleInjuries = (closedInjuries ?? []).filter((inj) => {
    const dob = inj.athletes?.date_of_birth;
    if (!dob) return true; // no DOB on file — can't apply the minor extension, the 8-year rule alone governs
    const closedAt = new Date(inj.updated_at);
    const ageAtClosureMs = closedAt.getTime() - new Date(dob).getTime();
    const wasMinorAtClosure = ageAtClosureMs < 18 * 365.25 * MS_PER_DAY;
    if (!wasMinorAtClosure) return true;
    const twentyFifthBirthday = new Date(dob);
    twentyFifthBirthday.setUTCFullYear(twentyFifthBirthday.getUTCFullYear() + 25);
    return twentyFifthBirthday.getTime() < Date.now();
  });

  const currentSeasonRes = await admin.from('seasons').select('id, starts_on').eq('org_id', orgId).eq('is_current', true).is('deleted_at', null).maybeSingle();
  const completedSeasonsRes = await admin
    .from('seasons')
    .select('id, starts_on')
    .eq('org_id', orgId)
    .eq('is_current', false)
    .is('deleted_at', null)
    .lt('ends_on', currentSeasonRes.data?.starts_on ?? '9999-12-31')
    // Most-recent-first, so index N is "the (N+1)-th most recent completed
    // season" — index 2 is the 3rd most recent (the last one kept
    // alongside the current season for the 3-season categories), index 4
    // the 5th most recent (same, for the 5-season categories).
    .order('starts_on', { ascending: false });
  const completedSeasons = completedSeasonsRes.data ?? [];
  const completedSeasonCount = completedSeasons.length;

  // Performance-data categories need 3 (or 5) *completed* seasons to have
  // actually elapsed before anything is even theoretically eligible — a
  // club in its first season, like every seed org in this build, always
  // shows zero here, correctly, not because the query is wrong but
  // because the window genuinely hasn't closed on anything yet.
  const performanceEligible = completedSeasonCount > 3;
  const testEligible = completedSeasonCount > 5;
  // The real cutoff date: anything on/after this date belongs to the
  // current season or one of the N most recent completed ones, and stays
  // out of the count. Below it is what "older than the Nth-most-recent
  // completed season" actually means as a real date, not just a label —
  // previously the counts below ran with no cutoff applied at all (every
  // row in the table, regardless of season), while the label claimed one.
  const performanceCutoff = performanceEligible ? completedSeasons[2]!.starts_on : null;
  const testCutoff = testEligible ? completedSeasons[4]!.starts_on : null;

  const [wellness, training, gymSessions, gps, testResultsCount, bodyComp] = await Promise.all([
    performanceCutoff
      ? admin.from('wellness_entries').select('id', { count: 'exact', head: true }).eq('org_id', orgId).lt('entry_date', performanceCutoff)
      : { count: 0 },
    performanceCutoff
      ? admin.from('training_entries').select('id', { count: 'exact', head: true }).eq('org_id', orgId).lt('entry_date', performanceCutoff)
      : { count: 0 },
    performanceCutoff
      ? admin.from('gym_session_logs').select('id', { count: 'exact', head: true }).eq('org_id', orgId).lt('entry_date', performanceCutoff)
      : { count: 0 },
    performanceCutoff
      ? admin.from('gps_records').select('id', { count: 'exact', head: true }).eq('org_id', orgId).lt('record_date', performanceCutoff)
      : { count: 0 },
    testCutoff
      ? admin.from('test_results').select('id', { count: 'exact', head: true }).eq('org_id', orgId).is('deleted_at', null).lt('test_date', testCutoff)
      : { count: 0 },
    testCutoff
      ? admin.from('body_composition').select('id', { count: 'exact', head: true }).eq('org_id', orgId).lt('measured_on', testCutoff)
      : { count: 0 },
  ]);

  return {
    orgId,
    computedAt: new Date().toISOString(),
    categories: [
      {
        category: 'Import batch raw files (30 days)',
        count: importCount ?? 0,
        cutoffDescription: 'Uploaded before 30 days ago',
        automated: true,
      },
      {
        category: 'Injury clinical detail (8 years from closure, longer if under 18)',
        count: eligibleInjuries.length,
        cutoffDescription: `Closed before 8 years ago${(closedInjuries?.length ?? 0) !== eligibleInjuries.length ? ', extended for athletes who were minors at closure' : ''}`,
        automated: true,
      },
      {
        category: 'Wellness, training, gym logs (current + 3 completed seasons)',
        count: (wellness.count ?? 0) + (training.count ?? 0) + (gymSessions.count ?? 0),
        cutoffDescription: performanceCutoff ? `Before ${performanceCutoff} (start of the 3rd-most-recent completed season)` : `Not yet eligible — this club has ${completedSeasonCount} completed season${completedSeasonCount === 1 ? '' : 's'} on record, needs more than 3`,
        automated: false,
      },
      {
        category: 'GPS records (current + 3 completed seasons)',
        count: gps.count ?? 0,
        cutoffDescription: performanceCutoff ? `Before ${performanceCutoff} (start of the 3rd-most-recent completed season)` : `Not yet eligible — ${completedSeasonCount} completed season${completedSeasonCount === 1 ? '' : 's'} on record`,
        automated: false,
      },
      {
        category: 'Test results, body composition (current + 5 completed seasons)',
        count: (testResultsCount.count ?? 0) + (bodyComp.count ?? 0),
        cutoffDescription: testCutoff ? `Before ${testCutoff} (start of the 5th-most-recent completed season)` : `Not yet eligible — ${completedSeasonCount} completed season${completedSeasonCount === 1 ? '' : 's'} on record`,
        automated: false,
      },
    ],
  };
}

export type RetentionRunResult = {
  importBatchesDeleted: number;
  injuriesRedacted: number;
};

/** The only two categories computeRetentionPreview's own header names as
 *  real. Refuses outright unless dryRun is explicitly false — the
 *  spec's own words, "refuses to run without a dry-run mode", enforced
 *  as a parameter the caller cannot skip past by accident. */
export async function runRetention(orgId: string, dryRun: true): Promise<{ error: string }>;
export async function runRetention(orgId: string, dryRun: false): Promise<{ result: RetentionRunResult | null; error: string | null }>;
export async function runRetention(orgId: string, dryRun: boolean): Promise<{ result?: RetentionRunResult | null; error: string | null }> {
  if (dryRun) return { error: 'runRetention was called with dryRun=true — use computeRetentionPreview instead, which never writes.' };

  const admin = createAdminClient();

  const importCutoff = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();
  const { data: deletedBatches, error: importErr } = await admin.from('import_batches').delete().eq('org_id', orgId).lt('created_at', importCutoff).select('id');
  if (importErr) return { result: null, error: importErr.message };

  const eightYearsAgo = yearsAgo(8);
  const { data: closedInjuries, error: injuriesReadErr } = await admin
    .from('injuries')
    .select('id, updated_at, athletes!inner(date_of_birth)')
    .eq('org_id', orgId)
    .eq('status', 'closed')
    .is('deleted_at', null)
    .lt('updated_at', eightYearsAgo);
  if (injuriesReadErr) return { result: null, error: injuriesReadErr.message };

  const eligibleIds = (closedInjuries ?? [])
    .filter((inj) => {
      const dob = inj.athletes?.date_of_birth;
      if (!dob) return true;
      const closedAt = new Date(inj.updated_at);
      const ageAtClosureMs = closedAt.getTime() - new Date(dob).getTime();
      const wasMinorAtClosure = ageAtClosureMs < 18 * 365.25 * MS_PER_DAY;
      if (!wasMinorAtClosure) return true;
      const twentyFifthBirthday = new Date(dob);
      twentyFifthBirthday.setUTCFullYear(twentyFifthBirthday.getUTCFullYear() + 25);
      return twentyFifthBirthday.getTime() < Date.now();
    })
    .map((inj) => inj.id);

  let injuriesRedacted = 0;
  if (eligibleIds.length > 0) {
    // The clinical row has no deleted_at of its own to redact through —
    // nulling its sensitive fields directly is the actual redaction;
    // soft-deleting the parent injury is what hides both from every
    // ordinary read path in the app, which already filters injuries on
    // deleted_at everywhere.
    const { error: clinicalErr } = await admin
      .from('injury_clinical')
      .update({ diagnosis: null, mechanism: null, clinical_notes: null, treatment_plan: null, imaging: null, referral: null })
      .in('injury_id', eligibleIds);
    if (clinicalErr) return { result: null, error: clinicalErr.message };

    const { error: injuryErr } = await admin.from('injuries').update({ deleted_at: new Date().toISOString() }).in('id', eligibleIds);
    if (injuryErr) return { result: null, error: injuryErr.message };
    injuriesRedacted = eligibleIds.length;
  }

  return {
    result: { importBatchesDeleted: deletedBatches?.length ?? 0, injuriesRedacted },
    error: null,
  };
}
