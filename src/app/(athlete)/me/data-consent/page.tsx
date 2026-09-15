import Link from 'next/link';
import { LegalPlaceholder } from '@/components/LegalPlaceholder/LegalPlaceholder';
import { ConsentBlocks } from '@/components/ConsentBlocks/ConsentBlocks';
import { consentStateLabel } from '@/lib/consentState';
import { formatDateTime } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Data consent · Fydr' };

/** PATTERN-S9 "named, not drawn": Settings › Your data › Data consent. The
 *  row on Me shows the current state and its date; this screen opens the same
 *  two blocks with the opposite pair of actions. Withdrawing sets the squad
 *  row to "data consent withdrawn" with today's date, stops new entries, and
 *  leaves submitted entries alone pending LEGAL-3E; the club sees it on the
 *  squad list and in the audit trail; no published mean is recomputed
 *  (LEGAL-3E's, nothing recomputes either way). An athlete who declined or
 *  withdrew sees the same blocks with "I agree to both blocks" first. */
export default async function DataConsentPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { consent, timezone } = await requireAthlete();
  const { e } = await searchParams;
  const inData = consent.state === 'in_data';

  if (consent.state === 'guardian_pending') {
    return (
      <>
        <div className="hd">
          <h1 className="d">Data consent</h1>
        </div>
        <div className="after-card">
          <h2 className="after-heading">A guardian answers this one</h2>
          <p className="after-note">The decision about your data is your guardian’s while you are under 18 on the club’s record.</p>
        </div>
        <div className="subm">
          <Link href="/consent/guardian" className="btn-primary btn-commit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            See where it stands
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <ConsentBlocks
        eyebrow={`Your data · ${consentStateLabel(consent.state).toLowerCase()}${consent.givenAt && inData ? ` since ${formatDateTime(consent.givenAt, timezone)}` : consent.at ? ` ${formatDateTime(consent.at, timezone)}` : ''}`}
        title={inData ? 'Withdraw your consent?' : 'Two kinds of data'}
        sub={inData ? 'The same two blocks you agreed to. Withdrawing stops new entries from today; what you already submitted stays as it is until the retention wording says otherwise.' : 'Listed apart because different people see them, and because you may be asked about them separately.'}
        error={e === 'failed' ? 'That did not save. Nothing was recorded — try again.' : null}
        action={inData ? '/me/data-consent/withdraw' : '/consent/decide/record'}
        agreeLabel={inData ? 'Keep my consent as it is' : 'I agree to both blocks'}
        declineLabel={inData ? 'Withdraw my consent' : 'I do not agree'}
        foot={
          inData ? (
            <>
              Withdrawing shows on the squad list beside your name — data consent withdrawn, with today’s date — and in the club’s audit trail.
              Version{' '}
              <span className="num">{consent.version}</span>.
            </>
          ) : (
            <>Agreeing opens the four entry forms again from today. Recorded with the date and time you choose.</>
          )
        }
      />

      {/* Finding 2: a "get my data" route beside the withdrawal, pointing at
          how to ask. Under UK GDPR a club cannot refuse a subject access
          request, which is a different thing from the decision that athletes
          get no self-service export. No export is built here. */}
      <section className="card" aria-labelledby="sar-title" style={{ marginTop: 'var(--sp-14)' }}>
        <h2 className="card-title" id="sar-title">
          A copy of what the club holds
        </h2>
        <p className="import-sub">
          Ask the club, in writing, for a copy of your data. They have one month to answer and cannot refuse. Where your request
          stands is shown on{' '}
          <Link href="/me/privacy" className="linklike">
            Privacy and my data
          </Link>
          .
        </p>
        <LegalPlaceholder id="LEGAL-3F" />
      </section>

      <section className="card" aria-labelledby="ret-title" style={{ marginTop: 'var(--sp-14)' }}>
        <h2 className="card-title" id="ret-title">
          What happens to entries after a withdrawal
        </h2>
        <LegalPlaceholder id="LEGAL-3E" />
      </section>
    </>
  );
}
