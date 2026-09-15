import { GlobalOptOutToggle } from '@/components/GlobalOptOutToggle/GlobalOptOutToggle';
import { HideLeaderboardsToggle } from '@/components/HideLeaderboardsToggle/HideLeaderboardsToggle';
import { fetchMyOptOuts } from '@/lib/queries/leaderboards';
import { ageFrom } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Leaderboards · Me · Fydr' };

/** screens/leaderboards.md "Athletes under 18" and the global opt-out in "Me →
 *  Privacy". Route per 20-route-map.md line 83, /me/leaderboards.
 *
 *  Isabella, 2026-09-13 (migration 0116): the under-18 self-consent toggle is
 *  removed. A minor is never named on a ranked board and has no opt-in path
 *  until the guardian route (S9) exists — a sixteen-year-old tapping
 *  themselves onto a board while parental_consent_* is written by nothing was
 *  consent that is not consent. The card says the rule; it offers no control. */
export default async function MyLeaderboardsSettingsPage() {
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();

  const [dob, optOuts] = await Promise.all([
    db.from('athletes').select('date_of_birth').eq('id', athleteId).maybeSingle(),
    fetchMyOptOuts(db, orgId, athleteId),
  ]);

  const age = ageFrom(dob.data?.date_of_birth ?? null, timezone);
  const isMinor = age === null || age < 18;
  const globallyOptedOut = optOuts.some((o) => o.leaderboard_id === null);

  return (
    <>
      {/* The page title only: the layout's Back button is the one back control
          on every athlete page (Isabella, 15 Sept 2026, mobile queue #3). */}
      <div className="hd">
        <h1 className="d">Leaderboards</h1>
      </div>

      {isMinor ? (
        <section className="card" aria-labelledby="minor-title">
          <h2 className="card-title" id="minor-title">
            Being named on a leaderboard
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            Because you&rsquo;re under 18, you are not named on any leaderboard, and nothing
            here can change that. Your results are still recorded and still yours to see
            in My data. When a parent or guardian can record their consent, that will be
            the only way to be named, and it will not be a switch on this screen.
          </p>
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
      <section className="card" aria-labelledby="hide-title">
        <h2 className="card-title" id="hide-title">
          Seeing leaderboards
        </h2>
        <p className="import-sub">
          Turn these off if you would rather not see rankings. This changes what you
          see, not whether you are on a board.
        </p>
        <HideLeaderboardsToggle />
      </section>

      {/* The opt-out is the adult's exit. A minor is never on a board (0116), so
          there is nothing to leave and the control is absent rather than
          offered as a dead switch. */}
      {isMinor ? null : (
        <>
          <section className="card" aria-labelledby="global-title">
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
      )}
    </>
  );
}
