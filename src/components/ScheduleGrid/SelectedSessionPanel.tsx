'use client';

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
};

type Props = {
  mode: 'read' | 'edit';
  session: PanelSession | null;
  isNew: boolean;
  groups: readonly GroupOption[];
  onStart: (deltaMin: number) => void;
  onDuration: (deltaMin: number) => void;
  onToggleGroup: (groupId: string) => void;
  onNameChange: (title: string) => void;
  onTypeChange: (type: DbSessionType) => void;
  onLocationChange: (location: string) => void;
  onAddToDay: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
};

/** SCHEDULE-SPEC.md §6, "Selected session panel". Read mode shows four
 *  facts; Edit mode is a real form — but only Start, Duration and Group are
 *  ever real overrides for an *existing* session (§9's `edits` shape has
 *  exactly those three fields), so Location/Type stay read-only boxes for
 *  one already on the schedule, same as the spec. A brand-new draft
 *  (isNew) needs Name/Type/Location to actually be choosable — the spec
 *  doesn't show that variant's field set explicitly, so this is the one
 *  real gap this file fills in, not a contradiction of anything stated. */
export function SelectedSessionPanel({
  mode,
  session,
  isNew,
  groups,
  onStart,
  onDuration,
  onToggleGroup,
  onNameChange,
  onTypeChange,
  onLocationChange,
  onAddToDay,
  onRemove,
  onDuplicate,
}: Props) {
  if (!session) {
    return (
      <div className="card sg-panel-card">
        <p className="cap" style={{ margin: 0 }}>
          Select a session on the grid to see it here{mode === 'edit' ? ', or click a day header to plan a new one.' : '.'}
        </p>
      </div>
    );
  }

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
          {isNew && mode === 'edit' ? (
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
              <p className="sg-helper">Steps 15 minutes, 08:00–18:00</p>
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
              Nobody selected means the whole squad.
            </p>
          </div>

          <div className="sg-edit-row">
            <div className="sg-edit-field">
              <span className="label">Location</span>
              {isNew ? (
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
              {isNew ? (
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
            {isNew ? (
              <button type="button" className="sg-btn-add" onClick={onAddToDay} disabled={!session.title.trim()}>
                Add to {weekday}
              </button>
            ) : (
              <>
                {!session.isPast ? (
                  <button type="button" className="sg-btn-remove" onClick={onRemove}>
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
