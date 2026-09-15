import { InstallCard } from '@/components/InstallCard/InstallCard';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Add to Home Screen · Fydr' };

/** PATTERN-S9 artboard 6, the canonical route: Settings › Reminders › Add to
 *  Home Screen. Permanent, reachable by name so a coach can say where it is;
 *  the card on Today is shown once, after the first check-in. */
export default async function InstallPage() {
  await requireAthlete();
  return (
    <>
      {/* The page title only: the layout's Back button is the one back control
          on every athlete page (Isabella, 15 Sept 2026, mobile queue #3). */}
      <div className="hd">
        <h1 className="d">Add to Home Screen</h1>
      </div>
      <InstallCard canonical />
    </>
  );
}
