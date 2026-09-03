import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm/LoginForm';
import { FydrLockup } from '@/components/FydrLockup/FydrLockup';

export const metadata = { title: 'Sign in · Fydr' };

/** Fydr App Launch.dc.html — the whole launch sequence lands on this one
 *  route, because that is how the scene is authored: Splash, Stop, Handoff,
 *  SignIn and Rest all happen on a single screen, with the lockup travelling
 *  from the middle of a navy splash to the top of the sign-in page. A
 *  loading.tsx that unmounts cannot hand an element over to a page, so the
 *  page owns all five beats and loading.tsx holds the splash still-frame it
 *  starts from.
 *
 *  The form is untouched and interactive from the first frame — the sequence
 *  is CSS on elements that are already in the DOM, so an athlete who opens
 *  this and types immediately never waits for it. Under prefers-reduced-motion
 *  nothing moves at all (base.css §5).
 *
 *  TWO THINGS THE SCENE SAYS THAT THIS BUILD CANNOT.
 *
 *  "Email me a sign-in link" is not built. There is no OTP or magic-link
 *  infrastructure anywhere in this app (LoginForm is email + password), so the
 *  scene's link would be a control that does nothing. The real secondary
 *  action — "Forgot your password?", which goes to /login/reset — takes its
 *  place inside the form.
 *
 *  "Staff sign in on the web at app.fydr.co" is false here: staff sign in on
 *  THIS screen, at this route. The footer keeps the line the sign-in page is
 *  actually required to carry instead.
 */
export default function LoginPage() {
  return (
    <main className="launch" data-animate="" id="main">
      <div className="launch-ground" aria-hidden="true" />

      <div className="launch-lockup">
        <FydrLockup animate title="Fydr" />
      </div>

      <div className="launch-page">
        <div className="launch-step" style={{ display: 'grid', gap: 8 }}>
          {/* The scene reads "Ashfield RFC · athlete app". Nobody is signed in
              yet, so the club is not knowable here — and this screen is where
              staff sign in too. What is true of everyone reading it. */}
          <p className="eyebrow">Athlete and staff</p>
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
          Your wellness answers are visible to your coaching and medical staff. Injury
          detail is medical only.
        </p>
      </div>
    </main>
  );
}
