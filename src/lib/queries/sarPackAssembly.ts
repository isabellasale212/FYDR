import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SAR_CATEGORIES, SAR_MANIFEST_VERSION, SAR_RECIPIENTS, SAR_YOUR_RIGHTS } from '@/lib/subjectAccess/manifest';

/* Split out of sarPack.ts for a real build reason, not a style choice:
 * this file imports lib/supabase/admin.ts, which imports 'server-only'.
 * sarPack.ts itself is imported by ClinicalReviewForm, a Client
 * Component — and Next.js bundles a whole module's exports together, so
 * a single shared file would have pulled the service-role client into
 * the browser bundle the moment any client component imported anything
 * from it, 'server-only' guard or not. This file is the half that
 * genuinely can only run on the server: gatherAthleteData and
 * assembleSarPack. Everything else — the plain RLS-gated request/review
 * queries a client component legitimately needs — stays in sarPack.ts.
 * See that file's header for the fuller reasoning on why release reaches
 * for the admin client at all. */

/** Every real table this schema has that references one athlete —
 *  see sarPack.ts's header for why the read runs on the service-role
 *  client. Cut, and named: sessions/fixtures themselves (session_attendance
 *  below already carries the athlete-specific half of that relationship;
 *  the session's own details are squad-wide scheduling data, not personal
 *  data about this athlete specifically), push_tokens' raw token value
 *  (a live credential, not the kind of thing Article 15 access is for —
 *  platform and registration date are included, the token string is not),
 *  and device_metrics/notification_deliveries (neither table exists in
 *  this schema — see 08-notifications.md's own "nothing sends anything
 *  yet" gap, already documented for notification preferences). */
async function gatherAthleteData(orgId: string, athleteId: string) {
  const admin = createAdminClient();

  // Fetched first, on its own: push_tokens is keyed by user_id, not
  // athlete_id, so the rest of the fan-out below needs this athlete's
  // linked user id in hand before it can run.
  const athleteRes = await admin.from('athletes').select('*').eq('org_id', orgId).eq('id', athleteId).maybeSingle();

  const [
    wellness,
    nutritionTargets,
    nutritionCheckins,
    training,
    gymSessions,
    gps,
    testResults,
    bodyComp,
    attendance,
    availability,
    injuries,
    flags,
    flagActions,
    programmeAssignments,
    rehabAssignments,
    groupMemberships,
    compliance,
    consents,
    pushTokens,
    leaderboardOptOuts,
    auditLog,
  ] = await Promise.all([
    admin.from('wellness_entries').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('nutrition_targets').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('nutrition_checkins').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('training_entries').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('gym_session_logs').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('gps_records').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('test_results').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('body_composition').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('session_attendance').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('availability').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('injuries').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('flags').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('flag_actions').select('*, flags!inner(athlete_id)').eq('flags.org_id', orgId).eq('flags.athlete_id', athleteId),
    admin.from('programme_assignments').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('rehab_assignments').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('group_memberships').select('*, groups!inner(name)').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('compliance_expectations').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('athlete_consents').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('push_tokens').select('platform, shell, created_at, invalidated_reason').eq('org_id', orgId).eq('user_id', athleteRes.data?.user_id ?? ''),
    admin.from('leaderboard_opt_outs').select('*').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('audit_log').select('id, actor_role, action, entity_type, occurred_at, metadata').eq('org_id', orgId).eq('athlete_id', athleteId),
  ]);

  // gym_set_logs has no athlete_id of its own — it hangs off
  // gym_session_logs, already fetched above, so its ids are the actual
  // filter.
  const gymSessionIds = (gymSessions.data ?? []).map((s) => s.id);
  const gymSets =
    gymSessionIds.length > 0
      ? await admin.from('gym_set_logs').select('*').eq('org_id', orgId).in('gym_session_log_id', gymSessionIds)
      : { data: [] as never[] };

  return {
    athlete: athleteRes.data,
    wellness_entries: wellness.data ?? [],
    nutrition_targets: nutritionTargets.data ?? [],
    nutrition_checkins: nutritionCheckins.data ?? [],
    training_entries: training.data ?? [],
    gym_session_logs: gymSessions.data ?? [],
    gym_set_logs: gymSets.data ?? [],
    gps_records: gps.data ?? [],
    test_results: testResults.data ?? [],
    body_composition: bodyComp.data ?? [],
    session_attendance: attendance.data ?? [],
    availability: availability.data ?? [],
    injuries: injuries.data ?? [],
    flags: flags.data ?? [],
    flag_actions: flagActions.data ?? [],
    programme_assignments: programmeAssignments.data ?? [],
    rehab_assignments: rehabAssignments.data ?? [],
    group_memberships: groupMemberships.data ?? [],
    compliance_expectations: compliance.data ?? [],
    athlete_consents: consents.data ?? [],
    push_tokens: pushTokens.data ?? [],
    leaderboard_opt_outs: leaderboardOptOuts.data ?? [],
    audit_log_entries_about_you: auditLog.data ?? [],
  };
}

/** The release step: refuses to run while any clinical record on this
 *  athlete has no recorded decision yet ("The pack cannot be released
 *  while review is pending", exports.md), applies withhold decisions by
 *  omitting that injury's clinical fields and substituting a note saying
 *  why, gathers everything else, and returns the finished document. The
 *  caller (the release route) is responsible for the org/role check, the
 *  sar_requests status update, and the audit_log write — this function is
 *  pure data assembly, it makes no write of its own. */
export async function assembleSarPack(orgId: string, athleteId: string, requestId: string): Promise<{ pack: Record<string, unknown> | null; error: string | null }> {
  const admin = createAdminClient();

  const [injuriesRes, reviewsRes] = await Promise.all([
    admin.from('injuries').select('id, injury_clinical(injury_id)').eq('org_id', orgId).eq('athlete_id', athleteId),
    admin.from('sar_clinical_reviews').select('injury_id, decision, reason').eq('org_id', orgId).eq('sar_request_id', requestId),
  ]);
  if (injuriesRes.error) return { pack: null, error: injuriesRes.error.message };
  if (reviewsRes.error) return { pack: null, error: reviewsRes.error.message };

  const injuriesWithClinical = (injuriesRes.data ?? []).filter((i) => i.injury_clinical !== null).map((i) => i.id);
  const decisionByInjury = new Map((reviewsRes.data ?? []).map((r) => [r.injury_id, r]));
  const undecided = injuriesWithClinical.filter((id) => !decisionByInjury.has(id));
  if (undecided.length > 0) {
    return { pack: null, error: `${undecided.length} clinical record${undecided.length === 1 ? '' : 's'} still need${undecided.length === 1 ? 's' : ''} a medical review decision before this pack can be released.` };
  }

  const data = await gatherAthleteData(orgId, athleteId);
  if (!data.athlete) return { pack: null, error: 'Athlete not found.' };

  // Apply the review decisions to injury_clinical before it's fetched: a
  // withheld note is replaced with the reason, not silently dropped — the
  // covering note this pack's manifest promises has to be findable
  // *inside* the pack, not just in a decisions table nobody reads.
  const withheldByInjury = new Map((reviewsRes.data ?? []).filter((r) => r.decision === 'withhold').map((r) => [r.injury_id, r.reason]));
  const clinicalRes = await admin.from('injury_clinical').select('*').eq('org_id', orgId).in('injury_id', injuriesWithClinical.length > 0 ? injuriesWithClinical : ['00000000-0000-0000-0000-000000000000']);
  const injuryClinical = (clinicalRes.data ?? []).map((row) => {
    const withheldReason = withheldByInjury.get(row.injury_id);
    if (withheldReason === undefined) return row;
    return {
      injury_id: row.injury_id,
      withheld: true,
      withheld_reason: withheldReason,
      note: 'This clinical record was withheld by a clinician under the Data Protection Act 2018, Schedule 3 Part 2 serious-harm test. See withheld_reason.',
    };
  });

  return {
    pack: {
      generated_at: new Date().toISOString(),
      manifest_version: SAR_MANIFEST_VERSION,
      about_this_pack: {
        legal_basis: 'UK GDPR Article 15, right of access',
        recipients: SAR_RECIPIENTS,
        your_other_rights: SAR_YOUR_RIGHTS,
        categories: SAR_CATEGORIES,
      },
      profile: data.athlete,
      wellness_entries: data.wellness_entries,
      nutrition_targets: data.nutrition_targets,
      nutrition_checkins: data.nutrition_checkins,
      training_entries: data.training_entries,
      gym_session_logs: data.gym_session_logs,
      gym_set_logs: data.gym_set_logs,
      gps_records: data.gps_records,
      test_results: data.test_results,
      body_composition: data.body_composition,
      session_attendance: data.session_attendance,
      availability: data.availability,
      injuries: data.injuries,
      injury_clinical: injuryClinical,
      flags: data.flags,
      flag_actions: data.flag_actions,
      programme_assignments: data.programme_assignments,
      rehab_assignments: data.rehab_assignments,
      group_memberships: data.group_memberships,
      compliance_expectations: data.compliance_expectations,
      athlete_consents: data.athlete_consents,
      push_tokens: data.push_tokens,
      leaderboard_opt_outs: data.leaderboard_opt_outs,
      audit_log_entries_about_you: data.audit_log_entries_about_you,
    },
    error: null,
  };
}
