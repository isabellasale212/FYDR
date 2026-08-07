import type { AppRole } from '@/lib/types/database';

/* docs/08-notifications.md §2, the notification catalogue, transcribed
 * faithfully from its own two tables (Athlete, Staff) — id, channel,
 * default, can-disable and priority all come from that source, not
 * invented here. This is data, not a feature in itself; see
 * notificationPreferences.ts and the two settings pages that read it for
 * what actually got built on top of it and what didn't.
 *
 * Kept as a plain TS module, not a database table, because §12 of the same
 * doc says the catalogue "changes without a data migration" — the whole
 * point of notification_preferences.notification_id being free text
 * (migration 0008's own comment) rather than a foreign key into a
 * catalogue table.
 */

export type NotificationChannel = 'push' | 'email';

export type CatalogueEntry = {
  id: string;
  /** 'athlete' or the staff roles who see this row on their own settings. */
  audience: 'athlete' | AppRole[];
  label: string;
  trigger: string;
  channels: NotificationChannel[];
  defaultOn: Partial<Record<NotificationChannel, boolean>>;
  canDisable: boolean;
  /** §5.4: for an athlete under 18, this row is forced off and no
   *  organisation setting or user toggle can turn it on. */
  minorFloorOff?: boolean;
};

export const ATHLETE_CATALOGUE: CatalogueEntry[] = [
  { id: 'athlete.wellness.prompt', audience: 'athlete', label: 'Morning wellness prompt', trigger: 'A wellness entry is expected today', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.wellness.nudge', audience: 'athlete', label: 'Wellness reminder', trigger: 'Wellness still outstanding a few hours later', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.rpe.prompt', audience: 'athlete', label: 'Session rating prompt', trigger: 'A session you need to rate has ended', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.rpe.nudge', audience: 'athlete', label: 'Session rating reminder', trigger: 'A session rating is still outstanding', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.nutrition.matchday', audience: 'athlete', label: 'Matchday fuelling reminder', trigger: 'The evening before a fixture', channels: ['push'], defaultOn: { push: false }, canDisable: true },
  { id: 'athlete.nutrition.checkin', audience: 'athlete', label: 'Weekly nutrition check-in', trigger: 'The week has ended and you haven’t checked in', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.programme.assigned', audience: 'athlete', label: 'New programme assigned', trigger: 'A gym or rehab programme starts', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.programme.changed', audience: 'athlete', label: 'Programme changed', trigger: 'Your assigned programme is edited by staff', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.rehab.assigned', audience: 'athlete', label: 'Rehab programme assigned', trigger: 'Medical assigns you a rehab programme', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.availability.changed', audience: 'athlete', label: 'Availability changed', trigger: 'Your availability status changes', channels: ['push', 'email'], defaultOn: { push: true, email: true }, canDisable: false },
  { id: 'athlete.session.changed', audience: 'athlete', label: 'Session moved or cancelled', trigger: 'Today or tomorrow’s session changes', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.flag.shared', audience: 'athlete', label: 'A flag was shared with you', trigger: 'Staff acknowledges a flag raised about you', channels: ['push'], defaultOn: { push: false }, canDisable: true, minorFloorOff: true },
  { id: 'athlete.test.results', audience: 'athlete', label: 'Test results published', trigger: 'New test results are ready for you', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'athlete.compliance.weekly', audience: 'athlete', label: 'Weekly personal summary', trigger: 'Every Monday morning', channels: ['push'], defaultOn: { push: false }, canDisable: true, minorFloorOff: true },
  { id: 'athlete.leaderboard.weekly', audience: 'athlete', label: 'Weekly leaderboard', trigger: 'Every Monday morning', channels: ['push'], defaultOn: { push: false }, canDisable: true, minorFloorOff: true },
  { id: 'athlete.consent.required', audience: 'athlete', label: 'New privacy notice', trigger: 'A new privacy notice version is published', channels: ['push', 'email'], defaultOn: { push: true, email: true }, canDisable: false },
];

export const STAFF_CATALOGUE: CatalogueEntry[] = [
  { id: 'staff.flag.raised.high', audience: ['coach', 'medical', 'admin'], label: 'High-severity flag raised', trigger: 'A flag is created at high severity', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.flag.digest', audience: ['coach', 'medical', 'admin'], label: 'Flag digest', trigger: 'Medium or low severity flags pending', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.flag.escalation', audience: ['coach', 'medical', 'admin'], label: 'Flag escalation', trigger: 'A flag has gone 24h unacknowledged', channels: ['push', 'email'], defaultOn: { push: true, email: true }, canDisable: false },
  { id: 'staff.availability.changed', audience: ['coach'], label: 'Availability changed', trigger: 'An athlete’s availability status changes', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.injury.reported', audience: ['medical'], label: 'Injury reported', trigger: 'An athlete self-reports, or staff raises a concern', channels: ['push'], defaultOn: { push: true }, canDisable: false },
  { id: 'staff.injury.rtp_due', audience: ['medical'], label: 'Return-to-play date reached', trigger: 'An expected return date arrives, still open', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.restriction.conflict', audience: ['coach', 'medical'], label: 'Restriction conflict', trigger: 'A coach assigns work an athlete is restricted from', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.compliance.weekly', audience: ['coach', 'medical', 'admin'], label: 'Weekly compliance digest', trigger: 'Every Monday morning', channels: ['push', 'email'], defaultOn: { push: true, email: true }, canDisable: true },
  { id: 'staff.compliance.low', audience: ['coach', 'admin'], label: 'Compliance below floor', trigger: 'Squad compliance stays below the org floor 3 days running', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.import.completed', audience: ['coach', 'medical'], label: 'Import completed', trigger: 'A GPS or data import you started finishes', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.import.failed', audience: ['coach', 'medical'], label: 'Import failed', trigger: 'A GPS or data import fails or rejects over 20% of rows', channels: ['push', 'email'], defaultOn: { push: true, email: true }, canDisable: true },
  { id: 'staff.programme.divergence', audience: ['coach'], label: 'Programme divergence', trigger: 'An edit didn’t reach every assigned athlete', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.export.ready', audience: ['coach', 'medical', 'admin'], label: 'Export ready', trigger: 'A report you generated finishes', channels: ['push'], defaultOn: { push: true }, canDisable: true },
  { id: 'staff.athlete.joined', audience: ['admin'], label: 'Athlete joined', trigger: 'An athlete accepts an invite', channels: [], defaultOn: {}, canDisable: true },
  { id: 'staff.consent.declined', audience: ['admin'], label: 'Privacy notice declined', trigger: 'An athlete declines the privacy notice at onboarding', channels: ['email'], defaultOn: { email: true }, canDisable: false },
  { id: 'staff.integration.failing', audience: ['admin'], label: 'Integration failing', trigger: 'A vendor adapter fails for over 6 hours', channels: ['email'], defaultOn: { email: true }, canDisable: true },
  { id: 'staff.device_sync.stalled', audience: ['coach'], label: 'Device sync stalled', trigger: 'Athletes with device sync silent over 7 days', channels: [], defaultOn: {}, canDisable: true },
];

/** The two athlete ids the mute rule (§5.2) can never turn off. */
export const ATHLETE_MANDATORY_IDS = ATHLETE_CATALOGUE.filter((e) => !e.canDisable).map((e) => e.id);

export function catalogueForRoles(roles: readonly AppRole[]): CatalogueEntry[] {
  const seen = new Set<string>();
  const rows: CatalogueEntry[] = [];
  for (const entry of STAFF_CATALOGUE) {
    if (entry.audience === 'athlete') continue;
    if (entry.audience.some((r) => roles.includes(r)) && !seen.has(entry.id)) {
      seen.add(entry.id);
      rows.push(entry);
    }
  }
  return rows;
}
