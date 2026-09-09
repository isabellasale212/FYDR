'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ordinal } from '@/lib/format';
import { UNITS, BANDS, type WallAthlete, type WallBoard, type WallData } from '@/lib/queries/leaderboardWall';
import {
  computeWallDerived,
  fmt,
  gainCell,
  rankAthletesInPool,
  rankBandColor,
  rankMarkerColor,
  sparklinePath,
  standardCell,
  type Rank,
  type WallMover,
} from '@/lib/leaderboardWallMath';

type Lens = 'Result' | 'Improvement' | 'Standard';
type Scope = 'Positional unit' | 'Age band' | 'Whole squad';

type Props = {
  data: WallData;
  activeGroupLabel: string;
};

type WallGroup = { label: string; athletes: WallAthlete[] };

/** Audit finding 44: rows within a group scan best-first on the board currently
 *  shown, not age — you can't scan a column for the best athlete otherwise. Age
 *  stays visible as the badge next to each name (`.lbw-age`); this only changes
 *  row order. One comparator shared by all three scopes so "ranked by the first
 *  column" means the same thing everywhere on the wall — 'Whole squad' already
 *  sorted this way, 'Positional unit' and 'Age band' now match it. */
function sortByRank(athletes: readonly WallAthlete[], board: WallBoard | undefined): WallAthlete[] {
  return [...athletes].sort((a, b) => {
    if (!board) return a.name.localeCompare(b.name);
    const av = a.values[board.key]?.current ?? null;
    const bv = b.values[board.key]?.current ?? null;
    if (av === null && bv === null) return a.name.localeCompare(b.name);
    if (av === null) return 1;
    if (bv === null) return -1;
    return board.lowerIsBetter ? av - bv : bv - av;
  });
}

function buildGroups(athletes: readonly WallAthlete[], scope: Scope, activeGroupLabel: string, firstBoard: WallBoard | undefined): WallGroup[] {
  if (scope === 'Positional unit') {
    return UNITS.map((label, i) => ({
      label,
      athletes: sortByRank(athletes.filter((a) => a.unitIndex === i), firstBoard),
    })).filter((g) => g.athletes.length > 0);
  }
  if (scope === 'Age band') {
    return BANDS.map((label, i) => ({
      label,
      athletes: sortByRank(athletes.filter((a) => a.bandIndex === i), firstBoard),
    })).filter((g) => g.athletes.length > 0);
  }
  return [{ label: activeGroupLabel, athletes: sortByRank(athletes, firstBoard) }];
}

function groupCellText(list: readonly WallAthlete[], board: WallBoard, isGain: boolean): string {
  if (!isGain) {
    const vals = list.map((a) => a.values[board.key]?.current).filter((v): v is number => v !== null && v !== undefined);
    if (vals.length === 0) return '·';
    return fmt(vals.reduce((s, v) => s + v, 0) / vals.length, board.decimals);
  }
  const gains = list
    .map((a) => {
      const v = a.values[board.key];
      if (!v) return null;
      return gainCell(board, v.current, v.first).sortValue;
    })
    .filter((g): g is number => g !== null && g !== 0 && Math.abs(g) > board.typicalError);
  if (gains.length === 0) return `– 0/${list.length}`;
  const mean = gains.reduce((s, g) => s + g, 0) / gains.length;
  return `${mean > 0 ? '▲ +' : '▼ −'}${fmt(Math.abs(mean), board.decimals)} · ${gains.length}/${list.length}`;
}

const LEGEND: Record<Lens, { label: string; bg: string }[]> = {
  Result: [
    { label: 'Top of the group', bg: 'rgb(var(--accent-rgb) / 0.22)' },
    { label: 'Above the middle', bg: 'rgb(var(--accent-rgb) / 0.1)' },
    { label: 'Below the middle', bg: 'rgb(var(--warn-rgb) / var(--lb-tint-alpha))' },
    { label: 'Bottom of the group', bg: 'rgb(var(--bad-rgb) / var(--lb-tint-alpha))' },
  ],
  Improvement: [
    { label: 'Clear gain', bg: 'rgb(var(--accent-rgb) / 0.22)' },
    { label: 'Small gain', bg: 'rgb(var(--accent-rgb) / 0.1)' },
    { label: 'Went backwards', bg: 'rgb(var(--bad-rgb) / var(--lb-tint-alpha))' },
    { label: 'No meaningful change', bg: 'var(--hair)' },
  ],
  Standard: [
    { label: 'Meets the standard', bg: 'rgb(var(--lb-standard-met-rgb) / 0.2)' },
    { label: 'Within 3%', bg: 'rgb(var(--warn-rgb) / var(--lb-tint-alpha))' },
    { label: 'Short of it', bg: 'rgb(var(--bad-rgb) / var(--lb-tint-alpha))' },
  ],
};

const CAPTIONS: Record<Lens, string> = {
  Result: 'Tint is rank position inside the scope, not an absolute standard',
  Improvement:
    'Change vs each athlete’s earliest result on file (2026-06-16 to 2026-08-10, this club’s real testing window) · a dash means the athlete has a result but nothing meaningful to report — inside the typical error of the protocol, exactly zero, or only one session on file so far · a plain dot means no result on file at all · wellness streak and compliance are not differenced, so Habits is unavailable here',
  Standard:
    'Against the club standard for the athlete’s position · forwards and backs are held to different numbers · these are Fydr-set placeholder standards, not club-specific norms, and there’s no way to change them yet',
};

function initials(name: string): string {
  const [surname, first] = name.split(',').map((s) => s.trim());
  return `${(first ?? '')[0] ?? ''}${(surname ?? '')[0] ?? ''}`.toUpperCase();
}

export function LeaderboardWall({ data, activeGroupLabel }: Props) {
  const derived = useMemo(() => computeWallDerived(data), [data]);

  const [lens, setLens] = useState<Lens>('Result');
  const [scope, setScope] = useState<Scope>('Positional unit');
  const [family, setFamily] = useState<WallBoard['family']>('Speed & power');
  const [sel, setSel] = useState<string | null>(
    () => data.athletes.find((a) => Object.values(a.values).some((v) => v.current !== null))?.id ?? data.athletes[0]?.id ?? null,
  );

  const isGain = lens === 'Improvement';
  const isStd = lens === 'Standard';
  /* A family is unavailable in a lens it cannot answer, rather than shown
   * answering it emptily. Habits and GPS are both gainable:false — a wellness
   * streak isn't differenced against a first test, and a GPS rolling mean has
   * no noise floor to separate a real gain from session variation. GPS is also
   * out under Standard: every one of its boards carries a null standard,
   * because this schema has no GPS norms-by-position table. */
  const familyUnavailable = (f: WallBoard['family']): string | null => {
    if (isGain && f === 'Habits')
      return 'Wellness streak and compliance aren’t differenced against a first test, so Habits has no meaningful improvement to show here.';
    if (isGain && f === 'GPS')
      return 'GPS boards are a rolling four-week mean with no per-metric typical error, so a change here can’t be told apart from normal session-to-session variation.';
    if (isStd && f === 'GPS')
      return 'No GPS norms-by-position exist in this schema, so these boards carry no standard to be measured against.';
    return null;
  };
  const effectiveFamily = familyUnavailable(family) ? 'Speed & power' : family;

  const familyCounts = useMemo(() => {
    const counts: Partial<Record<WallBoard['family'], number>> = {};
    for (const b of data.boards) counts[b.family] = (counts[b.family] ?? 0) + 1;
    return counts;
  }, [data.boards]);

  const familyBoards = useMemo(() => data.boards.filter((b) => b.family === effectiveFamily), [data.boards, effectiveFamily]);

  const groups = useMemo(
    () => buildGroups(data.athletes, scope, activeGroupLabel, familyBoards[0]),
    [data.athletes, scope, activeGroupLabel, familyBoards],
  );

  const rankMaps = useMemo(() => {
    const byGroup: Map<string, Map<string, Rank>>[] = groups.map((g) => {
      const m = new Map<string, Map<string, Rank>>();
      for (const b of familyBoards) m.set(b.key, rankAthletesInPool(g.athletes, b));
      return m;
    });
    return byGroup;
  }, [groups, familyBoards]);

  const selAthlete = data.athletes.find((a) => a.id === sel) ?? null;
  const selUnitPool = selAthlete ? data.athletes.filter((a) => a.unitIndex === selAthlete.unitIndex) : [];
  const totalN = groups.reduce((s, g) => s + g.athletes.length, 0);

  const cols = familyBoards.length;
  const gridTemplateColumns = `minmax(190px, 1.4fr) repeat(${cols}, minmax(112px, 1fr))`;
  const wallMinWidth = 210 + cols * 122;

  if (data.athletes.length === 0) {
    return (
      <EmptyState
        title="No athletes in this filter"
        body="No athletes fall inside the selected group. Clear the filter to see the whole squad."
      />
    );
  }

  return (
    <>
      <div className="card lbw-stats-card dash-stats">
        <div className="dash-stat">
          <p className="dash-stat-label">Boards</p>
          <p className="dash-stat-value">{derived.stats.boards}</p>
          <p className="dash-stat-sub">across {derived.stats.familyCount} families</p>
          <p className="dash-stat-foot">club wide, every athlete included</p>
        </div>
        <div className="dash-stat">
          <p className="dash-stat-label">Athletes</p>
          <p className="dash-stat-value">{derived.stats.athletes}</p>
          <p className="dash-stat-sub">with results on file</p>
          <p className="dash-stat-foot">best of three, staff entered</p>
        </div>
        <div className="dash-stat" data-tone="good">
          <p className="dash-stat-label">Meeting standard</p>
          <p className="dash-stat-value">
            {derived.stats.meetingStandardPct}
            <span className="unit">%</span>
          </p>
          <p className="dash-stat-sub">of all athlete-board pairs</p>
          <p className="dash-stat-foot" title="Fydr-set placeholder standard, not club-specific norms · not yet configurable">
            standards differ for forwards and backs · Fydr placeholder, not yet configurable
          </p>
        </div>
        <div className="dash-stat" data-tone="accent">
          <p className="dash-stat-label">Improved</p>
          {/* Colour comes from data-tone on the tile, not an inline --accent:
              --accent is the brand fill and measures 4.24:1 as text on this
              tile's own wash, under the 4.5:1 floor. --accent-pill-text is the
              derived text pair for exactly this background (5.28:1). */}
          <p className="dash-stat-value">
            {derived.stats.improvedCount}
          </p>
          <p className="dash-stat-sub">on at least one board</p>
          <p className="dash-stat-foot">beyond the typical error · {derived.stats.measurableBoards} measurable boards</p>
        </div>
      </div>

      <div className="lbw-movers-head">
        <p className="lbw-movers-title">Moved the most</p>
        <span className="pill pill-gold">since first test</span>
        <span className="lbw-movers-caption">mean gain across the {derived.stats.measurableBoards} measurable boards · changes inside the typical error are ignored</span>
      </div>

      {derived.movers.length === 0 ? (
        <div className="card">
          <p className="tiny" style={{ margin: 0 }}>
            No qualifying movers yet. Most athletes in this dataset have one recorded test
            session per board so far — a real gain needs two. This will populate as
            re-tests are logged.
          </p>
        </div>
      ) : (
        <div className="lbw-movers-grid">
          {derived.movers.slice(0, 3).map((m, i) => (
            <MoverCard
              key={m.athleteId}
              mover={m}
              rank={i + 1}
              measurableBoards={derived.stats.measurableBoards}
              onSelect={() => setSel(m.athleteId)}
              selected={m.athleteId === sel}
            />
          ))}
        </div>
      )}

      <div className="lbw-controls-row">
        <div className="lbw-segmented" role="tablist" aria-label="Lens">
          {(['Result', 'Improvement', 'Standard'] as const).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={lens === l} onClick={() => setLens(l)}>
              {l}
            </button>
          ))}
        </div>
        <div className="lbw-ranked-in">
          <span className="eyebrow">Ranked in</span>
          <div className="chiprow">
            {(['Positional unit', 'Age band', 'Whole squad'] as const).map((s) => (
              <button key={s} type="button" className="squad-chip" aria-pressed={scope === s} onClick={() => setScope(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lbw-controls-row" style={{ marginTop: 'var(--sp-12)' }}>
        <div className="chiprow">
          {(['Speed & power', 'Endurance', 'Strength', 'GPS', 'Habits'] as const).map((f) => {
            const unavailable = familyUnavailable(f);
            const disabled = unavailable !== null;
            return (
              <button
                key={f}
                type="button"
                className={`squad-chip${disabled ? ' lbw-chip-disabled' : ''}`}
                aria-pressed={effectiveFamily === f}
                disabled={disabled}
                title={unavailable ?? undefined}
                onClick={() => !disabled && setFamily(f)}
              >
                {f} <span className="lbw-chip-count">{familyCounts[f] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="lbw-legend">
          {LEGEND[lens].map((entry) => (
            <span key={entry.label} className="lbw-legend-item">
              <span className="lbw-swatch" style={{ background: entry.bg }} />
              {entry.label}
            </span>
          ))}
        </div>
      </div>

      <div className="card lbw-wall-card">
        <div className="lbw-wall-scroll">
          <div style={{ minWidth: wallMinWidth }}>
            <div className="lbw-wall-header" style={{ display: 'grid', gridTemplateColumns, gap: 'var(--sp-8)' }}>
              <div className="lbw-wall-head-name">Athlete</div>
              {familyBoards.map((b) => (
                <div key={b.key} className="lbw-wall-head-board">
                  <div>{b.label}</div>
                  <div
                    className="lbw-wall-head-sub"
                    title={lens === 'Standard' ? 'Fydr-set placeholder standard, not club-specific norms · not yet configurable' : undefined}
                  >
                    {lens === 'Result' ? b.unit : lens === 'Improvement' ? `vs earliest · ${b.unit}` : b.standardFwd === null || b.standardBack === null ? 'no standard on file' : `std ${fmt(b.standardFwd, b.decimals)}/${fmt(b.standardBack, b.decimals)}`}
                  </div>
                </div>
              ))}
            </div>

            {groups.map((g, gi) => (
              <div key={g.label}>
                <div className="lbw-group-row" style={{ display: 'grid', gridTemplateColumns, gap: 'var(--sp-8)' }}>
                  <div className="lbw-group-label">{g.label}</div>
                  {familyBoards.map((b) => (
                    <div key={b.key} className="lbw-group-cell">
                      {groupCellText(g.athletes, b, isGain)}
                    </div>
                  ))}
                </div>

                {g.athletes.map((a) => {
                  const isSelected = a.id === sel;
                  return (
                    <div
                      key={a.id}
                      className={`lbw-athlete-row${isSelected ? ' is-selected' : ''}`}
                      style={{ display: 'grid', gridTemplateColumns, gap: 'var(--sp-8)' }}
                      onClick={() => setSel(a.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="lbw-name-cell">
                        <span className="lbw-name">{a.name}</span>
                        <span className="lbw-age">{a.age !== null ? `${a.age}` : '·'}</span>
                      </div>
                      {familyBoards.map((b) => {
                        const v = a.values[b.key];
                        const current = v?.current ?? null;

                        if (lens === 'Result') {
                          const rank = rankMaps[gi]?.get(b.key)?.get(a.id) ?? null;
                          if (!rank || current === null) {
                            return <ValueCell key={b.key} marker="" markerColor="var(--faint)" value="·" bg="transparent" />;
                          }
                          return (
                            <ValueCell
                              key={b.key}
                              marker={`#${rank.rank}`}
                              markerColor={rankMarkerColor(rank.rank, rank.n)}
                              value={fmt(current, b.decimals)}
                              bg={rankBandColor(rank.rank, rank.n)}
                            />
                          );
                        }
                        if (lens === 'Improvement') {
                          const cell = gainCell(b, current, v?.first ?? null);
                          return (
                            <ValueCell key={b.key} marker={cell.mark} markerColor={cell.fg ?? 'inherit'} value={cell.value} bg={cell.bg} valueColor={cell.fg ?? undefined} />
                          );
                        }
                        const std = standardCell(b, current, a.unitIndex);
                        if (!std || current === null) {
                          return <ValueCell key={b.key} marker="" markerColor="var(--faint)" value="·" bg="transparent" />;
                        }
                        return <ValueCell key={b.key} marker={std.marker} markerColor={std.markerColor} value={fmt(current, b.decimals)} bg={std.bg} />;
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="lbw-wall-caption">
          {CAPTIONS[lens]} · group rows show the group {isGain ? 'mean real gain, and how many of the group moved' : 'mean'} · n = {totalN}
        </p>
      </div>

      <div className="lbw-lower-grid">
        <div className="card">
          {selAthlete ? (
            <>
              <div className="lbw-sel-head">
                <span className="lbw-avatar">{initials(selAthlete.name)}</span>
                <div>
                  <p className="lbw-sel-name">{selAthlete.name}</p>
                  <p className="lbw-sel-meta">
                    {selAthlete.unitIndex !== null ? UNITS[selAthlete.unitIndex] : '·'} · {selAthlete.age ?? '·'}
                    {selAthlete.bandIndex !== null ? ` · ${BANDS[selAthlete.bandIndex]}` : ''}
                  </p>
                </div>
                <Link href={`/squad/${selAthlete.id}`} className="lbw-profile-link">
                  Profile ›
                </Link>
              </div>

              <div className="lbw-sel-table">
                {/* Four columns, named in full. "Unit" and "Squad" were two
                    bare nouns over two different kinds of number — a position
                    within the athlete's own positional unit, and a position in
                    the whole squad — and neither label said which was which.
                    "vs first" went with them: the wall's own Improvement view
                    is where a change over time is read, and repeating it here
                    made a four-number row out of a two-number question. */}
                <div className="lbw-sel-thead">
                  <div>Test</div>
                  <div className="r">Result</div>
                  <div className="r">In group</div>
                  <div className="r">Squad rank</div>
                </div>
                {data.boards.map((b) => {
                  const v = selAthlete.values[b.key];
                  const current = v?.current ?? null;
                  const unitRank = rankAthletesInPool(selUnitPool, b).get(selAthlete.id) ?? null;
                  const squadRank = rankAthletesInPool(data.athletes, b).get(selAthlete.id) ?? null;
                  return (
                    <div key={b.key} className="lbw-sel-row">
                      <p className="lbw-sel-test">{b.label}</p>
                      <div className="r lbw-sel-result">{current !== null ? `${fmt(current, b.decimals)}${b.unit}` : '·'}</div>
                      {/* The in-group placing is the one figure on this row that
                          is a RANK rather than a measurement, and beside a
                          column of "#11" it read as another one. The pill says
                          which of the two you are looking at without a second
                          word of explanation. */}
                      <div className="r">
                        {unitRank ? (
                          <span className="pill pill-accent num">{`${ordinal(unitRank.rank)}/${unitRank.n}`}</span>
                        ) : (
                          <span className="lbw-sel-none">·</span>
                        )}
                      </div>
                      <div className="r lbw-sel-squad">{squadRank ? `#${squadRank.rank}` : '·'}</div>
                    </div>
                  );
                })}
              </div>
              <p className="cap lbw-sel-foot">
                ranked in {scope.toLowerCase()} · {totalN} athletes
              </p>
            </>
          ) : (
            <p className="tiny" style={{ margin: 0 }}>Select an athlete on the wall to see their full record.</p>
          )}
        </div>

        <div className="card">
          <p className="lbw-leaders-title">Unit leaders</p>
          <p className="lbw-leaders-sub">Who tops each test inside each positional unit, for the boards currently shown.</p>
          <div className="lbw-leaders-grid">
            {familyBoards.map((b) => (
              <div key={b.key} className="lbw-leader-tile">
                <p className="lbw-leader-board">{b.label}</p>
                {derived.unitLeaders[b.key]?.map((leader, i) => (
                  <div key={UNITS[i]} className="lbw-leader-row">
                    <span className="lbw-leader-unit">{UNITS[i]}</span>
                    <span className="lbw-leader-value">{leader ? `${leader.surname} ${leader.value}` : '·'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}


function ValueCell({
  marker,
  markerColor,
  value,
  bg,
  valueColor,
}: {
  marker: string;
  markerColor: string;
  value: string;
  bg: string;
  valueColor?: string;
}) {
  return (
    <div className="lbw-value-cell" style={{ background: bg }}>
      {marker ? (
        <span className="lbw-value-marker" style={{ color: markerColor }}>
          {marker}
        </span>
      ) : null}
      <span className="lbw-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

function MoverCard({
  mover,
  rank,
  measurableBoards,
  onSelect,
  selected,
}: {
  mover: WallMover;
  rank: number;
  measurableBoards: number;
  onSelect: () => void;
  selected: boolean;
}) {
  const spark = mover.sessions.length >= 2 ? sparklinePath(mover.sessions, mover.lowerIsBetter) : null;
  return (
    <div
      className={`card lbw-mover-card${rank === 1 ? ' is-top' : ''}${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
    >
      <div className="lbw-mover-head">
        <span className="lbw-avatar">{initials(mover.name)}</span>
        <div style={{ minWidth: 0 }}>
          <p className="lbw-mover-name">{mover.name}</p>
          <p className="lbw-mover-unit">{mover.unit}</p>
        </div>
        <span className={`pill ${rank === 1 ? 'pill-gold' : 'pill-accent'}`}>
          {rank === 1 ? 'Biggest gain' : `#${rank} mover`}
        </span>
      </div>
      <div className="lbw-mover-delta">
        <span className="lbw-mover-delta-value">
          +{fmt(Math.abs(mover.toValue - mover.fromValue), mover.decimals)}
          {mover.unitLabel}
        </span>
        <span className="lbw-mover-delta-board">on {mover.boardLabel}</span>
      </div>
      <div className="lbw-mover-range">
        <span style={{ color: 'var(--faint)' }}>{fmt(mover.fromValue, mover.decimals)}</span>
        {' → '}
        <span style={{ color: 'var(--text)' }}>{fmt(mover.toValue, mover.decimals)}</span>
      </div>
      {spark ? (
        <div className="lbw-mover-spark">
          <svg viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
            <path d={spark.fill} fill="rgb(var(--accent2-rgb) / 0.14)" />
            <path d={spark.line} fill="none" stroke="var(--accent2)" strokeWidth={2.2} strokeLinejoin="round" />
            <circle cx={300} cy={spark.cy} r={4} fill="var(--accent)" />
          </svg>
        </div>
      ) : null}
      <p className="lbw-mover-foot">
        improved on {mover.improvedOn} of {measurableBoards} boards · {mover.sessions.length} test sessions
      </p>
    </div>
  );
}
