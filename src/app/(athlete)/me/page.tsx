import Link from 'next/link';
import { AthleteProfileEditForm } from '@/components/AthleteProfileEditForm/AthleteProfileEditForm';
import { AvatarUploadForm } from '@/components/AvatarUploadForm/AvatarUploadForm';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchAthlete } from '@/lib/queries/squad';
import { fetchWellnessByAthlete } from '@/lib/queries/wellness';
import { mondayOf } from '@/lib/queries/schedule';
import { fetchMyBoards } from '@/lib/queries/leaderboards';
import { fetchHealthkitConsent } from '@/lib/queries/healthkit';
import { HealthkitConsentToggle } from '@/components/HealthkitConsentToggle/HealthkitConsentToggle';
import { isPremium } from '@/lib/tier';
import { addDays, BLANK, formatNumber, initials, todayIso } from '@/lib/format';
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

  /* Ninety days, one query, two cards. The week count only needs this week,
     but the latest body mass can be much older than that — an athlete who
     last weighed in a month ago still has a last known weight, and showing a
     dash because the window was seven days would report absence that is not
     there. Bounded at both ends: a future-dated row must not become "the
     latest". */
  const today = todayIso(timezone);
  const weekStart = mondayOf(today);
  const [athlete, userRow, myBoards, healthkit, recentWellness] = await Promise.all([
    fetchAthlete(db, orgId, athleteId),
    db.from('users').select('full_name, phone, avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle(),
    fetchMyBoards(db, orgId, athleteId),
    fetchHealthkitConsent(db, athleteId),
    fetchWellnessByAthlete(db, athleteId, { from: addDays(today, -90), to: today }),
  ]);

  /* Days elapsed so far this week, not seven: on a Wednesday the honest
     denominator is three. Claiming "2 of 7" on a Wednesday reads as five
     missed mornings that have not happened yet. */
  const daysThisWeek =
    Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86400000) + 1;
  const entriesThisWeek = recentWellness.filter(
    (e) => e.entry_date !== null && e.entry_date >= weekStart,
  ).length;
  const latestMass =
    [...recentWellness].reverse().find((e) => e.body_mass_kg !== null)?.body_mass_kg ?? null;

  return (
    <>
      {/* Spec §7.5: this screen's header IS the athlete — a 58px avatar, their
          name at 24/800, and their role beneath it. The "Me" title it replaces
          named the tab, which the tab bar is already doing two inches below,
          and the identity sat in a card of its own underneath it. One header,
          one statement of who this is. */}
      <div className="hd me-hd">
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
            width={58}
            height={58}
          />
        ) : (
          <span
            className="me-avatar"
            aria-hidden="true"
            style={
              userRow.data?.avatar_colour
                ? {
                    background: `var(--group-${userRow.data.avatar_colour.toLowerCase()})`,
                    /* --on-group, not --on-accent: the group palette inverts
                       between themes, so white initials measured under 3:1 on
                       six of its seven colours in dark. Same fix the upload
                       form took. */
                    color: 'var(--on-group)',
                  }
                : undefined
            }
          >
            {initials({ first_name: firstName, last_name: lastName })}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="d">
            {firstName} {lastName}
          </h1>
          {/* Fydr Athlete App.dc.html 23i: position, team and squad number —
              who this athlete is at the club. It read "Jimmy · Europe/London":
              a preferred name they already know and a timezone that is a
              setting, not an identity. Each part is dropped when absent rather
              than printed as a blank, so a squad with no teams set does not
              read "· ·". */}
          <div className="sub">
            {[
              athlete?.position,
              athlete?.team_name,
              athlete?.squad_number !== null && athlete?.squad_number !== undefined
                ? `squad no. ${athlete.squad_number}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Squad details not set'}
          </div>
        </div>
      </div>

      {/* Fydr Athlete App.dc.html 23i: two things an athlete checks about
          themselves, above the settings they rarely touch. Both are read from
          their own check-ins, which is why body mass says self-reported —
          nobody weighed them, they typed it. */}
      <div className="card" style={{ marginTop: 14 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Theme
        </p>
        <ThemeToggle />
      </div>

      <div className="me-stats">
        <div className="card me-stat">
          <p className="eyebrow">This week</p>
          <p className="me-stat-value num">
            {entriesThisWeek} of {daysThisWeek}
          </p>
          <p className="me-stat-sub">wellness entries</p>
        </div>
        <div className="card me-stat">
          <p className="eyebrow">Body mass</p>
          <p className="me-stat-value num">{latestMass !== null ? formatNumber(latestMass, 1) : BLANK}</p>
          <p className="me-stat-sub">
            {latestMass !== null ? 'kg · self-reported' : 'none recorded yet'}
          </p>
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
