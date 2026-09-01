import Link from 'next/link';
import { AthleteProfileEditForm } from '@/components/AthleteProfileEditForm/AthleteProfileEditForm';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchAthlete } from '@/lib/queries/squad';
import { fetchMyBoards } from '@/lib/queries/leaderboards';
import { fetchHealthkitConsent } from '@/lib/queries/healthkit';
import { HealthkitConsentToggle } from '@/components/HealthkitConsentToggle/HealthkitConsentToggle';
import { isPremium } from '@/lib/tier';
import { initials } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Me · Fydr' };

/** screens/settings.md, the athlete's Me tab. Same scope note as the staff
 *  Settings screen: password change is what Phase 0 actually asks for here.
 *  "Export my data" was added once 09-security-and-compliance.md's Article
 *  20 gave it a concrete, small shape — see
 *  src/app/(athlete)/me/export/route.ts. Notifications followed once
 *  08-notifications.md's own catalogue gave it a real shape — see
 *  src/app/(athlete)/me/notifications/page.tsx for what's real there and
 *  what still isn't (nothing sends a push or an email yet). Profile
 *  editing followed once migrations 0027-0029 gave preferred_name a real,
 *  database-backed write path — see
 *  src/components/AthleteProfileEditForm/AthleteProfileEditForm.tsx and
 *  lib/queries/profile.ts for what's editable and what still isn't (legal
 *  name, date of birth, position, squad number). A real photo upload
 *  followed once migration 0030 gave avatar_url a Storage bucket to point
 *  at (see lib/queries/avatar.ts). Privacy controls are still named
 *  honestly as not built. */
export default async function MePage() {
  const { db, orgId, athleteId, claims, firstName, lastName, timezone, tier } = await requireAthlete();

  const [athlete, userRow, myBoards, healthkit] = await Promise.all([
    fetchAthlete(db, orgId, athleteId),
    db.from('users').select('full_name, phone, avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle(),
    fetchMyBoards(db, orgId, athleteId),
    fetchHealthkitConsent(db, athleteId),
  ]);

  return (
    <>
      <div className="hd">
        <h1 className="d">Me</h1>
        <ThemeToggle />
      </div>

      <div className="card me-profile" style={{ marginTop: 14 }}>
        {/* avatar_url was fetched and handed to AvatarUploadForm below, but
         *  this header always drew initials regardless — so an athlete who
         *  uploaded a photo still saw their initials here (and on Today).
         *  The photo when there is one, initials only as the fallback. */}
        {userRow.data?.avatar_url ? (
          /* Supabase Storage URL, already public and correctly sized by the
           * uploader. next/image would need a remotePatterns entry for a host
           * that varies per project, for a 46px glyph. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="me-avatar"
            src={userRow.data.avatar_url}
            alt=""
            width={46}
            height={46}
          />
        ) : (
          <span
            className="me-avatar"
            aria-hidden="true"
            style={
              userRow.data?.avatar_colour
                ? {
                    background: `var(--group-${userRow.data.avatar_colour.toLowerCase()})`,
                    color: 'var(--on-accent)',
                  }
                : undefined
            }
          >
            {initials({ first_name: firstName, last_name: lastName })}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="nm">
            {firstName} {lastName}
          </div>
          <div className="sub">
            {athlete?.preferred_name ? `${athlete.preferred_name} · ` : ''}
            {timezone}
          </div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <AvatarUploadForm
          orgId={orgId}
          userId={claims.userId}
          fullName={userRow.data?.full_name ?? `${firstName} ${lastName}`}
          initialAvatarUrl={userRow.data?.avatar_url ?? null}
          initialAvatarColour={userRow.data?.avatar_colour ?? null}
        />

        <AthleteProfileEditForm
          userId={claims.userId}
          fullName={userRow.data?.full_name ?? `${firstName} ${lastName}`}
          initialPhone={userRow.data?.phone ?? ''}
        />

        <ChangePasswordForm />

        {/* Settings list, §12 — a row-list card for the flat entry points
         * a settings screen is meant to be, replacing four separate
         * cards. */}
        <div className="card flush">
          <a href="/me/export" className="me-row">
            <span className="k">Export my data</span>
            <span className="v">CSV</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </a>
          <div className="hair" />
          <Link href="/me/notifications" className="me-row">
            <span className="k">Notifications</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
          <div className="hair" />
          <Link href="/me/leaderboards" className="me-row">
            <span className="k">Leaderboards I appear on</span>
            <span className="v">
              {myBoards.length} board{myBoards.length === 1 ? '' : 's'}
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
          <div className="hair" />
          {/* Migration 0040's problem_reports table, 03-flows.md §6. Today's
           * own "Something not right?" card links to the same route. */}
          <Link href="/report-problem" className="me-row">
            <span className="k">Report a problem</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
          <div className="hair" />
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="me-row bad"
              style={{ width: '100%', border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
            >
              <span className="k">Log out</span>
            </button>
          </form>
        </div>

        {/* Apple Health lives HERE, not in club settings. The connection is to
         *  this athlete's own phone, so only they can make it — the staff
         *  Settings screen used to carry a "Connect" button that could not work
         *  by construction, and now points here instead.
         *
         *  Gated, not hidden, on Basic: the design system's own states rule is
         *  "a club should be able to see what it is not buying". */}
        <section className="card" aria-labelledby="health-title">
          <h2 className="card-title" id="health-title">
            Apple Health
          </h2>
          <p className="cap">
            Lets your phone fill in your sleep hours, so the wellness check-in has one less
            question to answer each morning. Resting heart rate and body mass come across too.
          </p>
          {isPremium(tier) ? (
            <>
              <HealthkitConsentToggle orgId={orgId} athleteId={athleteId} initialGranted={healthkit.granted} />
              {/* Said plainly rather than implied. Granting the permission is
               *  real and is recorded; the reading itself needs the native iOS
               *  app, which this build does not have (CLAUDE.md §8) — a browser
               *  cannot reach HealthKit. Better to state that than to leave an
               *  athlete waiting for sleep data that cannot arrive. */}
              <p className="tiny" style={{ color: 'var(--faint)', margin: '8px 0 0' }}>
                {healthkit.granted
                  ? 'Allowed. Nothing is being read yet — that needs the Fydr iPhone app, which is not out. You can withdraw this at any time.'
                  : 'You can turn this off again whenever you like. Your coach is never told either way.'}
              </p>
            </>
          ) : (
            <p className="tiny" style={{ color: 'var(--faint)', margin: '8px 0 0' }}>
              Your club&apos;s plan does not include Apple Health. Nothing is read from your
              phone.
            </p>
          )}
        </section>
      </div>

      <p className="me-footer">Fydr v1.0</p>
    </>
  );
}
