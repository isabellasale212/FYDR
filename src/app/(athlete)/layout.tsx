import type { Viewport } from 'next';
import { BackButton } from '@/components/BackButton/BackButton';
import { AthleteTabBar } from '@/components/AthleteTabBar/AthleteTabBar';
import { requireAthlete } from '@/lib/session';
import { DeviceBeacon } from '@/components/DeviceBeacon/DeviceBeacon';

/** The athlete app stops behaving like a web page (Isabella, 15 Sept 2026,
 *  mobile queue #1): pinch zoom is capped at 2× rather than blocked —
 *  maximum-scale=1 or user-scalable=no is a WCAG 1.4.4 failure, and this
 *  product has just spent a week on accessibility defects — and the
 *  accidental double-tap zoom is prevented by `touch-action: manipulation`
 *  on the shell (base.css .phone), which removes the double-tap gesture and
 *  nothing else. viewport-fit=cover carried from the root layout (P5). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 2,
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
      <main className="phone-body" id="main">
        <BackButton />
        {children}
      </main>
      <AthleteTabBar />
    </div>
  );
}
