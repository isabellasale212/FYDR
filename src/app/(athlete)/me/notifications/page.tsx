import Link from 'next/link';
import { NotificationPreferencesForm } from '@/components/NotificationPreferencesForm/NotificationPreferencesForm';
import { fetchAthlete } from '@/lib/queries/squad';
import { fetchMyNotificationPreferences } from '@/lib/queries/notificationPreferences';
import { ATHLETE_CATALOGUE } from '@/lib/notifications/catalogue';
import { ageFrom } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Notifications · Fydr' };

/** docs/08-notifications.md §2 (Athlete table) and §5.2 (the mute rule) —
 *  see lib/queries/notificationPreferences.ts's header for exactly what's
 *  real here (the settings, saved for real) and what isn't (nothing sends
 *  a push or an email yet). §5.4's under-18 floor is enforced from the
 *  athlete's own date_of_birth, already on file — a real age check, not a
 *  placeholder for one. */
export default async function AthleteNotificationsPage() {
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();

  const [athlete, preferences] = await Promise.all([
    fetchAthlete(db, orgId, athleteId),
    fetchMyNotificationPreferences(db, claims.userId),
  ]);

  const age = ageFrom(athlete?.date_of_birth ?? null, timezone);
  const isMinor = age !== null && age < 18;

  const initialPreferences = Object.fromEntries(preferences);

  return (
    <>
      <div className="hd">
        <h1 className="d">Notifications</h1>
      </div>
      <p className="tiny" style={{ margin: '4px 0 14px' }}>
        <Link href="/me">← Me</Link>
      </p>

      <NotificationPreferencesForm
        orgId={orgId}
        userId={claims.userId}
        entries={ATHLETE_CATALOGUE}
        initialPreferences={initialPreferences}
        showMuteAll
        isMinor={isMinor}
      />
    </>
  );
}
