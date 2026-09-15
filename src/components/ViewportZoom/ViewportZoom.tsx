'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { displayModeFrom } from '@/lib/installState';
import { browserViewportContent } from '@/lib/viewportMeta';

/* The athlete viewport's zoom cap is server-rendered (lib/viewportMeta.ts
 * says why: iOS settles the viewport at parse, and the installed app must
 * never depend on a client rewrite). This relaxes it in a BROWSER TAB only —
 * the display mode is a client fact, and the direction "cap in the HTML,
 * lifted in a tab" is the one that fails safe: if this never runs, the app
 * is an app and a tab is capped until it does. Re-applied on every
 * navigation in case the head is re-rendered with the layout's value. In
 * standalone — the manifest's mode honoured, or Safari's
 * navigator.standalone — nothing is touched. Renders nothing. */
export function ViewportZoom() {
  const pathname = usePathname();
  useEffect(() => {
    const mode = displayModeFrom({
      matchesStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    });
    if (mode === 'standalone') return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const relaxed = browserViewportContent(meta.content);
    if (relaxed !== meta.content) meta.content = relaxed;
  }, [pathname]);
  return null;
}
