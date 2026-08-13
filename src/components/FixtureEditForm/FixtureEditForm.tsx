'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { HumanError, toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import { updateFixture, type FixtureDetail } from '@/lib/queries/schedule';
import { zonedTimeToUtcIso, dateInTz, timeInTz } from '@/lib/format';

const HOME_AWAY = ['home', 'away', 'neutral'] as const;
const IMPORTANCE = ['friendly', 'normal', 'key', 'cup_final'] as const;

type Props = {
  orgId: string;
  fixture: FixtureDetail;
  timezone: string;
};

/** The edit half of fixture-detail.md's Details tab. Same shape and the same
 *  reason for staying a separate component from SessionEditForm rather than
 *  a shared one: touching working, tested code for an unrelated screen
 *  risks the exact bug class `zonedTimeToUtcIso` exists to prevent. */
export function FixtureEditForm({ orgId, fixture, timezone }: Props) {
  const router = useRouter();
  const kickoff = new Date(fixture.kickoff_at);

  const [opponent, setOpponent] = useState(fixture.opponent);
  const [date, setDate] = useState(dateInTz(kickoff, timezone));
  const [time, setTime] = useState(timeInTz(kickoff, timezone));
  const [venue, setVenue] = useState(fixture.venue ?? '');
  const [homeAway, setHomeAway] = useState<(typeof HOME_AWAY)[number]>(fixture.home_away);
  const [competition, setCompetition] = useState(fixture.competition ?? '');
  const [importance, setImportance] = useState<(typeof IMPORTANCE)[number]>(
    fixture.importance,
  );
  const [result, setResult] = useState(fixture.result ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const outcome = await withWriteTimeout(
        updateFixture(createClient(), orgId, fixture.id, {
          opponent,
          kickoffAt: zonedTimeToUtcIso(date, time, timezone),
          venue: venue.trim() ? venue.trim() : null,
          homeAway,
          competition: competition.trim() ? competition.trim() : null,
          importance,
          result: result.trim() ? result.trim() : null,
        }),
      );
      if (outcome.error) throw new HumanError(outcome.error);
    },
    onSuccess: () => router.refresh(),
    onError: (err: Error) => setError(toUserMessage(err, 'staff')),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!opponent.trim()) return setError('Give the opponent a name.');
    if (!date || !time) return setError('Set a kick-off date and time.');
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
        className="field"
        value={opponent}
        onChange={(event) => setOpponent(event.target.value)}
        maxLength={120}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="f-date">
            Date
          </label>
          <input
            id="f-date"
            className="field"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" htmlFor="f-time">
            Kick off
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
        <legend className="label">Home, away or neutral</legend>
        <div className="chiprow" style={{ marginTop: 6 }}>
          {HOME_AWAY.map((h) => (
            <button
              key={h}
              type="button"
              className="squad-chip"
              aria-pressed={homeAway === h}
              onClick={() => setHomeAway(h)}
            >
              {h.charAt(0).toUpperCase() + h.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="label" htmlFor="f-venue" style={{ marginTop: 14 }}>
        Venue
      </label>
      <input
        id="f-venue"
        className="field"
        value={venue}
        onChange={(event) => setVenue(event.target.value)}
        placeholder="Memorial Ground"
      />

      <label className="label" htmlFor="f-competition" style={{ marginTop: 14 }}>
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
        <div className="chiprow" style={{ marginTop: 6 }}>
          {IMPORTANCE.map((i) => (
            <button
              key={i}
              type="button"
              className="squad-chip"
              aria-pressed={importance === i}
              onClick={() => setImportance(i)}
            >
              {i === 'cup_final' ? 'Cup final' : i.charAt(0).toUpperCase() + i.slice(1)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="label" htmlFor="f-result" style={{ marginTop: 14 }}>
        Result (optional)
      </label>
      <input
        id="f-result"
        className="field"
        value={result}
        onChange={(event) => setResult(event.target.value)}
        placeholder="W 24-17"
        maxLength={40}
      />

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
