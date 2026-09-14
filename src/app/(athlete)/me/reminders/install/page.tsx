import Link from 'next/link';
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
      <div className="sheet-head">
        <Link href="/me/notifications" className="sheet-x" aria-label="Back to Reminders">
          <span aria-hidden="true">←</span>
        </Link>
        <h1 className="t">Add to Home Screen</h1>
        <span style={{ width: 'var(--tap-min)' }} />
      </div>
      <InstallCard canonical />
    </>
  );
}
