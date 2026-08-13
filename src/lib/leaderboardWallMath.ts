import { UNITS, type WallAthlete, type WallBoard, type WallData } from '@/lib/queries/leaderboardWall';

/* Pure functions ported from LEADERBOARD-SPEC.md §§3–7, framework-agnostic so the
 * server can use them once for the stats card / movers / unit leaders (none of which
 * change with the client's lens/scope/family toggles — the spec is explicit: "Lens...
 * never changes which athletes appear", "Scope... never changes the value shown"), and
 * the client wall grid can use the same functions on every interactive re-render
 * without a network round trip. Geometry, thresholds and band-colour formulas are the
 * spec's own literal algorithms; only the board/athlete data feeding them is real. */

export const BLANK = '–';

export function fmt(value: number | null, decimals: number): string {
  if (value === null || Number.isNaN(value)) return '·';
  return value.toFixed(decimals);
}

function roundsToZero(gain: number, decimals: number): boolean {
  return fmt(Math.abs(gain), decimals) === fmt(0, decimals);
}

// ---------------------------------------------------------------------------
// Ranking. One pool, one board, dense rank by real current value.
// ---------------------------------------------------------------------------

export type Rank = { rank: number; n: number };

/** Ranks every athlete in `pool` that has a real current value for `board`, best
 *  first. Ties broken by id for stability — LEADERBOARD-SPEC.md doesn't specify tie
 *  handling for the wall (unlike the older single-metric board's `is_tied` column). */
export function rankAthletesInPool(pool: readonly WallAthlete[], board: WallBoard): Map<string, Rank> {
  const withValue = pool.filter((a) => a.values[board.key]?.current !== null);
  const sorted = [...withValue].sort((a, b) => {
    const av = a.values[board.key]!.current!;
    const bv = b.values[board.key]!.current!;
    const diff = board.lowerIsBetter ? av - bv : bv - av;
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
  const n = sorted.length;
  const out = new Map<string, Rank>();
  sorted.forEach((a, i) => out.set(a.id, { rank: i + 1, n }));
  return out;
}

/** LEADERBOARD-SPEC.md §6. Deliberately wide, deliberately four bands — a positional
 *  unit is often four or five athletes, quartiles would be meaningless. Below three in
 *  a group there is no tint at all: you cannot rank two people. */
export function rankBandColor(rank: number, n: number): string {
  if (n < 3) return 'transparent';
  const p = (n - rank) / (n - 1);
  if (p >= 0.8) return 'rgb(var(--accent-rgb) / 0.22)';
  if (p >= 0.5) return 'rgb(var(--accent-rgb) / 0.1)';
  if (p >= 0.2) return 'rgb(var(--warn-rgb) / var(--lb-tint-alpha))';
  return 'rgb(var(--bad-rgb) / var(--lb-tint-alpha))';
}

// ---------------------------------------------------------------------------
// Improvement / gain.
// ---------------------------------------------------------------------------

export type GainCell = { value: string; mark: string; fg: string | null; bg: string; sortValue: number | null };

/** Sign-corrected gain: positive always means improvement, whichever direction the
 *  board's own unit runs. Requires two real sessions — see this file's header and
 *  lib/queries/leaderboardWall.ts's own header for why most athlete/board pairs in the
 *  real dataset today have only one recorded session and render "first test on file"
 *  rather than a fabricated comparison. */
export function gainCell(board: WallBoard, current: number | null, first: number | null): GainCell {
  // Audit finding 46: "no data at all" (never tested on this board) must look
  // different from "data exists but there's nothing meaningful to report" —
  // the Result and Standard lenses already render a missing value as a
  // transparent dot (see the '·' cells in LeaderboardWall.tsx); Improvement
  // was rendering both cases identically in grey, which is a real reading
  // ambiguity for a coach scanning the wall, not just a style mismatch.
  if (current === null) {
    return { value: '·', mark: '', fg: 'var(--faint)', bg: 'transparent', sortValue: null };
  }
  if (!board.gainable || first === null) {
    return { value: BLANK, mark: '', fg: 'var(--faint)', bg: 'var(--hair)', sortValue: null };
  }
  const gain = board.lowerIsBetter ? first - current : current - first;

  if (roundsToZero(gain, board.decimals)) {
    return { value: BLANK, mark: '', fg: 'var(--faint)', bg: 'var(--hair)', sortValue: 0 };
  }

  const real = Math.abs(gain) > board.typicalError;
  const mark = gain > 0 ? '▲' : '▼';
  const value = `${gain > 0 ? '+' : '−'}${fmt(Math.abs(gain), board.decimals)}`;

  if (!real) {
    return { value, mark, fg: 'var(--faint)', bg: 'var(--hair)', sortValue: gain };
  }
  if (gain < 0) {
    return { value, mark, fg: null, bg: 'rgb(var(--bad-rgb) / var(--lb-tint-alpha))', sortValue: gain };
  }
  const clear = gain > board.typicalError * 2.5;
  return {
    value,
    mark,
    fg: null,
    bg: clear ? 'rgb(var(--accent-rgb) / 0.22)' : 'rgb(var(--accent-rgb) / 0.1)',
    sortValue: gain,
  };
}

export function isRealGain(board: WallBoard, current: number | null, first: number | null): boolean {
  const cell = gainCell(board, current, first);
  return cell.sortValue !== null && cell.sortValue !== 0 && Math.abs(cell.sortValue) > board.typicalError;
}

// ---------------------------------------------------------------------------
// Standard.
// ---------------------------------------------------------------------------

/** LEADERBOARD-SPEC.md §6: "standardFor picks on unit <= 2" — units 0–2 (Front row,
 *  Second row, Back row) are forwards, 3–5 (Half backs, Centres, Back three) backs. */
export function standardFor(board: WallBoard, unitIndex: number | null): number {
  return unitIndex !== null && unitIndex <= 2 ? board.standardFwd : board.standardBack;
}

export type StandardCell = { marker: string; markerColor: string; bg: string };

export function standardCell(board: WallBoard, value: number | null, unitIndex: number | null): StandardCell | null {
  if (value === null) return null;
  const standard = standardFor(board, unitIndex);
  const diff = board.lowerIsBetter ? standard - value : value - standard;
  const met = diff >= 0;
  const close = !met && Math.abs(diff) <= standard * 0.03;

  if (met) {
    return { marker: '✓', markerColor: 'var(--lb-standard-met)', bg: 'rgb(var(--lb-standard-met-rgb) / 0.2)' };
  }
  const shortfall = `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), board.decimals)}`;
  return close
    ? { marker: shortfall, markerColor: 'var(--lb-warn-on-white)', bg: 'rgb(var(--warn-rgb) / var(--lb-tint-alpha))' }
    : { marker: shortfall, markerColor: 'var(--bad)', bg: 'rgb(var(--bad-rgb) / var(--lb-tint-alpha))' };
}

// ---------------------------------------------------------------------------
// Stats card, movers, unit leaders — computed once, independent of lens/scope/family.
// ---------------------------------------------------------------------------

export type WallStats = {
  boards: number;
  athletes: number;
  meetingStandardPct: number;
  improvedCount: number;
  measurableBoards: number;
};

export type WallMover = {
  athleteId: string;
  name: string;
  unit: string;
  score: number;
  boardKey: string;
  boardLabel: string;
  fromValue: number;
  toValue: number;
  decimals: number;
  unitLabel: string;
  lowerIsBetter: boolean;
  sessions: number[];
  improvedOn: number;
};

export type UnitLeader = { athleteId: string; surname: string; value: string } | null;

export type WallDerived = {
  stats: WallStats;
  movers: WallMover[];
  unitLeaders: Record<string, UnitLeader[]>; // boardKey -> 6 entries, one per unit
};

export function computeWallDerived(data: WallData): WallDerived {
  const { boards, athletes } = data;
  const measurable = boards.filter((b) => b.gainable);

  // Stats: athletes with any real value across any board (test or Habits).
  const athleteIdsWithAnyValue = new Set(
    athletes.filter((a) => boards.some((b) => a.values[b.key]?.current !== null)).map((a) => a.id),
  );

  let metPairs = 0;
  let totalPairs = 0;
  for (const a of athletes) {
    for (const b of boards) {
      const v = a.values[b.key]?.current ?? null;
      if (v === null) continue;
      totalPairs += 1;
      const cell = standardCell(b, v, a.unitIndex);
      if (cell?.marker === '✓') metPairs += 1;
    }
  }
  const meetingStandardPct = totalPairs > 0 ? Math.round((100 * metPairs) / totalPairs) : 0;

  const improvedAthletes = new Set<string>();
  for (const a of athletes) {
    for (const b of measurable) {
      const v = a.values[b.key];
      if (!v) continue;
      const cell = gainCell(b, v.current, v.first);
      if (cell.sortValue !== null && cell.sortValue > 0 && Math.abs(cell.sortValue) > b.typicalError) {
        improvedAthletes.add(a.id);
      }
    }
  }

  // Movers: mean signed real gain across every measurable board, padded with 0 for
  // boards with no real comparison, divided by the FULL measurable-board count — not
  // just the boards where a gain exists. LEADERBOARD-SPEC.md §4: "not on his single
  // best result" — breadth of improvement counts, one lucky session should not win.
  const movers: WallMover[] = [];
  for (const a of athletes) {
    let sum = 0;
    let improvedCount = 0;
    let bestBoard: WallBoard | null = null;
    let bestGain = -Infinity;
    for (const b of measurable) {
      const v = a.values[b.key];
      if (!v) continue;
      const cell = gainCell(b, v.current, v.first);
      const g = cell.sortValue ?? 0;
      const real = g !== 0 && Math.abs(g) > b.typicalError;
      if (!real) continue;
      sum += g;
      if (g > 0) {
        improvedCount += 1;
        if (g > bestGain) {
          bestGain = g;
          bestBoard = b;
        }
      }
    }
    if (!bestBoard || improvedCount === 0) continue;
    const score = sum / measurable.length;
    if (score <= 0) continue; // "moved the most" is a positive-improvement section, per spec framing
    const v = a.values[bestBoard.key]!;
    movers.push({
      athleteId: a.id,
      name: a.name,
      unit: a.unitIndex !== null ? UNITS[a.unitIndex]! : '',
      score,
      boardKey: bestBoard.key,
      boardLabel: bestBoard.label,
      fromValue: v.first!,
      toValue: v.current!,
      decimals: bestBoard.decimals,
      unitLabel: bestBoard.unit,
      lowerIsBetter: bestBoard.lowerIsBetter,
      sessions: v.sessions,
      improvedOn: improvedCount,
    });
  }
  movers.sort((a, b) => b.score - a.score);

  // Unit leaders: top athlete per unit per board, by current value.
  const unitLeaders: Record<string, UnitLeader[]> = {};
  for (const b of boards) {
    const leaders: UnitLeader[] = [];
    for (let u = 0; u < 6; u += 1) {
      const pool = athletes.filter((a) => a.unitIndex === u && a.values[b.key]?.current !== null);
      if (pool.length === 0) {
        leaders.push(null);
        continue;
      }
      const best = pool.reduce((champ, a) => {
        const av = a.values[b.key]!.current!;
        const cv = champ.values[b.key]!.current!;
        return (b.lowerIsBetter ? av < cv : av > cv) ? a : champ;
      });
      const surname = best.name.split(',')[0]!.trim();
      leaders.push({ athleteId: best.id, surname, value: fmt(best.values[b.key]!.current, b.decimals) });
    }
    unitLeaders[b.key] = leaders;
  }

  return {
    stats: {
      boards: boards.length,
      athletes: athleteIdsWithAnyValue.size,
      meetingStandardPct,
      improvedCount: improvedAthletes.size,
      measurableBoards: measurable.length,
    },
    movers,
    unitLeaders,
  };
}

// ---------------------------------------------------------------------------
// Sparkline. LEADERBOARD-SPEC.md §4's own formula, generalised from a fixed eight
// points to however many real sessions exist (2 minimum — a mover requires a real
// prior session — capped at the most recent 8 to match the spec's own window once an
// org has that much history).
// ---------------------------------------------------------------------------

export function sparklinePath(points: readonly number[], lowerIsBetter: boolean): { line: string; fill: string; cy: number } {
  const recent = points.slice(-8);
  const lo = Math.min(...recent);
  const hi = Math.max(...recent);
  const span = hi - lo || 1;
  const n = recent.length;

  const coords = recent.map((v, k) => {
    const x = n > 1 ? Math.round((k / (n - 1)) * 300) : 300;
    const y = lowerIsBetter ? 8 + ((v - lo) / span) * 44 : 52 - ((v - lo) / span) * 44;
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x} ${c.y.toFixed(1)}`).join(' ');
  const fill = `${line} L300 60 L0 60 Z`;
  return { line, fill, cy: coords[coords.length - 1]!.y };
}
