'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { markRequestReviewed, submitClinicalReview, type InjuryForReview } from '@/lib/queries/sarPack';
import { enumLabel, formatDate } from '@/lib/format';

type Props = {
  orgId: string;
  requestId: string;
  timezone: string;
  injuries: InjuryForReview[];
};

type Draft = { decision: 'include' | 'withhold' | null; reason: string };

/** One decision per injury with a clinical record, per this page's own
 *  header. Already-decided injuries (a reviewer returning to a partly
 *  completed request) render read-only, matching sar_clinical_reviews'
 *  own immutability — see migration 0032's header for why there is no
 *  update path to reach for here. Submitting writes one row per
 *  newly-decided injury, then marks the request reviewed once every
 *  injury has a decision — the same check assembleSarPack itself runs
 *  again, server-side, before release, so a client-side bug here can
 *  make release wait longer, never skip the review it protects. */
export function ClinicalReviewForm({ orgId, requestId, timezone, injuries }: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(injuries.filter((i) => i.decision === null).map((i) => [i.injury_id, { decision: null, reason: '' }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decided = injuries.filter((i) => i.decision !== null);
  const pending = injuries.filter((i) => i.decision === null);
  const allDraftsComplete = pending.every((i) => {
    const d = drafts[i.injury_id];
    return d?.decision === 'include' || (d?.decision === 'withhold' && d.reason.trim().length > 0);
  });

  function setDecision(injuryId: string, decision: 'include' | 'withhold') {
    setDrafts((prev) => ({ ...prev, [injuryId]: { decision, reason: prev[injuryId]?.reason ?? '' } }));
  }

  function setReason(injuryId: string, reason: string) {
    setDrafts((prev) => ({ ...prev, [injuryId]: { decision: prev[injuryId]?.decision ?? null, reason } }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allDraftsComplete) {
      setError('Every clinical record needs a decision — withholding one also needs a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    const db = createClient();

    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      setBusy(false);
      setError('Your session has expired — sign in again.');
      return;
    }

    for (const injury of pending) {
      const draft = drafts[injury.injury_id];
      if (!draft?.decision) continue;
      const { error: err } = await submitClinicalReview(db, orgId, requestId, injury.injury_id, draft.decision, draft.decision === 'withhold' ? draft.reason.trim() : null, user.id);
      if (err) {
        setBusy(false);
        setError(err);
        return;
      }
    }

    await markRequestReviewed(db, orgId, requestId);

    setBusy(false);
    router.push('/settings/subject-access');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      {decided.map((injury) => (
        <section className="card" key={injury.injury_id} aria-labelledby={`injury-${injury.injury_id}`}>
          <h2 className="card-title" id={`injury-${injury.injury_id}`}>
            {enumLabel(injury.body_area)} · onset {formatDate(injury.onset_date, timezone)}
          </h2>
          <p className="cap">
            Already decided: <b>{injury.decision === 'include' ? 'Include' : 'Withhold'}</b>
            {injury.decision === 'withhold' && injury.reason ? ` — ${injury.reason}` : ''}
          </p>
        </section>
      ))}

      {pending.map((injury) => {
        const draft = drafts[injury.injury_id];
        return (
          <section className="card" key={injury.injury_id} aria-labelledby={`injury-${injury.injury_id}`}>
            <h2 className="card-title" id={`injury-${injury.injury_id}`}>
              {enumLabel(injury.body_area)} · onset {formatDate(injury.onset_date, timezone)}
            </h2>
            <div className="kv">
              <span className="sub">Diagnosis</span>
              <span className="sub">{injury.diagnosis ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="sub">Mechanism</span>
              <span className="sub">{injury.mechanism ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="sub">Clinical notes</span>
              <span className="sub">{injury.clinical_notes ?? '—'}</span>
            </div>
            <div className="kv">
              <span className="sub">Treatment plan</span>
              <span className="sub">{injury.treatment_plan ?? '—'}</span>
            </div>

            <div className="chiprow" style={{ marginTop: 10 }} role="group" aria-label={`Decision for ${enumLabel(injury.body_area)}`}>
              <button
                type="button"
                className="squad-chip"
                aria-pressed={draft?.decision === 'include'}
                onClick={() => setDecision(injury.injury_id, 'include')}
              >
                Include
              </button>
              <button
                type="button"
                className="squad-chip"
                aria-pressed={draft?.decision === 'withhold'}
                onClick={() => setDecision(injury.injury_id, 'withhold')}
              >
                Withhold
              </button>
            </div>

            {draft?.decision === 'withhold' ? (
              <div className="form-row" style={{ marginTop: 10 }}>
                <label className="label" htmlFor={`reason-${injury.injury_id}`}>
                  Reason (required)
                </label>
                <textarea
                  id={`reason-${injury.injury_id}`}
                  className="field"
                  rows={2}
                  value={draft.reason}
                  onChange={(e) => setReason(injury.injury_id, e.target.value)}
                  placeholder="Serious harm test applied — state the basis"
                />
              </div>
            ) : null}
          </section>
        );
      })}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <button className="btn-primary" type="submit" disabled={busy || !allDraftsComplete}>
          {busy ? 'Saving…' : 'Submit decisions'}
        </button>
      ) : injuries.length === 0 ? (
        // No clinical record exists for this athlete at all — there is
        // nothing to decide, but the request still needs an explicit
        // reviewer action to reach 'reviewed' (onSubmit's loop over
        // `pending` already no-ops correctly here; markRequestReviewed
        // still runs unconditionally after it). Without this button the
        // request had no path off pending_review — release/route.ts
        // refuses release until status is 'reviewed', and the only other
        // writer of that status was this form's own submit, gated behind
        // `pending.length > 0` above.
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Confirm — nothing to review'}
        </button>
      ) : null}
    </form>
  );
}
