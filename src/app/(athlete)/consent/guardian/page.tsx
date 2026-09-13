import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LegalPlaceholder } from '@/components/LegalPlaceholder/LegalPlaceholder';
import { fetchLatestGuardianRequest } from '@/lib/guardianConsent';
import { formatDateTime } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'A guardian answers this one · Fydr' };

/** PATTERN-S9 artboard 4A: the athlete under 18 while guardian consent is
 *  outstanding. The guardian's name and masked address from the club's
 *  record, never asked for; what the athlete can do meanwhile (not locked out
 *  of the app, only out of the entry forms); "Your own say" and LEGAL-4A; "1
 *  of 1 guardian contacted"; Send the link again (56px); "This is not my
 *  guardian — tell the club" (a 44px row to a person, not a screen). No date
 *  of birth shown or requested. docs/athlete/screens/21-consent-first-run.md. */
export default async function ConsentGuardianPage({ searchParams }: { searchParams: Promise<{ sent?: string; e?: string }> }) {
  const { db, athleteId, consent, timezone } = await requireAthlete({ allowUndecided: true });
  if (!consent.isMinor) redirect('/consent/decide');
  if (consent.state === 'in_data') redirect('/today');
  if (consent.state === 'declined' || consent.state === 'withdrawn') redirect('/consent/declined');
  const { sent, e } = await searchParams;
  const latest = await fetchLatestGuardianRequest(db, athleteId);

  /* No request yet: the first send is the act of reaching this step. */
  if (!latest) {
    return (
      <>
        <div className="sheet-head">
          <p className="eyebrow">Step 3 of 3 · waiting on a guardian</p>
          <h1 className="t">A guardian answers this one</h1>
          <p className="s">Because you are under 18 on the club’s record, the decision about your data is your guardian’s to make.</p>
        </div>
        <div className="stack">
          {e ? (
            <p className="form-error" role="alert" style={{ margin: 0 }}>
              {e === 'no_guardian'
                ? 'The club has no guardian contact recorded for you yet. Ask them to add one — nothing can be sent until they do.'
                : 'The link could not be sent. Try again, or tell the club.'}
            </p>
          ) : null}
          <section className="card" aria-labelledby="g-who">
            <h2 className="card-title" id="g-who">
              {consent.guardianName ?? 'No guardian recorded'}
            </h2>
            {consent.guardianEmailMasked ? <p className="import-sub num">{consent.guardianEmailMasked}</p> : null}
            <p className="import-sub" style={{ marginBottom: 0 }}>
              The club holds them as your guardian contact. They will get a link to the same two blocks you have just read — the same
              words, nothing extra.
            </p>
          </section>
        </div>
        <form method="post" action="/consent/guardian/send" className="subm">
          <button type="submit" className="btn-primary btn-commit" disabled={!consent.guardianName}>
            Send them the link
          </button>
          <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
            Fydr does not ask you for their address, and does not ask you for your date of birth. Both come from the club’s record.
          </p>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="sheet-head">
        <p className="eyebrow">Step 3 of 3 · waiting on a guardian</p>
        <h1 className="t">A guardian answers this one</h1>
        <p className="s num">
          Sent {formatDateTime(latest.sent_at, timezone)} · no answer yet
        </p>
      </div>

      <div className="stack">
        {sent ? (
          <p className="tiny" role="status" style={{ margin: 0 }}>
            The link was sent again just now. The earlier one still works until it expires.
          </p>
        ) : null}
        {e ? (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            The link could not be sent. Try again, or tell the club.
          </p>
        ) : null}
        <section className="card" aria-labelledby="g-who">
          <h2 className="card-title" id="g-who">
            {latest.guardian_name}
          </h2>
          {consent.guardianEmailMasked ? <p className="import-sub num">{consent.guardianEmailMasked}</p> : null}
          <p className="import-sub" style={{ marginBottom: 0 }}>
            The club holds them as your guardian contact. They have a link to the same two blocks you have just read — the same words,
            nothing extra.
          </p>
        </section>

        <section className="card" aria-labelledby="g-meanwhile">
          <h2 className="card-title" id="g-meanwhile">
            What you can do meanwhile
          </h2>
          <p className="import-sub">You are not locked out. The schedule, your gym programme, your nutrition plan and the club’s messages all work.</p>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            Morning check-ins, session ratings, gym logging and the weekly nutrition check-in stay closed, because filling one in is the
            thing being agreed to. Nothing you type is held back waiting — the forms are simply not open yet.
          </p>
        </section>

        <section className="card" aria-labelledby="g-say">
          <h2 className="card-title" id="g-say">
            Your own say
          </h2>
          <p className="import-sub">
            Their answer is recorded as theirs. Yours is recorded as yours, and you are asked the same question in your own name when you
            turn 18.
          </p>
          <LegalPlaceholder id="LEGAL-4A" />
        </section>

        <p className="tiny num" style={{ textAlign: 'center' }}>
          1 of 1 guardian contacted
        </p>
      </div>

      <form method="post" action="/consent/guardian/send" className="subm">
        <button type="submit" className="btn-primary btn-commit">
          Send the link again
        </button>
        <Link href="/report-problem?about=guardian" className="me-row" style={{ marginTop: 'var(--sp-8)', textDecoration: 'none', color: 'inherit', minHeight: 44 }}>
          <span>This is not my guardian — tell the club</span>
          <span className="chev" aria-hidden="true">›</span>
        </Link>
        <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-8)' }}>
          Fydr does not ask you for their address, and does not ask you for your date of birth. Both come from the club’s record.
        </p>
      </form>
    </>
  );
}
