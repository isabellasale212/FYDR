'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { updateSession, type SessionDetail } from '@/lib/queries/schedule';
import { enumLabel, zonedTimeToUtcIso, dateInTz, timeInTz } from '@/lib/format';
import type { Group } from '@/lib/queries/groups';

const SESSION_TYPES = [
  'training',
  'gym',
  'match',
  'testing',
  'recovery',
  'meeting',
  'rehab',
] as const;

type Props = {
  orgId: string;
  session: SessionDetail;
  groups: readonly Group[];
  timezone: string;
};

/** The edit half of session-detail.md's `SessionEditorSheet`, kept as a
 *  separate component from `NewSessionForm` rather than a shared
 *  `mode='create'|'edit'` component: the same field set, but touching the
 *  working, tested creation form for an unrelated screen risked the exact
 *  class of bug the timezone helper below was written to fix. Prefilled
 *  from the stored UTC instant via `dateInTz`/`timeInTz`, the read side of
 *  the same conversion `zonedTimeToUtcIso` writes. */
export function SessionEditForm({ orgId, session, groups, timezone }: Props) {
  const router = useRouter();
  const startsAt = new Date(session.starts_at);

  const [title, setTitle] = useState(session.title);
  const [sessionType, setSessionType] = useState<(typeof SESSION_TYPES)[number]>(
    session.session_type as (typeof SESSION_TYPES)[number],
  );
  const [date, setDate] = useState(dateInTz(startsAt, timezone));
  const [time, setTime] = useState(timeInTz(startsAt, timezone));
  const [duration, setDuration] = useState(
    session.duration_min !== null ? String(session.duration_min) : '',
  );
  const [location, setLocation] = useState(session.location ?? '');
  const [mdOffset, setMdOffset] = useState(
    session.md_offset !== null ? String(session.md_offset) : '',
  );
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(session.groupIds),
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        updateSession(createClient(), orgId, session.id, {
          title,
          sessionType,
          startsAt: zonedTimeToUtcIso(date, time, timezone),
          durationMin: duration ? Number(duration) : null,
          location: location.trim() ? location.trim() : null,
          mdOffset: mdOffset.trim() ? Number(mdOffset) : null,
          groupIds: [...selectedGroups],
          // Optimistic lock — see updateSession's own comment (schedule.ts).
          // Guards this form the same way it guards the schedule grid's
          // publish flow: if this session changed elsewhere (the grid, or
          // another tab on this same page) since this page loaded, the
          // write is refused with a clear conflict error instead of
          // silently overwriting whatever changed.
          expectedUpdatedAt: session.updated_at,
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => router.refresh(),
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function toggleGroup(id: string) {
    setSelectedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError('Give the session a name.');
    if (!date || !time) return setError('Set a date and time.');
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <label className="label" htmlFor="e-title">
        Name
      </label>
      <input
        id="e-title"
        className="field"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={80}
      />

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Type</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {SESSION_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className="squad-chip"
              aria-pressed={sessionType === t}
              onClick={() => setSessionType(t)}
            >
              {enumLabel(t)}
            </button>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="e-date">
            Date
          </label>
          <input
            id="e-date"
            className="field"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="e-time">
            Time
          </label>
          <input
            id="e-time"
            className="field"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="e-duration">
            Duration (min)
          </label>
          <input
            id="e-duration"
            className="field"
            type="number"
            inputMode="numeric"
            min={5}
            max={240}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="e-md">
            MD offset (optional)
          </label>
          <input
            id="e-md"
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="-2"
            value={mdOffset}
            onChange={(event) => setMdOffset(event.target.value)}
          />
        </div>
      </div>

      <label className="label" htmlFor="e-location" style={{ marginTop: 14 }}>
        Location
      </label>
      <input
        id="e-location"
        className="field"
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        placeholder="Main pitch"
      />

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Who&rsquo;s in it</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className="squad-chip"
              aria-pressed={selectedGroups.has(g.id)}
              onClick={() => toggleGroup(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Same rule as NewSessionForm, worded for a save rather than a
          create. An edit is the case where a second step feels most
          plausible — the session is already out there — so leaving it
          unsaid here would undo the sentence on the create form. */}
      <p className="cap" style={{ marginTop: 14 }}>
        Athletes named in this session see the change in their athlete app as
        soon as you save. There is no separate publish step.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
