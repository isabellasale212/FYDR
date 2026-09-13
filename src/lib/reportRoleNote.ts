/* PATTERN-S7 C10 (2026-09-13): the role note on the report, not only in the
 * settings matrix — one sentence, under the definition, saying what THIS
 * reader sees that another role does not, or what is withheld from them and
 * whose it is. Built from lib/access.ts's own sets, never a hand-written
 * summary that could drift. Null where the report reads the same for every
 * role that can open it: a withheld column is absent, not announced, and a
 * report with no difference carries no note.
 *
 * Pure; exercised by scripts/test-report-role-note.ts. */

import { CLINICAL_ONLY, hasAnyRole, type ReportKey } from '@/lib/access';
import type { AppRole } from '@/lib/types/database';

export function reportRoleNote(key: ReportKey, roles: readonly AppRole[]): string | null {
  const medic = hasAnyRole(roles, CLINICAL_ONLY);
  const nutritionistOnly = roles.length > 0 && roles.every((r) => r === 'nutritionist');
  switch (key) {
    case 'injuries':
      return medic
        ? 'Medical: you see the diagnosis and the clinical columns. Coaches, the sport scientist and S&C do not — they read the status, the restriction and the expected return.'
        : 'Status, restriction and expected return only. The diagnosis and the clinical detail are the medic’s and are not on this report for your role.';
    case 'athlete':
      return medic
        ? 'Medical: the injury detail on this report is yours to see; every other role reads availability and the restriction line only.'
        : nutritionistOnly
          ? 'Nutritionist: availability is shown as a status without injury detail, and body mass is yours to see.'
          : 'Availability and the restriction line only. The injury detail is the medic’s and is not on this report for your role.';
    case 'compliance':
      return nutritionistOnly ? 'Nutritionist: the nutrition domain only. Wellness, session RPE and gym are not shown to this role.' : null;
    default:
      return null;
  }
}
