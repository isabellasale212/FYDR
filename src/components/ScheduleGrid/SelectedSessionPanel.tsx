'use client';

import { useEffect, useRef, useState } from 'react';
import { TYPE_STYLE, clockLabel, expectsLabel, type DbSessionType } from '@/lib/scheduleGeometry';
import { enumLabel, mdLabel } from '@/lib/format';
import type { GroupOption } from './types';

// Built per call from the org's real timezone, not a hardcoded one — see
// schedule/page.tsx's own weekdayLongFmt/dayMonthFmt for the same fix and
// its reasoning.
function domFmt(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: timezone });
}

/* The click-to-create card, as three steps.
 *
 * THE ORDER IS THE ARGUMENT. The click already said WHEN, so the card opens on
 * WHAT. Time and place travel together because a coach setting one is usually
 * setting the other. WHO is last on purpose: its caption — "Nobody selected
 * means staff only, no athlete will see this in their app" — is the most
 * consequential sentence on the card, and it belongs immediately before the
 * button that commits, not three fields earlier where it is scrolled past.
 *
 * Declared as data so the indicator counts the real steps. "Step 2 of 3"
 * written as a literal is a sentence that goes quietly wrong the first time
 * somebody adds a fourth. */
const WIZARD_STEPS = [
  { key: 'what', label: 'What' },
  { key: 'when', label: 'When & where' },
  { key: 'who', label: 'Who' },
] as const;

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
  timezone: string;
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
  /* Whether THIS session carries unpublished changes, and how to drop just
     them. Week-level Discard clears every change in the week, which is not an
     undo for one session. */
  isDirty: boolean;
  onRevert: () => void;
  /* This session is removed on screen but still published — the removal has
     not reached athletes yet. */
  pendingRemoval: boolean;
  /* Un-removes the session and touches nothing else — deliberately NOT
     onRevert, which also clears the edits overlay. */
  onRestore: () => void;
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
  timezone,
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
  isDirty,
  onRevert,
  pendingRemoval,
  onRestore,
}: Props) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  /* When the card opens over the grid, the caret belongs in the name field:
     the coach has already said WHEN by clicking, and the next thing they have
     to say is WHAT. Keyed on the precommit id so it fires once per draft and
     does not steal focus back while they are using the steppers. */
  const nameRef = useRef<HTMLInputElement>(null);
  const isPrecommitId = session?.id === '__new';
  const [step, setStep] = useState(0);
  /* Name, location and type are what a session IS; start, duration and groups
     are adjustments to it. The schedule is a screen people click around on, so
     the first three sit behind an explicit Edit rather than being live the
     moment a session is selected. Relocked whenever the selection moves, so an
     unlock cannot leak from the session you meant to edit onto the next one you
     merely looked at. */
  const [unlocked, setUnlocked] = useState(false);
  const onUnlock = () => setUnlocked(true);
  useEffect(() => {
    setUnlocked(false);
  }, [session?.id]);
  useEffect(() => {
    if (isPrecommitId) nameRef.current?.focus();
    /* A fresh card starts at the beginning. Keyed on the precommit id so it
       does not reset while the coach is moving between steps of the same
       draft. */
    if (isPrecommitId) setStep(0);
  }, [isPrecommitId]);
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

  /* A REMOVED SESSION IS NOT AN EDITABLE ONE, so it gets its own compact
     branch rather than the form with a Restore button bolted on. Steppers and
     group chips on something that is on its way out invite edits that Publish
     will throw away.

     THE SENTENCE IS THE POINT, more than the button. A coach who removes a
     session and sees it vanish reasonably assumes it is gone — from the app and
     from the squad's phones. It is not: nothing has been written, and every
     athlete still sees the session until Publish runs. That was true before
     this panel existed and nothing said it. */
  if (pendingRemoval) {
    return (
      <div className="card sg-panel-card">
        <h3 className="sg-panel-title">{session.title}</h3>
        <p className="sub">
          {/* Same shape and the same two formatters the panel's own header
              uses below, so a removed session reads identically to a live one
              — it is the same session, and only its fate differs. */}
          {new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: timezone }).format(
            new Date(`${session.dow}T12:00:00Z`),
          )}{' '}
          {domFmt(timezone).format(new Date(`${session.dow}T12:00:00Z`))} · {clockLabel(session.start)} –{' '}
          {clockLabel(session.start + session.mins / 60)}
          {session.location ? ` · ${session.location}` : ''}
        </p>
        <p className="tiny" style={{ marginTop: 'var(--sp-10)' }}>
          Removed on your screen. Athletes still see this session until you publish.
        </p>
        {mode === 'edit' ? (
          <div className="sg-panel-actions">
            <button type="button" className="btn-ghost" onClick={onRestore}>
              Restore session
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const isPrecommit = session.id === '__new';
  const isDraft = isPrecommit || session.id.startsWith('new-');

  const style = TYPE_STYLE[session.type];
  const end = session.start + session.mins / 60;
  const groupLabel = session.groupNames.length > 0 ? session.groupNames.join(' + ') : 'Whole squad';
  const isStaffOnly = session.athleteIds.length === 0;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: timezone }).format(
    new Date(`${session.dow}T12:00:00Z`),
  );

  /* Every field is defined ONCE and then placed — into the three-step flow for a
     brand-new draft, or into the single form for everything else. Defining them
     twice would fork the fixes this panel already carries. */
  const nameField = (
          <input
            ref={nameRef}
            className="field"
            value={session.title}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Session name"
            maxLength={80}
            style={{ fontSize: 'var(--fs-16)', fontWeight: 700, padding: '8px 10px' }}
          />
  );

  const dayField = (isDraft || unlocked) ? (
    <div style={{ marginTop: 0, marginBottom: 'var(--sp-14)' }}>
      <span className="label">Day</span>
      <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
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
  ) : null;

  const timeFields = (
  <div className="sg-edit-row">
    <div className="sg-edit-field">
      <span className="label">Start</span>
      <div className="sg-stepper">
        <button type="button" className="sg-stepper-btn" onClick={() => onStart(-15)} aria-label="Earlier">
          −
        </button>
        <span className="sg-stepper-value num">{clockLabel(session.start)}</span>
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
        <span className="sg-stepper-value num">{session.mins} min</span>
        <button type="button" className="sg-stepper-btn" onClick={() => onDuration(5)} aria-label="Longer">
          +
        </button>
      </div>
      <p className="sg-helper">Steps 5 minutes, 15–180</p>
    </div>
  </div>
  );

  const groupField = (
  <div style={{ marginTop: 'var(--sp-14)' }}>
    <span className="label">Group</span>
    <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
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
    <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
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
  );

  const locationField = (
    <div className="sg-edit-field">
      <span className="label">Location</span>
      {isDraft || unlocked ? (
        <input
          className="field"
          style={{ marginTop: 'var(--sp-6)', height: 40 }}
          value={session.location ?? ''}
          onChange={(e) => onLocationChange(e.target.value)}
          placeholder="Main pitch"
        />
      ) : (
        <div className="sg-field-ro">{session.location ?? 'Location not set'}</div>
      )}
    </div>
  );

  const typeField = (
    <div className="sg-edit-field">
      <span className="label">Type</span>
      {isDraft || unlocked ? (
        <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
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
  );

  return (
    <div className="card sg-panel-card">
      <div className="sg-panel-head">
        <div style={{ minWidth: 0 }}>
          {isPrecommit && mode === 'edit' ? (
            /* In the stepped card the name is a field ON step one, not the
               header, so the header says where you are instead. The meta line
               below stays either way: it is what the card is building, and it
               should be readable from every step. */
            <div className="sg-wiz-step">
              Step {step + 1} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step]?.label}
            </div>
          ) : (isDraft || unlocked) && mode === 'edit' ? (
            nameField
          ) : (
            <div className="sg-panel-name">{session.title}</div>
          )}
          <div className="sg-panel-meta num">
            {weekday} {domFmt(timezone).format(new Date(`${session.dow}T12:00:00Z`))} · {clockLabel(session.start)} –{' '}
            {clockLabel(end)} · {session.location ?? 'Location not set'}
          </div>
        </div>
        {isPrecommit && mode === 'edit' ? (
          /* A way out that is not the Cancel button at the bottom of a step.
             The card can open on a mis-click, and the answer to "I did not mean
             that" should be in the corner where people already look for it,
             on every step. Discards the draft, same as Cancel and Escape. */
          <button type="button" className="sheet-x" onClick={onCancelDraft} aria-label="Discard this session">
            {/* ✕ (U+2715), not × (U+00D7). The same class draws ✕ in all eight
                athlete sheets, and × is a multiplication sign this product uses
                for real in "3 × 10" and "1.42×". One affordance, one character. */}
            <span aria-hidden="true">✕</span>
          </button>
        ) : !isDraft && mode === 'edit' && !unlocked ? (
          /* Name, location and type are read-only until asked for. They are what
             the session IS, and this is a screen people click around on — the
             three below (start, duration, groups) are adjustments and stay
             live. Opening these needs one deliberate press. */
          <button type="button" className="btn-ghost" style={{ minHeight: 32, padding: '5px 12px' }} onClick={onUnlock}>
            Edit
          </button>
        ) : (
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
        )}
      </div>

      {session.restrictionConflictCount > 0 ? (
        <div className="note" style={{ margin: '0 0 14px', borderColor: 'var(--warn)' }}>
          <div className="note-glyph" aria-hidden="true">⚠</div>
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
            <div className="sg-fact-value num">{groupLabel}</div>
          </div>
          <div>
            <div className="sg-fact-label">Duration</div>
            <div className="sg-fact-value num">{session.mins} min</div>
          </div>
          <div>
            <div className="sg-fact-label">MD</div>
            <div className="sg-fact-value num">{mdLabel(session.mdOffset) ?? '—'}</div>
          </div>
          <div>
            <div className="sg-fact-label">Expects</div>
            <div className="sg-fact-value num">{expectsLabel(session, timezone)}</div>
          </div>
        </div>
      ) : isPrecommit && mode === 'edit' ? (
        /* THE THREE-STEP FLOW, for a brand-new draft only. An existing session
           selected in the rail keeps the single form below: it is being read and
           adjusted, not built, and stepping through it would be friction with
           nothing to organise. */
        <>
          <div className="sg-wiz-pips" role="list" aria-label="Progress">
            {WIZARD_STEPS.map((wStep, i) => (
              <span
                key={wStep.key}
                role="listitem"
                className="sg-wiz-pip"
                aria-current={i === step ? 'step' : undefined}
                data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
              />
            ))}
          </div>

          {step === 0 ? (
            <>
              {nameField}
              {typeField}
            </>
          ) : null}

          {step === 1 ? (
            <>
              {dayField}
              {timeFields}
              {locationField}
            </>
          ) : null}

          {step === 2 ? groupField : null}

          <div className="sg-panel-actions">
            {step > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : null}
            {step < WIZARD_STEPS.length - 1 ? (
              /* Disabled on step one without a name, for the reason the Add
                 button has always been disabled without one. Enforcing it here
                 rather than at the end means the coach finds out while they are
                 looking at the field, not two steps later at a dead button with
                 no explanation. */
              <button
                type="button"
                className="sg-btn-add"
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !session.title.trim()}
              >
                Next
              </button>
            ) : null}
            {step === WIZARD_STEPS.length - 1 ? (
              <button type="button" className="sg-btn-add" onClick={onAddToDay} disabled={!session.title.trim()}>
                Add to {weekday}
              </button>
            ) : null}
          </div>
          {step === 0 && !session.title.trim() ? (
            <p className="sg-helper" style={{ marginTop: 'var(--sp-6)' }}>
              Give it a name to continue.
            </p>
          ) : null}
        </>
      ) : (
        <>
          {dayField}

          {timeFields}

          {groupField}

          <div className="sg-edit-row">
            {locationField}
            {typeField}
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
                {/* CANCEL, WHERE THE EDIT HAPPENED. Only when this session
                    actually has something to cancel — a Cancel that is always
                    present but usually does nothing is the same problem as a
                    Save that writes nothing. Ghost rather than a destructive
                    class: it drops unpublished changes on one session, which is
                    a smaller act than "Remove session" beside it and much
                    smaller than week-level Discard.

                    NOT ON A STAGED DRAFT, found by testing it: a draft IS the
                    change, so cancelling it and removing it are the same act,
                    and the panel offered two buttons that did exactly the same
                    thing with different confirmations. "Remove session" already
                    owns that, with a confirmation this would have bypassed. So
                    the button is for a committed session carrying an overlay,
                    which is the case that had no undo short of discarding the
                    whole week. The commit line below still shows for a draft,
                    because a staged draft genuinely is held and unpublished. */}
                {isDirty && !isDraft ? (
                  <button type="button" className="btn-ghost" onClick={onRevert}>
                    Cancel changes
                  </button>
                ) : null}
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
          {/* NAMES THE COMMIT, because the control that performs it is not on
              screen. Measured: with this panel at y=700 the banner holding
              "Publish to athletes" sat at y=-1782. Without this line a coach
              sees the time change in the panel and has nothing telling them
              whether it was captured or how it reaches anybody. Deliberately
              NOT a second Publish button here: the commit is week-level on
              purpose — one session published out of a week would put a
              half-updated schedule on athletes' phones and break the banner's
              own promise. */}
          {isDirty ? (
            <p className="tiny" style={{ margin: 'var(--sp-8) 0 0' }}>
              Held on your screen. Publish to athletes, at the top of this page, puts it on their phones.
            </p>
          ) : null}
        </>
      )}

      <div className="sg-preview">
        <div className="sg-preview-head">
          <span className="pill pill-accent">Athlete app</span>
          <span className="sub">What the athlete sees</span>
        </div>
        <div className="sg-preview-card">
          <div className="sess">
            <span className="tm num">{clockLabel(session.start)}</span>
            <div>
              <div className="ti">
                {session.title}
                <span className="pill pill-neutral num" style={{ marginLeft: 'auto' }}>
                  {mdLabel(session.mdOffset) ?? '—'}
                </span>
              </div>
              <div className="lo">
                {session.location ?? 'Location not set'} · <span className="num">{session.mins}</span> min
              </div>
              <div className="sg-preview-expects">{expectsLabel(session, timezone)}</div>
            </div>
          </div>
        </div>
        <p className="sg-preview-foot">
          {isStaffOnly
            ? 'Staff only · this session is never published to the athlete app'
            : `Publishes to ${groupLabel} · appears under Today on the morning of ${weekday} ${domFmt(timezone).format(new Date(`${session.dow}T12:00:00Z`))}`}
        </p>
      </div>
    </div>
  );
}
