import type { Db } from './groups';
import type { NotificationChannel } from '@/lib/notifications/catalogue';

/* docs/08-notifications.md, settings half only — see
 * lib/notifications/catalogue.ts's header for the catalogue itself. This
 * file is the read/write layer for notification_preferences, migration
 * 0008's own table: per user, per notification, per channel, "null means
 * inherit" for push_enabled/email_enabled. No new migration needed — the
 * table and its own-row-only RLS policy already existed, unused until now.
 *
 * What this build does not do, and why it's a different gap than the usual
 * "not enough time" one: nothing in this codebase actually sends a push or
 * an email. There's no Expo push credential, no APNs/FCM key, no email
 * provider account, in .env.local or anywhere else — the same category of
 * external-dependency gap this session already names for scheduled report
 * delivery. Saving a preference here is real and will be respected the
 * moment a real send pipeline exists; nothing currently reads these rows to
 * decide whether to send something, because nothing sends anything yet.
 *
 * Also not built: quiet hours (the table has the columns; no UI sets them),
 * the organisation-level default/lock an admin would set for the whole
 * club, and a persisted "muted until this date" state for the athlete mute
 * rule (§5.2) — the table has no such column, so "mute everything" here is
 * a one-click bulk toggle of every disableable row, not a dated pause a
 * scheduler would later un-mute automatically.
 */

export type PreferenceState = { push: boolean | null; email: boolean | null };

export async function fetchMyNotificationPreferences(db: Db, userId: string): Promise<Map<string, PreferenceState>> {
  const { data, error } = await db
    .from('notification_preferences')
    .select('notification_id, push_enabled, email_enabled')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const map = new Map<string, PreferenceState>();
  for (const row of data ?? []) {
    map.set(row.notification_id, { push: row.push_enabled, email: row.email_enabled });
  }
  return map;
}

export async function setNotificationChannel(
  db: Db,
  orgId: string,
  userId: string,
  notificationId: string,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<{ error: string | null }> {
  const base = { org_id: orgId, user_id: userId, notification_id: notificationId };
  const { error } =
    channel === 'push'
      ? await db.from('notification_preferences').upsert({ ...base, push_enabled: enabled }, { onConflict: 'user_id,notification_id' })
      : await db.from('notification_preferences').upsert({ ...base, email_enabled: enabled }, { onConflict: 'user_id,notification_id' });
  return { error: error?.message ?? null };
}

/** The mute-rule bulk action, §5.2 — every row in `notificationIds` gets
 *  both channels turned off in one round trip. Not the persisted, dated
 *  pause the spec describes; see this file's own header for why. */
export async function muteAll(db: Db, orgId: string, userId: string, notificationIds: readonly string[]): Promise<{ error: string | null }> {
  const rows = notificationIds.map((id) => ({ org_id: orgId, user_id: userId, notification_id: id, push_enabled: false, email_enabled: false }));
  const { error } = await db.from('notification_preferences').upsert(rows, { onConflict: 'user_id,notification_id' });
  return { error: error?.message ?? null };
}

export async function unmuteAll(db: Db, orgId: string, userId: string, notificationIds: readonly string[]): Promise<{ error: string | null }> {
  const rows = notificationIds.map((id) => ({ org_id: orgId, user_id: userId, notification_id: id, push_enabled: true, email_enabled: true }));
  const { error } = await db.from('notification_preferences').upsert(rows, { onConflict: 'user_id,notification_id' });
  return { error: error?.message ?? null };
}
