import Link from 'next/link';
import { NotificationPreferencesForm } from '@/components/NotificationPreferencesForm/NotificationPreferencesForm';
import { fetchMyNotificationPreferences } from '@/lib/queries/notificationPreferences';
import { catalogueForRoles } from '@/lib/notifications/catalogue';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Notifications · Fydr' };

/** docs/08-notifications.md §2 (Staff table) — see
 *  lib/queries/notificationPreferences.ts's header for what's real here and
 *  what isn't. No mute-all: the spec's single-button mute rule (§5.2) is
 *  written for the athlete catalogue only, nothing equivalent is specified
 *  for staff. Each role sees only the rows its own audience column names —
 *  a coach doesn't see staff.injury.reported, that's medical's row. */
export default async function StaffNotificationsPage() {
  const { db, orgId, claims } = await requireStaff();

  const entries = catalogueForRoles(claims.roles);
  const preferences = await fetchMyNotificationPreferences(db, claims.userId);
  const initialPreferences = Object.fromEntries(preferences);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Notifications
          </p>
          <h1>Notifications</h1>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <h2>Nothing to configure</h2>
          <p>No staff notifications apply to your role yet.</p>
        </div>
      ) : (
        <NotificationPreferencesForm orgId={orgId} userId={claims.userId} entries={entries} initialPreferences={initialPreferences} showMuteAll={false} isMinor={false} />
      )}
    </>
  );
}
