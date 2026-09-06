/* screens/exports.md, job 1 ("Scoped bulk export for staff: pick what, pick
 * who, pick when, pick a format, get a file"). The spec's own "Exportable
 * content, by role" table (§"Data requirements") lists eighteen rows; this
 * is the subset with a real, working squad-wide query behind it as of this
 * pass — checked directly against lib/queries/*.ts before this list was
 * written, not copied from the spec's wishlist. Six real domains:
 *
 *   - Wellness entries         -> wellness_entries (via fetchWellnessForAthletes)
 *   - Training RPE entries     -> training_entries
 *   - Gym session + set logs   -> gym_session_logs, gym_set_logs
 *   - Test results             -> test_results
 *   - Body composition         -> body_composition
 *   - Nutrition check-ins      -> nutrition_checkins
 *
 * Left out, and why: GPS records, device metrics, attendance, sessions and
 * fixtures, availability, injuries (non-clinical and clinical), programmes
 * and overrides, compliance, flags, thresholds, groups, users and roles,
 * and the audit log are all real tables this app reads elsewhere, but none
 * of them has a squad-wide, date-ranged fetch function this pass could
 * point to and call real — adding a checkbox for any of them would be
 * promising a query that doesn't exist yet. That's a genuine, stated gap
 * against the spec's table, not an oversight.
 *
 * Injury clinical detail specifically is not here for the same reason, which
 * also means the medical-only "clinical detail, separately marked and
 * audited" branch the spec's role table describes has nothing to gate in
 * this pass: coach and medical get an identical checklist below. The
 * meaningful role split lives one level up, at the route itself
 * (requireReportAccess(), same as every report page) — an admin with
 * neither role never reaches this list at all, matching
 * 01-roles-and-permissions.md (superseded) §1's deliberate admin/coach friction.
 *
 * One shared module (not 'use client', not server-only) so the checklist
 * the builder renders and the allow-list the generate route validates
 * against are the same array, not two lists that can drift.
 */

export type ExportDomainKey = 'wellness' | 'training_rpe' | 'gym' | 'test_results' | 'body_composition' | 'nutrition_checkins';

export type ExportDomain = {
  key: ExportDomainKey;
  label: string;
  description: string;
};

export const EXPORT_DOMAINS: readonly ExportDomain[] = [
  {
    key: 'wellness',
    label: 'Wellness entries',
    description: 'Sleep, fatigue, soreness, stress, mood, resting HR and body mass, one row per submitted day.',
  },
  {
    key: 'training_rpe',
    label: 'Training RPE entries',
    description: 'Session RPE and duration as each athlete rated it, with session load.',
  },
  {
    key: 'gym',
    label: 'Gym session and set logs',
    description: 'Completed gym sessions and every logged set within them, in one file.',
  },
  {
    key: 'test_results',
    label: 'Test results',
    description: 'Every logged attempt against a test definition, with unit and personal-best flag.',
  },
  {
    key: 'body_composition',
    label: 'Body composition',
    description: 'Weigh-ins: body mass and body fat percentage.',
  },
  {
    key: 'nutrition_checkins',
    label: 'Nutrition check-ins',
    description: 'The weekly one-tap fuelling check-in — the only nutrition domain athletes log (CLAUDE.md rule 8).',
  },
] as const;

const VALID_KEYS = new Set<string>(EXPORT_DOMAINS.map((d) => d.key));

export function isExportDomainKey(value: unknown): value is ExportDomainKey {
  return typeof value === 'string' && VALID_KEYS.has(value);
}
