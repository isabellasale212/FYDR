import { z } from 'zod';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';
import type { Json } from '../types/database';
import { mondayOf, rangeBounds } from './schedule';
import { dateInTz, daysBetween, zonedTimeToUtcIso } from '../format';

/* screens/md-planner.md, cut down hard from a screen the spec's own header
 * calls "provisional. Awaiting client design photographs" and closes with
 * six open product questions (O-286 to O-294) it explicitly asks the
 * client to confirm — starter templates or not, whether templates carry
 * group assignments, a monotony warning threshold, whether an apply can
 * create the fixture too. Building those as written would mean guessing
 * at product decisions the spec's own author flagged as unresolved,
 * against CLAUDE.md §5. What this file does build is the real mechanism
 * underneath all six: define a week's shape once, reuse it.
 *
 * Cut, and why:
 *  - No Edge Function. The spec wants server-side transactional apply with
 *    plan-hash 409 conflict detection. Nothing else in this codebase uses
 *    an Edge Function — every other write, including this session's own
 *    Timetable and Audit log, goes through a direct client call with RLS
 *    as the security boundary. applyTemplate() below does the same:
 *    fewer guarantees under concurrent edits (no 409 re-preview), same
 *    architecture as the rest of the app.
 *  - No compliance_expectations regeneration triggered directly from applyTemplate()
 *    itself. The spec's own confirm copy promises it ("Compliance expectations will be
 *    regenerated for 24 athletes..."), and as of migration 0044 the generator this
 *    promise needs now exists — public.generate_compliance_expectations(org, date),
 *    idempotent, called nightly by pg_cron for every org's local today and tomorrow
 *    (04-data-model.md §11, 05-architecture.md §7). What's still real and still cut
 *    here: applyTemplate() does not call it inline after creating a week's sessions, so
 *    a newly applied template's expectations land on the next nightly tick rather than
 *    immediately. Wiring an inline call is a small, real follow-up now that the function
 *    exists, not the schema-wide gap this comment used to describe.
 *  - No drag-and-drop, no monotony/strain warning threshold (O-289), no
 *    seeded starter templates (O-286).
 *  - Participants are always the whole squad (O-291's `all_squad` case
 *    only) — no per-position group assignment. The spec's own worry about
 *    this ("carrying group ids in a template makes it fragile: rename or
 *    delete a group and the template silently creates sessions with no
 *    one in them") is sidestepped rather than mitigated.
 *  - No two-fixture-in-one-week handling. Real seed data never produces
 *    this case (one upcoming fixture, no overlap), and the spec's own
 *    handling for it — an anchor picker, a locked column, forward
 *    labelling — is substantial enough to warrant its own pass once a
 *    real week actually needs it. applyTemplate() below anchors to the
 *    single nearest fixture in the target week, or none.
 *  - No bulk "apply to the next 6 fixtures" (O-292, the spec's own words:
 *    "out of scope for v1 unless you say otherwise").
 *
 * What's real: week_templates itself (migration 0003, RLS in 0012) had
 * zero application code before this file, the same shape of gap already
 * closed this session for organisations.tier, session_attendance and
 * audit_log. sessions.template_key / applied_template_id (migration 0037)
 * are new, real columns, O-287's own recommendation, with real pgTAP
 * coverage (180_week_templates_test.sql) — the table's RLS had none
 * either, until now. */

export const TEMPLATE_STRUCTURE_VERSION = 2;

const TemplateSessionSchema = z.object({
  key: z.string().min(1),
  type: z.enum(['training', 'gym', 'match', 'testing', 'recovery', 'meeting', 'rehab']),
  title: z.string().min(1).max(120),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:MM'),
  // Nullable, not defaulted: a match session's real stored shape has no
  // duration or RPE at all — a match's actual length comes from the real
  // fixture, not a plan, and this org's own real pre-existing template
  // (see this file's header) stores its matchday row exactly that way.
  // Fabricating "80 minutes" here would be a number nobody planned.
  durationMin: z.number().int().min(5).max(480).nullable(),
  plannedRpe: z.number().min(1).max(10).nullable(),
  location: z.string().nullable(),
});

const TemplateDaySchema = z.object({
  mdOffset: z.number().int().min(-14).max(7),
  sessions: z.array(TemplateSessionSchema).max(4, '4 sessions is the maximum for one day.'),
  requires: z.object({ wellness: z.boolean(), rpe: z.boolean(), nutrition: z.boolean() }),
});

export const TemplateStructureSchema = z
  .object({
    version: z.literal(TEMPLATE_STRUCTURE_VERSION),
    anchor: z.enum(['fixture', 'training_week']),
    covers: z.object({ from: z.number().int().min(-14).max(0), to: z.number().int().min(0).max(7) }),
    days: z.array(TemplateDaySchema),
  })
  .refine((s) => s.covers.from <= s.covers.to, { message: 'covers.from must be on or before covers.to' })
  .refine((s) => s.days.every((d) => !d.sessions.some((sess) => sess.type === 'match') || d.mdOffset === 0), {
    message: 'A match can only be on matchday.',
  });
/* screens/md-planner.md's own validation table also wants "at least one day
 * with at least one session" enforced at save. Deliberately not a Zod
 * refine here: the spec's own States table lists "Builder, new:
 * pre-populated... all empty" as a real, valid intermediate state, and a
 * hard schema rule can't tell a fresh template that's about to be built
 * apart from one someone saved empty on purpose. isTemplateUsable() below
 * is the same check, applied where it belongs — a UI warning on an empty
 * template, not a write that fails before the coach has typed anything. */
export function isTemplateUsable(structure: TemplateStructure): boolean {
  return structure.days.some((d) => d.sessions.length > 0);
}

export type TemplateStructure = z.infer<typeof TemplateStructureSchema>;
export type TemplateSession = z.infer<typeof TemplateSessionSchema>;
export type TemplateDay = z.infer<typeof TemplateDaySchema>;

export function emptyStructure(): TemplateStructure {
  return { version: 2, anchor: 'fixture', covers: { from: -5, to: 0 }, days: [] };
}

/* Storage is snake_case JSON, per screens/md-planner.md's own documented
 * "Recommended structure, version 2" example — the app's own convention
 * everywhere else (camelCase in TypeScript, whatever the wire/storage
 * shape is) is kept in-memory via these two functions rather than by
 * renaming every field in this file to match the JSON.
 *
 * parseStoredStructure() also does real, live work beyond that renaming:
 * this org's own week_templates table (migration 0003) already carried a
 * genuine pre-existing row, "Standard 1-game week", written before this
 * feature existed — real seed content matching this spec's own worked
 * example almost exactly (Recovery, Lower body, Conditioning, Unit
 * skills, Upper B, Team run, Captain's run, a matchday Fixture). It has
 * no version field, no anchor, no covers, and no per-session key/
 * start_time/location — exactly the shape screens/md-planner.md's own
 * O-283/"Fields" table calls "version 1" and says must be "upgraded in
 * memory on read". Found live: a first pass here used TemplateStructureSchema
 * .safeParse() directly against raw storage, which silently discarded this
 * real row to an empty template — caught by loading the real page, not by
 * a type error, since a caught Zod failure and "genuinely no data" look
 * identical from the caller's side unless you go looking. */
type RawSession = { key?: string; type: string; title: string; start_time?: string; duration_min?: number | null; planned_rpe?: number | null; location?: string | null };
type RawDay = { md_offset: number; sessions?: RawSession[]; requires?: { wellness?: boolean; rpe?: boolean; nutrition?: boolean } };
type RawStructure = { version?: number; anchor?: string; covers?: { from: number; to: number }; days?: RawDay[] };

export function parseStoredStructure(raw: unknown): TemplateStructure {
  const r = (raw ?? {}) as RawStructure;
  const days = r.days ?? [];

  if (r.version === TEMPLATE_STRUCTURE_VERSION && r.anchor && r.covers) {
    const upgraded: TemplateStructure = {
      version: 2,
      anchor: r.anchor === 'training_week' ? 'training_week' : 'fixture',
      covers: r.covers,
      days: days.map((d) => ({
        mdOffset: d.md_offset,
        requires: { wellness: !!d.requires?.wellness, rpe: !!d.requires?.rpe, nutrition: !!d.requires?.nutrition },
        sessions: (d.sessions ?? []).map((s, i) => normaliseSession(s, i)),
      })),
    };
    const parsed = TemplateStructureSchema.safeParse(upgraded);
    return parsed.success ? parsed.data : emptyStructure();
  }

  // Version 1 (or unversioned, this org's real case): no anchor/covers
  // wrapper at all, just day rows keyed by md_offset. Upgrade per the
  // spec's own stated rule — start_time defaults to 09:00 for a day's
  // first session and steps forward 3 hours per subsequent one,
  // participants default to the whole squad (this build's only real
  // mode anyway, see this file's header).
  if (days.length === 0) return emptyStructure();
  const offsets = days.map((d) => d.md_offset);
  const upgraded: TemplateStructure = {
    version: 2,
    anchor: 'fixture',
    covers: { from: Math.min(0, ...offsets), to: Math.max(0, ...offsets) },
    days: days.map((d) => ({
      mdOffset: d.md_offset,
      requires: { wellness: !!d.requires?.wellness, rpe: !!d.requires?.rpe, nutrition: !!d.requires?.nutrition },
      sessions: (d.sessions ?? []).map((s, i) => normaliseSession(s, i)),
    })),
  };
  const parsed = TemplateStructureSchema.safeParse(upgraded);
  return parsed.success ? parsed.data : emptyStructure();
}

function normaliseSession(s: RawSession, indexInDay: number): TemplateSession {
  const hour = 9 + indexInDay * 3;
  return {
    key: s.key ?? `${s.type}-${s.title}-${indexInDay}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
    type: (['training', 'gym', 'match', 'testing', 'recovery', 'meeting', 'rehab'] as const).includes(s.type as never) ? (s.type as TemplateSession['type']) : 'training',
    title: s.title,
    startTime: s.start_time ?? `${String(Math.min(hour, 23)).padStart(2, '0')}:00`,
    durationMin: s.duration_min ?? null,
    plannedRpe: s.planned_rpe ?? null,
    location: s.location ?? null,
  };
}

export function serializeStructure(s: TemplateStructure): Json {
  return {
    version: s.version,
    anchor: s.anchor,
    covers: s.covers,
    days: s.days.map((d) => ({
      md_offset: d.mdOffset,
      requires: d.requires,
      sessions: d.sessions.map((sess) => ({
        key: sess.key,
        type: sess.type,
        title: sess.title,
        start_time: sess.startTime,
        duration_min: sess.durationMin,
        planned_rpe: sess.plannedRpe,
        location: sess.location,
      })),
    })),
  };
}

function dayLoad(day: TemplateDay): { total: number; unscored: boolean } {
  let total = 0;
  let unscored = false;
  for (const s of day.sessions) {
    if (s.plannedRpe === null || s.durationMin === null) unscored = true;
    else total += s.durationMin * s.plannedRpe;
  }
  return { total, unscored };
}

export function weekTotalLoad(structure: TemplateStructure): number {
  return structure.days.reduce((sum, d) => sum + dayLoad(d).total, 0);
}

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

export type TemplateSummary = {
  id: string;
  name: string;
  structure: TemplateStructure;
  applyCount: number;
  lastAppliedAt: string | null;
  archived: boolean;
};

export async function fetchTemplates(db: Db, orgId: string, timezone: string, includeArchived = false): Promise<TemplateSummary[]> {
  let q = db.from('week_templates').select('id, name, structure, deleted_at').eq('org_id', orgId);
  if (!includeArchived) q = q.is('deleted_at', null);
  const { data, error } = await q.order('name');
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((t) => t.id);
  const usage = new Map<string, { count: number; last: string | null }>();
  if (ids.length > 0) {
    const { data: sessions, error: sessErr } = await db
      .from('sessions')
      .select('applied_template_id, starts_at, created_at')
      .eq('org_id', orgId)
      .in('applied_template_id', ids)
      .is('deleted_at', null);
    if (sessErr) throw new Error(sessErr.message);
    const weeksByTemplate = new Map<string, Set<string>>();
    for (const s of sessions ?? []) {
      const tid = s.applied_template_id;
      if (!tid) continue;
      const weeks = weeksByTemplate.get(tid) ?? new Set<string>();
      // Local calendar date, not the UTC one — a session between 23:00-00:00
      // UTC (00:00-01:00 local in BST) belongs to the next local week, not
      // whatever week its raw UTC date falls in (same bug class as
      // schedule.ts's own dayBounds()/rangeBounds() — see its header).
      weeks.add(mondayOf(dateInTz(new Date(s.starts_at), timezone)));
      weeksByTemplate.set(tid, weeks);
      const cur = usage.get(tid);
      if (!cur || s.created_at > (cur.last ?? '')) usage.set(tid, { count: weeksByTemplate.get(tid)!.size, last: s.created_at });
      else usage.set(tid, { count: weeksByTemplate.get(tid)!.size, last: cur.last });
    }
  }

  return (data ?? []).map((t) => {
    const u = usage.get(t.id);
    return {
      id: t.id,
      name: t.name,
      structure: parseStoredStructure(t.structure),
      applyCount: u?.count ?? 0,
      lastAppliedAt: u?.last ?? null,
      archived: t.deleted_at !== null,
    };
  });
}

export async function fetchTemplate(db: Db, orgId: string, templateId: string): Promise<TemplateSummary | null> {
  const { data, error } = await db
    .from('week_templates')
    .select('id, name, structure, deleted_at')
    .eq('org_id', orgId)
    .eq('id', templateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    structure: parseStoredStructure(data.structure),
    applyCount: 0,
    lastAppliedAt: null,
    archived: data.deleted_at !== null,
  };
}

export async function createTemplate(
  db: Db,
  orgId: string,
  userId: string,
  input: { name: string; structure: TemplateStructure },
): Promise<{ id: string | null; error: string | null }> {
  const parsed = TemplateStructureSchema.safeParse(input.structure);
  if (!parsed.success) return { id: null, error: parsed.error.issues[0]?.message ?? 'Invalid template.' };
  if (input.name.trim().length === 0 || input.name.length > 80) return { id: null, error: 'Give the template a name.' };

  const { data, error } = await db
    .from('week_templates')
    .insert({ org_id: orgId, name: input.name.trim(), structure: serializeStructure(parsed.data), created_by: userId })
    .select('id')
    .single();
  /* Raw driver strings never leave this file — audit S5. */
  if (error) return { id: null, error: humanizeDbError(error.message, 'staff') };
  return { id: data.id, error: null };
}

export async function updateTemplate(
  db: Db,
  orgId: string,
  templateId: string,
  input: { name?: string; structure?: TemplateStructure },
): Promise<{ error: string | null }> {
  const patch: { updated_at: string; name?: string; structure?: Json } = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.structure !== undefined) {
    const parsed = TemplateStructureSchema.safeParse(input.structure);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid template.' };
    patch.structure = serializeStructure(parsed.data);
  }

  const { error } = await db.from('week_templates').update(patch).eq('org_id', orgId).eq('id', templateId);
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export async function archiveTemplate(db: Db, orgId: string, templateId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('week_templates').update({ deleted_at: new Date().toISOString() }).eq('org_id', orgId).eq('id', templateId);
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export async function restoreTemplate(db: Db, orgId: string, templateId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('week_templates').update({ deleted_at: null }).eq('org_id', orgId).eq('id', templateId);
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}

export async function duplicateTemplate(db: Db, orgId: string, userId: string, templateId: string): Promise<{ id: string | null; error: string | null }> {
  const original = await fetchTemplate(db, orgId, templateId);
  if (!original) return { id: null, error: 'Template not found.' };
  return createTemplate(db, orgId, userId, { name: `${original.name} (copy)`, structure: original.structure });
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export type ApplyStrategy = 'add' | 'replace_planned' | 'fill_gaps';

export type ApplyPlanItem = {
  day: string;
  mdOffset: number | null;
  templateKey: string;
  session: TemplateSession;
  requires: { wellness: boolean; rpe: boolean; nutrition: boolean };
};

export type ApplyPlan = {
  create: ApplyPlanItem[];
  softDelete: string[];
  keepCount: number;
  unmappedPositions: number[];
};

type WeekDay = { date: string; mdOffset: number | null };
type ExistingSession = { id: string; date: string; status: string; hasData: boolean };

/** Pure, deterministic — the same function the builder's preview and the
 *  eventual write both call, so the preview can never disagree with what
 *  actually gets created. screens/md-planner.md's own packages/core
 *  boundary, kept as one function in this file rather than a separate
 *  package this codebase doesn't otherwise have. */
export function buildApplyPlan(structure: TemplateStructure, week: WeekDay[], existing: ExistingSession[], strategy: ApplyStrategy): ApplyPlan {
  const byOffset = new Map(week.map((w) => [w.mdOffset, w.date]));
  const existingByDate = new Map<string, ExistingSession[]>();
  for (const e of existing) {
    const list = existingByDate.get(e.date) ?? [];
    list.push(e);
    existingByDate.set(e.date, list);
  }

  const create: ApplyPlanItem[] = [];
  const softDelete: string[] = [];
  const unmappedPositions: number[] = [];
  let keepCount = 0;

  for (const day of structure.days) {
    const date = byOffset.get(day.mdOffset);
    if (!date) {
      if (day.sessions.length > 0) unmappedPositions.push(day.mdOffset);
      continue;
    }
    const existingOnDay = existingByDate.get(date) ?? [];
    const dayIsEmpty = existingOnDay.length === 0;

    if (strategy === 'fill_gaps' && !dayIsEmpty) {
      keepCount += existingOnDay.length;
      continue;
    }

    if (strategy === 'replace_planned') {
      for (const e of existingOnDay) {
        if (e.status === 'planned' && !e.hasData) softDelete.push(e.id);
        else keepCount += 1;
      }
    } else {
      keepCount += existingOnDay.length;
    }

    for (const session of day.sessions) {
      create.push({ day: date, mdOffset: day.mdOffset === 0 ? 0 : day.mdOffset, templateKey: session.key, session, requires: day.requires });
    }
  }

  return { create, softDelete, keepCount, unmappedPositions };
}

export async function applyTemplate(
  db: Db,
  orgId: string,
  userId: string,
  input: { templateId: string; weekStart: string; strategy: ApplyStrategy; fixtureId: string | null },
  timezone: string,
): Promise<{ created: number; softDeleted: number; error: string | null }> {
  const template = await fetchTemplate(db, orgId, input.templateId);
  if (!template) return { created: 0, softDeleted: 0, error: 'Template not found.' };

  const seasonRes = await db.from('sessions').select('season_id').eq('org_id', orgId).order('starts_at', { ascending: false }).limit(1).maybeSingle();
  const seasonId = seasonRes.data?.season_id;
  if (!seasonId) return { created: 0, softDeleted: 0, error: 'No season on record to attach these sessions to.' };

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${input.weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  let fixtureDate: string | null = null;
  if (input.fixtureId) {
    const { data: fx } = await db.from('fixtures').select('kickoff_at').eq('org_id', orgId).eq('id', input.fixtureId).maybeSingle();
    // Local calendar date, not the UTC one — same bug class as this
    // function's own week-window fix below (a late kickoff near the
    // 23:00-00:00 UTC edge could otherwise anchor MD-n to the wrong day).
    fixtureDate = fx ? dateInTz(new Date(fx.kickoff_at), timezone) : null;
  }

  const week: WeekDay[] = weekDates.map((date) => ({
    date,
    // daysBetween (format.ts), not a reinvented Date.parse diff — same
    // primitive apply/page.tsx's own preview uses for the identical
    // fixtureDate-anchored offset.
    mdOffset: fixtureDate ? daysBetween(fixtureDate, date) : null,
  }));

  // Same fix as schedule.ts's own dayBounds()/rangeBounds() (integration-
  // audit Batch 2): a literal `${date}T00:00:00Z`/`T23:59:59Z` window is
  // only correct for UTC+0 with no DST — a session between 23:00-00:00 UTC
  // would have been read as belonging to the wrong local day, which would
  // have made this "what already exists this week" check miss or
  // double-count a real session right at the edge of the week.
  const weekBounds = rangeBounds(weekDates[0]!, weekDates[6]!, timezone);
  const { data: existingRows, error: existErr } = await db
    .from('sessions')
    .select('id, starts_at, status')
    .eq('org_id', orgId)
    .gte('starts_at', weekBounds.from)
    .lte('starts_at', weekBounds.to)
    .is('deleted_at', null);
  if (existErr) return { created: 0, softDeleted: 0, error: humanizeDbError(existErr.message, 'staff') };

  // "Has recorded data" checks the calendar session's own two real
  // session_id-linked tables — session_attendance and training_entries.
  // gym_session_logs is keyed to programme_session_id, a gym *programme*
  // session (a different table entirely from the calendar sessions this
  // planner creates), so it has nothing to check here.
  const sessionIds = (existingRows ?? []).map((r) => r.id);
  const [attendanceRes, trainingRes] = await Promise.all([
    sessionIds.length ? db.from('session_attendance').select('session_id').in('session_id', sessionIds) : Promise.resolve({ data: [] as { session_id: string | null }[] }),
    sessionIds.length ? db.from('training_entries').select('session_id').in('session_id', sessionIds) : Promise.resolve({ data: [] as { session_id: string | null }[] }),
  ]);
  const idsWithData = new Set(
    [...(attendanceRes.data ?? []), ...(trainingRes.data ?? [])].map((r) => r.session_id).filter((id): id is string => id !== null),
  );

  const existing: ExistingSession[] = (existingRows ?? []).map((r) => ({
    id: r.id,
    // Local calendar date, not the UTC one — same bug class as this
    // function's own week-window fix above.
    date: dateInTz(new Date(r.starts_at), timezone),
    status: r.status,
    hasData: idsWithData.has(r.id),
  }));

  const plan = buildApplyPlan(template.structure, week, existing, input.strategy);
  if (plan.create.length === 0 && plan.softDelete.length === 0) {
    return { created: 0, softDeleted: 0, error: 'Every position in this template already has sessions. Nothing would be created.' };
  }

  if (plan.softDelete.length > 0) {
    const { error } = await db.from('sessions').update({ deleted_at: new Date().toISOString() }).in('id', plan.softDelete);
    if (error) return { created: 0, softDeleted: 0, error: humanizeDbError(error.message, 'staff') };
  }

  const rows = plan.create.map((item) => ({
    org_id: orgId,
    season_id: seasonId,
    fixture_id: item.mdOffset === 0 ? input.fixtureId : null,
    session_type: item.session.type,
    title: item.session.title,
    // item.session.startTime is the template's local wall-clock time
    // ("09:00" means 9am at the club, not 9am UTC) — appending a literal
    // `Z` stored it as if the org's local time WERE UTC. zonedTimeToUtcIso
    // is the real conversion, the same one NewSessionForm.tsx and
    // ScheduleWorkspace.tsx already use for every other session write, and
    // the one weekBounds just above already uses for this same timezone.
    starts_at: zonedTimeToUtcIso(item.day, item.session.startTime, timezone),
    duration_min: item.session.durationMin,
    location: item.session.location,
    md_offset: item.mdOffset,
    planned_rpe: item.session.plannedRpe,
    requires_wellness: item.requires.wellness,
    requires_rpe: item.requires.rpe,
    requires_nutrition: item.requires.nutrition,
    status: 'planned' as const,
    template_key: item.templateKey,
    applied_template_id: input.templateId,
    created_by: userId,
  }));

  const { data: created, error: insErr } = await db.from('sessions').insert(rows).select('id');
  if (insErr) return { created: 0, softDeleted: plan.softDelete.length, error: humanizeDbError(insErr.message, 'staff') };

  // "All squad" participation is real, individual athlete_id rows, not a
  // group shortcut — createSession's own group-based path (schedule.ts)
  // would miss any athlete not covered by the org's real positional
  // groups (a real gap this session already found: some athletes fall
  // into no positional group at all). One row per athlete per session
  // guarantees full coverage regardless of group membership gaps.
  if (created && created.length > 0) {
    const { data: athletes, error: athErr } = await db.from('athletes').select('id').eq('org_id', orgId).eq('status', 'active').is('deleted_at', null);
    if (athErr) return { created: created.length, softDeleted: plan.softDelete.length, error: `Sessions created, but rostering failed. ${humanizeDbError(athErr.message, 'staff')}` };
    const participantRows = created.flatMap((s) => (athletes ?? []).map((a) => ({ org_id: orgId, session_id: s.id, athlete_id: a.id, group_id: null })));
    const { error: partErr } = await db.from('session_participants').insert(participantRows);
    if (partErr) return { created: created.length, softDeleted: plan.softDelete.length, error: `Sessions created, but rostering failed. ${humanizeDbError(partErr.message, 'staff')}` };
  }

  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: userId,
    actor_role: 'coach',
    action: 'week_template.applied',
    entity_type: 'week_templates',
    entity_id: input.templateId,
    metadata: { week_start: input.weekStart, strategy: input.strategy, created: created?.length ?? 0, soft_deleted: plan.softDelete.length },
  });

  return { created: created?.length ?? 0, softDeleted: plan.softDelete.length, error: null };
}
