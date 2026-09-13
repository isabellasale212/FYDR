/* PATTERN-S8 C3 (2026-09-13): the users list's search and filters as pure
 * functions — search by name or email, one role, one status — with the
 * sentence the list reads back ("12 of 37 accounts · coaches · active ·
 * matching 'ok'"). The panel keeps the state; this decides the rows and
 * the words. Athlete accounts stay in the list because invitations and
 * athlete linking live on this screen; "Athlete" is a role filter like
 * any other. */

import type { AppRole, UserStatus } from '@/lib/types/database';

export type RoleFilter = AppRole | 'all';
export type StatusFilter = UserStatus | 'all';

export type UserFilter = { q: string; role: RoleFilter; status: StatusFilter };

export const EMPTY_FILTER: UserFilter = { q: '', role: 'all', status: 'all' };

/** The chips, in the order the filter row shows them. Labels are the
 *  plural the summary sentence uses ("coaches"), the chip shows the
 *  singular via `chip`. */
export const ROLE_FILTERS: ReadonlyArray<{ value: RoleFilter; chip: string; plural: string }> = [
  { value: 'all', chip: 'Every role', plural: '' },
  { value: 'sport_scientist', chip: 'Sport scientist', plural: 'sport scientists' },
  { value: 'coach', chip: 'Coach', plural: 'coaches' },
  { value: 'strength_conditioning', chip: 'S&C', plural: 'S&C staff' },
  { value: 'medic', chip: 'Medic', plural: 'medics' },
  { value: 'nutritionist', chip: 'Nutritionist', plural: 'nutritionists' },
  { value: 'athlete', chip: 'Athlete', plural: 'athlete accounts' },
];

export const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; chip: string; word: string }> = [
  { value: 'all', chip: 'Any status', word: '' },
  { value: 'active', chip: 'Active', word: 'active' },
  { value: 'invited', chip: 'Invited', word: 'invited, not yet signed in' },
  { value: 'suspended', chip: 'Suspended', word: 'suspended' },
  { value: 'deactivated', chip: 'Deactivated', word: 'deactivated' },
];

/** Read a filter off the URL (`?q=&role=&status=`); anything unknown is
 *  "all", so a stale link never filters to nothing silently. */
export function parseUserFilter(params: { q?: string | string[]; role?: string | string[]; status?: string | string[] }): UserFilter {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const role = one(params.role);
  const status = one(params.status);
  return {
    q: one(params.q).slice(0, 80),
    role: ROLE_FILTERS.some((r) => r.value === role) ? (role as RoleFilter) : 'all',
    status: STATUS_FILTERS.some((s) => s.value === status) ? (status as StatusFilter) : 'all',
  };
}

type Filterable = { full_name: string; email: string; roles: readonly AppRole[]; status: UserStatus };

export function matchesUserFilter(u: Filterable, f: UserFilter): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && !`${u.full_name} ${u.email}`.toLowerCase().includes(q)) return false;
  if (f.role !== 'all' && !u.roles.includes(f.role)) return false;
  if (f.status !== 'all' && u.status !== f.status) return false;
  return true;
}

export function filterUsers<T extends Filterable>(users: readonly T[], f: UserFilter): T[] {
  return users.filter((u) => matchesUserFilter(u, f));
}

export function isFiltered(f: UserFilter): boolean {
  return f.q.trim() !== '' || f.role !== 'all' || f.status !== 'all';
}

/** The line above the list. Always the denominator; the active filters
 *  named in words; never "0" on its own. */
export function userFilterSummary(o: { shown: number; total: number; filter: UserFilter }): string {
  const { shown, total, filter } = o;
  const parts: string[] = [];
  const role = ROLE_FILTERS.find((r) => r.value === filter.role);
  const status = STATUS_FILTERS.find((s) => s.value === filter.status);
  if (role && role.plural) parts.push(role.plural);
  if (status && status.word) parts.push(status.word);
  if (filter.q.trim()) parts.push(`matching "${filter.q.trim()}"`);
  const noun = total === 1 ? 'account' : 'accounts';
  if (!isFiltered(filter)) return `${total} ${noun}`;
  if (shown === 0) return `No account matches — ${parts.join(' · ')}. Clear the filters to see all ${total}.`;
  return `${shown} of ${total} ${noun} · ${parts.join(' · ')}`;
}
