import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ApplyControls } from '@/components/ApplyControls/ApplyControls';
import { buildApplyPlan, fetchTemplates, type ApplyStrategy } from '@/lib/queries/weekTemplates';
import { fetchNextFixture, mondayOf, rangeBounds } from '@/lib/queries/schedule';
import { dateInTz, daysBetween, formatDate, mdLabel, todayIso, zonedTimeToUtcIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { SESSION_EDIT, hasAnyRole } from '@/lib/access';

export const metadata = { title: 'Apply a week template · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/md-planner.md's Applier, reduced to what direct Supabase calls
 *  can support — see lib/queries/weekTemplates.ts's header. No plan-hash
 *  conflict detection (that needs the Edge Function this build doesn't
 *  have), no two-fixture-in-one-week handling (real seed data never
 *  produces the case). Anchors to the single nearest fixture in the
 *  target week, or none. */
export default async function ApplyTemplatePage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  /* applying a template CREATES sessions, so it is the same gate as + Session. Offering the form and refusing the save is the G-34 shape. */
  if (!hasAnyRole(claims.roles, SESSION_EDIT)) redirect('/schedule');
  const sp = await searchParams;

  const weekStart = typeof sp.week === 'string' ? mondayOf(sp.week) : mondayOf(todayIso(timezone));
  const templateId = typeof sp.template === 'string' ? sp.template : null;
  const strategy: ApplyStrategy = sp.strategy === 'replace_planned' || sp.strategy === 'fill_gaps' ? sp.strategy : 'add';

  // Real local midnight, not a literal UTC one — same bug class as
  // dashboard.ts's fetchNextFixture calls (see that file for the full
  // explanation): `${weekStart}T00:00:00Z` is up to an hour after this
  // org's real local midnight in BST, which could wrongly skip past a
  // fixture kicking off in that gap.
  const [templates, fixture] = await Promise.all([
    fetchTemplates(db, orgId, timezone),
    fetchNextFixture(db, orgId, zonedTimeToUtcIso(weekStart, '00:00', timezone)),
  ]);
  const usableTemplates = templates.filter((t) => !t.archived);
  const weekEnd = (() => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  // Local calendar date, not the UTC one — a fixture kicking off between
  // 23:00-00:00 UTC (00:00-01:00 local in BST) belongs to the next local
  // day, so slicing kickoff_at's raw UTC digits could place it in the
  // wrong week here (same bug class as schedule.ts's own
  // dayBounds()/rangeBounds() — see its header).
  const fixtureLocalDate = fixture ? dateInTz(new Date(fixture.kickoff_at), timezone) : null;
  const fixtureInWeek = fixtureLocalDate && fixtureLocalDate >= weekStart && fixtureLocalDate <= weekEnd ? fixture : null;

  const selected = templateId ? usableTemplates.find((t) => t.id === templateId) : null;

  let previewRows: { date: string; md: string | null; existingTitles: string[]; templateTitles: string[]; result: string }[] = [];
  let planSummary: { create: number; softDelete: number; keep: number; unmapped: number[] } | null = null;

  if (selected) {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${weekStart}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    // fixtureLocalDate is already this fixture's real local calendar date
    // (computed above) — reused rather than re-sliced from kickoff_at here.
    const fixtureDate = fixtureInWeek ? fixtureLocalDate : null;
    const week = weekDates.map((date) => ({
      date,
      mdOffset: fixtureDate ? daysBetween(fixtureDate, date) : null,
    }));

    // Same fix as applyTemplate() itself (weekTemplates.ts) and
    // schedule.ts's own dayBounds()/rangeBounds(): this preview must use
    // the identical timezone-aware week window the real apply uses below,
    // or the "what will happen" table shown here could disagree with what
    // applyTemplate() actually does for a session near the DST edge.
    const weekBounds = rangeBounds(weekDates[0]!, weekDates[6]!, timezone);
    const { data: existingRows } = await db
      .from('sessions')
      .select('id, title, starts_at, status')
      .eq('org_id', orgId)
      .gte('starts_at', weekBounds.from)
      .lte('starts_at', weekBounds.to)
      .is('deleted_at', null);

    // Local calendar date, not the UTC one — same bug class noted above.
    const existing = (existingRows ?? []).map((r) => ({ id: r.id, date: dateInTz(new Date(r.starts_at), timezone), status: r.status, hasData: false }));
    const plan = buildApplyPlan(selected.structure, week, existing, strategy);
    planSummary = { create: plan.create.length, softDelete: plan.softDelete.length, keep: plan.keepCount, unmapped: plan.unmappedPositions };

    const templateByDate = new Map<string, string[]>();
    for (const item of plan.create) {
      const list = templateByDate.get(item.day) ?? [];
      list.push(item.session.title);
      templateByDate.set(item.day, list);
    }
    const existingByDate = new Map<string, string[]>();
    for (const e of existingRows ?? []) {
      // Local calendar date, not the UTC one — same bug class noted above.
      const date = dateInTz(new Date(e.starts_at), timezone);
      const list = existingByDate.get(date) ?? [];
      list.push(e.title);
      existingByDate.set(date, list);
    }
    const softDeletedIds = new Set(plan.softDelete);
    const removedByDate = new Map<string, number>();
    for (const e of existingRows ?? []) {
      if (softDeletedIds.has(e.id)) {
        const date = dateInTz(new Date(e.starts_at), timezone);
        removedByDate.set(date, (removedByDate.get(date) ?? 0) + 1);
      }
    }

    previewRows = week.map((w) => {
      const created = templateByDate.get(w.date) ?? [];
      const removed = removedByDate.get(w.date) ?? 0;
      const keptCount = (existingByDate.get(w.date) ?? []).length - removed;
      const resultParts = [];
      if (keptCount > 0) resultParts.push(`${keptCount} kept`);
      if (created.length > 0) resultParts.push(`+${created.length} new`);
      if (removed > 0) resultParts.push(`-${removed}`);
      return {
        date: w.date,
        md: mdLabel(w.mdOffset),
        existingTitles: existingByDate.get(w.date) ?? [],
        templateTitles: created,
        result: resultParts.join(', ') || '—',
      };
    });
  }

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule/planner">Week templates</Link> · Apply
          </p>
          <h1>
            Apply to {formatDate(weekStart, timezone)} – {formatDate(weekEnd, timezone)}
          </h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--sp-14)' }}>
        <p className="tiny">
          Anchor{' '}
          {fixtureInWeek ? (
            <>
              v {fixtureInWeek.opponent}, {formatDate(fixtureInWeek.kickoff_at, timezone)}
            </>
          ) : (
            'No fixture this week — days are labelled by training-week position only.'
          )}
        </p>
      </div>

      {usableTemplates.length === 0 ? (
        <div className="card">
          <p className="tiny">
            No templates yet. <Link href="/schedule/planner/new">Create one →</Link>
          </p>
        </div>
      ) : (
        <ApplyControls
          orgId={orgId}
          userId={claims.userId}
          orgName={orgName}
          templates={usableTemplates.map((t) => ({ id: t.id, name: t.name }))}
          selectedTemplateId={selected?.id ?? null}
          weekStart={weekStart}
          strategy={strategy}
          fixtureId={fixtureInWeek?.id ?? null}
          previewRows={previewRows}
          planSummary={planSummary}
          timezone={timezone}
        />
      )}
    </>
  );
}
