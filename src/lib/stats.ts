/* The small amount of arithmetic the Phase 1a slice needs.
 *
 * Everything here is per athlete, against that athlete's own history. The
 * question a coach asks is never "what did they score", it is "is this normal for
 * them", so there is no squad mean anywhere in this file.
 *
 * The specification points these calculations at mv_wellness_baselines and
 * mv_daily_athlete_summary. Those materialised views are not in
 * supabase/migrations, so the slice computes the same quantities in the
 * application from wellness_entries_current. When the views land, these
 * functions are what they replace. */

export type Point = { date: string; value: number | null };

export type Band = {
  date: string;
  value: number | null;
  mean: number | null;
  sd: number | null;
};

/** The five 1 to 5 scales, averaged and put on 0 to 100. Matches
 *  public.wellness_compute_readiness in migration 0010: every scale runs
 *  5 = best, including soreness, so no term is inverted. */
export function readiness(entry: {
  sleep_quality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
}): number | null {
  const parts = [
    entry.sleep_quality,
    entry.fatigue,
    entry.soreness,
    entry.stress,
    entry.mood,
  ];
  if (parts.some((p) => p === null || p === undefined)) return null;
  const sum = parts.reduce<number>((acc, p) => acc + (p as number), 0);
  return (sum / 25) * 100;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation. Needs at least two observations; one value has no
 *  spread, and a band of zero width would read as a precise claim. */
export function stdDev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m === null) return null;
  const variance =
    values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * A trailing rolling mean and +/-1SD band over `window` observations.
 *
 * Missing days are absent from `points`, not zero, and a day with no
 * observation produces mean null rather than carrying the previous value
 * forward. `minObservations` stops a band being drawn off two data points.
 */
export function rollingBand(
  points: readonly Point[],
  window: number,
  minObservations = 4,
): Band[] {
  return points.map((p, i) => {
    const from = Math.max(0, i - window + 1);
    const observed = points
      .slice(from, i + 1)
      .map((q) => q.value)
      .filter((v): v is number => v !== null);

    if (observed.length < minObservations) {
      return { date: p.date, value: p.value, mean: null, sd: null };
    }
    return {
      date: p.date,
      value: p.value,
      mean: mean(observed),
      sd: stdDev(observed),
    };
  });
}

export type BandPosition = 'above' | 'below' | 'inside' | 'unknown';

/** Where a value sits against its own band. Drives the triangle glyphs in
 *  06-design-system.md §5.2: nothing at all when the value is inside. */
export function bandPosition(b: Band): BandPosition {
  if (b.value === null || b.mean === null || b.sd === null) return 'unknown';
  if (b.value > b.mean + b.sd) return 'above';
  if (b.value < b.mean - b.sd) return 'below';
  return 'inside';
}

/** Signed distance in standard deviations of the athlete's own distribution. */
export function zScore(b: Band): number | null {
  if (b.value === null || b.mean === null || b.sd === null || b.sd === 0) {
    return null;
  }
  return (b.value - b.mean) / b.sd;
}
