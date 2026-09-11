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
/** Plays the launch sequence once per browser session, not on every visit.
 *
 *  WHY IT IS A SCRIPT AND NOT STATE. The attribute has to be right at FIRST
 *  PAINT — an effect running after hydration would either flash the animation
 *  on a repeat visit or flash the finished form on a first one. layout.tsx
 *  already solves the identical problem for the theme with a synchronous inline
 *  script, and this is the same technique with a smaller blast radius: it walks
 *  up from its own <script> tag, so it touches this page's shell and nothing
 *  else.
 *
 *  THE DEFAULT IS "NO ANIMATION", WHICH IS THE POINT. The attribute is absent in
 *  the markup and added only on a first visit, so every failure mode — script
 *  blocked, JS off, sessionStorage throwing in a privacy mode — lands on a form
 *  that is simply visible. Before this, the markup hard-coded data-animate and
 *  failed the other way: the sequence ran on every visit, and for its first 2.4
 *  seconds the form was invisible while still being focusable and announced.
 *
 *  sessionStorage rather than localStorage, deliberately: once per session is
 *  the brand moment. Once ever would make it a thing most people never see. */
const LAUNCH_ONCE_SCRIPT = `(function(){try{var s=document.currentScript;var m=s&&s.parentElement;if(!m)return;if(sessionStorage.getItem('fydr-launch-seen'))return;sessionStorage.setItem('fydr-launch-seen','1');m.setAttribute('data-animate','');}catch(e){}})();`;

export default function LoginPage() {
  return (
    <main className="launch" id="main" suppressHydrationWarning>
      {/* Runs during parse, before this element paints, and sets data-animate
          only on a first visit. Has to be a plain inline script for that; there
          is no JSX way to run before paint. suppressHydrationWarning above
          because the server cannot know what sessionStorage holds — the same
          note layout.tsx carries for the theme attribute. */}
      <script dangerouslySetInnerHTML={{ __html: LAUNCH_ONCE_SCRIPT }} />
      <div className="launch-ground" aria-hidden="true" />

      <div className="launch-lockup">
        <FydrLockup animate title="Fydr" />
      </div>

      {/* Wide only. The phone scene has no claim column — its whole screen is
          the form — so this is hidden below the breakpoint rather than
          restyled. That is also what makes the three-column grid below safe at
          every width it renders in; see base.css's own note.

          THE EYEBROW IS GONE ON PURPOSE. "Staff web app" sat between the
          wordmark and the headline, and the headline is specified as sitting
          56px below the wordmark, which it cannot do with a line in between. It
          was also the least true string on the page: athletes sign in here too.

          THE THREE CAPTIONS ARE UNCHANGED COPY, re-presented. See this file's
          header for why that matters — the design scene put a named club's live
          figures on a page nobody has signed in to, and these are the honest
          replacements. A redesign is not a licence to reopen that. */}
      <section className="launch-claim">
        <h2 className="launch-claim-h launch-step">Data, finally worth reading.</h2>

        <ul className="launch-features launch-step">
          <li>
            <svg
              className="i"
              data-feature="flags"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* Sized against the two circles beside it rather than drawn on
                  its own: they span y 3.6-20.4 at r=8.4, and a flag with a
                  short banner read visibly lighter than them at 24px. The pole
                  stays left, which is what makes it a flag rather than a
                  pennant, but the banner is deep enough to carry the same
                  optical weight. */}
              <path d="M5.75 20.75V3.9" />
              <path d="M5.75 4.6h12.5l-2.3 4 2.3 4H5.75" />
            </svg>
            <span className="k">Flags</span>
            <span className="v">raised when a value crosses your threshold</span>
          </li>
          <li>
            <svg
              className="i"
              data-feature="availability"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.4" />
              <path d="M8.3 12.3l2.6 2.5 4.8-5.1" />
            </svg>
            <span className="k">Availability</span>
            <span className="v">who can train, and what they can&rsquo;t do</span>
          </li>
          <li>
            <svg
              className="i"
              data-feature="this-morning"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.4" />
              <path d="M12 7.3V12l3.3 2" />
            </svg>
            <span className="k">This morning</span>
            <span className="v">entries against each athlete&rsquo;s baseline</span>
          </li>
        </ul>

        {/* Kept, and moved below the grid rather than deleted with the eyebrow.
            The brief pins wordmark -> headline -> grid and says nothing about
            what follows, and this is the only sentence on the public page that
            states the medical-visibility rule. */}
        <p className="launch-claim-sub launch-step">
          Coaching staff see availability and restrictions; diagnosis and treatment
          notes stay with medical staff and the athlete.
        </p>
      </section>

      <div className="launch-page">
        {/* ATH-ADULT-01, 2026-09-11. "For athletes and club staff", not
            "Athlete and staff" — the review called the old line systems
            vocabulary (F6). And one sentence, not two: "Your morning entry
            takes 45 seconds" answered a first-run question on a screen that a
            returning person meets at a bad moment (F1, the review's highest
            finding). The line that survives is the one that answers the
            question they actually have. */}
        <div className="launch-step launch-head">
          <p className="eyebrow launch-narrow-only">For athletes and club staff</p>
          <h1 className="launch-title">Sign in</h1>
          <p className="launch-sub">Use the email address your club invited you on.</p>
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
