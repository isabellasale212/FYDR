/** The metric registry: the one place a metric key maps to a human label,
 *  its decimals and unit. screens/flags.md calls for this to be "a shared
 *  TypeScript constant... a single source of truth for label, unit,
 *  precision, direction and series source" — this is the label/precision
 *  half of that, used by both the Flags screen and Thresholds. Only the six
 *  metrics the evaluator can compute (migrations 0052 and 0128) are
 *  listed; the full metric registry the spec describes spans domains
 *  (gym, testing) that have no data source yet. */

import type { FlagDomain } from '@/lib/types/database';

export type MetricInfo = { label: string; decimals: number; unit: string; domain: FlagDomain };

export const METRIC_REGISTRY: Record<string, MetricInfo> = {
  'wellness.readiness_score': {
    label: 'Readiness score',
    decimals: 0,
    unit: '',
    domain: 'wellness',
  },
  'wellness.sleep_hours': { label: 'Sleep hours', decimals: 1, unit: ' h', domain: 'wellness' },
  'wellness.soreness': { label: 'Soreness', decimals: 0, unit: ' of 5', domain: 'wellness' },
  'load.acwr': { label: 'Acute:chronic load ratio', decimals: 2, unit: '', domain: 'gps' },
  /* MET-043, migration 0128. The day's weigh-in (body_composition, else the
   *  athlete's own check-in figure) against the athlete's own rolling mean —
   *  a change rule only, never an absolute number; the table refuses the
   *  absolute shape. In the nutrition domain, the one the nutritionist may act
   *  on and the S&C's dashboard counts alongside load. The coach does not see
   *  body mass at all (access-matrix §3.2), so the flags it raises are withheld
   *  from the coach at RLS and the editor does not offer it to them. */
  'body.mass_kg': { label: 'Body mass', decimals: 1, unit: ' kg', domain: 'nutrition' },
  'compliance.wellness_7d': {
    label: 'Wellness check-ins, 7 days',
    decimals: 0,
    unit: ' of 7',
    domain: 'compliance',
  },
};

/** The one metric whose flags are body mass — BODY_MASS_VIEW's rule reaches
 *  them (lib/access.ts), and a rule on it is a change rule only. */
export const BODY_MASS_METRIC = 'body.mass_kg';

/** The comparisons a body-mass rule may use: a change against the athlete's
 *  own baseline. Mirrors thresholds_body_mass_is_a_change (migration 0128). */
export const BODY_MASS_COMPARISONS = ['pct_change_below', 'pct_change_above', 'z_score'] as const;

export function metricLabel(metric: string): string {
  return METRIC_REGISTRY[metric]?.label ?? metric;
}

const FALLBACK_METRIC: MetricInfo = { label: 'Unknown metric', decimals: 1, unit: '', domain: 'wellness' };

/** Always returns a MetricInfo, so callers never have to guard against an
 *  unregistered key mid-form. */
export function getMetricInfo(metric: string): MetricInfo {
  return METRIC_REGISTRY[metric] ?? FALLBACK_METRIC;
}
