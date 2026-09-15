'use client';

import { useEffect } from 'react';
import { displayModeFrom } from '@/lib/installState';
import { standaloneViewportContent } from '@/lib/viewportMeta';

/* In the installed app, the viewport stops zooming (Isabella, 15 September
 * 2026; lib/viewportMeta.ts says why and what it does not change). Runs once
 * on mount: the display mode is a client fact — a layout cannot know how it
 * is being shown — and iOS re-reads the meta when its content changes. In a
 * browser tab nothing is touched. Renders nothing. */
export function StandaloneViewport() {
  useEffect(() => {
    const mode = displayModeFrom({
      matchesStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    });
    if (mode !== 'standalone') return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    meta.content = standaloneViewportContent(meta.content);
  }, []);
  return null;
}
