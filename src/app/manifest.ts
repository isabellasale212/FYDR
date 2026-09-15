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
 *  lacks against that decision is inventoried under PATTERN-S11.
 *
 *  THE ICONS, 15 Sept 2026 (Isabella, P4 of the overnight queue): the home
 *  screen icon is the full logo — white ground, the outlined Sora wordmark,
 *  the trace ending in the ringed dot — at 192 and 512, as "any" and as
 *  "maskable", the whole logo inside the central 80% so Android's mask (a
 *  circle, a squircle, whatever the launcher draws) never clips it. Full-bleed
 *  squares with no corners baked in. Built by scripts/build-brand-icons.mjs,
 *  which also writes /apple-icon.png and /opengraph-image.png. /icon.svg, the
 *  browser tab, stays the trace-and-dot mark: a wordmark is illegible at 16px.
 *
 *  background_color is the icon's own ground, so the splash a phone generates
 *  from the icon sits the logo on the white it was drawn on; it was the
 *  navy tile's #202b4e while the icon was the navy tile. theme_color keeps
 *  the navy — it colours the browser chrome, not the splash. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fydr',
    short_name: 'Fydr',
    description: 'Athlete performance management for sports clubs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#202b4e',
    icons: [
      /* The same two files under both purposes (the manifest type takes one
         purpose per entry): drawn to the maskable safe zone, they serve as
         "any" with a wider white margin, which is what a launcher shows. */
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
