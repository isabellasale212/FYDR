/* PATTERN-S8 C1 (2026-09-13): the setup checklist a new club lands on —
 * five steps, in the order that saves the most rework, each with a count
 * and a done / outstanding state. A list of what is still on a default,
 * not a gate: the club can use Fydr from the first step onwards. D8,
 * answered 2026-09-13: a threshold with no creator is a Fydr default, so
 * "set thresholds" is done once at least one of the club's own lines
 * exists. Pure; the page, the hub row, the dashboard card and the guard
 * read the same steps. */

export type SetupCounts = {
  athletes: number;
  groups: number;
  athletesInNoGroup: number;
  thresholdsActive: number;
  /** Active thresholds with no created_by — Fydr's starter set. */
  thresholdsDefault: number;
  staffAccounts: number;
  staffSignedIn: number;
  staffInvited: number;
  /** Accounts holding no role at all. */
  accountsWithoutRole: number;
};

export type SetupStep = {
  n: number;
  key: 'athletes' | 'groups' | 'thresholds' | 'staff' | 'roles';
  title: string;
  why: string;
  done: boolean;
  state: string;
  count: string;
  cta: string;
  href: string;
};

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

export function setupSteps(c: SetupCounts, clubName: string): SetupStep[] {
  const thresholdsOwn = c.thresholdsActive - c.thresholdsDefault;
  return [
    {
      n: 1,
      key: 'athletes',
      title: 'Add athletes',
      why: 'Every other step needs people to apply to. Added one at a time, or invited from a .csv of the squad list.',
      done: c.athletes > 0,
      state: c.athletes > 0 ? 'Done' : 'Outstanding',
      count: c.athletes > 0 ? n(c.athletes, 'athlete', 'athletes') : 'No athletes yet',
      cta: c.athletes > 0 ? 'Squad overview' : 'Add athletes',
      href: c.athletes > 0 ? '/squad' : '/squad/new',
    },
    {
      n: 2,
      key: 'groups',
      title: 'Make groups',
      why: 'The filter that appears above every squad screen, report and export.',
      done: c.groups > 0,
      state: c.groups > 0 ? 'Done' : 'Outstanding',
      count: c.groups > 0 ? `${n(c.groups, 'group', 'groups')}${c.athletesInNoGroup > 0 ? ` · ${n(c.athletesInNoGroup, 'athlete', 'athletes')} in none` : ''}` : 'No groups yet',
      cta: c.groups > 0 ? 'Groups' : 'Make a group',
      href: c.groups > 0 ? '/settings/groups' : '/settings/groups/new',
    },
    {
      n: 3,
      key: 'thresholds',
      title: 'Set thresholds',
      why: `Until these are set, every colour and flag in the app is a Fydr default rather than ${clubName}'s.`,
      done: thresholdsOwn > 0,
      state: thresholdsOwn > 0 ? 'Done' : 'Outstanding',
      count:
        c.thresholdsActive === 0
          ? 'No thresholds — nothing raises a flag'
          : thresholdsOwn > 0
            ? `${n(thresholdsOwn, 'line', 'lines')} of ${c.thresholdsActive} ${clubName}'s own`
            : `0 of ${c.thresholdsActive} lines changed — all Fydr defaults`,
      cta: 'Set thresholds',
      href: '/settings/thresholds',
    },
    {
      n: 4,
      key: 'staff',
      title: 'Invite staff',
      why: 'Nobody sees a thing until they accept and sign in.',
      done: c.staffAccounts > 0 && c.staffInvited === 0,
      state: c.staffAccounts === 0 ? 'Outstanding' : c.staffInvited > 0 ? n(c.staffInvited, 'invitation outstanding', 'invitations outstanding') : 'Done',
      count: c.staffAccounts === 0 ? 'No staff accounts yet' : `${c.staffSignedIn} of ${n(c.staffAccounts, 'account signed in', 'accounts signed in')}`,
      cta: 'Users and roles',
      href: c.staffInvited > 0 ? '/settings/users?status=invited' : '/settings/users',
    },
    {
      n: 5,
      key: 'roles',
      title: 'Assign roles',
      why: 'A role decides which screens open. An account with no role can sign in and reach nothing.',
      done: c.staffAccounts > 0 && c.accountsWithoutRole === 0,
      state: c.staffAccounts > 0 && c.accountsWithoutRole === 0 ? 'Done' : 'Outstanding',
      count: c.staffAccounts === 0 ? 'No accounts yet' : c.accountsWithoutRole === 0 ? 'Every account has a role' : `${n(c.accountsWithoutRole, 'account has', 'accounts have')} no role`,
      cta: 'Users and roles',
      href: '/settings/users',
    },
  ];
}

export type SetupSummary = {
  done: number;
  total: number;
  /** "2 of 5 done" */
  count: string;
  complete: boolean;
  /** The outstanding step that costs the most if skipped — thresholds first, then in order. */
  mattersMost: SetupStep | null;
};

export function setupSummary(steps: SetupStep[]): SetupSummary {
  const done = steps.filter((s) => s.done).length;
  const outstanding = steps.filter((s) => !s.done);
  const mattersMost = outstanding.find((s) => s.key === 'thresholds') ?? outstanding[0] ?? null;
  return { done, total: steps.length, count: `${done} of ${steps.length} done`, complete: outstanding.length === 0, mattersMost };
}

/** The one line the dashboard shows while anything is outstanding. */
export function setupDashboardLine(summary: SetupSummary, clubName: string): string | null {
  if (summary.complete || !summary.mattersMost) return null;
  const m = summary.mattersMost;
  const consequence = m.key === 'thresholds' ? 'every colour and flag on this dashboard is a Fydr default, not yours' : m.key === 'athletes' ? 'nothing here has anyone to apply to' : m.key === 'groups' ? 'the group filter has nothing to offer' : m.key === 'staff' ? 'somebody invited has not signed in' : 'an account has no role and reaches nothing';
  return `Getting ${clubName} set up: ${summary.count}. ${m.title} is still outstanding — ${consequence}.`;
}
