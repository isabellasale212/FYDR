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
 *  `display: standalone` is deliberate and not aspirational: the athlete
 *  surface is mobile web (see CLAUDE.md §8 — the React Native shell in §4 does
 *  not exist), so an athlete adding Fydr to their home screen is a real path,
 *  and it should open without browser chrome. The colours are the icon tile's
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
