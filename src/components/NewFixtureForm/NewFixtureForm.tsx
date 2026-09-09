'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { createFixture } from '@/lib/queries/schedule';
import { enumLabel, zonedTimeToUtcIso } from '@/lib/format';

const HOME_AWAY = ['home', 'away', 'neutral'] as const;
const IMPORTANCE = ['friendly', 'normal', 'key', 'cup_final'] as const;

type Props = {
  orgId: string;
  userId: string;
  defaultDate: string;
  timezone: string;
};

/** Creating a fixture. Deliberately the same shape as NewSessionForm — same
 *  card, same field rhythm, same chiprow-of-buttons for the two enums, same
 *  submit pair — because a coach reaching this screen has almost certainly
 *  just used that one, and a match is the other half of the same job.
 *
 *  A fixture is NOT a session. This creates the match itself: the opponent,
 *  the kickoff, where it is played. What the squad does around it — the
 *  captain's run, the gym slot, the match session on the day — are sessions,
 *  made on /schedule/new or generated from a week template pointed at this
 *  fixture. That separation is what lets an MD-n week survive the match being
 *  moved, and it is why the planner takes a fixtureId rather than a date. */
export function NewFixtureForm({ orgId, userId, defaultDate, timezone }: Props) {
  const router = useRouter();
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('14:00');
  const [venue, setVenue] = useState('');
  const [homeAway, setHomeAway] = useState<(typeof HOME_AWAY)[number]>('home');
  const [competition, setCompetition] = useState('');
  const [importance, setImportance] = useState<(typeof IMPORTANCE)[number]>('normal');
  const [error, setError] = useState<string | null>(null);

  /* A refused submit has to be findable. The message alone was not enough: it
     renders inside a long form, and somebody who has just pressed the button at
     the bottom is looking at the button, not at a line that may be off screen.
     Reported as "it stays on the same page" — which it does, correctly, but with
     no visible reason. Focus moves to the field at fault and scrolls it into
     view, so the refusal lands where the fix has to happen. */
  const opponentRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function focusField(el: HTMLInputElement | null, message: string): void {
    setError(message);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  }


  const mutation = useMutation({
    mutationFn: async () => {
      const result = await withWriteTimeout(
        createFixture(createClient(), orgId, userId, {
          opponent,
          kickoffAt: zonedTimeToUtcIso(date, time, timezone),
          venue: venue.trim() ? venue.trim() : null,
          homeAway,
          competition: competition.trim() ? competition.trim() : null,
          importance,
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opponent.trim()) return focusField(opponentRef.current, 'Name the opponent.');
    if (!date || !time) return focusField(dateRef.current, 'Set a date and kick-off time.');
    setError(null);
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="card" noValidate>
      <label className="label" htmlFor="f-opponent">
        Opponent
      </label>
      <input
        id="f-opponent"
        ref={opponentRef}
        className="field"
        value={opponent}
        onChange={(event) => setOpponent(event.target.value)}
        maxLength={80}
        placeholder="Ashfield RFC"
      />

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-14)' }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="f-date">
            Date
          </label>
          <input
            id="f-date"
            className="field"
            type="date"
            ref={dateRef}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="f-time">
            Kick-off
          </label>
          <input
            id="f-time"
            className="field"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Home or away</legend>
        <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
          {HOME_AWAY.map((t) => (
            <button
              key={t}
              type="button"
              className="squad-chip"
              aria-pressed={homeAway === t}
              onClick={() => setHomeAway(t)}
            >
              {enumLabel(t)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="label" htmlFor="f-venue" style={{ marginTop: 'var(--sp-14)' }}>
        Venue
      </label>
      <input
        id="f-venue"
        className="field"
        value={venue}
        onChange={(event) => setVenue(event.target.value)}
        placeholder="Ashcombe Park"
      />

      <label className="label" htmlFor="f-competition" style={{ marginTop: 'var(--sp-14)' }}>
        Competition
      </label>
      <input
        id="f-competition"
        className="field"
        value={competition}
        onChange={(event) => setCompetition(event.target.value)}
        placeholder="League"
      />

      <fieldset style={{ border: 'none', padding: 0, margin: '14px 0 0' }}>
        <legend className="label">Importance</legend>
        <div className="chiprow" style={{ marginTop: 'var(--sp-6)' }}>
          {IMPORTANCE.map((t) => (
            <button
              key={t}
              type="button"
              className="squad-chip"
              aria-pressed={importance === t}
              onClick={() => setImportance(t)}
            >
              {enumLabel(t)}
            </button>
          ))}
        </div>
        <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
          Used to weight the match in load planning. Leave it on Normal unless
          this one is treated differently.
        </p>
      </fieldset>

      {/* Deliberately NOT the sentence on the session form, because a fixture
          reaches athletes on different terms. It carries no participants; the
          athlete app shows it through fetchNextFixture, which takes the single
          nearest scheduled fixture for the whole club and puts it on everyone's
          Today screen as "Working towards". So it is immediate and it is
          club-wide, but it is not a roster, and nobody is named in it. Both
          halves have to be said: the first stops somebody assuming a further
          publish step, the second stops them assuming the squad has been told
          to turn up. */}
      <p className="cap" style={{ marginTop: 'var(--sp-14)' }}>
        Every athlete sees the club&rsquo;s next fixture on their Today screen as soon
        as you create it, with the opponent, kick-off and venue. There is no
        separate publish step. Nobody is named in a fixture, though — create a
        session for anything athletes have to turn up to.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginTop: 'var(--sp-14)' }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-18)' }}>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create fixture'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.push('/schedule')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
