'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  createSession,
  updateSession,
  deleteSession,
  type DbSessionType,
  type GridSession,
  type NormalWeek,
} from '@/lib/queries/schedule';
import { anchorMdOffsetsToWeek, decimalHourInTz, zonedTimeToUtcIso } from '@/lib/format';
import {
  PXH,
  clockLabel,
  computeHourRange,
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

// Built per call from the org's real timezone, not a hardcoded one — see
// schedule/page.tsx's own weekdayLongFmt/dayMonthFmt for the same fix and
// its reasoning.
function weekdayFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: timezone });
}
function domFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: timezone });
}

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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

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
      // A staged draft has no row in the database yet — createSession (not
      // updateSession) is what publishes it, which takes no optimistic-lock
      // token at all, so this value is never read. Present only to satisfy
      // BaseSession's shape.
      updatedAt: '',
      // Same reasoning: a draft has no session_participants row yet, so
      // there is nothing for fetchWeekSessionsDetailed to have counted.
      // Real once this session is published and the page refetches.
      restrictionConflictCount: 0,
      edited: true,
      isNew: true,
    }));
    return [...kept, ...drafts];
  }, [base, edits, added, removed, groupMembership, groupNameById]);

  const effectiveById = useMemo(() => new Map(effective.map((s) => [s.id, s])), [effective]);

  // ---- per-day geometry (§5) ----
  // MD labels re-anchored to this week's OWN matchday: a stored md_offset
  // counts toward whichever fixture the session was created against, which
  // for a historical week can be a later week's fixture — the audit caught
  // an actual matchday header reading "MD-7" that way (see
  // anchorMdOffsetsToWeek, format.ts — the same helper the dashboard and
  // athlete week strips use, so all three agree).
  const anchoredMd = anchorMdOffsetsToWeek(
    days.map((date) => {
      const daySessions = effective.filter((s) => s.dow === date);
      return {
        date,
        isMatch: daySessions.some((s) => s.type === 'match'),
        storedMdOffset: daySessions.find((s) => s.mdOffset !== null)?.mdOffset ?? null,
      };
    }),
  );

  // UX audit finding 1: the grid's hour range is computed from this week's
  // own sessions (see computeHourRange's own header for why), not a fixed
  // 08:00–18:00 constant. One shared range for the whole week, since all
  // seven day columns share one time axis.
  const { h0, h1 } = computeHourRange(effective.map((s) => ({ start: s.start, mins: s.mins })));
  const gridHeightPx = (h1 - h0) * PXH;

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
      // The grid's hour range (h0/h1, above) is computed from this week's
      // own sessions, so every block's real start time already falls inside
      // it — no clamping to a fixed band needed. A real Saturday evening
      // kickoff (20:30 local) now genuinely extends the grid rather than
      // being pinned to a misleading sliver at its edge (UX audit finding
      // 1; see scheduleGeometry.ts's computeHourRange for the full account).
      const top = (p.x.start - h0) * PXH;
      const height = display.h;
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
    const dateObj = new Date(`${date}T12:00:00Z`);

    dayColumns.push({
      date,
      weekday: weekdayFmt(timezone).format(dateObj),
      domLabel: domFmt(timezone).format(dateObj),
      isToday: date === today,
      isPast: date < today,
      isMatch: daySessions.some((s) => s.type === 'match'),
      mdOffset: daySessions.length > 0 ? (anchoredMd.get(date) ?? null) : null,
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
          // Precommit form, no session_participants row yet — nothing to count.
          restrictionConflictCount: 0,
        }
      : selectedEffective
        ? {
            ...selectedEffective,
            // Same per-week anchoring as the day header above it — the
            // panel must never say "MD-7" under a column header saying "MD".
            mdOffset: anchoredMd.get(selectedEffective.dow) ?? selectedEffective.mdOffset,
            isPast: selectedEffective.dow < today,
            // restrictionConflictCount rides through from `selectedEffective`
            // as originally fetched — same known simplification as the
            // athleteIds preview above it (see `effective`'s own comment): a
            // local, unpublished group-membership edit doesn't recompute it,
            // because doing so needs per-athlete restriction data this
            // workspace never fetches. Correct again the moment this
            // session is published and the page refetches.
          }
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
      setNewDraft((cur) => (cur ? { ...cur, start: clamp(cur.start + deltaMin / 60, h0, h1 - cur.mins / 60) } : cur));
      return;
    }
    if (!sel) return;
    const eff = effectiveById.get(sel);
    if (!eff) return;
    const next = clamp(eff.start + deltaMin / 60, h0, h1 - eff.mins / 60);
    if (sel.startsWith('new-')) {
      setAdded((cur) => cur.map((d) => (d.id === sel ? { ...d, start: next } : d)));
      return;
    }
    patchEdit(sel, { start: next });
  }

  function handleDuration(deltaMin: number) {
    if (sel === '__new') {
      setNewDraft((cur) => {
        if (!cur) return cur;
        const maxByClock = (h1 - cur.start) * 60;
        return { ...cur, mins: Math.min(180, maxByClock, Math.max(15, cur.mins + deltaMin)) };
      });
      return;
    }
    if (!sel) return;
    const eff = effectiveById.get(sel);
    if (!eff) return;
    const maxByClock = (h1 - eff.start) * 60;
    const next = Math.min(180, maxByClock, Math.max(15, eff.mins + deltaMin));
    if (sel.startsWith('new-')) {
      setAdded((cur) => cur.map((d) => (d.id === sel ? { ...d, mins: next } : d)));
      return;
    }
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
    if (sel.startsWith('new-')) {
      // A staged (already-added) draft has no `edits` overlay of its own —
      // it is not in `base`, so an overlay keyed to its synthetic id would
      // never be read back (see the Start/Duration fix just above with the
      // same root cause). Patch the staged draft directly.
      const has = eff.groupIds.includes(groupId);
      setAdded((cur) =>
        cur.map((d) =>
          d.id === sel
            ? { ...d, groupIds: has ? d.groupIds.filter((id) => id !== groupId) : [...d.groupIds, groupId] }
            : d,
        ),
      );
      return;
    }
    const current = edits[sel]?.groupIds ?? eff.groupIds;
    const has = current.includes(groupId);
    patchEdit(sel, { groupIds: has ? current.filter((id) => id !== groupId) : [...current, groupId] });
  }

  /** Draft fields (name, type, location, day) stay editable for the whole
   *  life of an unpublished draft — both before it is staged (`sel ===
   *  '__new'`, still in `newDraft`) and after (`sel` starting `new-`, now in
   *  `added`) — not just in the instant before "Add to Day" is clicked. UX
   *  audit finding 11. Uses the functional setState form throughout, same
   *  reasoning as the newDraft-only comment above: two field edits can land
   *  in the same React batch. */
  function updateDraftField<K extends keyof DraftSession>(key: K, value: DraftSession[K]) {
    if (sel === '__new') {
      setNewDraft((cur) => (cur ? { ...cur, [key]: value } : cur));
      return;
    }
    if (sel && sel.startsWith('new-')) {
      setAdded((cur) => cur.map((d) => (d.id === sel ? { ...d, [key]: value } : d)));
    }
  }

  function handleCancelDraft() {
    setNewDraft(null);
    setSel(null);
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
        // Optimistic lock: b.updatedAt is this session's updated_at as of
        // this page's load. If it moved since — another tab, or a
        // SessionEditForm edit on /schedule/[sessionId] — updateSession
        // refuses the write and returns a clear conflict error instead of
        // silently resending this stale snapshot's title/location/type/
        // mdOffset over whatever changed. See that function's comment.
        expectedUpdatedAt: b.updatedAt,
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
    setConfirmingDiscard(false);
  }

  // UX audit finding 17: Discard used to be a single unconfirmed click
  // beside Publish. Nothing stages `confirmingDiscard` when there is
  // nothing dirty — the button that opens it only renders when
  // `dirtyCount > 0` (below) — so this never prompts for a no-op discard.
  // Reset if a Publish (or anything else) clears dirtyCount while a
  // confirmation happened to be open.
  useEffect(() => {
    if (dirtyCount === 0) setConfirmingDiscard(false);
  }, [dirtyCount]);

  // "Currently focused/visible day" has no separate meaning in this grid —
  // all seven days are always visible as columns at once (no per-day
  // scroll/paging state to read), so the real answer to "what day is in
  // view" is: today, when today is one of the seven columns on screen;
  // otherwise the first (Monday) column of whatever week is being viewed.
  const defaultDraftDay = days.includes(today) ? today : (days[0] ?? weekStart);
  const dayOptions = days.map((d) => ({
    date: d,
    weekday: weekdayFmt(timezone).format(new Date(`${d}T12:00:00Z`)),
    domLabel: domFmt(timezone).format(new Date(`${d}T12:00:00Z`)),
  }));

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
            confirmingDiscard ? (
              <>
                <span className="tiny" style={{ color: 'var(--bad-text)' }}>
                  Discard {dirtyCount} change{dirtyCount === 1 ? '' : 's'}? This can&apos;t be undone.
                </span>
                <button
                  type="button"
                  className="sg-btn-discard"
                  onClick={handleDiscard}
                  disabled={publishing}
                  style={{ color: 'var(--bad-text)', borderColor: 'var(--bad)' }}
                >
                  Yes, discard
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmingDiscard(false)}>
                  Never mind
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sg-btn-discard"
                  onClick={() => setConfirmingDiscard(true)}
                  disabled={publishing}
                >
                  Discard
                </button>
                <button type="button" className="sg-btn-publish" onClick={handlePublish} disabled={publishing}>
                  {publishing ? 'Publishing…' : 'Publish to athletes'}
                </button>
              </>
            )
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
        h0={h0}
        h1={h1}
        gridHeightPx={gridHeightPx}
        onSelect={selectSession}
        onDayHeaderClick={startDraft}
      />

      <div className="sg-panels">
        <SelectedSessionPanel
          mode={mode}
          timezone={timezone}
          session={panelSession}
          groups={groups}
          dayOptions={dayOptions}
          hourRange={{ h0, h1 }}
          onStart={handleStart}
          onDuration={handleDuration}
          onToggleGroup={handleToggleGroup}
          onDayChange={(date) => updateDraftField('dow', date)}
          onNameChange={(title) => updateDraftField('title', title)}
          onTypeChange={(type: DbSessionType) => updateDraftField('type', type)}
          onLocationChange={(location) => updateDraftField('location', location)}
          onAddToDay={handleAddToDay}
          onCancelDraft={handleCancelDraft}
          onRemove={handleRemove}
          onDuplicate={handleDuplicate}
        />
        <WeekStatsPanel sessions={effective} typical={typical} groups={groups} />
      </div>
    </div>
  );
}
