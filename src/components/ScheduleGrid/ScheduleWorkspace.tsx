'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { createClient } from '@/lib/supabase/client';
import {
  createSession,
  updateSession,
  deleteSession,
  type DbSessionType,
  type GridSession,
  type NormalWeek,
} from '@/lib/queries/schedule';
import { decimalHourInTz, zonedTimeToUtcIso } from '@/lib/format';
import {
  H0,
  H1,
  clockLabel,
  detectClashes,
  placeBlocks,
  computeBlockDisplay,
} from '@/lib/scheduleGeometry';
import { TimeGrid, type DayColumn, type RenderedBlock } from './TimeGrid';
import { SelectedSessionPanel, type PanelSession } from './SelectedSessionPanel';
import { WeekStatsPanel } from './WeekStatsPanel';
import { toBaseSession, type BaseSession, type DraftSession, type EditOverlay, type GroupOption, type TemplateOption } from './types';

type EffectiveSession = BaseSession & { edited: boolean; isNew: boolean };

type Props = {
  orgId: string;
  userId: string;
  timezone: string;
  weekStart: string;
  days: string[]; // 7 ISO dates, Mon..Sun
  today: string;
  weekRangeLabel: string;
  eyebrow: string;
  prevHref: string;
  nextHref: string;
  timetableHref: string;
  initialSessions: readonly GridSession[];
  groups: readonly (GroupOption & { memberCount: number })[];
  groupMembership: Record<string, string[]>;
  templates: readonly TemplateOption[];
  applyTemplateHrefBase: string;
  saveTemplateHref: string;
  typical: NormalWeek;
  nowDecimalHourToday: number | null; // real "now", only meaningful when today is in `days`
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' });
const DOM_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

/** SCHEDULE-SPEC.md, the full grid rebuild. §9's editing model, ported for
 *  real: `edits`/`added`/`removed` are held as genuine client-only state —
 *  nothing here is written to the database until Publish is clicked (see
 *  the long comment on handlePublish below for why that is a real,
 *  schema-free way to satisfy "publish must commit, not clear" without the
 *  draft/publish column this app's `sessions` table does not have). */
export function ScheduleWorkspace({
  orgId,
  userId,
  timezone,
  weekStart,
  days,
  today,
  weekRangeLabel,
  eyebrow,
  prevHref,
  nextHref,
  timetableHref,
  initialSessions,
  groups,
  groupMembership,
  templates,
  applyTemplateHrefBase,
  saveTemplateHref,
  typical,
  nowDecimalHourToday,
}: Props) {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [sel, setSel] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<DraftSession | null>(null);
  const [edits, setEdits] = useState<Record<string, EditOverlay>>({});
  const [added, setAdded] = useState<DraftSession[]>([]);
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const base: BaseSession[] = useMemo(
    () => initialSessions.map((s) => toBaseSession(s, timezone, (iso, tz) => decimalHourInTz(new Date(iso), tz))),
    [initialSessions, timezone],
  );
  const baseById = useMemo(() => new Map(base.map((s) => [s.id, s])), [base]);
  const groupNameById = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const dirtyCount =
    Object.values(edits).filter((e) => e && Object.keys(e).length > 0).length +
    added.length +
    Object.keys(removed).length;

  useEffect(() => {
    if (dirtyCount === 0) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyCount]);

  const effective: EffectiveSession[] = useMemo(() => {
    const kept = base
      .filter((s) => !removed[s.id])
      .map((s): EffectiveSession => {
        const e = edits[s.id];
        if (!e) return { ...s, edited: false, isNew: false };
        const groupIds = e.groupIds ?? s.groupIds;
        // Recomputed from real membership, but unscoped by the active group
        // filter (unlike the server fetch) — a known, minor simplification
        // for the local-edit-only window before publish; the server
        // recomputes it correctly-scoped the moment this change is
        // actually published and the page refetches.
        const athleteIds = e.groupIds
          ? [...new Set(e.groupIds.flatMap((gid) => groupMembership[gid] ?? []))]
          : s.athleteIds;
        return {
          ...s,
          start: e.start ?? s.start,
          mins: e.mins ?? s.mins,
          groupIds,
          groupNames: groupIds.map((id) => groupNameById.get(id) ?? 'Unnamed group'),
          athleteIds,
          edited: true,
          isNew: false,
        };
      });
    const drafts: EffectiveSession[] = added.map((d) => ({
      id: d.id,
      dow: d.dow,
      start: d.start,
      mins: d.mins,
      title: d.title,
      type: d.type,
      location: d.location,
      mdOffset: d.mdOffset,
      groupIds: d.groupIds,
      groupNames: d.groupIds.map((id) => groupNameById.get(id) ?? 'Unnamed group'),
      athleteIds: [...new Set(d.groupIds.flatMap((gid) => groupMembership[gid] ?? []))],
      status: 'planned',
      edited: true,
      isNew: true,
    }));
    return [...kept, ...drafts];
  }, [base, edits, added, removed, groupMembership, groupNameById]);

  const effectiveById = useMemo(() => new Map(effective.map((s) => [s.id, s])), [effective]);

  // ---- per-day geometry (§5) ----
  const dayColumns: DayColumn[] = [];
  let clashPairLabels: string[] = [];
  const clashedIds = new Set<string>();

  for (const date of days) {
    const daySessions = effective.filter((s) => s.dow === date);
    const placed = placeBlocks(
      daySessions.map((s) => ({ id: s.id, start: s.start, mins: s.mins, name: s.title, athleteIds: s.athleteIds })),
    );
    const clash = detectClashes(placed);
    clashPairLabels = [...clashPairLabels, ...clash.pairLabels];
    clash.clashedIds.forEach((id) => clashedIds.add(id));

    const blocks: RenderedBlock[] = placed.map((p) => {
      const s = effectiveById.get(p.x.id)!;
      const display = computeBlockDisplay(p, placed, s.edited);
      // Real seed data has sessions starting before H0 and, for a Saturday
      // fixture with a real evening kickoff (19:30 UTC — 20:30 local in
      // August), a session almost entirely after H1. The spec's own worked
      // example never needed either case (earliest session 09:00, its own
      // fixture at 14:00) because it's a single frozen mockup day, not a
      // real club's actual week. The 08:00–18:00 grid is a deliberate,
      // literal §5 constant, not something to widen for one early gym
      // session or a floodlit kickoff, so a block outside it is clamped to
      // the visible 0–680px band — and, when the real time is entirely
      // outside that band, pinned to a minimum visible sliver at the near
      // edge rather than collapsed to nothing, so a real Saturday fixture
      // is still a clickable block instead of a silently empty column
      // under a day header that still (correctly) says "80m". Found live
      // on this org's real data, not hypothesised.
      const rawTop = (p.x.start - H0) * 68;
      const rawBottom = rawTop + display.h;
      const MIN_SLIVER = 24;
      let top: number;
      let height: number;
      if (rawBottom <= 0) {
        top = 0;
        height = Math.min(display.h, MIN_SLIVER);
      } else if (rawTop >= 680) {
        height = Math.min(display.h, MIN_SLIVER);
        top = 680 - height;
      } else {
        top = Math.max(0, rawTop);
        height = Math.min(680, rawBottom) - top;
      }
      return {
        id: s.id,
        title: s.title,
        type: s.type,
        groupNames: s.groupNames,
        top,
        height,
        left: display.left,
        width: display.width,
        zIndex: display.zIndex,
        showTime: display.showTime,
        timeText: display.timeText,
        showBadge: display.showBadge,
        clashed: clash.clashedIds.has(s.id),
        stagger: display.stagger,
        tied: display.tied,
      };
    });

    const contactMins = daySessions.filter((s) => s.athleteIds.length > 0).reduce((sum, s) => sum + s.mins, 0);
    const mdSession = daySessions.find((s) => s.mdOffset !== null);
    const dateObj = new Date(`${date}T12:00:00Z`);

    dayColumns.push({
      date,
      weekday: WEEKDAY_FMT.format(dateObj),
      domLabel: DOM_FMT.format(dateObj),
      isToday: date === today,
      isPast: date < today,
      isMatch: daySessions.some((s) => s.type === 'match'),
      mdOffset: mdSession?.mdOffset ?? null,
      contactMins,
      blocks,
    });
  }

  // ---- selection ----
  const selectedEffective = sel && sel !== '__new' ? (effectiveById.get(sel) ?? null) : null;
  const panelSession: PanelSession | null =
    sel === '__new' && newDraft
      ? {
          id: '__new',
          dow: newDraft.dow,
          start: newDraft.start,
          mins: newDraft.mins,
          title: newDraft.title,
          type: newDraft.type,
          location: newDraft.location,
          mdOffset: newDraft.mdOffset,
          groupIds: newDraft.groupIds,
          groupNames: newDraft.groupIds.map((id) => groupNameById.get(id) ?? 'Unnamed group'),
          athleteIds: [...new Set(newDraft.groupIds.flatMap((gid) => groupMembership[gid] ?? []))],
          isPast: newDraft.dow < today,
        }
      : selectedEffective
        ? { ...selectedEffective, isPast: selectedEffective.dow < today }
        : null;

  function selectSession(id: string) {
    setNewDraft(null);
    setSel(id);
  }

  function startDraft(dow: string) {
    if (mode !== 'edit') return;
    setNewDraft({ id: '__new', dow, start: 9, mins: 60, title: '', type: 'training', location: null, mdOffset: null, groupIds: [] });
    setSel('__new');
  }

  function patchEdit(id: string, patch: EditOverlay) {
    setEdits((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
  }

  // Every newDraft update below goes through the functional setState form —
  // `setNewDraft((cur) => ...)`, never `setNewDraft({ ...newDraft, ... })`.
  // Found live: two field edits fired in the same React batch (a stepper
  // press immediately followed by a group-chip click, both real, ordinary
  // user actions React can coalesce into one commit) each closed over the
  // same pre-batch `newDraft` snapshot under the object form, so the
  // second write silently discarded the first — the exact "loses a
  // coach's work" defect class §9 warns about, just one step earlier than
  // publish. The functional form always composes on top of the latest
  // pending state, batched or not.
  function handleStart(deltaMin: number) {
    if (sel === '__new') {
      setNewDraft((cur) => (cur ? { ...cur, start: clamp(cur.start + deltaMin / 60, H0, H1 - cur.mins / 60) } : cur));
      return;
    }
    if (!sel) return;
    const eff = effectiveById.get(sel);
    if (!eff) return;
    const next = clamp(eff.start + deltaMin / 60, H0, H1 - eff.mins / 60);
    patchEdit(sel, { start: next });
  }

  function handleDuration(deltaMin: number) {
    if (sel === '__new') {
      setNewDraft((cur) => {
        if (!cur) return cur;
        const maxByClock = (H1 - cur.start) * 60;
        return { ...cur, mins: Math.min(180, maxByClock, Math.max(15, cur.mins + deltaMin)) };
      });
      return;
    }
    if (!sel) return;
    const eff = effectiveById.get(sel);
    if (!eff) return;
    const maxByClock = (H1 - eff.start) * 60;
    const next = Math.min(180, maxByClock, Math.max(15, eff.mins + deltaMin));
    patchEdit(sel, { mins: next });
  }

  function handleToggleGroup(groupId: string) {
    if (sel === '__new') {
      setNewDraft((cur) => {
        if (!cur) return cur;
        const has = cur.groupIds.includes(groupId);
        return { ...cur, groupIds: has ? cur.groupIds.filter((id) => id !== groupId) : [...cur.groupIds, groupId] };
      });
      return;
    }
    if (!sel) return;
    const eff = effectiveById.get(sel);
    if (!eff) return;
    const current = edits[sel]?.groupIds ?? eff.groupIds;
    const has = current.includes(groupId);
    patchEdit(sel, { groupIds: has ? current.filter((id) => id !== groupId) : [...current, groupId] });
  }

  function handleRemove() {
    if (!sel) return;
    if (sel.startsWith('new-')) {
      setAdded((cur) => cur.filter((d) => d.id !== sel));
    } else {
      setRemoved((cur) => ({ ...cur, [sel]: true }));
    }
    setSel(null);
  }

  function handleDuplicate() {
    if (!sel) return;
    const eff = effectiveById.get(sel);
    if (!eff) return;
    const id = `new-${crypto.randomUUID()}`;
    setAdded((cur) => [
      ...cur,
      {
        id,
        dow: eff.dow,
        start: eff.start,
        mins: eff.mins,
        title: `${eff.title} (copy)`,
        type: eff.type,
        location: eff.location,
        mdOffset: eff.mdOffset,
        groupIds: eff.groupIds,
      },
    ]);
    setSel(id);
  }

  function handleAddToDay() {
    if (!newDraft) return;
    const id = `new-${crypto.randomUUID()}`;
    setAdded((cur) => [...cur, { ...newDraft, id }]);
    setSel(id);
    setNewDraft(null);
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const failures: string[] = [];

    for (const id of Object.keys(removed)) {
      const b = baseById.get(id);
      if (!b) continue;
      const res = await deleteSession(client, orgId, id);
      if (res.error) failures.push(`${b.title}: ${res.error}`);
      else
        setRemoved((cur) => {
          const next = { ...cur };
          delete next[id];
          return next;
        });
    }

    for (const [id, patch] of Object.entries(edits)) {
      if (!patch || Object.keys(patch).length === 0) continue;
      const b = baseById.get(id);
      if (!b) continue;
      const startsAt = zonedTimeToUtcIso(b.dow, clockLabel(patch.start ?? b.start), timezone);
      const res = await updateSession(client, orgId, id, {
        title: b.title,
        sessionType: b.type,
        startsAt,
        durationMin: patch.mins ?? b.mins,
        location: b.location,
        mdOffset: b.mdOffset,
        groupIds: patch.groupIds ?? b.groupIds,
      });
      if (res.error) failures.push(`${b.title}: ${res.error}`);
      else
        setEdits((cur) => {
          const next = { ...cur };
          delete next[id];
          return next;
        });
    }

    for (const draft of added) {
      const res = await createSession(client, orgId, userId, {
        title: draft.title.trim() || 'New session',
        sessionType: draft.type,
        startsAt: zonedTimeToUtcIso(draft.dow, clockLabel(draft.start), timezone),
        durationMin: draft.mins,
        location: draft.location,
        mdOffset: draft.mdOffset,
        groupIds: draft.groupIds,
      });
      if (res.error) failures.push(`${draft.title || 'New session'}: ${res.error}`);
      else setAdded((cur) => cur.filter((d) => d.id !== draft.id));
    }

    setPublishing(false);
    setPublishError(failures.length > 0 ? `Not published: ${failures.join('; ')}` : null);
    router.refresh();
  }

  function handleDiscard() {
    setEdits({});
    setAdded([]);
    setRemoved({});
    setNewDraft(null);
    setSel(null);
    setPublishError(null);
  }

  const defaultDraftDay = days.includes(today) ? today : (days[0] ?? weekStart);

  return (
    <div className="sg">
      <div className="sg-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="sg-title">Schedule</h1>
        </div>
        <div className="sg-header-right">
          <div className="sg-segmented" role="group" aria-label="Read or edit">
            <button type="button" className="sg-segment" aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
              Read
            </button>
            <button
              type="button"
              className="sg-segment"
              aria-pressed={mode === 'edit'}
              onClick={() => setMode('edit')}
            >
              Edit
            </button>
          </div>
          <div className="sg-weeknav">
            <Link href={prevHref} className="sg-weeknav-btn" aria-label="Previous week">
              ‹
            </Link>
            <span className="sg-weeknav-range mono">{weekRangeLabel}</span>
            <Link href={nextHref} className="sg-weeknav-btn" aria-label="Next week">
              ›
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 14 }}>
        <span className="squad-chip" aria-current="page">
          Week plan
        </span>
        <Link href={timetableHref} className="squad-chip">
          Today
        </Link>
      </div>

      <div className="card sg-banner" data-dirty={dirtyCount > 0}>
        <span className="sg-banner-dot" />
        <div>
          <div className="sg-banner-title">
            {dirtyCount > 0 ? `${dirtyCount} change${dirtyCount === 1 ? '' : 's'} not yet in the athlete app` : 'The athlete app is up to date'}
          </div>
          <div className="sg-banner-sub">
            {dirtyCount > 0
              ? 'Athletes still see the schedule as it was before these edits. Nothing changes on their phone until you publish.'
              : 'No local edits waiting — every earlier save here is already live on every phone.'}
          </div>
          {publishError ? (
            <div className="sg-banner-sub" style={{ color: 'var(--bad-text)' }}>
              {publishError}
            </div>
          ) : null}
        </div>
        <div className="sg-banner-actions">
          {dirtyCount > 0 ? (
            <>
              <button type="button" className="sg-btn-discard" onClick={handleDiscard} disabled={publishing}>
                Discard
              </button>
              <button type="button" className="sg-btn-publish" onClick={handlePublish} disabled={publishing}>
                {publishing ? 'Publishing…' : 'Publish to athletes'}
              </button>
            </>
          ) : (
            <button type="button" className="sg-btn-published" disabled>
              Published
            </button>
          )}
        </div>
      </div>

      {mode === 'edit' ? (
        <div className="card sg-toolbar">
          <button type="button" className="sg-btn-add" onClick={() => startDraft(defaultDraftDay)}>
            + Session
          </button>
          <span className="sg-toolbar-divider" />
          <span className="sg-toolbar-label">Apply template</span>
          {templates.length > 0 ? (
            templates.map((t) => (
              <Link key={t.id} href={`${applyTemplateHrefBase}&template=${t.id}`} className="squad-chip">
                {t.name}
              </Link>
            ))
          ) : (
            <span className="cap" style={{ margin: 0 }}>
              No templates yet.
            </span>
          )}
          <Link href={saveTemplateHref} className="btn-ghost sg-toolbar-save">
            Save this week as a template
          </Link>
        </div>
      ) : null}

      {clashPairLabels.length > 0 ? (
        <div className="sg-clash">
          <span className="sg-clash-dot" />
          <span>
            <span className="sg-clash-count">
              {clashPairLabels.length} overlap{clashPairLabels.length === 1 ? '' : 's'}
            </span>{' '}
            <span className="sg-clash-list">{clashPairLabels.join('; ')} — each pair shares athletes</span>
          </span>
          <button
            type="button"
            className="sg-clash-link"
            onClick={() => {
              const first = [...clashedIds][0];
              if (first) selectSession(first);
            }}
          >
            Show me ›
          </button>
        </div>
      ) : null}

      <TimeGrid
        days={dayColumns}
        mode={mode}
        selectedId={sel}
        nowDecimalHour={nowDecimalHourToday}
        onSelect={selectSession}
        onDayHeaderClick={startDraft}
      />

      <div className="sg-panels">
        <SelectedSessionPanel
          mode={mode}
          session={panelSession}
          isNew={sel === '__new'}
          groups={groups}
          onStart={handleStart}
          onDuration={handleDuration}
          onToggleGroup={handleToggleGroup}
          onNameChange={(title) => setNewDraft((cur) => (cur ? { ...cur, title } : cur))}
          onTypeChange={(type: DbSessionType) => setNewDraft((cur) => (cur ? { ...cur, type } : cur))}
          onLocationChange={(location) => setNewDraft((cur) => (cur ? { ...cur, location } : cur))}
          onAddToDay={handleAddToDay}
          onRemove={handleRemove}
          onDuplicate={handleDuplicate}
        />
        <WeekStatsPanel sessions={effective} typical={typical} groups={groups} />
      </div>
    </div>
  );
}
