/* §0z — "Turn notifications back on" restores, it does not reset. Decided by
 * Isabella 2026-09-11, built 2026-09-12 with migration 0103.
 *
 * The behaviour itself is pinned by supabase/tests/590_notification_mute_
 * restore_test.sql, which runs the two database functions against the real
 * schema (own rows only; off-before stays off; on-before comes back on; a
 * chip changed by hand while muted wins; a never-touched type returns to
 * inheriting; a second Mute keeps the first snapshot). That suite needs a
 * database, so this file pins what a source read can: that the app actually
 * calls those functions, that a single-chip write clears the snapshot, that
 * the form derives "muted" from the rows and renders what was restored, and
 * that the migration and the test exist and say the same things.
 */
import { readFileSync, existsSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const queries = strip(read('src/lib/queries/notificationPreferences.ts'));
const form = strip(read('src/components/NotificationPreferencesForm/NotificationPreferencesForm.tsx'));

console.log('the migration and its test');
{
  const mig = 'supabase/migrations/0103_notification_preferences_mute_snapshot.sql';
  assert(existsSync(mig), '0103 exists');
  const sql = read(mig).replace(/--.*$/gm, '');
  assert(/add column pre_mute_push\s+boolean/.test(sql) && /add column pre_mute_email boolean/.test(sql) && /add column muted_at\s+timestamptz/.test(sql), 'it adds the snapshot pair and the muted_at marker');
  assert(/create or replace function public\.mute_notifications\(p_notification_ids text\[\]\)/.test(sql) && /create or replace function public\.unmute_notifications\(p_notification_ids text\[\]\)/.test(sql), 'and the two functions');
  assert(/security invoker/.test(sql) && !/security definer/.test(sql), 'both run as the invoker, under the own-row policy');
  assert(/set pre_mute_push\s*=\s*push_enabled,\s*pre_mute_email\s*=\s*email_enabled,\s*muted_at\s*=\s*now\(\),\s*push_enabled\s*=\s*false,\s*email_enabled\s*=\s*false/.test(sql), 'mute records the current channels before setting them false');
  assert(/and muted_at is null;/.test(sql), 'and only for rows not already muted — a second Mute keeps the first snapshot');
  assert(/set push_enabled\s*=\s*p\.pre_mute_push,\s*email_enabled\s*=\s*p\.pre_mute_email,\s*pre_mute_push\s*=\s*null,\s*pre_mute_email\s*=\s*null,\s*muted_at\s*=\s*null/.test(sql), 'unmute writes the recorded values back and clears the snapshot');
  assert(/and p\.muted_at is not null/.test(sql), 'and touches only rows that hold one');
  assert(/grant execute on function public\.mute_notifications\(text\[\]\) to authenticated/.test(sql) && /revoke execute on function public\.unmute_notifications\(text\[\]\) from anon/.test(sql), 'granted to authenticated, revoked from anon');
  const test = read('supabase/tests/590_notification_mute_restore_test.sql');
  assert(/off before muting, is still off/.test(test) && /on before muting, is on again/.test(test) && /turned on by hand while muted is still on/.test(test), 'the pgTAP test carries the three cases the decision named');
}

console.log('\nthe app calls the functions, and nothing else writes all-on');
{
  assert(/db\.rpc\('mute_notifications', \{ p_notification_ids: \[\.\.\.notificationIds\] \}\)/.test(queries), 'muteAll calls mute_notifications');
  assert(/db\.rpc\('unmute_notifications', \{ p_notification_ids: \[\.\.\.notificationIds\] \}\)/.test(queries), 'unmuteAll calls unmute_notifications');
  assert(!/push_enabled: true, email_enabled: true/.test(queries), 'no all-on upsert remains');
  assert(!/push_enabled: false, email_enabled: false/.test(queries), 'and no all-off upsert either — the snapshot is the database\'s job');
  assert(/restored\[row\.notification_id\] = \{ push: row\.push_enabled, email: row\.email_enabled, muted: false \}/.test(queries), 'unmuteAll returns what was restored');
  assert(/pre_mute_push: null, pre_mute_email: null, muted_at: null/.test(queries) && /setNotificationChannel/.test(queries), 'a single-chip write clears the row\'s snapshot — the athlete\'s newer intent wins');
  assert(/select\('notification_id, push_enabled, email_enabled, muted_at'\)/.test(queries) && /muted: row\.muted_at !== null/.test(queries), 'the read carries whether each row is muted');
}

console.log('\nthe form shows the truth');
{
  assert(/useState\(\(\) => Object\.values\(initialPreferences\)\.some\(\(p\) => p\.muted\)\)/.test(form), '"muted" comes from the rows, so the button is right after a reload and on another device');
  assert(/for \(const \[id, state\] of Object\.entries\(restored\)\) next\[id\] = state;/.test(form), 'un-mute renders what the database restored');
  assert(!/next\[id\] = \{ push: true, email: true \}/.test(form), 'and no longer paints every chip on');
  assert(/\[channel\]: next, muted: false/.test(form), 'a chip changed by hand marks its row as no longer muted');
  assert(/Turn notifications back on/.test(form), 'the label stays "Turn notifications back on" — with this rule it is finally true');
}

console.log('\nthe spec says so');
{
  const spec = read('docs/athlete/screens/14-notification-settings.md');
  assert(/Restores each muted type to exactly what it was before muting/.test(spec) && /never all-on/.test(spec), '14-notification-settings.md describes restore, not reset');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
