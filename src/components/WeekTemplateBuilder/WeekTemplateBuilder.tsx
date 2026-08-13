'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import {
  archiveTemplate,
  duplicateTemplate,
  restoreTemplate,
  updateTemplate,
  weekTotalLoad,
  type TemplateDay,
  type TemplateSession,
  type TemplateStructure,
} from '@/lib/queries/weekTemplates';
import { WeekLoadChart } from '@/components/WeekLoadChart/WeekLoadChart';
import { mdLabel } from '@/lib/format';

type Props = { orgId: string; userId: string; templateId: string; name: string; structure: TemplateStructure; archived: boolean };

const SESSION_TYPES = ['training', 'gym', 'match', 'testing', 'recovery', 'meeting', 'rehab'] as const;

function emptySession(): TemplateSession {
  return { key: Math.random().toString(36).slice(2, 8), type: 'training', title: '', startTime: '09:00', durationMin: 60, plannedRpe: null, location: null };
}

function positionsInOrder(structure: TemplateStructure): TemplateDay[] {
  const byOffset = new Map(structure.days.map((d) => [d.mdOffset, d]));
  const out: TemplateDay[] = [];
  for (let off = structure.covers.from; off <= structure.covers.to; off++) {
    out.push(byOffset.get(off) ?? { mdOffset: off, sessions: [], requires: { wellness: false, rpe: false, nutrition: false } });
  }
  return out;
}

/** screens/md-planner.md's Builder, reduced — see lib/queries/weekTemplates.ts's
 *  header for the full list of what's cut (no drag, no live monotony
 *  warning, participants always all_squad). What's kept: the chart
 *  recomputes from local state on every edit (spec's own performance
 *  note — "no query per keystroke"), a required-entries toggle per
 *  position, and one Save that writes the whole structure back in one
 *  update. Session reordering within a day is up/down buttons, not drag —
 *  the spec's own stated mobile fallback ("Move to..."), used here for
 *  both surfaces rather than building a second interaction only web gets. */
export function WeekTemplateBuilder({ orgId, userId, templateId, name: initialName, structure: initialStructure, archived }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [structure, setStructure] = useState<TemplateStructure>(initialStructure);
  const [editingPosition, setEditingPosition] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateSession>(emptySession());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  const positions = useMemo(() => positionsInOrder(structure), [structure]);
  const chartBars = useMemo(
    () =>
      positions.map((p) => ({
        mdOffset: p.mdOffset,
        total: p.sessions.reduce((s, sess) => s + (sess.plannedRpe !== null && sess.durationMin !== null ? sess.durationMin * sess.plannedRpe : 0), 0),
        unscored: p.sessions.length > 0 && p.sessions.some((s) => s.plannedRpe === null || s.durationMin === null),
      })),
    [positions],
  );

  function mutatePosition(mdOffset: number, fn: (day: TemplateDay) => TemplateDay) {
    setStructure((prev) => {
      const existing = prev.days.find((d) => d.mdOffset === mdOffset);
      const base = existing ?? { mdOffset, sessions: [], requires: { wellness: false, rpe: false, nutrition: false } };
      const updated = fn(base);
      const rest = prev.days.filter((d) => d.mdOffset !== mdOffset);
      return { ...prev, days: [...rest, updated].sort((a, b) => a.mdOffset - b.mdOffset) };
    });
    setSaved(false);
  }

  function addSession(mdOffset: number) {
    if (!draft.title.trim()) {
      setError('Give the session a title.');
      return;
    }
    if (draft.type === 'match' && mdOffset !== 0) {
      setError('A match can only be on matchday.');
      return;
    }
    mutatePosition(mdOffset, (day) => {
      if (day.sessions.length >= 4) return day;
      return { ...day, sessions: [...day.sessions, draft] };
    });
    setDraft(emptySession());
    setEditingPosition(null);
    setError(null);
  }

  function removeSession(mdOffset: number, key: string) {
    mutatePosition(mdOffset, (day) => ({ ...day, sessions: day.sessions.filter((s) => s.key !== key) }));
  }

  function moveSession(mdOffset: number, key: string, direction: -1 | 1) {
    mutatePosition(mdOffset, (day) => {
      const idx = day.sessions.findIndex((s) => s.key === key);
      const swap = idx + direction;
      if (idx < 0 || swap < 0 || swap >= day.sessions.length) return day;
      const next = [...day.sessions];
      [next[idx], next[swap]] = [next[swap]!, next[idx]!];
      return { ...day, sessions: next };
    });
  }

  function toggleRequires(mdOffset: number, key: 'wellness' | 'rpe' | 'nutrition') {
    mutatePosition(mdOffset, (day) => ({ ...day, requires: { ...day.requires, [key]: !day.requires[key] } }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(updateTemplate(createClient(), orgId, templateId, { name, structure }));
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setSaved(true);
      router.refresh();
    },
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(duplicateTemplate(createClient(), orgId, userId, templateId));
      if (result.error || !result.id) throw new HumanError(result.error ?? 'Could not duplicate.');
      return result.id;
    },
    onSuccess: (id) => router.push(`/schedule/planner/${id}`),
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        archived ? restoreTemplate(createClient(), orgId, templateId) : archiveTemplate(createClient(), orgId, templateId),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => router.refresh(),
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/schedule/planner">Week templates</Link> · {archived ? 'Archived' : saved ? 'Saved' : 'Unsaved changes'}
          </p>
          <input
            className="field"
            style={{ fontSize: 22, fontWeight: 700, border: 'none', padding: '4px 0', background: 'none' }}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            aria-label="Template name"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-ghost" onClick={() => duplicateMutation.mutate()} disabled={duplicateMutation.isPending}>
            Duplicate
          </button>
          <button type="button" className="btn-ghost" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
            {archived ? 'Restore' : 'Archive'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || saved}
            style={saved ? {} : { background: 'var(--accent)' }}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner" style={{ marginBottom: 14 }}>
          <span className="g g-warn">⚠</span>
          <div>{error}</div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <label className="tiny">
            Covers from
            <select
              className="field"
              style={{ width: 90, marginLeft: 6, display: 'inline-block' }}
              value={structure.covers.from}
              onChange={(e) => {
                setStructure((s) => ({ ...s, covers: { ...s.covers, from: Number(e.target.value) } }));
                setSaved(false);
              }}
            >
              {Array.from({ length: 15 }, (_, i) => -14 + i).map((n) => (
                <option key={n} value={n}>
                  {mdLabel(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="tiny">
            to
            <select
              className="field"
              style={{ width: 90, marginLeft: 6, display: 'inline-block' }}
              value={structure.covers.to}
              onChange={(e) => {
                setStructure((s) => ({ ...s, covers: { ...s.covers, to: Number(e.target.value) } }));
                setSaved(false);
              }}
            >
              {Array.from({ length: 8 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {mdLabel(n)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <WeekLoadChart bars={chartBars} title="Weekly load" />
        </div>
        <p className="cap" style={{ marginTop: 6 }}>
          Total planned load {weekTotalLoad(structure).toLocaleString()} · {positions.filter((p) => p.sessions.length > 0).length} of {positions.length} days planned
        </p>
      </div>

      <div className="stack">
        {positions.map((day) => (
          <div key={day.mdOffset} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{mdLabel(day.mdOffset)}</span>
              {day.sessions.length === 0 ? <span className="tiny" style={{ color: 'var(--faint)' }}>Off. Nothing scheduled.</span> : null}
              <button type="button" className="btn-ghost" style={{ marginLeft: 'auto', minHeight: 32, padding: '5px 12px' }} onClick={() => setEditingPosition(day.mdOffset)}>
                + session
              </button>
            </div>

            {day.sessions.length > 0 ? (
              <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                {day.sessions.map((s, i) => (
                  <div key={s.key} className="load-row" style={{ gridTemplateColumns: '1fr auto auto auto', alignItems: 'center' }}>
                    <div>
                      <span className="nm">{s.title}</span>{' '}
                      <span className="pill pill-neutral">{s.type}</span>
                      <div className="tiny">
                        {s.startTime} · {s.durationMin !== null ? `${s.durationMin}m` : 'no planned duration'}
                        {s.plannedRpe !== null ? ` · RPE ${s.plannedRpe}` : ' · unscored'}
                        {s.location ? ` · ${s.location}` : ''}
                      </div>
                    </div>
                    <button type="button" className="btn-ghost" style={{ minHeight: 32, padding: '4px 8px' }} disabled={i === 0} onClick={() => moveSession(day.mdOffset, s.key, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ minHeight: 32, padding: '4px 8px' }}
                      disabled={i === day.sessions.length - 1}
                      onClick={() => moveSession(day.mdOffset, s.key, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" className="btn-ghost" style={{ minHeight: 32, padding: '4px 8px', color: 'var(--bad-text)' }} onClick={() => removeSession(day.mdOffset, s.key)}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {editingPosition === day.mdOffset ? (
              <div className="card" style={{ marginTop: 10, background: 'var(--field)', boxShadow: 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  <label className="tiny">
                    Type
                    <select className="field" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as TemplateSession['type'] }))}>
                      {SESSION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="tiny">
                    Title
                    <input className="field" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                  </label>
                  <label className="tiny">
                    Start
                    <input className="field" type="time" value={draft.startTime} onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))} />
                  </label>
                  <label className="tiny">
                    Duration, min
                    <input
                      className="field"
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={480}
                      value={draft.durationMin ?? ''}
                      placeholder="no planned duration"
                      onChange={(e) => setDraft((d) => ({ ...d, durationMin: e.target.value === '' ? null : Number(e.target.value) }))}
                    />
                  </label>
                  <label className="tiny">
                    Planned RPE
                    <input
                      className="field"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={10}
                      step={0.5}
                      value={draft.plannedRpe ?? ''}
                      placeholder="unscored"
                      onChange={(e) => setDraft((d) => ({ ...d, plannedRpe: e.target.value === '' ? null : Number(e.target.value) }))}
                    />
                  </label>
                  <label className="tiny">
                    Location
                    <input className="field" value={draft.location ?? ''} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value || null }))} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn-primary" onClick={() => addSession(day.mdOffset)}>
                    Add
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setEditingPosition(null);
                      setDraft(emptySession());
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="chiprow" style={{ marginTop: 10 }}>
              {(['wellness', 'rpe', 'nutrition'] as const).map((k) => (
                <label key={k} className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input type="checkbox" checked={day.requires[k]} onChange={() => toggleRequires(day.mdOffset, k)} />
                  {k === 'rpe' ? 'RPE' : k[0]!.toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
