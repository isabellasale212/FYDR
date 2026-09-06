import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm/LoginForm';
import { FydrLockup } from '@/components/FydrLockup/FydrLockup';

export const metadata = { title: 'Sign in · Fydr' };

/** Fydr App Launch.dc.html (phone) and Fydr Staff Launch.dc.html (desktop),
 *  which are ONE page here.
 *
 *  The two scenes are the same five beats — Splash, Stop, Handoff, SignIn,
 *  Rest — at two widths: the phone hands the lockup to a single column, the
 *  desktop hands it to a two-column screen with the claim on the left and a
 *  form panel on the right. This app has one sign-in route for athletes and
 *  staff alike, so those are not two pages; they are the same page narrow and
 *  wide, and the desktop layout is a media query rather than a second route.
 *
 *  THREE THINGS THE STAFF SCENE SAYS THAT THIS BUILD CANNOT.
 *
 *  "23 of 26 submitted this morning · 3 flags to review · 07:12 last sync" are
 *  a named club's real figures on a page nobody has signed in to. Either they
 *  are invented, or they are a tenant's compliance data leaking to the public
 *  internet — CLAUDE.md §2 rule 1 in the one place it is easiest to break.
 *  The three slots keep their rhythm and say what the screen behind the login
 *  actually shows instead of pretending to know a club's numbers.
 *
 *  "Single sign-on is available on Premium" describes a feature that does not
 *  exist: no SSO, SAML or OIDC anywhere in this repo, and none in
 *  docs/12-product-tiers.md's feature table. Shipping it would be a pricing
 *  promise the product cannot keep.
 *
 *  "Athletes sign in on the Fydr app, not here" is false. They sign in here.
 *
 *  Also, as on the phone: "Email me a sign-in link" is not built (LoginForm is
 *  email + password), so the real "Forgot your password?" carries the
 *  secondary action, and the club name and athlete count are not knowable
 *  before anyone has authenticated.
 */
export default function LoginPage() {
  return (
    <main className="launch" data-animate="" id="main">
      <div className="launch-ground" aria-hidden="true" />

      <div className="launch-lockup">
        <FydrLockup animate title="Fydr" />
      </div>

      {/* Wide only. The phone scene has no claim column — its whole screen is
          the form — so this is hidden below the breakpoint rather than
          restyled. */}
      <section className="launch-claim">
        <div className="launch-step">
          <p className="eyebrow">Staff web app</p>
          <h2 className="launch-claim-h">
            The data you already collect, finally worth opening at 07:00.
          </h2>
          <p className="launch-claim-sub">
            Sign in to see this morning&rsquo;s entries against each athlete&rsquo;s
            baseline. Coaching staff see availability and restrictions; diagnosis and
            treatment notes stay with medical staff and the athlete.
          </p>
        </div>
        <ul className="launch-facts launch-step">
          <li>
            <span className="k">This morning</span>
            <span className="v">entries against each athlete&rsquo;s baseline</span>
          </li>
          <li>
            <span className="k">Flags</span>
            <span className="v">raised when a value crosses your threshold</span>
          </li>
          <li>
            <span className="k">Availability</span>
            <span className="v">who can train, and what they can&rsquo;t do</span>
          </li>
        </ul>
      </section>

      <div className="launch-page">
        <div className="launch-step" style={{ display: 'grid', gap: 8 }}>
          <p className="eyebrow launch-narrow-only">Athlete and staff</p>
          <h1 className="launch-title">Sign in</h1>
          <p className="launch-sub">
            Use the email address your club invited you on. Your morning entry takes 45
            seconds.
          </p>
        </div>

        <div className="launch-step">
          <Suspense
            fallback={
              <p className="cap" style={{ margin: 0 }}>
                Loading the form.
              </p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="launch-step launch-foot">
          Your wellness answers are visible to your club&rsquo;s staff. Injury
          detail is medical only.
        </p>
      </div>
    </main>
  );
}
