import { FydrLockup } from '@/components/FydrLockup/FydrLockup';
import { LegalPlaceholder } from '@/components/LegalPlaceholder/LegalPlaceholder';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDateTime } from '@/lib/format';

export const metadata = { title: 'A decision about your child’s data · Fydr' };

/** PATTERN-S9 artboard 4B: the guardian, on the emailed link. A web page with
 *  no account — outside both shells, reached by the single-use token alone,
 *  reading and writing only through guardian_request_by_token and
 *  guardian_decide (0120, anon-callable). The athlete's own wording verbatim:
 *  the same two blocks condensed, LEGAL-3A and LEGAL-3B shown by reference so
 *  a reviewer can confirm the strings match, the same sentence about
 *  selection, the same two equal 56px choices, zero haloed primaries. The
 *  wordmark and the club name identify the page the way the invite does.
 *  "Under 18 on the club's record" and nothing more precise: no date of
 *  birth is shown or asked. docs/athlete/screens/21-consent-first-run.md. */
export default async function GuardianPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ e?: string }> }) {
  const { token } = await params;
  const { e } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc('guardian_request_by_token', { p_token: token });
  const req = data?.[0] ?? null;
  const timezone = 'Europe/London';

  const shell = (children: React.ReactNode) => (
    <main className="login-wrap" id="main">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="signin-logo">
          <FydrLockup title="Fydr" />
        </div>
        {children}
      </div>
    </main>
  );

  if (!req) {
    return shell(
      <div className="signin-head">
        <p className="signin-eyebrow">No account needed</p>
        <h1 className="signin-title">This link is not recognised.</h1>
        <p className="signin-sub">It may have been copied incompletely. Ask the club to send it again.</p>
      </div>,
    );
  }

  if (req.state === 'decided') {
    return shell(
      <div className="signin-head">
        <p className="signin-eyebrow">{req.club_name} · answered</p>
        <h1 className="signin-title">{req.decision === 'agree' ? 'You agreed.' : 'You said no.'}</h1>
        <p className="signin-sub num">
          Recorded {req.decided_at ? formatDateTime(req.decided_at, timezone) : ''}. {req.athlete_first_name} sees your name, your answer and the date. To change it, reply to the club or ask
          for a new link.
        </p>
      </div>,
    );
  }

  if (req.state === 'expired') {
    return shell(
      <div className="signin-head">
        <p className="signin-eyebrow">{req.club_name}</p>
        <h1 className="signin-title">This link has expired.</h1>
        <p className="signin-sub">Ask the club, or {req.athlete_first_name}, to send it again. Nothing has been recorded.</p>
      </div>,
    );
  }

  const first = req.athlete_first_name;
  return shell(
    <>
      <div className="signin-head">
        <p className="signin-eyebrow">No account needed</p>
        <p className="tiny num">
          {req.club_name} · link expires {formatDate(req.expires_at, timezone)}
        </p>
        <h1 className="signin-title">For {req.guardian_name}, about {first}</h1>
        <p className="signin-sub">
          {first} is under 18 on the club’s record, so this decision is yours. {first} has read the same two blocks.
        </p>
      </div>

      {e === 'failed' ? (
        <p className="form-error" role="alert">
          That did not save. Nothing was recorded — try again.
        </p>
      ) : null}

      <div className="stack">
        <section className="card" aria-labelledby="gb-1">
          <p className="eyebrow" style={{ marginBottom: 'var(--sp-4)' }}>Block 1</p>
          <h2 className="card-title" id="gb-1">
            Performance data
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            Morning check-ins, session ratings, gym and nutrition logs, test results. Seen by the coach, the sport scientist, the
            physiotherapist, and {first}.
          </p>
          <LegalPlaceholder id="LEGAL-3A" sameAs="same wording as the athlete screen" />
        </section>

        <section className="card" aria-labelledby="gb-2">
          <p className="eyebrow" style={{ marginBottom: 'var(--sp-4)' }}>Block 2</p>
          <h2 className="card-title" id="gb-2">
            Health and injury data
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            Injuries, symptoms, diagnosis, treatment. Seen by the physiotherapist and {first}. Coaching staff see availability and one
            restriction line.
          </p>
          <LegalPlaceholder id="LEGAL-3B" sameAs="same wording as the athlete screen" />
        </section>

        <section className="card" aria-labelledby="gb-3">
          <h2 className="card-title" id="gb-3">
            What {first} sees of your answer
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>Your name, your decision and the date. Not this page, and no note you add here.</p>
        </section>

        <form method="post" action={`/guardian/${token}/decide`} className="card" data-consent-form>
          <p className="import-sub" style={{ marginBottom: 'var(--sp-2)' }}>
            <b>Saying no does not affect selection.</b>
          </p>
          <p className="tiny" style={{ marginBottom: 'var(--sp-12)' }}>
            The club states this; Fydr records the answer.
          </p>
          <LegalPlaceholder id="LEGAL-3C" sameAs="same wording as the athlete screen" />
          <div className="consent-choices" style={{ marginTop: 'var(--sp-12)' }}>
            <button type="submit" name="decision" value="agree" className="consent-choice">
              I agree to both blocks
            </button>
            <button type="submit" name="decision" value="decline" className="consent-choice">
              I do not agree
            </button>
          </div>
          <p className="tiny" style={{ textAlign: 'center', marginTop: 'var(--sp-10)' }}>
            Version <span className="num">{req.version}</span>. You can change this by replying to the club, or on this link again while it lasts.
          </p>
          <LegalPlaceholder id="LEGAL-3D" sameAs="same wording as the athlete screen" />
        </form>
      </div>
    </>,
  );
}
