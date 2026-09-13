import Link from 'next/link';
import { LegalPlaceholder } from '@/components/LegalPlaceholder/LegalPlaceholder';
import { formatDateTime } from '@/lib/format';
import { requireAthlete } from '@/lib/session';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Your data · Fydr' };

/** PATTERN-S9 artboard 3B: declining as a state of the screen, not a toast.
 *  The eyebrow carries the recorded date and time; two cards say what the club
 *  sees and what the athlete sees; the retention card is LEGAL-3E's. Also
 *  where a withdrawal lands. docs/athlete/screens/21-consent-first-run.md. */
export default async function ConsentDeclinedPage() {
  const { consent, timezone } = await requireAthlete();
  if (consent.state !== 'declined' && consent.state !== 'withdrawn') redirect('/today');
  const withdrawn = consent.state === 'withdrawn';

  return (
    <>
      <div className="sheet-head">
        <p className="eyebrow num">Your data · recorded {consent.at ? formatDateTime(consent.at, timezone) : '—'}</p>
        <h1 className="t">{withdrawn ? 'You withdrew' : 'You said no'}</h1>
        <p className="s">Your account stays. You are still in the squad, and the club can still tell you where to be.</p>
      </div>

      <div className="stack">
        <section className="card" aria-labelledby="club-sees">
          <h2 className="card-title" id="club-sees">
            What the club sees
          </h2>
          <p className="import-sub">
            Your name in the squad list, with “{withdrawn ? 'data consent withdrawn' : 'no data consent'}” beside it, and the date. No new entries from you, and no
            readiness figure — your cells read an em dash, never a zero.
          </p>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            Squad figures count you out of the denominator. Where the coach used to read 24 of 30 submitted, they read 24 of 29,
            and the caption says one athlete is excluded.
          </p>
        </section>

        <section className="card" aria-labelledby="you-see">
          <h2 className="card-title" id="you-see">
            What you see
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            Today has no morning check-in and no session rating to fill in. The schedule, your gym programme, the club’s messages
            and your own profile all work as normal.
          </p>
        </section>

        <section className="card" aria-labelledby="kept">
          <h2 className="card-title" id="kept">
            {withdrawn ? 'What you entered before today' : 'Nothing you entered before today is kept'}
          </h2>
          <p className="import-sub">
            {withdrawn
              ? 'Entries you submitted before withdrawing are left as they are until the retention wording says otherwise. Nothing new is recorded.'
              : 'You had no entries, so there is nothing to delete. If you had, this card would say how many and what happens to them.'}
          </p>
          <LegalPlaceholder id="LEGAL-3E" />
        </section>

        <Link href="/me/data-consent" className="card me-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>Settings › Your data</span>
          <span className="chev" aria-hidden="true">›</span>
        </Link>
      </div>

      <div className="subm">
        <Link href="/today" className="btn-primary btn-commit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          Go to Today
        </Link>
      </div>
    </>
  );
}
