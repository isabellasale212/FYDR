import { BackButton } from '@/components/BackButton/BackButton';
import { AthleteTabBar } from '@/components/AthleteTabBar/AthleteTabBar';
import { requireAthlete } from '@/lib/session';

/** The athlete shell, ATHLETE-APP-SPEC.md §2/§4: a fixed header (rendered
 *  per page, since the title and status pill are per-tab), a scrolling
 *  body, a fixed tab bar — nothing else. Sign out and the theme toggle used
 *  to live in a persistent footer below the tab bar, which the spec has no
 *  room for (§4's shell is exactly those three regions); both moved to the
 *  Me tab, where §12's own settings list already has a real "Log out" row
 *  and the theme toggle now sits beside that page's own header, the same
 *  placement my-programme and notifications already used for it. Phase 1a
 *  ships this as responsive mobile web in the same Next.js application;
 *  ADR-002 still has the phone app as Expo, and these routes are the same
 *  paths that app will use. */
export default async function AthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAthlete();

  return (
    <div className="phone">
      <main className="phone-body" id="main">
        <BackButton />
        {children}
      </main>
      <AthleteTabBar />
    </div>
  );
}
