import Link from 'next/link';
import { fetchStaffVisibility } from '@/lib/staffVisibility';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Who sees what you enter · Fydr' };

/** PATTERN-S9 artboard 2: what staff can see, before any decision is asked.
 *  Named people from this club's own accounts, one card per role present, the
 *  athlete as the fifth; the coach card leads with the boundary. The
 *  emphasised card carries the two facts already true in the product —
 *  submitted entries are immutable (ADR-005) and a day not answered stays
 *  empty (missing is not zero). Every line is a boundary enforced today; see
 *  lib/staffVisibility.ts for what each rests on, and for the one claim on
 *  the board that is not yet true (body site and side, the coach) and is
 *  therefore not made. docs/athlete/screens/21-consent-first-run.md. */
export default async function ConsentStaffPage() {
  const { orgId, consent } = await requireAthlete({ allowUndecided: true });
  const { cards, people } = await fetchStaffVisibility(orgId);
  const next = consent.isMinor ? '/consent/guardian' : '/consent/decide';
  /* The roles listed, you included — a structural count, never a figure
     about the data. */
  const total = cards.length + 1;

  return (
    <>
      <div className="sheet-head">
        <p className="eyebrow">Step 2 of 3 · nothing decided yet</p>
        <h1 className="t">Who sees what you enter</h1>
        <p className="s">
          {cards.length === 0
            ? 'Nobody at the club has a staff account yet. What each role sees is set by the role, not by who they get on with.'
            : `${people} ${people === 1 ? 'person' : 'people'} at the club ${people === 1 ? 'has' : 'have'} a staff account. What each one sees is set by their role in the club, not by who they get on with.`}
        </p>
      </div>

      <div className="stack">
        {cards.map((c) => (
          <section key={c.role} className="card" aria-labelledby={`role-${c.role}`} data-role={c.role}>
            <h2 className="card-title" id={`role-${c.role}`}>
              {c.who} — {c.roleWord}
            </h2>
            <dl className="consent-block-list" style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}>
              <dt>Sees</dt>
              <dd>{c.sees}</dd>
              <dt>Does not see</dt>
              <dd>{c.doesNotSee}</dd>
            </dl>
          </section>
        ))}

        <section className="card" aria-labelledby="role-you">
          <h2 className="card-title" id="role-you">
            You
          </h2>
          <dl className="consent-block-list" style={{ gridTemplateColumns: '64px minmax(0, 1fr)' }}>
            <dt>Sees</dt>
            <dd>Everything you enter, everything recorded about you, and any correction a coach makes beside what you first sent.</dd>
            <dt>Does not see</dt>
            <dd>The physiotherapist’s working notes. Everything else in your clinical record is yours to read.</dd>
          </dl>
        </section>

        <section className="card" aria-labelledby="two-facts" data-emphasis>
          <h2 className="card-title" id="two-facts">
            Two things that are already true
          </h2>
          <p className="import-sub">
            Once you submit a morning check-in or a session rating, nobody can change it — not you, not the club. A correction is a
            new entry with its own time, and both are kept.
          </p>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            A day you do not answer stays empty. It is not counted as a bad score, and the club’s figures say how many people
            answered out of how many were asked.
          </p>
        </section>

        <p className="tiny num" style={{ textAlign: 'center' }}>
          {total} of {total} roles listed
        </p>
      </div>

      {/* A minor's "Read the choice" is a form post: it sends the guardian
          the link (an act, not a side effect of opening a page) and lands on
          4A. An adult's is a link to 3A. Once a link has been sent the minor
          goes straight to 4A. */}
      {consent.isMinor && !consent.guardianRequestSent ? (
        <form method="post" action="/consent/guardian/send" className="subm">
          <button type="submit" className="btn-primary btn-commit">
            Read the choice
          </button>
        </form>
      ) : (
        <div className="subm">
          <Link href={next} className="btn-primary btn-commit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            Read the choice
          </Link>
        </div>
      )}
    </>
  );
}
