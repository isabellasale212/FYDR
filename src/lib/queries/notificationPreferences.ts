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
 * club, and a scheduler that would un-mute on a date. "Mute everything" is a
 * bulk action, but since migration 0103 it is a REMEMBERED one: each row
 * keeps what it was before (pre_mute_push / pre_mute_email) and when it was
 * muted (muted_at), and un-muting restores that — see muteAll / unmuteAll.
 */

/** `muted`: the row holds a pre-mute snapshot (migration 0103's muted_at), so
 *  "Turn notifications back on" is the right label — on this device and on
 *  any other, which the client-only flag it replaced never managed. */
export type PreferenceState = { push: boolean | null; email: boolean | null; muted: boolean };

export async function fetchMyNotificationPreferences(db: Db, userId: string): Promise<Map<string, PreferenceState>> {
  const { data, error } = await db
    .from('notification_preferences')
    .select('notification_id, push_enabled, email_enabled, muted_at')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const map = new Map<string, PreferenceState>();
  for (const row of data ?? []) {
    map.set(row.notification_id, { push: row.push_enabled, email: row.email_enabled, muted: row.muted_at !== null });
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
  /* A chip changed by hand is the athlete's newer intent, so it also clears
     any pre-mute snapshot on the row (§0z): "Turn notifications back on"
     will then leave this type exactly as the athlete just set it. */
  const base = { org_id: orgId, user_id: userId, notification_id: notificationId, pre_mute_push: null, pre_mute_email: null, muted_at: null };
  const { error } =
    channel === 'push'
      ? await db.from('notification_preferences').upsert({ ...base, push_enabled: enabled }, { onConflict: 'user_id,notification_id' })
      : await db.from('notification_preferences').upsert({ ...base, email_enabled: enabled }, { onConflict: 'user_id,notification_id' });
  return { error: error?.message ?? null };
}

/* THE MUTE PAIR RESTORES, IT DOES NOT RESET — §0z, decided by Isabella
 * 2026-09-11, built 2026-09-12 with migration 0103. It used to upsert
 * all-false then all-true without reading the rows it overwrote, so four
 * types that default to off, and any the athlete had turned off by choice,
 * came back ON after "Turn notifications back on" — including email on types
 * with no email channel. Both halves now run in the database
 * (mute_notifications / unmute_notifications), own rows only, atomic per
 * call, and are pinned by supabase/tests/590_notification_mute_restore_test.sql:
 * off-before stays off, on-before comes back on, a chip changed by hand
 * while muted stays as the athlete set it, a never-touched type goes back to
 * inheriting, and pressing Mute twice keeps the first snapshot.
 *
 * `orgId` and `userId` are no longer needed by the write — the functions
 * resolve the caller from the JWT — and are kept in the signature so the
 * call sites read the same as every other writer here. */
export async function muteAll(db: Db, _orgId: string, _userId: string, notificationIds: readonly string[]): Promise<{ error: string | null }> {
  const { error } = await db.rpc('mute_notifications', { p_notification_ids: [...notificationIds] });
  return { error: error?.message ?? null };
}

/** Restores each muted type to its recorded state and returns what it
 *  restored, so the form can render the truth without a refetch. A type with
 *  no snapshot (never muted, or changed by hand since) is absent from the
 *  result and untouched. */
export async function unmuteAll(
  db: Db,
  _orgId: string,
  _userId: string,
  notificationIds: readonly string[],
): Promise<{ error: string | null; restored: Record<string, PreferenceState> }> {
  const { data, error } = await db.rpc('unmute_notifications', { p_notification_ids: [...notificationIds] });
  const restored: Record<string, PreferenceState> = {};
  for (const row of data ?? []) {
    restored[row.notification_id] = { push: row.push_enabled, email: row.email_enabled, muted: false };
  }
  return { error: error?.message ?? null, restored };
}
