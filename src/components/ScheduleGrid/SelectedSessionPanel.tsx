'use client';

import { useEffect, useState } from 'react';
import { EXPECTS, TYPE_STYLE, clockLabel, type DbSessionType } from '@/lib/scheduleGeometry';
import { enumLabel, mdLabel } from '@/lib/format';
import type { GroupOption } from './types';

const DOM_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

const SESSION_TYPES: DbSessionType[] = [
  'training',
  'gym',
  'match',
  'testing',
  'recovery',
  'meeting',
  'rehab',
];

export type PanelSession = {
  id: string;
  dow: string;
  start: number;
  mins: number;
  title: string;
  type: DbSessionType;
  location: string | null;
  mdOffset: number | null;
  groupIds: string[];
  groupNames: string[];
  athleteIds: string[];
  isPast: boolean;
  /** Restriction-to-session-card linkage (integration audit Batch 3): how
   *  many participants have a restriction `computeConflicts` flags as
   *  relevant to this session — see GridSession's own comment
   *  (lib/queries/schedule.ts) for the full heuristic and its known
   *  limits. Names never appear here — this panel has no participant
   *  roster to name against, and `docs/screens/session-detail.md`'s own
   *  clinical boundary is that a restriction warning names the
   *  restriction, never a diagnosis; a coach who needs the who goes to
   *  Timetable, which already shows conflicts per athlete. */
  restrictionConflictCount: number;
};

type DayOption = { date: string; weekday: string; domLabel: string };

type Props = {
  mode: 'read' | 'edit';
  session: PanelSession | null;
  groups: readonly GroupOption[];
  dayOptions: readonly DayOption[];
  hourRange: { h0: number; h1: number };
  onStart: (deltaMin: number) => void;
  onDuration: (deltaMin: number) => void;
  onToggleGroup: (groupId: string) => void;
  onDayChange: (date: string) => void;
  onNameChange: (title: string) => void;
  onTypeChange: (type: DbSessionType) => void;
  onLocationChange: (location: string) => void;
  onAddToDay: () => void;
  onCancelDraft: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
};

/** SCHEDULE-SPEC.md §6, "Selected session panel". Read mode shows four
 *  facts; Edit mode is a real form. Start, Duration and Group are real
 *  overrides for an *existing* session (§9's `edits` shape). A draft —
 *  `isPrecommit` (the in-progress `'__new'` form, before "Add to Day") or
 *  `isDraft` more broadly (that same session once staged, still carrying
 *  its synthetic `new-` id right up until Publish) — additionally gets
 *  Name/Type/Location/Day as real, live-editable fields for its whole
 *  unpublished life, not just the instant before it is staged (UX audit
 *  finding 11: these used to go read-only the moment "Add to Day" was
 *  clicked, which is the opposite of what a draft should do). Derived from
 *  `session.id` rather than a parent-supplied flag, so the two facts (is
 *  this a draft; is it the not-yet-staged form) can never drift apart. */
export function SelectedSessionPanel({
  mode,
  session,
  groups,
  dayOptions,
  hourRange,
  onStart,
  onDuration,
  onToggleGroup,
  onDayChange,
  onNameChange,
  onTypeChange,
  onLocationChange,
  onAddToDay,
  onCancelDraft,
  onRemove,
  onDuplicate,
}: Props) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // A fresh selection should never inherit a stale confirmation from
  // whatever was selected before it.
  useEffect(() => {
    setConfirmingRemove(false);
  }, [session?.id]);

  if (!session) {
    return (
      <div className="card sg-panel-card">
        <p className="cap" style={{ margin: 0 }}>
          Select a session on the grid to see it here{mode === 'edit' ? ', or click a day header to plan a new one.' : '.'}
        </p>
      </div>
    );
  }

  const isPrecommit = session.id === '__new';
  const isDraft = isPrecommit || session.id.startsWith('new-');

  const style = TYPE_STYLE[session.type];
  const end = session.start + session.mins / 60;
  const groupLabel = session.groupNames.length > 0 ? session.groupNames.join(' + ') : 'Whole squad';
  const isStaffOnly = session.athleteIds.length === 0;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Europe/London' }).format(
    new Date(`${session.dow}T12:00:00Z`),
  );

  return (
    <div className="card sg-panel-card">
      <div className="sg-panel-head">
        <div style={{ minWidth: 0 }}>
          {isDraft && mode === 'edit' ? (
            <input
              className="field"
              value={session.title}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Session name"
              maxLength={80}
              style={{ fontSize: 16, fontWeight: 700, padding: '8px 10px' }}
            />
          ) : (
            <div className="sg-panel-name">{session.title}</div>
          )}
          <div className="sg-panel-meta mono">
            {weekday} {DOM_FMT.format(new Date(`${session.dow}T12:00:00Z`))} · {clockLabel(session.start)} –{' '}
            {clockLabel(end)} · {session.location ?? 'Location not set'}
          </div>
        </div>
        <span
          className="pill"
          style={{
            background: style.bg,
            color: 'var(--text)',
            borderInlineStart: `2px solid ${style.tone}`,
          }}
        >
          {enumLabel(session.type)}
        </span>
      </div>

      {session.restrictionConflictCount > 0 ? (
        <div className="note" style={{ margin: '0 0 14px', borderColor: 'var(--warn)' }}>
          <div className="note-glyph">⚠</div>
          <p className="note-text">
            {session.restrictionConflictCount} athlete{session.restrictionConflictCount === 1 ? ' has' : 's have'} a
            restriction this session may conflict with. See Timetable for who.
          </p>
        </div>
      ) : null}

      {mode === 'read' ? (
        <div className="sg-panel-facts">
          <div>
            <div className="sg-fact-label">Group</div>
            <div className="sg-fact-value mono">{groupLabel}</div>
          </div>
          <div>
            <div className="sg-fact-label">Duration</div>
            <div className="sg-fact-value mono">{session.mins} min</div>
          </div>
          <div>
            <div className="sg-fact-label">MD</div>
            <div className="sg-fact-value mono">{mdLabel(session.mdOffset) ?? '—'}</div>
          </div>
          <div>
            <div className="sg-fact-label">Expects</div>
            <div className="sg-fact-value mono">{EXPECTS[session.type]}</div>
          </div>
        </div>
      ) : (
        <>
          {isDraft ? (
            <div style={{ marginTop: 0, marginBottom: 14 }}>
              <span className="label">Day</span>
              <div className="chiprow" style={{ marginTop: 6 }}>
                {dayOptions.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    className="squad-chip"
                    aria-pressed={session.dow === d.date}
                    onClick={() => onDayChange(d.date)}
                  >
                    {d.weekday} {d.domLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sg-edit-row">
            <div className="sg-edit-field">
              <span className="label">Start</span>
              <div className="sg-stepper">
                <button type="button" className="sg-stepper-btn" onClick={() => onStart(-15)} aria-label="Earlier">
                  −
                </button>
                <span className="sg-stepper-value mono">{clockLabel(session.start)}</span>
                <button type="button" className="sg-stepper-btn" onClick={() => onStart(15)} aria-label="Later">
                  +
                </button>
              </div>
              <p className="sg-helper">
                Steps 15 minutes, {clockLabel(hourRange.h0)}–{clockLabel(hourRange.h1)}
              </p>
            </div>
            <div className="sg-edit-field">
              <span className="label">Duration</span>
              <div className="sg-stepper">
                <button
                  type="button"
                  className="sg-stepper-btn"
                  onClick={() => onDuration(-5)}
                  aria-label="Shorter"
                >
                  −
                </button>
                <span className="sg-stepper-value mono">{session.mins} min</span>
                <button type="button" className="sg-stepper-btn" onClick={() => onDuration(5)} aria-label="Longer">
                  +
                </button>
              </div>
              <p className="sg-helper">Steps 5 minutes, 15–180</p>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <span className="label">Group</span>
            <div className="chiprow" style={{ marginTop: 6 }}>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="squad-chip"
                  aria-pressed={session.groupIds.includes(g.id)}
                  onClick={() => onToggleGroup(g.id)}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <p className="cap" style={{ marginTop: 6 }}>
              {/* UX audit finding 12: this used to read "Nobody selected
                  means the whole squad", which contradicts the preview
                  footer below and, more importantly, contradicts what
                  actually happens — an athlete's Today view
                  (fetchAthleteDaySessions, lib/queries/schedule.ts) only
                  returns a session it can match to an explicit
                  session_participants row. A session with no group named
                  has no such row, so no athlete's app ever shows it: it
                  really is staff-only, never "the whole squad" the way a
                  coach would read that phrase. The copy now says the real
                  thing instead of the aspirational one. */}
              Nobody selected means staff only — no athlete will see this in their app.
            </p>
          </div>

          <div className="sg-edit-row">
            <div className="sg-edit-field">
              <span className="label">Location</span>
              {isDraft ? (
                <input
                  className="field"
                  style={{ marginTop: 6, height: 40 }}
                  value={session.location ?? ''}
                  onChange={(e) => onLocationChange(e.target.value)}
                  placeholder="Main pitch"
                />
              ) : (
                <div className="sg-field-ro">{session.location ?? 'Location not set'}</div>
              )}
            </div>
            <div className="sg-edit-field">
              <span className="label">Type</span>
              {isDraft ? (
                <div className="chiprow" style={{ marginTop: 6 }}>
                  {SESSION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="squad-chip"
                      aria-pressed={session.type === t}
                      onClick={() => onTypeChange(t)}
                    >
                      {enumLabel(t)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="sg-field-ro">{enumLabel(session.type)}</div>
              )}
            </div>
          </div>

          <div className="sg-panel-actions">
            {isPrecommit ? (
              <>
                <button type="button" className="sg-btn-add" onClick={onAddToDay} disabled={!session.title.trim()}>
                  Add to {weekday}
                </button>
                <button type="button" className="btn-ghost" onClick={onCancelDraft}>
                  Cancel
                </button>
              </>
            ) : confirmingRemove ? (
              <>
                <span className="tiny" style={{ color: 'var(--bad-text)' }}>
                  Remove this session? You can undo with Discard, until you publish.
                </span>
                <button
                  type="button"
                  className="sg-btn-remove"
                  onClick={() => {
                    onRemove();
                    setConfirmingRemove(false);
                  }}
                >
                  Yes, remove
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmingRemove(false)}>
                  Never mind
                </button>
              </>
            ) : (
              <>
                {/* A staged draft (isDraft) was never committed to the
                    database, so the "past session" server rule that blocks
                    deleting a committed session never applies to it — only
                    a real, already-published session needs that guard. */}
                {isDraft || !session.isPast ? (
                  <button type="button" className="sg-btn-remove" onClick={() => setConfirmingRemove(true)}>
                    Remove session
                  </button>
                ) : null}
                <button type="button" className="btn-ghost" onClick={onDuplicate}>
                  Duplicate
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div className="sg-preview">
        <div className="sg-preview-head">
          <span className="pill pill-accent">Athlete app</span>
          <span className="sub">What the athlete sees</span>
        </div>
        <div className="sg-preview-card">
          <div className="sess">
            <span className="tm mono">{clockLabel(session.start)}</span>
            <div>
              <div className="ti">
                {session.title}
                <span className="pill pill-neutral mono" style={{ marginLeft: 'auto' }}>
                  {mdLabel(session.mdOffset) ?? '—'}
                </span>
              </div>
              <div className="lo">
                {session.location ?? 'Location not set'} · <span className="mono">{session.mins}</span> min
              </div>
              <div className="sg-preview-expects">{EXPECTS[session.type]}</div>
            </div>
          </div>
        </div>
        <p className="sg-preview-foot">
          {isStaffOnly
            ? 'Staff only · this session is never published to the athlete app'
            : `Publishes to ${groupLabel} · appears under Today on the morning of ${weekday} ${DOM_FMT.format(new Date(`${session.dow}T12:00:00Z`))}`}
        </p>
      </div>
    </div>
  );
}
