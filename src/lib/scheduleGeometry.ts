/* SCHEDULE-SPEC.md §5 — the time grid's block-placement geometry, ported
 * verbatim from the spec's own JS. This is real, tested algorithmic logic
 * (the spec's own words: "a real fix to a real measured layout defect"),
 * not decoration, so every function here is a direct line-for-line port of
 * the pseudocode, not a reinterpretation — only the input/output shapes are
 * adapted to real session data instead of the spec's literal fixture array.
 *
 * One deliberate substitution, documented once here rather than at each
 * call site: §5's clash detector (`SHARES`) compares a session's single
 * literal `group` string against a hard-coded exception list ('Staff',
 * 'Academy' never clash). This build's real schema has no such single
 * group-per-session field — a session can be assigned zero, one, or several
 * real groups (`session_participants`), and there is no 'Staff' or
 * 'Matchday 23' group row anywhere in `groups` (see schedule.ts's own
 * header for the full account). `sharesAthletes` below replaces the
 * name-based heuristic with a real Set-intersection over each session's
 * actual resolved athlete IDs. This is strictly more correct, not a
 * reduction: a staff-only session (zero real athlete participants) never
 * clashes with anything, for real, without needing a fake 'Staff' group to
 * name it — the same outcome the spec's literal exception produced, now
 * derived from real membership data instead of asserted by string. */

export const H0 = 8;
export const H1 = 18;
export const PXH = 68;
export const STAGGER = 14;

export type DbSessionType =
  | 'training'
  | 'gym'
  | 'match'
  | 'testing'
  | 'recovery'
  | 'meeting'
  | 'rehab';

export type TypeStyle = { tone: string; bg: string; bc: string };

/* Colours ported 1:1 from §10's TYPE table. Every value is a CSS custom
 * property reference, never a literal hex/rgba — base.css's own rule
 * ("Every colour reads a token from tokens.css... in any component, fails
 * review") applies here as much as to a stylesheet. Where the spec's
 * literal value already matches an existing token exactly (pitch's accent
 * blue, gym's gold, rehab's warn, match's bad, testing/recovery's cyan
 * against the .sg-scoped Good override in tokens.css — see that file's own
 * comment) the existing token is reused outright. 'meeting' is the one type
 * whose tone (rgba(16,18,23,0.3)) matches no existing named token — its
 * neutral-ink alpha is genuinely new, so it is exposed as --ink-rgb in
 * tokens.css (§4.5's own triplet convention) rather than written as a raw
 * literal here. */
export const TYPE_STYLE: Record<DbSessionType, TypeStyle> = {
  training: { tone: 'var(--accent)', bg: 'rgb(var(--accent-rgb) / 0.08)', bc: 'rgb(var(--accent-rgb) / 0.22)' },
  gym: { tone: 'var(--gym)', bg: 'rgb(var(--gym-rgb) / 0.12)', bc: 'rgb(var(--gym-rgb) / 0.35)' },
  rehab: { tone: 'var(--warn)', bg: 'rgb(var(--warn-rgb) / 0.12)', bc: 'rgb(var(--warn-rgb) / 0.35)' },
  testing: { tone: 'var(--good)', bg: 'rgb(var(--good-rgb) / 0.14)', bc: 'rgb(var(--good-rgb) / 0.35)' },
  match: { tone: 'var(--bad)', bg: 'rgb(var(--bad-rgb) / 0.1)', bc: 'rgb(var(--bad-rgb) / 0.32)' },
  meeting: { tone: 'rgb(var(--ink-rgb) / 0.3)', bg: 'rgb(var(--ink-rgb) / 0.04)', bc: 'var(--border)' },
  recovery: { tone: 'var(--good)', bg: 'rgb(var(--good-rgb) / 0.1)', bc: 'rgb(var(--good-rgb) / 0.3)' },
};

/* §6's EXPECTS map, keys translated to this schema's real session_type
 * vocabulary (training/testing, not the spec's mockup pitch/test — see
 * schedule.ts header for why the real DB enum wins on naming). */
export const EXPECTS: Record<DbSessionType, string> = {
  training: 'RPE due by 19:45',
  gym: 'Sets to log',
  match: 'RPE after full time',
  testing: 'Staff entered',
  rehab: 'Stage log',
  recovery: '—',
  meeting: '—',
};

/* The six-swatch legend (§5) covers Pitch/Gym/Rehab/Testing/Match/Recovery
 * — Meeting has a swatch in the type table but not the legend row, matched
 * here by simply listing the five real types plus training last. */
export const LEGEND_TYPES: DbSessionType[] = ['training', 'gym', 'rehab', 'testing', 'match', 'recovery'];

export function clockLabel(decimalHour: number): string {
  const totalMin = Math.round(decimalHour * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type GeometryInput = {
  id: string;
  start: number; // decimal hours
  mins: number;
  name: string;
  athleteIds: readonly string[];
};

export type Placed<T extends GeometryInput> = {
  x: T;
  end: number;
  col: number;
  of: number;
};

/** §5 "Block placement" — sessions sort by start, each takes the first free
 *  column among sessions it overlaps, and a cluster's `of` is the max
 *  column in it plus one. Ported line for line. */
export function placeBlocks<T extends GeometryInput>(list: readonly T[]): Placed<T>[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const placed: Placed<T>[] = sorted.map((x) => ({ x, end: x.start + x.mins / 60, col: 0, of: 1 }));

  placed.forEach((p, i) => {
    const used: Record<number, boolean> = {};
    for (let j = 0; j < i; j += 1) {
      const pj = placed[j];
      if (pj && pj.x.start < p.end && p.x.start < pj.end) used[pj.col] = true;
    }
    while (used[p.col]) p.col += 1;
  });

  placed.forEach((p) => {
    const over = placed.filter((q) => q.x.start < p.end && p.x.start < q.end);
    const of = Math.max(...over.map((q) => q.col)) + 1;
    over.forEach((q) => {
      q.of = Math.max(q.of, of);
    });
  });

  return placed;
}

export type HorizontalLayout = { stagger: boolean; tied: boolean; width: number; left: number };

/** §5 "Horizontal treatment — three cases", ported verbatim including both
 *  named fallbacks (a 50/50 split truncating names to three characters; a
 *  tied stagger hiding a name completely) — skipping either reproduces the
 *  bug it fixed. */
export function horizontalLayout<T extends GeometryInput>(p: Placed<T>, placed: readonly Placed<T>[]): HorizontalLayout {
  const stagger = p.of > 1;
  const tied = placed.some((q) => q !== p && q.x.start === p.x.start && q.x.start < p.end && p.x.start < q.end);
  const width = !stagger ? 98.5 : tied ? 100 / p.of - 1.5 : 100 - (p.of - 1) * STAGGER;
  const left = !stagger ? 0 : tied ? (p.col / p.of) * 100 : p.col * STAGGER;
  return { stagger, tied, width, left };
}

/** §5 "Vertical treatment". `32` is real chrome (14px padding, 2px border,
 *  a 15px time line, 1px margin); each name line is 15px. Height clears
 *  content, never just duration — a 30-minute session is 31px of grid but
 *  needs 47px for a one-line name, 62px for two. */
export function nameLines(name: string): 1 | 2 {
  return name.length <= 13 ? 1 : 2;
}

export function blockHeight<T extends GeometryInput>(p: Placed<T>, stagger: boolean): number {
  const lines = nameLines(p.x.name);
  const raw = (p.x.mins / 60) * PXH - 3;
  return stagger ? Math.max(33, raw) : Math.max(32 + lines * 15, raw);
}

/** §5 "What a block shows" — `clearance` is the vertical distance in px to
 *  the nearest block drawn over this one (only a block in a *later* column
 *  can cover an earlier one, per the spec's own `q.col > p.col` guard),
 *  Infinity when nothing covers it. */
export function clearance<T extends GeometryInput>(p: Placed<T>, placed: readonly Placed<T>[]): number {
  const covering = placed.filter((q) => q.col > p.col && q.x.start < p.end && p.x.start < q.end);
  if (covering.length === 0) return Infinity;
  return Math.min(...covering.map((q) => (q.x.start - p.x.start) * PXH));
}

export type BlockDisplay = {
  h: number;
  stagger: boolean;
  tied: boolean;
  width: number;
  left: number;
  showTime: boolean;
  showBadge: boolean;
  timeText: string;
  zIndex: number;
};

/** Assembles every §5 derived value for one placed block. `moved` is true
 *  when this session currently carries a local, unpublished edit (this
 *  build's real stand-in for the spec's `moved` flag — see schedule
 *  workspace's overlay model). */
export function computeBlockDisplay<T extends GeometryInput>(
  p: Placed<T>,
  placed: readonly Placed<T>[],
  moved: boolean,
): BlockDisplay {
  const { stagger, tied, width, left } = horizontalLayout(p, placed);
  const h = blockHeight(p, stagger);
  const clear = clearance(p, placed);
  const showTime = stagger ? clear >= 39 && h >= 62 : true;
  const showBadge = moved && !tied;
  const timeText =
    stagger || moved
      ? clockLabel(p.x.start)
      : `${clockLabel(p.x.start)} – ${clockLabel(p.end)}`;
  const zIndex = stagger ? 6 : 2 + p.col;
  return { h, stagger, tied, width, left, showTime, showBadge, timeText, zIndex };
}

/** Two real athlete-ID sets "share" when neither is empty and they
 *  intersect. An empty set (no real athlete named in the session — the
 *  real proxy for a staff-only session, see this file's header) never
 *  shares with anything, the same outcome §5's literal 'Staff'/'Academy'
 *  exception produced, derived from real data instead of asserted by
 *  string. */
export function sharesAthletes(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return b.some((id) => set.has(id));
}

export type ClashResult = { pairLabels: string[]; clashedIds: Set<string> };

/** §5 "Clash detection" — two sessions clash only when they overlap AND
 *  share real athletes. The once-only guard tiebreaks on column index
 *  (unique inside a cluster), not start time (two sessions can start the
 *  same minute and both satisfy a start-time comparison, reporting the
 *  pair twice) — ported exactly. */
export function detectClashes<T extends GeometryInput>(placed: readonly Placed<T>[]): ClashResult {
  const pairLabels: string[] = [];
  const clashedIds = new Set<string>();
  placed.forEach((p) => {
    const sharing = placed.filter(
      (q) => q !== p && q.x.start < p.end && p.x.start < q.end && sharesAthletes(p.x.athleteIds, q.x.athleteIds),
    );
    sharing.forEach((q) => {
      clashedIds.add(p.x.id);
      clashedIds.add(q.x.id);
      if (p.col < q.col) pairLabels.push(`${p.x.name} and ${q.x.name}`);
    });
  });
  return { pairLabels, clashedIds };
}
