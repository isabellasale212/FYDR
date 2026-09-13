import type { MetadataRoute } from 'next';

/** The web app manifest, and the fourth of the four places a browser looks for
 *  this product's icon. Until 2026-09-07 all four were empty: `/favicon.ico`,
 *  `/icon.png`, `/icon.svg`, `/apple-icon.png`, `/apple-touch-icon.png`,
 *  `/opengraph-image.png`, `/manifest.webmanifest` and `/site.webmanifest` every
 *  one returned 404 on production, so every tab showed the browser's generic
 *  globe and every shared link previewed with nothing at all.
 *
 *  WHY THIS FILE AND NOT A public/site.webmanifest. Next resolves the icon
 *  paths and the content type itself from this route, so the manifest cannot
 *  drift out of step with the files beside it the way a hand-written JSON copy
 *  would — which is the failure this whole audit was about.
 *
 *  `display: standalone` is deliberate and not aspirational: both apps are
 *  installable web apps (docs/platform-decision.md, 2026-09-13 — no native
 *  app, none planned), so an athlete adding Fydr to their home screen is THE
 *  path, and it must open without browser chrome. What this manifest still
 *  lacks against that decision is inventoried under PATTERN-S11. The colours are the icon tile's
 *  own ground, so the splash a phone generates matches the icon it generates
 *  it from rather than flashing white first. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fydr',
    short_name: 'Fydr',
    description: 'Athlete performance management for sports clubs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#202b4e',
    theme_color: '#202b4e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
