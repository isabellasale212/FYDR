import { formatDateTime } from '@/lib/format';
import type { InjuryProtocol, StageEvent } from '@/lib/queries/injuryStages';
import { RESTRICTION_HINT, STAGE_ADVANCE_RULE } from '@/lib/queries/injuryStages';
import { stageLadder } from '@/lib/statusScreen';

/** PATTERN-S3 C3, the medic's side: the ladder with state words (Done, Now,
 *  Next, Later, Cleared — no invented stage names), the advance form (one
 *  stage, a rewritten restriction line, the criteria-reviewed confirmation)
 *  and the "set any other stage" form (a reason). Plain form posts to
 *  /injuries/[id]/stage; the rules are the database's (move_injury_stage). The
 *  confirmation the board asks for is on the card before the press: who will
 *  read what — the athlete their status screen, the coach the restriction
 *  line, the medical team the record. */
export function StageLadder({
  injuryId,
  protocol,
  events,
  timezone,
  notice,
  closed,
  namesById,
}: {
  injuryId: string;
  protocol: InjuryProtocol | null;
  events: StageEvent[];
  timezone: string;
  notice: string | null;
  closed: boolean;
  namesById: Map<string, string>;
}) {
  const notices: Record<string, string> = {
    opened: 'Protocol opened at stage 0.',
    advanced: 'Advanced one stage. The athlete reads it on their status screen; the coach reads the new restriction line.',
    set: 'Stage set, with the reason on the record.',
    restriction_line_required: 'Not saved: write the restriction line for the new stage — what the athlete can and cannot do, without naming a diagnosis or a protocol.',
    criteria_not_reviewed: 'Not saved: confirm the criteria in the club’s protocol were reviewed.',
    reason_required: 'Not saved: setting any stage but the next one needs a reason.',
    restriction_line_names_clinical: 'Not saved: the restriction line names a diagnosis or a protocol. Describe the restriction, not the injury.',
    stage_out_of_range: 'Not saved: that stage is past the protocol’s end.',
    same_stage: 'Not saved: that is the current stage.',
    injury_closed: 'Not saved: the injury is closed.',
    invalid: 'Not saved: check the fields.',
    failed: 'Not saved. Try again.',
    refused: 'The protocol is the medic’s.',
  };
  const rungs = protocol ? stageLadder(protocol.current_stage === 0 ? null : protocol.current_stage, protocol.total_stages, closed) : [];
  const next = protocol ? protocol.current_stage + 1 : null;

  return (
    <section className="card" aria-labelledby="ladder-title" data-stage-ladder>
      <h2 className="card-title" id="ladder-title">
        Return to play
      </h2>
      {notice && notices[notice] ? (
        <p className={/Not saved|medic’s/.test(notices[notice]!) ? 'form-error' : 'tiny'} role={/Not saved/.test(notices[notice]!) ? 'alert' : 'status'} style={{ marginBottom: 'var(--sp-10)' }}>
          {notices[notice]}
        </p>
      ) : null}

      {!protocol ? (
        <>
          <p className="import-sub">
            No protocol is open for this injury. Open one with the number of stages the club’s protocol has for it; the criteria for each
            stage live in that protocol, not here.
          </p>
          {!closed ? (
            <form method="post" action={`/injuries/${injuryId}/stage`} className="form-row" style={{ margin: 0 }}>
              <input type="hidden" name="action" value="open" />
              <label className="label" htmlFor="stage-total">
                Stages in the protocol
              </label>
              <input id="stage-total" name="total" type="number" min={1} max={12} defaultValue={6} className="field num" style={{ maxWidth: 120 }} required />
              <button type="submit" className="btn-ghost" style={{ marginTop: 'var(--sp-8)' }}>
                Open the protocol
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <>
          <p className="import-sub">
            {closed
              ? `Cleared. ${protocol.total_stages} stages in the club’s protocol.`
              : protocol.current_stage === 0
                ? `Opened, not yet on a stage. ${protocol.total_stages} stages in the club’s protocol.`
                : `Stage ${protocol.current_stage} of ${protocol.total_stages}. The criteria for the next stage live in the club’s protocol.`}
          </p>
          <ol className="install-steps" aria-label="Stages">
            {rungs.map((r) => (
              <li key={r.n} className="install-step" data-rung={r.state} style={{ alignItems: 'center' }}>
                <span className="install-step-n" aria-hidden="true" style={r.state === 'now' ? undefined : { background: 'var(--surf2)', color: 'var(--muted)' }}>
                  {r.n}
                </span>
                <span>
                  Stage {r.n} · <b>{r.state === 'done' ? 'Done' : r.state === 'now' ? 'Now' : r.state === 'next' ? 'Next' : r.state === 'cleared' ? 'Cleared' : 'Later'}</b>
                </span>
              </li>
            ))}
          </ol>

          {!closed && next !== null && next <= protocol.total_stages ? (
            <form method="post" action={`/injuries/${injuryId}/stage`} className="form-row" style={{ marginTop: 'var(--sp-14)' }} data-stage-advance>
              <input type="hidden" name="action" value="advance" />
              <input type="hidden" name="to" value={next} />
              <p className="tiny" style={{ marginBottom: 'var(--sp-8)' }}>
                {STAGE_ADVANCE_RULE}
              </p>
              <label className="label" htmlFor="stage-line">
                Restriction line for stage {next}
              </label>
              <input id="stage-line" name="line" className="field" required maxLength={120} placeholder="e.g. Straight-line running only" />
              <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
                {RESTRICTION_HINT}
              </p>
              <label className="tiny" style={{ display: 'flex', gap: 'var(--sp-8)', alignItems: 'center', marginTop: 'var(--sp-8)', minHeight: 'var(--tap-min)' }}>
                <input type="checkbox" name="reviewed" value="1" required style={{ width: 18, height: 18, margin: 0 }} />
                The criteria for stage {next} in the club’s protocol were reviewed.
              </label>
              <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
                When this lands: the athlete reads “Stage {next} · Now” on their status screen; the coach reads the new restriction line
                and nothing else; the record keeps this move with your name and the time.
              </p>
              <button type="submit" className="btn-primary" style={{ marginTop: 'var(--sp-8)' }}>
                Advance to stage {next}
              </button>
            </form>
          ) : null}

          {!closed ? (
            <form method="post" action={`/injuries/${injuryId}/stage`} className="form-row" style={{ marginTop: 'var(--sp-14)' }} data-stage-set>
              <input type="hidden" name="action" value="set" />
              <p className="tiny" style={{ marginBottom: 'var(--sp-8)' }}>
                Set any other stage — back, or a jump — with a reason on the record.
              </p>
              <label className="label" htmlFor="stage-to">
                Stage
              </label>
              <input id="stage-to" name="to" type="number" min={0} max={protocol.total_stages} defaultValue={Math.max(0, protocol.current_stage - 1)} className="field num" style={{ maxWidth: 120 }} required />
              <label className="label" htmlFor="stage-reason" style={{ marginTop: 'var(--sp-8)' }}>
                Reason
              </label>
              <input id="stage-reason" name="reason" className="field" required maxLength={240} />
              <label className="label" htmlFor="stage-line-2" style={{ marginTop: 'var(--sp-8)' }}>
                Restriction line (optional)
              </label>
              <input id="stage-line-2" name="line" className="field" maxLength={120} />
              <button type="submit" className="btn-ghost" style={{ marginTop: 'var(--sp-8)' }}>
                Set the stage
              </button>
            </form>
          ) : null}

          {events.length > 0 ? (
            <ul className="pw-rules" style={{ marginTop: 'var(--sp-14)' }} aria-label="Stage history">
              {events.map((e) => (
                <li key={e.id} className="pw-rule" data-state="met" style={{ color: 'var(--muted)' }}>
                  <span className="pw-rule-mark num" aria-hidden="true">{e.to_stage}</span>
                  <span className="num">
                    {e.from_stage === null ? 'Opened' : e.to_stage === (e.from_stage ?? 0) + 1 ? `Advanced ${e.from_stage} → ${e.to_stage}` : `Set ${e.from_stage} → ${e.to_stage}`} · {e.moved_by ? (namesById.get(e.moved_by) ?? 'a medic') : 'a medic'} · {formatDateTime(e.moved_at, timezone)}
                    {e.restriction_line ? ` · “${e.restriction_line}”` : ''}
                    {e.reason ? ` · ${e.reason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
