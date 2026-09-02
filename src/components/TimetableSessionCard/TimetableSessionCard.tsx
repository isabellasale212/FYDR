'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  bulkMarkPresent,
  recordAttendance,
  type AttendanceStatus,
  type TimetableSession,
} from '@/lib/queries/timetable';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { enumLabel, formatTime, mdLabel } from '@/lib/format';

type Props = {
  orgId: string;
  userId: string;
  actorRole: 'coach' | 'medical';
  session: TimetableSession;
  // IANA zone used to display session.starts_at in the organisation's local time.
  timezone: string;
  // The session's md_offset re-anchored to its real calendar week (see
  // anchorMdOffsetsToWeek, format.ts) — computed once by the page for the
  // whole day and passed down, rather than read raw off `session`, so this
  // card can't show a different MD-n than the Schedule grid for the same
  // session (audit blocker B2).
  anchoredMdOffset: number | null;
  defaultExpanded: boolean;
};

const SEGMENTS: { value: AttendanceStatus; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'modified', label: 'Mod' },
  { value: 'absent', label: 'Abs' },
  { value: 'excused', label: 'Exc' },
];

type MarkInput = {
  athleteId: string;
  status: AttendanceStatus;
  modifiedReason: string | null;
  overrideReason?: string;
};

/** A failed write, kept with everything needed to try it again. Audit S5 /
 *  coach finding 11: an attendance write once failed with the control
 *  silently snapping back and a raw Postgres string in a hidden region —
 *  this state exists so the failure is instead shown in plain English next
 *  to the exact control that snapped back, with a working retry. */
type WriteFailure =
  | { kind: 'mark'; input: MarkInput; message: string }
  | { kind: 'bulk'; athleteIds: string[]; message: string };

/** screens/timetable.md's AttendanceControl + RestrictionWarning, reduced to
 *  this app's existing web patterns (no BottomSheet/ConfirmSheet component
 *  exists here) — an inline override panel stands in for the doc's
 *  ConfirmSheet. Every write goes through lib/queries/timetable.ts's real
 *  recordAttendance/bulkMarkPresent against the real session_attendance
 *  table; router.refresh() re-pulls server state after each mutation,
 *  same pattern as GymSessionLogger.tsx rather than a hand-rolled
 *  optimistic cache. */
export function TimetableSessionCard({ orgId, userId, actorRole, session, timezone, anchoredMdOffset, defaultExpanded }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [failure, setFailure] = useState<WriteFailure | null>(null);

  /* Both writes are bounded (ten seconds) and both have a real onError: a
   * thrown network failure and a returned Postgres error end in the same
   * place — a visible, human sentence with a retry — never a silent
   * snap-back. */
  const markMutation = useMutation({
    mutationFn: async (input: MarkInput) => {
      const result = await withWriteTimeout(
        recordAttendance(createClient(), orgId, userId, actorRole, { sessionId: session.id, ...input }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setFailure(null);
      setOverrideFor(null);
      setOverrideReason('');
      router.refresh();
    },
    onError: (err, input) =>
      setFailure({ kind: 'mark', input, message: toUserMessage(err, 'staff') }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (athleteIds: string[]) => {
      const result = await withWriteTimeout(
        bulkMarkPresent(createClient(), orgId, userId, session.id, athleteIds),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      setFailure(null);
      router.refresh();
    },
    onError: (err, athleteIds) =>
      setFailure({ kind: 'bulk', athleteIds, message: toUserMessage(err, 'staff') }),
  });

  const marked = session.participants.filter((p) => p.attendance !== null).length;
  const counts = {
    full: session.participants.filter((p) => p.attendance === 'full').length,
    modified: session.participants.filter((p) => p.attendance === 'modified').length,
    absent: session.participants.filter((p) => p.attendance === 'absent').length,
    excused: session.participants.filter((p) => p.attendance === 'excused').length,
  };
  const conflictCount = session.participants.filter((p) => p.conflicts.length > 0).length;
  const md = mdLabel(anchoredMdOffset);

  function selectSegment(athleteId: string, status: AttendanceStatus, hasConflict: boolean, current: AttendanceStatus | null) {
    if (status === 'full' && hasConflict && current !== 'full') {
      setOverrideFor(athleteId);
      setOverrideReason('');
      return;
    }
    markMutation.mutate({
      athleteId,
      status,
      modifiedReason: status === 'modified' ? (reasonDrafts[athleteId] ?? null) : null,
    });
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span className="nm num">{formatTime(session.starts_at, timezone)}</span>
        <span className="nm">{session.title}</span>
        <span className="tiny">
          {enumLabel(session.session_type)}
          {session.location ? ` · ${session.location}` : ''}
        </span>
        {md ? <span className="pill pill-accent">{md}</span> : null}
        <span className="tiny" style={{ marginLeft: 'auto' }}>
          {session.participants.length} expected · {marked} marked
        </span>
        <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </button>

      {expanded ? (
        <div style={{ borderTop: '1px solid var(--hair)' }}>
          {session.participants.length === 0 ? (
            <p className="tiny" style={{ padding: '12px 18px' }}>
              No athletes expected in this filter.
            </p>
          ) : (
            <>
              <div
                style={{
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  borderBottom: '1px solid var(--hair)',
                }}
              >
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(session.participants.map((p) => p.athlete_id))}
                >
                  Mark all present
                </button>
                <span className="tiny">
                  {counts.full} full · {counts.modified} modified · {counts.absent} absent · {counts.excused} excused
                </span>
              </div>

              {conflictCount > 0 ? (
                <div className="note" style={{ margin: '10px 18px', borderColor: 'var(--warn)' }}>
                  <div className="note-glyph">⚠</div>
                  <p className="note-text">
                    {conflictCount} athlete{conflictCount === 1 ? '' : 's'} have restrictions this session may conflict with —
                    marked below.
                  </p>
                </div>
              ) : null}

              {failure?.kind === 'bulk' ? (
                <p className="form-error" role="alert" style={{ margin: '0 18px 10px' }}>
                  {failure.message}{' '}
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={bulkMutation.isPending}
                    onClick={() => bulkMutation.mutate(failure.athleteIds)}
                  >
                    Try again
                  </button>
                </p>
              ) : null}

              {/* No fixed min-width and no horizontal scroll: the row is a
               *  wrapping flex, so on a phone the attendance buttons wrap
               *  onto their own line below the name instead of sitting
               *  off-screen — a real audit blocker: at 375px the controls
               *  rendered up to ~184px past the right edge with no way to
               *  reach them, on the one screen built for pitch-side phone
               *  use. */}
              <div>
                <div>
                  {session.participants.map((p, index) => (
                    <div key={p.athlete_id}>
                      {index > 0 ? <div className="hair" /> : null}
                      <div style={{ padding: '10px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span className="nm">
                            {p.first_name} {p.last_name}
                          </span>
                          {p.squad_number !== null ? <span className="tiny num">#{p.squad_number}</span> : null}
                          <span
                            className={`pill ${
                              p.availability_status === 'available'
                                ? 'pill-good'
                                : p.availability_status === 'unavailable'
                                  ? 'pill-bad'
                                  : p.availability_status === 'modified'
                                    ? 'pill-warn'
                                    : 'pill-neutral'
                            }`}
                          >
                            {p.availability_status === 'unknown' ? 'No record' : enumLabel(p.availability_status)}
                          </span>
                          {p.conflicts.length > 0 ? (
                            <span className="pill pill-warn">⚠ {p.conflicts.join(', ')}</span>
                          ) : null}
                          <div className="chiprow" style={{ marginLeft: 'auto' }} role="group" aria-label={`Attendance for ${p.first_name} ${p.last_name}`}>
                            {SEGMENTS.map((seg) => (
                              <button
                                key={seg.value}
                                type="button"
                                className="squad-chip"
                                aria-pressed={p.attendance === seg.value}
                                disabled={markMutation.isPending}
                                onClick={() => selectSegment(p.athlete_id, seg.value, p.conflicts.length > 0, p.attendance)}
                              >
                                {seg.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {failure?.kind === 'mark' && failure.input.athleteId === p.athlete_id ? (
                          <p className="form-error" role="alert" style={{ marginTop: 6 }}>
                            {failure.message}{' '}
                            <button
                              type="button"
                              className="btn-ghost"
                              disabled={markMutation.isPending}
                              onClick={() => markMutation.mutate(failure.input)}
                            >
                              Try again
                            </button>
                          </p>
                        ) : null}
                        {p.restrictions.length > 0 ? (
                          <p className="tiny" style={{ marginTop: 4 }}>
                            {p.restrictions.join(' · ')}
                          </p>
                        ) : null}
                        {p.attendance === 'modified' ? (
                          <input
                            className="field"
                            style={{ marginTop: 6, maxWidth: 380 }}
                            placeholder="Reason (required — left early, family, etc.)"
                            defaultValue={p.modified_reason ?? ''}
                            onChange={(e) => setReasonDrafts((d) => ({ ...d, [p.athlete_id]: e.target.value }))}
                            onBlur={(e) =>
                              markMutation.mutate({ athleteId: p.athlete_id, status: 'modified', modifiedReason: e.target.value })
                            }
                          />
                        ) : null}
                        {!p.modified_reason && p.attendance === 'modified' ? (
                          <p className="tiny" style={{ color: 'var(--warn-text)', marginTop: 4 }}>
                            A reason is needed — unreadable a week from now without one.
                          </p>
                        ) : null}

                        {overrideFor === p.athlete_id ? (
                          <div className="note" style={{ marginTop: 8, borderColor: 'var(--warn)' }}>
                            <div className="note-glyph">⚠</div>
                            <div style={{ flex: 1 }}>
                              <p className="note-text">
                                Marking full despite {p.conflicts.join(', ')}. This is logged, not blocked — say why.
                              </p>
                              <input
                                className="field"
                                style={{ marginTop: 6 }}
                                placeholder="Reason for overriding the restriction"
                                value={overrideReason}
                                onChange={(e) => setOverrideReason(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={overrideReason.trim() === '' || markMutation.isPending}
                                  onClick={() =>
                                    markMutation.mutate({
                                      athleteId: p.athlete_id,
                                      status: 'full',
                                      modifiedReason: null,
                                      overrideReason: overrideReason.trim(),
                                    })
                                  }
                                >
                                  Mark full anyway
                                </button>
                                <button type="button" className="btn-ghost" onClick={() => setOverrideFor(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
