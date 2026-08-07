/** The metric registry: the one place a metric key maps to a human label,
 *  its decimals and unit. screens/flags.md calls for this to be "a shared
 *  TypeScript constant... a single source of truth for label, unit,
 *  precision, direction and series source" — this is the label/precision
 *  half of that, used by both the Flags screen and Thresholds. Only the five
 *  metrics that actually exist in this build's seed data and thresholds are
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
  'compliance.wellness_7d': {
    label: 'Wellness check-ins, 7 days',
    decimals: 0,
    unit: ' of 7',
    domain: 'compliance',
  },
};

export function metricLabel(metric: string): string {
  return METRIC_REGISTRY[metric]?.label ?? metric;
}

const FALLBACK_METRIC: MetricInfo = { label: 'Unknown metric', decimals: 1, unit: '', domain: 'wellness' };

/** Always returns a MetricInfo, so callers never have to guard against an
 *  unregistered key mid-form. */
export function getMetricInfo(metric: string): MetricInfo {
  return METRIC_REGISTRY[metric] ?? FALLBACK_METRIC;
}
