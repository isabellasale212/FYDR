/* The athlete's own "don't show me leaderboards" preference.
 *
 * This is a DISPLAY preference and nothing more. It hides the leaderboard
 * surfaces inside this athlete's own app; it does not remove them from any
 * board, does not change what other athletes see, and writes nothing to the
 * database. The real mechanisms for not appearing on a board are separate
 * and deliberately untouched by this:
 *   - leaderboard_opt_outs, the opt-out (adults' only exit)
 *   - athlete_consents.leaderboard_visibility, the under-18 opt-in gate
 * Both are enforced server-side in compute_leaderboard. The club asked to
 * remove the athlete's ability to leave a board entirely; that is refused
 * on GDPR Article 7(3) grounds and by a hard `check (allow_opt_out)` in
 * migration 0016, whose own comment says "a leaderboard nobody can leave is
 * not offered by this product". This toggle is the part of that request
 * that CAN be honoured: an athlete who simply does not want to look at
 * rankings can turn them off for themselves.
 *
 * Deliberately localStorage, not a column: it changes nothing anyone else
 * can observe, so it does not need to be authoritative, auditable, or
 * synced. The cost is that it is per-device, which the UI states plainly
 * rather than implying it follows them everywhere.
 */

export const LEADERBOARD_HIDDEN_KEY = 'fydr-hide-leaderboards';

/** Safe on the server, in private windows, and where site data is blocked —
 *  every one of those either throws or has no localStorage at all, and the
 *  honest default in each case is "not hidden". */
export function readLeaderboardsHidden(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LEADERBOARD_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLeaderboardsHidden(hidden: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (hidden) window.localStorage.setItem(LEADERBOARD_HIDDEN_KEY, '1');
    else window.localStorage.removeItem(LEADERBOARD_HIDDEN_KEY);
  } catch {
    /* Storage unavailable. The toggle still reflects the session's own state
     * in React; it simply will not survive a reload. Silently degrading beats
     * an error dialog for a cosmetic preference. */
  }
}
