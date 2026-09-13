'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { submitTrainingEntry } from '@/lib/queries/training';
import { qk } from '@/lib/queries/keys';
import { OUTBOX_CHANGED_EVENT, dequeueTraining, enqueueTraining, pendingTraining } from '@/lib/outbox';
import { CR10_ANCHORS, CR10_SCALE, TrainingEntryInput } from '@/lib/validation/training';
import { rpeRatedLine, rpeSentLine } from '@/lib/todayRows';

type Props = {
  orgId: string;
  athleteId: string;
  userId: string;
  sessionId: string;
  sessionTitle: string;
  entryDate: string;
  /** The session's scheduled length — the minutes the rating is multiplied
   *  by. Null only for a session published before a duration was required
   *  (0113 era); the row then hands over to the screen, which asks. */
  durationMin: number | null;
  name: string;
  sub: string;
};

/**
 * The session rating prompt, on Today (Isabella, 2026-09-13, the RPE package,
 * change two: "The prompt is one tap, not a form. A row on Today carrying the
 * scale itself, no sheet. It is one number and the sheet is why compliance
 * is hard.").
 *
 * The row is the to-do row's shape — name, when — with the CR-10 grid the
 * rating screen draws (the same .cr10 cells, 58px, every anchor visible)
 * under it. One tap on a number sends: the session's scheduled minutes are
 * the duration (MET-007 is RPE × minutes and the schedule already knows
 * them), there is no note and no submit button. The tapped cell stays
 * selected and the row turns into its own receipt — "Rated 7 · Very hard"
 * with whether it was sent or is waiting on this phone — and does not
 * vanish (no auto-advance): the To do count catches up on the next visit.
 *
 * Buttons, not radios: the list on /rpe/[sessionId] uses real radios because
 * a selection there is not yet a submission, so arrow keys moving the
 * selection are harmless. Here a selection IS the submission, and an arrow
 * key must not send anything — a button sends on Enter, Space or a tap only.
 *
 * Offline and double-tap: the same outbox path as RpeForm — enqueue first,
 * then send; a failure leaves the entry in the outbox for OutboxFlusher to
 * retry from this page. The grid is disabled the moment a tap lands, which
 * is what closes the double-submit race (two rows for one session slot die
 * on training_entries_one_live_per_session).
 *
 * The screen at /rpe/[sessionId] stays for a notification's deep link and
 * for changing the minutes or adding a note; the row's subtitle links to it
 * until a rating is sent.
 */
export function TodayRpeRow({ orgId, athleteId, userId, sessionId, sessionTitle, entryDate, durationMin, name, sub }: Props) {
  const queryClient = useQueryClient();
  const [rated, setRated] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'waiting'>('idle');
  const [entryId, setEntryId] = useState<string | null>(null);

  /* "Waiting to send" must turn into "Sent" when the send happens, whoever
     does it: OutboxFlusher on this same page retries the outbox when the
     signal returns, and the receipt would otherwise say waiting forever. The
     outbox announces every write on this window (OUTBOX_CHANGED_EVENT); when
     this entry is no longer in it, it went. */
  useEffect(() => {
    if (state !== 'waiting' || entryId === null) return;
    const check = () => {
      if (!pendingTraining().some((p) => p.input.id === entryId)) setState('sent');
    };
    check();
    window.addEventListener(OUTBOX_CHANGED_EVENT, check);
    return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, check);
  }, [state, entryId]);

  const submit = useMutation({
    mutationFn: async (input: TrainingEntryInput) => {
      await submitTrainingEntry(createClient(), input, { orgId, athleteId, userId });
      return input;
    },
    onMutate: (input) => {
      enqueueTraining(input);
      setState('sending');
    },
    onSuccess: (input) => {
      dequeueTraining(input.id);
      setState('sent');
      void queryClient.invalidateQueries({ queryKey: qk.training.entryForSession(orgId, athleteId, sessionId) });
    },
    onError: () => {
      /* Still in the outbox; OutboxFlusher on this page retries it. The row
         says so rather than pretending it was sent. */
      setState('waiting');
    },
  });

  function rate(step: number) {
    if (rated !== null || durationMin === null) return;
    const candidate = { id: crypto.randomUUID(), session_id: sessionId, entry_date: entryDate, rpe: step, duration_min: durationMin, comment: null };
    const parsed = TrainingEntryInput.safeParse(candidate);
    if (!parsed.success) return;
    setRated(step);
    setEntryId(parsed.data.id);
    submit.mutate(parsed.data);
  }

  const done = rated !== null;
  const href = `/rpe/${sessionId}`;

  return (
    <div className="card td-row td-rate" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--sp-10)' }} data-state={state}>
      <div style={{ minWidth: 0 }}>
        <span className="td-name" style={{ fontSize: '1.0625rem' }}>
          {done ? rpeRatedLine(sessionTitle, rated) : name}
        </span>
        <span className="td-sub num" role={done ? 'status' : undefined} aria-live={done ? 'polite' : undefined}>
          {done ? rpeSentLine(state) : (
            <>
              {sub}
              {durationMin !== null ? (
                <>
                  {' · '}
                  <Link href={href} className="td-rate-more">
                    {durationMin} min · change or add a note
                  </Link>
                </>
              ) : null}
            </>
          )}
        </span>
      </div>

      {durationMin === null ? (
        /* No scheduled length to multiply by: the screen asks for one. */
        <Link href={href} className="btn-ghost" style={{ width: '100%' }}>
          Rate on the next screen
        </Link>
      ) : (
        <div className="cr10" role="group" aria-label={`Rate ${sessionTitle}, 0 rest to 10 maximal`} style={{ margin: 0 }}>
          {CR10_SCALE.map((step) => {
            const anchor = CR10_ANCHORS[step];
            const selected = rated === step;
            return (
              <button
                key={step}
                type="button"
                className="cr10-row"
                data-selected={selected}
                aria-pressed={selected}
                aria-label={anchor ? `${step}, ${anchor}` : String(step)}
                disabled={done && !selected}
                onClick={() => rate(step)}
                style={{ padding: 0, font: 'inherit' }}
              >
                <span className="cr10-n num" aria-hidden="true">{step}</span>
                <span className="cr10-a" aria-hidden="true">{anchor ?? '·'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
