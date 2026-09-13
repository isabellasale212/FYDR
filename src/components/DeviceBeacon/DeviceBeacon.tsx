'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { INSTALL_SESSION_KEY, displayModeFrom, platformFrom, pushSupportedFrom } from '@/lib/installState';

/** PATTERN-S9: once per session start, tell the club how this app is running
 *  — platform, standalone or browser, push-capable — through
 *  record_athlete_device (0121). Nothing about the phone itself is sent. The
 *  staff reachability figure reads the rows; the install card reads the
 *  same facts locally. Failures are silent: a beacon that could not send is
 *  not a thing the athlete can act on. */
export function DeviceBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(INSTALL_SESSION_KEY) === '1') return;
    } catch {
      /* Storage blocked: record anyway, once per page load. */
    }
    const platform = platformFrom(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    const displayMode = displayModeFrom({
      matchesStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    });
    const pushSupported = pushSupportedFrom({ hasPushManager: 'PushManager' in window, hasServiceWorker: 'serviceWorker' in navigator });
    void createClient()
      .rpc('record_athlete_device', { p_platform: platform, p_display_mode: displayMode, p_push_supported: pushSupported })
      .then(() => {
        try {
          sessionStorage.setItem(INSTALL_SESSION_KEY, '1');
        } catch {
          /* ignore */
        }
      });
  }, []);
  return null;
}
