/* PATTERN-S8 C2 (2026-09-13): the settings hub's four groups as data — Club,
 * People, Data, You — each a list of destination rows with a label, a
 * sub-line, a count where there is one, and the gate that decides whether
 * the row links or states its reason. The hub draws it; a guard reads it.
 * Pure. */

import type { AppRole } from '@/lib/types/database';

export type HubRow = {
  key: string;
  label: string;
  sub: string;
  /** Null when this role cannot open it: the row shows its reason in `sub`. */
  href: string | null;
  count: string | null;
  countTone?: 'warn' | 'good' | 'neutral';
};

export type HubCard = { key: 'club' | 'people' | 'data' | 'you'; title: string; rows: HubRow[] };

export function settingsGroups(o: {
  roles: readonly AppRole[];
  isAdmin: boolean;
  canExport: boolean;
  canImport: boolean;
  onPremium: boolean;
  previewingTier: boolean;
  tierWord: 'Basic' | 'Premium';
  counts: { groups: number; thresholds: number; users: number | null; sarOpen: number | null; importBatches: number | null; auditRecent: number | null; setup?: { done: number; total: number } | null };
  mfa: 'on' | 'required' | 'off';
}): HubCard[] {
  const medic = o.roles.includes('medic');
  const fmt = (v: number) => v.toLocaleString('en-GB');
  const n = (v: number | null, noun: string) => (v === null ? null : `${fmt(v)} ${noun}${v === 1 ? '' : 's'}`);
  return [
    {
      key: 'club',
      title: 'Club',
      rows: [
        /* PATTERN-S8 C1: the setup checklist lives in Settings for good, its
           count carrying the denominator; warn while a step is outstanding. */
        ...(o.isAdmin && o.counts.setup
          ? [{ key: 'setup', label: 'Setup checklist', sub: 'Athletes, groups, thresholds, staff, roles — what is still on a default', href: '/settings/setup', count: `${o.counts.setup.done} of ${o.counts.setup.total} done`, countTone: (o.counts.setup.done < o.counts.setup.total ? 'warn' : 'good') as 'warn' | 'good' }]
          : []),
        { key: 'plan', label: 'Plan', sub: o.previewingTier ? 'Previewing Basic — the real plan is Premium' : 'What the club has bought', href: '/settings/club#plan', count: o.tierWord, countTone: o.previewingTier ? 'warn' : undefined },
        { key: 'club-details', label: 'Club details', sub: o.isAdmin ? 'Name, sport, timezone and badge' : 'Read by the sport scientist', href: o.isAdmin ? '/settings/club' : null, count: null },
        { key: 'groups', label: 'Groups', sub: 'Squad groups and who is in them', href: '/settings/groups', count: n(o.counts.groups, 'group') },
        { key: 'thresholds', label: 'Thresholds', sub: 'The rules that raise a flag', href: '/settings/thresholds', count: `${o.counts.thresholds} active`, countTone: 'warn' },
        { key: 'notifications', label: 'Notifications', sub: 'What the club sends, and when', href: '/settings/notifications', count: null },
      ],
    },
    {
      key: 'people',
      title: 'People',
      rows: [
        { key: 'users', label: 'Users', sub: o.isAdmin ? 'Staff accounts, roles and invitations' : 'Sport scientist only', href: o.isAdmin ? '/settings/users' : null, count: n(o.counts.users, 'active account') },
        { key: 'sar', label: 'Subject access requests', sub: o.isAdmin || medic ? 'Requests, review and release' : 'Sport scientist or medic only', href: o.isAdmin || medic ? '/settings/subject-access' : null, count: o.counts.sarOpen === null ? null : `${fmt(o.counts.sarOpen)} open` },
        { key: 'retention', label: 'Data retention', sub: o.isAdmin ? 'What is kept, for how long, and the purge' : 'Sport scientist only', href: o.isAdmin ? '/settings/retention' : null, count: null },
      ],
    },
    {
      key: 'data',
      title: 'Data',
      rows: [
        {
          key: 'imports',
          label: 'Vendor imports',
          sub: !o.canImport ? 'Sport scientist only' : o.onPremium ? 'Catapult, STATSports and Polar GPS files' : 'Premium — GPS files are on the Premium plan',
          href: o.canImport ? '/settings/imports' : null,
          count: !o.canImport ? null : o.onPremium ? n(o.counts.importBatches, 'file') : 'Premium',
          countTone: o.canImport && !o.onPremium ? 'neutral' : undefined,
        },
        { key: 'exports', label: 'Exports', sub: o.canExport ? 'Pick what, pick who, pick when, get a CSV' : 'Sport scientist, coach, S&C or medic only', href: o.canExport ? '/settings/exports' : null, count: null },
        { key: 'audit', label: 'Audit log', sub: o.isAdmin ? 'Who did what, and when' : 'Sport scientist only', href: o.isAdmin ? '/settings/audit' : null, count: o.counts.auditRecent === null ? null : `${fmt(o.counts.auditRecent)} in 90 days` },
      ],
    },
    {
      key: 'you',
      title: 'You',
      rows: [
        { key: 'account', label: 'Profile and password', sub: 'Your name, phone, avatar, password and two-factor', href: '/settings/profile', count: o.mfa === 'on' ? 'Two-factor on' : o.mfa === 'required' ? 'Two-factor required' : 'Two-factor off', countTone: o.mfa === 'required' ? 'warn' : o.mfa === 'on' ? 'good' : undefined },
      ],
    },
  ];
}
