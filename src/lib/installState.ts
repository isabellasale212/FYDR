/* PATTERN-S9 artboard 6: how the app is running, read on the client. Pure
 * where it can be, so the guard can hold the platform rule. */

export type Platform = 'ios' | 'android' | 'desktop' | 'other';
export type DisplayMode = 'standalone' | 'browser';

/** iPhone and iPad (which reports itself as a Mac with touch since iPadOS 13),
 *  Android, or a desktop. The user agent is read for the two words the card
 *  needs and nothing else is kept. */
export function platformFrom(ua: string, maxTouchPoints = 0): Platform {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s) || (/macintosh/.test(s) && maxTouchPoints > 1)) return 'ios';
  if (/android/.test(s)) return 'android';
  if (/windows|macintosh|linux|cros/.test(s)) return 'desktop';
  return 'other';
}

/** Standalone is what "added to the Home Screen" means at runtime: the
 *  manifest's display mode is honoured, or Safari's own navigator.standalone. */
export function displayModeFrom(o: { matchesStandalone: boolean; navigatorStandalone: boolean | undefined }): DisplayMode {
  return o.matchesStandalone || o.navigatorStandalone === true ? 'standalone' : 'browser';
}

/** Whether this browser could hold a push subscription at all. On iOS that is
 *  only true from the Home Screen (iOS 16.4+); in a Safari tab it is false,
 *  which is the whole reason artboard 6 exists. */
export function pushSupportedFrom(o: { hasPushManager: boolean; hasServiceWorker: boolean }): boolean {
  return o.hasPushManager && o.hasServiceWorker;
}

export const INSTALL_SESSION_KEY = 'fydr-device-recorded';
