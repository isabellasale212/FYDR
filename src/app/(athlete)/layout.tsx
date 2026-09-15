import type { Viewport } from 'next';
import { BackButton } from '@/components/BackButton/BackButton';
import { AthleteTabBar } from '@/components/AthleteTabBar/AthleteTabBar';
import { requireAthlete } from '@/lib/session';
import { DeviceBeacon } from '@/components/DeviceBeacon/DeviceBeacon';
import { StandaloneViewport } from '@/components/StandaloneViewport/StandaloneViewport';
import { AthleteFooterDock } from '@/components/AthleteFooterDock/AthleteFooterDock';

/** The athlete app behaves like an app, not a web page (Isabella, 15 Sept
 *  2026). Two gestures, two mechanisms, and both are needed — blocking one
 *  and not the other is why this kind of change looks as if it did nothing:
 *
 *    - DOUBLE-TAP zoom is dead by `touch-action: manipulation` on the shell
 *      (base.css .phone), independent of the viewport;
 *    - PINCH zoom is dead in the INSTALLED app only: this meta carries no cap,
 *      and StandaloneViewport rewrites it on the client with maximum-scale=1
 *      and user-scalable=no when the app is standalone, keeping
 *      viewport-fit=cover (P5). A Safari tab ignores those directives by
 *      design, so the browser still zooms — the platform's difference, not a
 *      bug.
 *
 *  Earlier the same day this capped the pinch at 2× rather than blocking it
 *  (the builder's recommendation, WCAG 1.4.4); Isabella tested the installed
 *  app and ruled for the block. Recorded as a deliberate divergence in
 *  06-design-system.md §11.7 so nobody removes it as a mistake. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** The athlete shell, ATHLETE-APP-SPEC.md §2/§4: a fixed header (rendered
 *  per page, since the title and status pill are per-tab), a scrolling
 *  body, a fixed tab bar — nothing else. Sign out and the theme toggle used
 *  to live in a persistent footer below the tab bar, which the spec has no
 *  room for (§4's shell is exactly those three regions); both moved to the
 *  Me tab, where §12's own settings list already has a real "Log out" row
 *  and the theme toggle now sits beside that page's own header, the same
 *  placement my-programme and notifications already used for it. This is
 *  the athlete app: an installable web app in the same Next.js application
 *  (docs/platform-decision.md, 2026-09-13 — one web product, two installable
 *  apps, no native app and none planned; ADR-002's Expo plan is superseded). */
export default async function AthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* The shell only; each page decides for itself, and the consent flow's
     own pages must render for an undecided athlete (PATTERN-S9). */
  await requireAthlete({ allowUndecided: true });

  return (
    <div className="phone">
      {/* PATTERN-S9: how this app is running, once per session (0121). */}
      <DeviceBeacon />
      <StandaloneViewport />
      {/* The docked footer's measured height, for the body's clearance. */}
      <AthleteFooterDock />
      <main className="phone-body" id="main">
        <BackButton />
        {children}
      </main>
      <AthleteTabBar />
    </div>
  );
}
