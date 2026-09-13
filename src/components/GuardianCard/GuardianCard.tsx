import { formatDate, formatDateTime } from '@/lib/format';
import type { AthleteProfile } from '@/lib/queries/squad';
import type { GuardianRequestRow } from '@/lib/guardianConsent';

/** PATTERN-S9 artboard 4, the staff side (not drawn; needed for the route
 *  to have a starting point): for an athlete under 18, the guardian the club
 *  holds, the state of the consent link, and the two ways a decision lands —
 *  the guardian's own answer on the link, or a decision the guardian gave
 *  offline that the sport scientist records with its method. Sport scientist
 *  only; every other role reads the state. Plain form posts to
 *  /squad/[athleteId]/guardian. */
export function GuardianCard({ athlete, latest, isAdmin, timezone, notice }: { athlete: AthleteProfile; latest: GuardianRequestRow | null; isAdmin: boolean; timezone: string; notice: string | null }) {
  const c = athlete.consent;
  const decided = c.state === 'in_data' || c.state === 'declined' || c.state === 'withdrawn';
  const method = c.parentalMethod;
  const methodWords: Record<string, string> = {
    guardian_link: 'answered by the guardian on the link',
    club_registration_form: 'recorded from the club registration form',
    written_confirmation: 'recorded from written confirmation',
    in_person: 'recorded in person',
    not_required: 'not required',
  };
  const notices: Record<string, string> = {
    saved: 'Guardian saved.',
    sent: 'The consent link was sent to the guardian.',
    recorded: 'The guardian’s decision is recorded.',
    no_guardian: 'Nothing sent: record the guardian’s name and email first.',
    not_a_minor: 'Nothing sent: this athlete is not under 18.',
    invalid: 'Not saved: check the fields.',
    failed: 'Not saved. Try again.',
    refused: 'The guardian belongs to the sport scientist.',
  };
  return (
    <section className="card" aria-labelledby="guardian-title" data-guardian-card>
      <h2 className="card-title" id="guardian-title">
        Guardian
      </h2>
      <p className="import-sub">
        Under 18 on the club’s record, so the data decision is a guardian’s. The athlete sees the name and a masked address and is never
        asked for either. Two routes: the guardian answers on an emailed link, or the club records a decision given offline, with its
        method.
      </p>
      {notice && notices[notice] ? (
        <p className={/Not saved|Nothing sent|belongs/.test(notices[notice]!) ? 'form-error' : 'tiny'} role={/Not saved|Nothing sent/.test(notices[notice]!) ? 'alert' : 'status'} style={{ marginBottom: 'var(--sp-10)' }}>
          {notices[notice]}
        </p>
      ) : null}

      <dl className="consent-block-list" style={{ gridTemplateColumns: '96px minmax(0, 1fr)', marginBottom: 'var(--sp-12)' }}>
        <dt>Guardian</dt>
        <dd>{c.guardianName ? `${c.guardianName} · ${c.guardianEmail ?? 'no email'}` : 'None recorded'}</dd>
        <dt>Decision</dt>
        <dd className="num">
          {decided
            ? `${c.state === 'in_data' ? 'Agreed' : c.state === 'declined' ? 'Declined' : 'Withdrawn'}${c.at || c.parentalRecordedAt ? ` · ${formatDate((c.at ?? c.parentalRecordedAt)!, timezone)}` : ''}${method && methodWords[method] ? ` · ${methodWords[method]}` : ''}`
            : latest
              ? `Link sent ${formatDateTime(latest.sent_at, timezone)} · ${latest.expires_at < new Date().toISOString() ? 'expired' : `works until ${formatDate(latest.expires_at, timezone)}`} · no answer yet`
              : 'Nothing sent yet'}
        </dd>
      </dl>

      {isAdmin ? (
        <div className="stack">
          <form method="post" action={`/squad/${athlete.id}/guardian`} className="form-row" style={{ margin: 0 }}>
            <input type="hidden" name="action" value="save" />
            <label className="label" htmlFor="g-name">
              Guardian’s name
            </label>
            <input id="g-name" name="guardianName" className="field" defaultValue={c.guardianName ?? ''} required />
            <label className="label" htmlFor="g-email" style={{ marginTop: 'var(--sp-8)' }}>
              Guardian’s email
            </label>
            <input id="g-email" name="guardianEmail" type="email" className="field" defaultValue={c.guardianEmail ?? ''} required />
            <button type="submit" className="btn-ghost" style={{ marginTop: 'var(--sp-8)' }}>
              Save guardian
            </button>
          </form>

          {!decided ? (
            <form method="post" action={`/squad/${athlete.id}/guardian`}>
              <input type="hidden" name="action" value="send" />
              <button type="submit" className="btn-primary" disabled={!c.guardianEmail}>
                {latest ? 'Send the link again' : 'Send the consent link'}
              </button>
            </form>
          ) : null}

          <form method="post" action={`/squad/${athlete.id}/guardian`} className="form-row" style={{ margin: 0 }}>
            <input type="hidden" name="action" value="record" />
            <p className="tiny" style={{ marginBottom: 'var(--sp-6)' }}>
              Record a decision the guardian gave offline. The record says which route was used.
            </p>
            <label className="label" htmlFor="g-method">
              How it was given
            </label>
            <select id="g-method" name="method" className="field" defaultValue="club_registration_form">
              <option value="club_registration_form">Club registration form</option>
              <option value="written_confirmation">Written confirmation</option>
              <option value="in_person">In person</option>
            </select>
            <div className="consent-choices" style={{ marginTop: 'var(--sp-8)' }}>
              <button type="submit" name="decision" value="agree" className="btn-ghost">
                Record: agreed to both blocks
              </button>
              <button type="submit" name="decision" value="decline" className="btn-ghost">
                Record: did not agree
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="tiny">The sport scientist records the guardian and any offline decision.</p>
      )}
    </section>
  );
}
