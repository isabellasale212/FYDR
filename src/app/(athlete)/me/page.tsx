import Link from 'next/link';
import { ChangePasswordForm } from '@/components/ChangePasswordForm/ChangePasswordForm';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchAthlete } from '@/lib/queries/squad';
import { fetchWellnessByAthlete } from '@/lib/queries/wellness';
import { mondayOf } from '@/lib/queries/schedule';
import { fetchLeaderboardConsent, fetchMyOptOuts } from '@/lib/queries/leaderboards';
import { fetchMyNotificationPreferences } from '@/lib/queries/notificationPreferences';
import { addDays, ageFrom, BLANK, formatNumber, initials, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Me · Fydr' };

/** screens/settings.md, the athlete's Me tab.
 *
 *  REDRAWN 2026-09-08 from the redesign reference (screens 11 and 12). The
 *  screen was six stacked cards; it is now the identity header, the theme
 *  control, the two stat tiles, a password form, one settings card and Sign
 *  out. What went, and why each was a removal rather than a restyle:
 *
 *    - The photo/avatar-colour picker and the profile edit form. Both are
 *      real, working write paths (lib/queries/avatar.ts, lib/queries/profile.ts)
 *      and both are gone from the reference. The header still shows an uploaded
 *      photo when there is one; nothing on this screen sets one any more.
 *      NOTE FOR WHOEVER MISSES IT: those components are now unreferenced.
 *      Left in the tree rather than deleted, because "the reference does not
 *      draw it" is a weaker reason to delete a working feature than it is to
 *      stop rendering it.
 *    - The Apple Health marketing card. This finally implements Q-03, decided
 *      today: hide it until ingestion exists. There is no native app to read
 *      HealthKit from, so the card advertised a connection that cannot be made.
 *      The reference replaces it with an "Apple Health / Not connected" row —
 *      that is Q-03's rejected option, not its confirmed one, so the row is NOT
 *      added here. One line to add if that gets overturned.
 *    - The version footer.
 *
 *  WHAT THE REFERENCE DROPS AND THIS KEEPS, both flagged rather than done
 *  quietly, because each is a decision above a drawing:
 *
 *    - The password form. Q-02, decided today: a player "can change their own
 *      password and use the email-linked reset flow, and nothing else affecting
 *      the account itself". Removing the form leaves only the forgotten-password
 *      email, so an athlete who simply wants to change a password they know
 *      would have to claim to have forgotten it.
 *    - "Export my data" (Article 20, see me/export/route.ts) and "Report a
 *      problem". The reference's settings card has neither. Export is statutory;
 *      Report a problem's only other entry point was Today's "Something not
 *      right?" row, which this same redesign removed, so dropping it here would
 *      leave /report-problem with no route in at all. Both are compliance and
 *      reachability, not visual choices.
 *
 *  Every value on the settings card is READ, not written into the markup —
 *  a settings row that always says "On" is a picture of a setting. */
export default async function MePage() {
  const { db, orgId, athleteId, claims, firstName, lastName, timezone } = await requireAthlete();

  /* Ninety days, one query, two cards. The week count only needs this week,
     but the latest body mass can be much older than that — an athlete who
     last weighed in a month ago still has a last known weight, and showing a
     dash because the window was seven days would report absence that is not
     there. Bounded at both ends: a future-dated row must not become "the
     latest". */
  const today = todayIso(timezone);
  const weekStart = mondayOf(today);
  const [athlete, userRow, notificationPrefs, optOuts, leaderboardConsent, recentWellness] =
    await Promise.all([
      fetchAthlete(db, orgId, athleteId),
      db.from('users').select('avatar_url, avatar_colour').eq('id', claims.userId).maybeSingle(),
      fetchMyNotificationPreferences(db, claims.userId),
      fetchMyOptOuts(db, orgId, athleteId),
      fetchLeaderboardConsent(db, athleteId),
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

  /* The reference's row reads "wellness reminder at 07:00". There is no 07:00
     anywhere in the notification system — 08-notifications.md triggers the
     morning prompt on "a wellness entry is expected today", with no time — so
     the row names the notification the catalogue actually defines rather than
     printing a schedule the app does not keep. `push: null` in
     notification_preferences means inherit, and the catalogue's default for
     athlete.wellness.prompt is on. */
  const wellnessPush = notificationPrefs.get('athlete.wellness.prompt')?.push ?? true;

  /* Under 18 is opt-IN and over 18 is opt-OUT (screens/leaderboards.md), so
     this row cannot state one rule for both. Same age source and same
     null-date-of-birth-is-a-minor floor as /me/leaderboards itself, so the row
     and the screen it opens can never disagree. */
  const age = ageFrom(athlete?.date_of_birth ?? null, timezone);
  const isMinor = age === null || age < 18;
  const named = isMinor
    ? leaderboardConsent.granted
    : !optOuts.some((o) => o.leaderboard_id === null);

  return (
    <>
      {/* Spec §7.5: this screen's header IS the athlete — a 58px avatar, their
          name at 24/800, and their role beneath it. The "Me" title it replaces
          named the tab, which the tab bar is already doing two inches below,
          and the identity sat in a card of its own underneath it. One header,
          one statement of who this is. */}
      <div className="hd me-hd">
        {/* The photo when there is one, initials only as the fallback. Nothing
         *  on this screen uploads one any more (see the header note), but an
         *  athlete who uploaded one before must still see it. */}
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
              who this athlete is at the club. Each part is dropped when absent
              rather than printed as a blank, so a squad with no teams set does
              not read "· ·". */}
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

      <div className="card" style={{ marginTop: 14 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Theme
        </p>
        <ThemeToggle />
      </div>

      {/* Fydr Athlete App.dc.html 23i: two things an athlete checks about
          themselves, above the settings they rarely touch. Both are read from
          their own check-ins, which is why body mass says self-reported —
          nobody weighed them, they typed it. */}
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
        <ChangePasswordForm />

        <div className="card flush me-set">
          <Link href="/me/notifications" className="me-row">
            <span className="k">
              Notifications
              <span className="s">morning wellness prompt</span>
            </span>
            <span className="v" data-off={wellnessPush ? undefined : ''}>
              {wellnessPush ? 'On' : 'Off'}
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
          <div className="hair" />
          <Link href="/me/leaderboards" className="me-row">
            <span className="k">
              Leaderboard
              <span className="s">
                {isMinor ? 'you choose to appear' : 'you appear unless you leave'}
              </span>
            </span>
            <span className="v" data-off={named ? undefined : ''}>
              {named ? 'Opted in' : 'Opted out'}
            </span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
          <div className="hair" />
          {/* The one static value on the card, and the honest rendering of it:
              there is no units preference in the schema, the app is kilograms
              and metres everywhere, and adding a column to store a constant
              would be a worse answer than stating the constant. No chevron —
              the row goes nowhere, and a chevron on it would be a lie about a
              tap target. */}
          <div className="me-row">
            <span className="k">
              Units
              <span className="s">weight and distance</span>
            </span>
            <span className="v">kg · m</span>
          </div>
          <div className="hair" />
          <a href="/me/export" className="me-row">
            <span className="k">Export my data</span>
            <span className="v">CSV</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </a>
          <div className="hair" />
          {/* Migration 0040's problem_reports table, 03-flows.md §6. This is
           *  now the ONLY route to it — Today's "Something not right?" row was
           *  removed by the same redesign. */}
          <Link href="/report-problem" className="me-row">
            <span className="k">Report a problem</span>
            <span className="chev" aria-hidden="true">
              ›
            </span>
          </Link>
        </div>

        {/* Spec §7.5/§10: its own full-width button below the settings card, not
            a row inside it — and "Sign out", the verb §10 names, which is also
            the words on the screen it returns you to. */}
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="sign-out">
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
