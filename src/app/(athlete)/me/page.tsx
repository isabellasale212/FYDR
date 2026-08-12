import Link from 'next/link';
import { AthleteProfileEditForm } from '@/components/AthleteProfileEditForm/AthleteProfileEditForm';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchAthlete } from '@/lib/queries/squad';
import { fetchMyBoards } from '@/lib/queries/leaderboards';
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
  const { db, orgId, athleteId, claims, firstName, lastName, timezone } = await requireAthlete();

  const [athlete, userRow, myBoards] = await Promise.all([
    fetchAthlete(db, orgId, athleteId),
    db.from('users').select('full_name, phone, avatar_url').eq('id', claims.userId).maybeSingle(),
    fetchMyBoards(db, orgId, athleteId),
  ]);

  return (
    <>
      <div className="hd">
        <h1 className="d">Me</h1>
        <ThemeToggle />
      </div>

      <div className="card me-profile" style={{ marginTop: 14 }}>
        <span className="me-avatar" aria-hidden="true">
          {initials({ first_name: firstName, last_name: lastName })}
        </span>
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
        />

        <AthleteProfileEditForm
          userId={claims.userId}
          athleteId={athleteId}
          fullName={userRow.data?.full_name ?? `${firstName} ${lastName}`}
          initialPreferredName={athlete?.preferred_name ?? ''}
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
          {/* No report-a-problem table or write path exists anywhere in
           * this schema (checked live) — this row states that honestly
           * rather than submitting to nowhere. Today's own "Something not
           * right?" card links here via #report. */}
          <div id="report" className="me-row" style={{ cursor: 'default' }}>
            <span className="k">Report a problem</span>
            <span className="v">Not built yet — email your club</span>
          </div>
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

        <section className="card" aria-labelledby="more-title">
          <h2 className="card-title" id="more-title">
            Coming soon
          </h2>
          <p className="cap">Privacy controls are planned for a future update.</p>
        </section>
      </div>

      <p className="me-footer">Fydr v1.0</p>
    </>
  );
}
