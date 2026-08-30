import Link from 'next/link';
import { LeaderboardConsentToggle } from '@/components/LeaderboardConsentToggle/LeaderboardConsentToggle';
import { GlobalOptOutToggle } from '@/components/GlobalOptOutToggle/GlobalOptOutToggle';
import { HideLeaderboardsToggle } from '@/components/HideLeaderboardsToggle/HideLeaderboardsToggle';
import { fetchLeaderboardConsent, fetchMyOptOuts } from '@/lib/queries/leaderboards';
import { ageFrom } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Leaderboards · Me · Fydr' };

/** screens/leaderboards.md "Athletes under 18: opt-in, not opt-out" and the global
 *  opt-out in "Me → Privacy". Route per 20-route-map.md line 83, /me/leaderboards. */
export default async function MyLeaderboardsSettingsPage() {
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();

  const [dob, consent, optOuts] = await Promise.all([
    db.from('athletes').select('date_of_birth').eq('id', athleteId).maybeSingle(),
    fetchLeaderboardConsent(db, athleteId),
    fetchMyOptOuts(db, orgId, athleteId),
  ]);

  const age = ageFrom(dob.data?.date_of_birth ?? null, timezone);
  const isMinor = age === null || age < 18;
  const globallyOptedOut = optOuts.some((o) => o.leaderboard_id === null);

  return (
    <>
      <div className="sheet-head">
        <Link href="/me" className="sheet-x" aria-label="Back to Me">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="t">Leaderboards</h1>
        <span style={{ width: 44 }} />
      </div>

      {isMinor ? (
        <section className="card" aria-labelledby="minor-title">
          <h2 className="card-title" id="minor-title">
            Being named on a leaderboard
          </h2>
          <p className="import-sub">
            Because you&rsquo;re under 18, you are never named on a leaderboard unless
            you choose to be &mdash; that choice is yours alone, and nobody at your club
            can turn it on for you. Turning it off again is just as easy, any time.
          </p>
          <LeaderboardConsentToggle orgId={orgId} athleteId={athleteId} initialGranted={consent.granted} />
        </section>
      ) : (
        <section className="card">
          <h2 className="card-title">Being named on a leaderboard</h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            You appear on any leaderboard your club publishes and includes you in,
            unless you leave it. Leave one from the board itself, or leave every board
            at once below.
          </p>
        </section>
      )}

      {/* Ordered deliberately: hiding is the lighter, reversible, local
       *  choice, so it comes first. Leaving is the real one with real
       *  consequences and sits below it. The club asked for leaving to be
       *  removed entirely — refused: migration 0016 carries a hard
       *  `check (allow_opt_out)` on GDPR Article 7(3) grounds, and for an
       *  adult the opt-out is their only exit (the consent toggle above
       *  renders for minors only). */}
      <section className="card" style={{ marginTop: 14 }} aria-labelledby="hide-title">
        <h2 className="card-title" id="hide-title">
          Seeing leaderboards
        </h2>
        <p className="import-sub">
          Turn these off if you would rather not see rankings. This changes what you
          see, not whether you are on a board.
        </p>
        <HideLeaderboardsToggle />
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="global-title">
        <h2 className="card-title" id="global-title">
          Every leaderboard at once
        </h2>
        <p className="import-sub">
          Do not include me on any leaderboard, including ones published later.
        </p>
        <GlobalOptOutToggle
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          initialOptedOut={globallyOptedOut}
        />
      </section>

      <p className="cap">
        Leaving a leaderboard removes your name and value from what other athletes see.
        It does not remove your own measurements from your own data.
      </p>
    </>
  );
}
