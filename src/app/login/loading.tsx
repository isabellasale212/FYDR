import { FydrLockup } from '@/components/FydrLockup/FydrLockup';

/** The splash still-frame — the first frame of Fydr App Launch.dc.html's
 *  Splash scene, held.
 *
 *  Deliberately NOT animated. This is shown while the route is still loading,
 *  for an unknown and usually very short time; starting a 1.6-second build
 *  here would mean the lockup restarts the moment the page mounts and plays
 *  the same beats twice. The still frame is what the sequence begins on, so
 *  the handoff into the page is continuous rather than a cut.
 *
 *  Scoped to /login rather than the app root on purpose: a root loading.tsx
 *  would put a full-screen navy splash between the athlete's tabs.
 */
export default function LoginLoading() {
  return (
    <main className="launch launch-splash" aria-busy="true">
      <div className="launch-ground" aria-hidden="true" />
      <div className="launch-lockup">
        <FydrLockup title="Fydr" />
      </div>
    </main>
  );
}
