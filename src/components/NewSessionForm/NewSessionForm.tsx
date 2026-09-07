'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createSession } from '@/lib/queries/schedule';
import { enumLabel, zonedTimeToUtcIso } from '@/lib/format';
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
  userId: string;
  groups: readonly Group[];
  defaultDate: string;
  timezone: string;
};

export function NewSessionForm({ orgId, userId, groups, defaultDate, timezone }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<(typeof SESSION_TYPES)[number]>('training');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [mdOffset, setMdOffset] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  /* A refused submit has to be findable. The message alone was not enough: it
     renders inside a long form, and somebody who has just pressed the button at
     the bottom is looking at the button, not at a line that may be off screen.
     Reported as "it stays on the same page" — which it does, correctly, but with
     no visible reason. Focus moves to the field at fault and scrolls it into
     view, so the refusal lands where the fix has to happen. */
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function focusField(el: HTMLInputElement | null, message: string): void {
    setError(message);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  }


  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        createSession(createClient(), orgId, userId, {
          title,
          sessionType,
          startsAt: zonedTimeToUtcIso(date, time, timezone),
          durationMin: duration ? Number(duration) : null,
          location: location.trim() ? location.trim() : null,
          mdOffset: mdOffset.trim() ? Number(mdOffset) : null,
          groupIds: [...selectedGroups],
        }),
      );
      if (result.error) throw new HumanError(result.error);
    },
    onSuccess: () => {
      router.push(`/schedule?date=${date}`);
      router.refresh();
    },
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
    if (!title.trim()) return focusField(titleRef.current, 'Give the session a name.');
    if (!date || !time) return focusField(dateRef.current, 'Set a date and time.');
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <label className="label" htmlFor="s-title">
        Name
      </label>
      <input
        id="s-title"
        ref={titleRef}
        className="field"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={80}
        placeholder="Captain's run"
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
          <label className="label" htmlFor="s-date">
            Date
          </label>
          <input
            id="s-date"
            className="field"
            type="date"
            ref={dateRef}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="s-time">
            Time
          </label>
          <input
            id="s-time"
            className="field"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="s-duration">
            Duration (min)
          </label>
          <input
            id="s-duration"
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
          <label className="label" htmlFor="s-md">
            MD offset (optional)
          </label>
          <input
            id="s-md"
            className="field"
            type="number"
            inputMode="numeric"
            placeholder="-2"
            value={mdOffset}
            onChange={(event) => setMdOffset(event.target.value)}
          />
        </div>
      </div>

      <label className="label" htmlFor="s-location" style={{ marginTop: 14 }}>
        Location
      </label>
      <input
        id="s-location"
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
        <p className="cap" style={{ marginTop: 6 }}>
          Pick every group that should see this, for example Forwards and Backs
          together for a full-squad session. Nobody selected means nobody is
          named in it yet.
        </p>
      </fieldset>

      {/* The reported gap: somebody adds a session, is returned to the
          schedule, and has no idea whether a further step is needed before the
          squad sees it. There isn't one — the row is the visibility. Said here,
          at the moment of committing, rather than as a toast afterwards, so it
          answers the question before it is asked. */}
      <p className="cap" style={{ marginTop: 14 }}>
        Athletes named in it see this in their athlete app as soon as you create
        it. There is no separate publish step.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create session'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => router.push('/schedule')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
