import { NextResponse } from 'next/server';
import { toCsv } from '@/lib/csv';
import { EXPORT_DOMAINS, isExportDomainKey, type ExportDomainKey } from '@/lib/exportDomains';
import { groupScopeLabel, parseGroupParam } from '@/lib/groupFilter';
import {
  fetchBodyCompositionExportRows,
  fetchExportAthletes,
  fetchGymExportRows,
  fetchNutritionCheckinExportRows,
  fetchTestResultExportRows,
  fetchTrainingExportRows,
  fetchWellnessExportRows,
} from '@/lib/queries/exportBuilder';
import { fetchGroups } from '@/lib/queries/groups';
import { recordReportView } from '@/lib/queries/reports';
import { requireReportAccess } from '@/lib/session';
import type { AppRole } from '@/lib/types/database';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type GenerateResult = { ok: boolean; error: string | null; files: { filename: string; content: string }[]; athleteCount: number; groupLabel: string };

function fail(error: string, status: number): NextResponse<GenerateResult> {
  return NextResponse.json({ ok: false, error, files: [], athleteCount: 0, groupLabel: '' }, { status });
}

/** wellness_entries_current/training_entries_current type every column as
 *  nullable (the same view-typing quirk reports.ts's own comment names),
 *  even though a row scoped to a real, resolved athlete id is never
 *  actually missing one. This just satisfies the type without pretending
 *  the fallback ever fires in practice. */
function athleteLabel(athleteId: string | null, nameById: Map<string, string>): string {
  if (!athleteId) return 'Unknown athlete';
  return nameById.get(athleteId) ?? athleteId;
}

/** screens/exports.md job 1: "pick what, pick who, pick when, pick a format,
 *  get a file." The one route the whole builder posts to.
 *
 *  requireReportAccess() is the non-negotiable role gate — coach or medical
 *  only, exactly the same check every report page and report export/route.ts
 *  in this build already uses. An admin with neither role is redirected
 *  before this handler ever runs, matching
 *  01-roles-and-permissions.md §1: "not athlete-level performance detail by
 *  default." All six domains this builder offers (lib/exportDomains.ts) are
 *  athlete-level performance detail, so gating the whole route this way,
 *  rather than per-domain, is the correct, real version of the spec's role
 *  split for the domains this pass actually has — there is no
 *  admin-permitted, non-performance domain in scope to carve out separately.
 *
 *  Synchronous and real, matching every /reports/*​/export/route.ts in this
 *  build: no export_jobs table, no worker, no polling, no notification. The
 *  spec's job 3 ("asynchronous generation with notification... a season of
 *  set-level gym logs for 40 athletes is not a file that renders while
 *  somebody waits") is a real, stated cut for this pass — see
 *  docs/screens/exports.md's status note and this route's own scope limits
 *  below for the reasoning, the same "reduced but real" judgment call
 *  supabase/migrations/0024_testing.sql's header makes for its own domain.
 *
 *  One file per selected domain (never a zip — no new dependency), returned
 *  as JSON so the client can trigger a real browser download per file. One
 *  audit_log row for the whole request, not one per file: `04-data-model.md`
 *  §13's "audit every export" is satisfied by a single row whose metadata
 *  names every domain, the group scope and the date range together — the
 *  actual disclosure a coach or medical user is making in one "Generate"
 *  click, not N separate ones. */
export async function POST(request: Request): Promise<NextResponse<GenerateResult>> {
  const { db, orgId, claims } = await requireReportAccess();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return fail('Invalid request.', 400);

  const requestedDomains: ExportDomainKey[] = Array.isArray(body.domains) ? body.domains.filter(isExportDomainKey) : [];
  const groupIds = parseGroupParam(Array.isArray(body.groupIds) ? body.groupIds.join(',') : undefined);
  const from = typeof body.from === 'string' ? body.from : '';
  const to = typeof body.to === 'string' ? body.to : '';

  if (requestedDomains.length === 0) return fail('Choose what to include.', 400);
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return fail('Choose a valid date range.', 400);
  if (from > to) return fail('The end date must be after the start date.', 400);

  // Export at most 5 years at a time — screens/exports.md's own validation
  // rule, cheap to keep even without the full row/size-estimate machinery
  // job 3 would add.
  const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000;
  if (new Date(to).getTime() - new Date(from).getTime() > fiveYearsMs) return fail('Export at most 5 years at a time.', 400);

  const [groups, athletes] = await Promise.all([fetchGroups(db, orgId), fetchExportAthletes(db, orgId, groupIds)]);
  if (athletes.length === 0) return fail('No athletes in this population.', 400);

  const athleteIds = athletes.map((a) => a.id);
  const nameById = new Map(athletes.map((a) => [a.id, `${a.last_name}, ${a.first_name}`]));
  const groupLabel = groupScopeLabel(groups, groupIds);
  const scopeCaption = `${groupLabel} (${athletes.length} athlete${athletes.length === 1 ? '' : 's'}) · ${from} to ${to}`;

  const files: { filename: string; content: string }[] = [];

  for (const key of requestedDomains) {
    const domain = EXPORT_DOMAINS.find((d) => d.key === key);
    if (!domain) continue;

    let csv: string;

    if (key === 'wellness') {
      const rows = await fetchWellnessExportRows(db, athleteIds, from, to);
      csv = toCsv(
        rows.map((r) => ({
          athlete: athleteLabel(r.athlete_id, nameById),
          date: r.entry_date,
          sleep_hours: r.sleep_hours ?? '',
          sleep_quality: r.sleep_quality ?? '',
          fatigue: r.fatigue ?? '',
          soreness: r.soreness ?? '',
          stress: r.stress ?? '',
          mood: r.mood ?? '',
          resting_hr: r.resting_hr ?? '',
          body_mass_kg: r.body_mass_kg ?? '',
          readiness_score: r.readiness_score ?? '',
          submitted_at: r.submitted_at ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['date', 'Date'],
          ['sleep_hours', 'Sleep (hours)'],
          ['sleep_quality', 'Sleep quality (1-5, 5 best)'],
          ['fatigue', 'Fatigue (1-5, 5 best)'],
          ['soreness', 'Soreness (1-5, 5 best)'],
          ['stress', 'Stress (1-5, 5 best)'],
          ['mood', 'Mood (1-5, 5 best)'],
          ['resting_hr', 'Resting HR'],
          ['body_mass_kg', 'Body mass (kg)'],
          ['readiness_score', 'Readiness score'],
          ['submitted_at', 'Submitted at'],
        ],
      );
    } else if (key === 'training_rpe') {
      const rows = await fetchTrainingExportRows(db, athleteIds, from, to);
      csv = toCsv(
        rows.map((r) => ({
          athlete: athleteLabel(r.athlete_id, nameById),
          date: r.entry_date,
          session: r.session_title ?? '',
          rpe: r.rpe,
          duration_min: r.duration_min,
          session_load: r.session_load ?? '',
          submitted_at: r.submitted_at ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['date', 'Date'],
          ['session', 'Session'],
          ['rpe', 'RPE'],
          ['duration_min', 'Duration (min)'],
          ['session_load', 'Session load (RPE x duration)'],
          ['submitted_at', 'Submitted at'],
        ],
      );
    } else if (key === 'gym') {
      const { sessions, sets } = await fetchGymExportRows(db, athleteIds, from, to);
      const sessionsCsv = toCsv(
        sessions.map((s) => ({
          athlete: nameById.get(s.athlete_id) ?? s.athlete_id,
          date: s.entry_date,
          session_rpe: s.session_rpe ?? '',
          total_volume_kg: s.total_volume_kg ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['date', 'Date'],
          ['session_rpe', 'Session RPE'],
          ['total_volume_kg', 'Total volume (kg)'],
        ],
      );
      const setsCsv = toCsv(
        sets.map((s) => ({
          athlete: nameById.get(s.athlete_id) ?? s.athlete_id,
          date: s.entry_date,
          exercise: s.exercise_name,
          set_number: s.set_number,
          reps: s.reps_completed ?? '',
          load_kg: s.load_kg ?? '',
          rpe: s.rpe ?? '',
          side: s.side ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['date', 'Date'],
          ['exercise', 'Exercise'],
          ['set_number', 'Set'],
          ['reps', 'Reps'],
          ['load_kg', 'Load (kg)'],
          ['rpe', 'RPE'],
          ['side', 'Side'],
        ],
      );
      csv = `# Gym sessions\r\n${sessionsCsv}\r\n# Gym sets\r\n${setsCsv}`;
    } else if (key === 'test_results') {
      const rows = await fetchTestResultExportRows(db, orgId, athleteIds, from, to);
      csv = toCsv(
        rows.map((r) => ({
          athlete: athleteLabel(r.athlete_id, nameById),
          date: r.test_date,
          test: r.test_name,
          value: r.value,
          unit: r.unit,
          attempt: r.attempt_number,
          side: r.side ?? '',
          is_best: r.is_best ? 'yes' : '',
          conditions: r.conditions ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['date', 'Date'],
          ['test', 'Test'],
          ['value', 'Value'],
          ['unit', 'Unit'],
          ['attempt', 'Attempt'],
          ['side', 'Side'],
          ['is_best', 'Personal best'],
          ['conditions', 'Conditions'],
        ],
      );
    } else if (key === 'body_composition') {
      const rows = await fetchBodyCompositionExportRows(db, orgId, athleteIds, from, to);
      csv = toCsv(
        rows.map((r) => ({
          athlete: athleteLabel(r.athlete_id, nameById),
          date: r.measured_on,
          body_mass_kg: r.body_mass_kg ?? '',
          body_fat_pct: r.body_fat_pct ?? '',
          method: r.method ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['date', 'Date'],
          ['body_mass_kg', 'Body mass (kg)'],
          ['body_fat_pct', 'Body fat (%)'],
          ['method', 'Method'],
        ],
      );
    } else {
      const rows = await fetchNutritionCheckinExportRows(db, orgId, athleteIds, from, to);
      csv = toCsv(
        rows.map((r) => ({
          athlete: athleteLabel(r.athlete_id, nameById),
          week_start: r.week_start,
          answer: r.answer,
          note: r.note ?? '',
          submitted_at: r.submitted_at ?? '',
        })),
        [
          ['athlete', 'Athlete'],
          ['week_start', 'Week starting'],
          ['answer', 'Fuelling the plan?'],
          ['note', 'Note'],
          ['submitted_at', 'Submitted at'],
        ],
      );
    }

    const caption = `# ${domain.label}. Scope: ${scopeCaption}.\r\n\r\n`;
    const filename = `${key.replace(/_/g, '-')}-${from}-to-${to}.csv`;
    files.push({ filename, content: caption + csv });
  }

  const actorRole = (claims.roles.includes('medic') ? 'medic' : claims.roles.includes('coach') ? 'coach' : claims.roles[0]) as AppRole;
  await recordReportView(
    db,
    orgId,
    claims.userId,
    actorRole,
    'export_builder',
    { domains: requestedDomains, group_ids: groupIds, from, to, athlete_count: athletes.length, format: 'csv' },
    'export',
  );

  return NextResponse.json({ ok: true, error: null, files, athleteCount: athletes.length, groupLabel });
}
