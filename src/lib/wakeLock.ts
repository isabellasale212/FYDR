/* Keep the screen on during a gym session, and a short buzz when a set logs
 * — ATH-ADULT-09 C5, approved 2026-09-12. Both feature-detected and both
 * silent when absent: iPhone Safari has Wake Lock (16.4+) and no vibrate;
 * Android Chrome has both; a desktop browser may have neither. Nothing here
 * is allowed to throw into a screen the athlete is logging on.
 *
 * Takes the navigator as an argument so the decisions can be tested with a
 * fake; the logger passes the real one.
 */

type Sentinel = { release: () => Promise<void> };
type WakeLockNavigator = { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };
type VibrateNavigator = { vibrate?: (pattern: number | number[]) => boolean };

/** Ask for the screen to stay on. Null when the browser cannot (no API, or it
 *  refused — a low battery, a hidden tab), never a throw. */
export async function acquireWakeLock(nav: WakeLockNavigator | undefined): Promise<Sentinel | null> {
  if (!nav?.wakeLock) return null;
  try {
    return await nav.wakeLock.request('screen');
  } catch {
    return null;
  }
}

export async function releaseWakeLock(sentinel: Sentinel | null): Promise<void> {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    /* Already released (the browser drops it when the tab hides). */
  }
}

/** A short confirmation buzz. 10 ms: felt, not heard. */
export function buzz(nav: VibrateNavigator | undefined, ms = 10): boolean {
  if (!nav?.vibrate) return false;
  try {
    return nav.vibrate(ms);
  } catch {
    return false;
  }
}
