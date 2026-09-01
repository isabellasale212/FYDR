'use client';

import { useEffect, useRef } from 'react';

import { PXH, TYPE_STYLE, clockLabel, type DbSessionType } from '@/lib/scheduleGeometry';
import { enumLabel, mdLabel } from '@/lib/format';

export type RenderedBlock = {
  id: string;
  title: string;
  type: DbSessionType;
  groupNames: string[];
  top: number;
  height: number;
  left: number;
  width: number;
  zIndex: number;
  showTime: boolean;
  timeText: string;
  showBadge: boolean;
  clashed: boolean;
  stagger: boolean;
  tied: boolean;
};

export type DayColumn = {
  date: string;
  weekday: string;
  domLabel: string;
  isToday: boolean;
  isPast: boolean;
  isMatch: boolean;
  mdOffset: number | null;
  contactMins: number;
  blocks: RenderedBlock[];
};

type Props = {
  days: DayColumn[];
  mode: 'read' | 'edit';
  selectedId: string | null;
  nowDecimalHour: number | null; // only set on the real today column
  h0: number; // grid's first visible hour, computed per week — see scheduleGeometry.ts computeHourRange
  h1: number; // grid's last visible hour
  gridHeightPx: number; // (h1 - h0) * PXH, the shared column/gutter height
  onSelect: (id: string) => void;
  onDayHeaderClick: (date: string) => void;
};

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** SCHEDULE-SPEC.md §5, "The time grid" — the screen's centre. Every
 *  geometric value below (PXH, the 62px gutter, hour-line tops) is a literal
 *  port; ScheduleWorkspace has already run scheduleGeometry.ts's
 *  placement/clash algorithms and computeHourRange before this component
 *  ever renders, so this file is pure layout, no math. `h0`/`h1` are this
 *  week's real computed hour range (UX audit finding 1), not a fixed
 *  constant — the day columns' width is likewise not fixed (finding 2: see
 *  base.css's `.sg-grid-inner`/`.sg-grid-header`/`.sg-grid-body`, which now
 *  shrink to fit the available viewport down to a real per-column minimum
 *  instead of forcing a flat 1440px scroll). */
export function TimeGrid({ days, mode, selectedId, nowDecimalHour, h0, h1, gridHeightPx, onSelect, onDayHeaderClick }: Props) {
  const HOURS = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const bodyRef = useRef<HTMLDivElement>(null);

  /* A block is a fixed height — the session's real duration — so its content
   * has to fit or be cut. Three text lines fit a one-hour block, but only if
   * the session's name takes one of them: "Speed & power testing" wraps to two
   * and pushed the group line 13px past the bottom edge, where overflow:hidden
   * silently ate it and the clamped name ended "power…". Cutting either one is
   * wrong, so the secondary line goes instead: the name is what identifies the
   * session, and the group list is already ellipsised to a fragment.
   *
   * Measured rather than guessed from a height threshold, because whether a
   * name wraps depends on the column width, which is fluid — the same title
   * fits on one line at 1440px and two at 1100px. Re-measured on resize and
   * once webfonts land, since both change the wrap point. */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const fit = () => {
      el.querySelectorAll<HTMLElement>('.sg-block').forEach((b) => {
        b.removeAttribute('data-tight');
        b.style.removeProperty('--name-lines');
        const name = b.querySelector<HTMLElement>('.sg-block-name');
        if (!name) return;
        const group = b.querySelector<HTMLElement>('.sg-block-group');

        // Step 1 — drop the group line if the block misses by more than
        // rounding. Tolerance, not zero: sub-pixel line boxes leave a block
        // 1px over its own height without anything actually being cut, and a
        // zero test threw the group line away on blocks that fit fine. A real
        // miss is a whole line, so 4px separates the two cleanly.
        if (group && b.scrollHeight > b.clientHeight + 4) b.setAttribute('data-tight', '');

        // Step 2 — clamp the name to the lines that genuinely remain. A short
        // block in a narrow column has room for one line, not the CSS
        // default of two: at 1100px "Captain's run" wrapped and hung 16px
        // below its own bottom edge, and there was no group line left to
        // drop. Computed from what the block is actually made of, so it holds
        // at any column width.
        const s = getComputedStyle(b);
        const lh = parseFloat(getComputedStyle(name).lineHeight) || 16;
        const row = b.querySelector<HTMLElement>('.sg-block-row');
        const groupH =
          group && getComputedStyle(group).display !== 'none'
            ? group.getBoundingClientRect().height + parseFloat(getComputedStyle(group).marginTop || '0')
            : 0;
        const room =
          b.clientHeight -
          parseFloat(s.paddingTop) -
          parseFloat(s.paddingBottom) -
          (row ? row.getBoundingClientRect().height : 0) -
          groupH;
        b.style.setProperty('--name-lines', String(Math.max(1, Math.floor((room + 1.5) / lh))));
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  });

  return (
    <div className="card sg-grid-card">
      <div className="sg-grid-inner">
        <div className="sg-grid-header">
          <div />
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              className="sg-day-head"
              data-today={day.isToday}
              data-match={day.isMatch}
              onClick={() => onDayHeaderClick(day.date)}
            >
              <span>
                <span className="sg-day-head-weekday">{day.weekday}</span>
                <span className="sg-day-head-date mono">{day.domLabel}</span>
              </span>
              <div className="sg-day-head-row2">
                <span
                  className="sg-day-head-md mono"
                  data-tone={day.mdOffset === 0 ? 'md' : day.mdOffset === -1 ? 'md-1' : undefined}
                >
                  {mdLabel(day.mdOffset) ?? '—'}
                </span>
                <span className="sg-day-head-mins mono">{day.contactMins}m</span>
              </div>
            </button>
          ))}
        </div>

        <div className="sg-grid-body" ref={bodyRef}>
          <div className="sg-hour-gutter" style={{ height: gridHeightPx }}>
            {HOURS.map((h) => (
              <span key={h} className="sg-hour-label mono" style={{ top: (h - h0) * PXH }}>
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.date}
              className="sg-day-col"
              data-today={day.isToday}
              data-past={day.isPast}
              style={{ height: gridHeightPx }}
            >
              {HOURS.map((h) => (
                <div key={h} className="sg-hour-line" style={{ top: (h - h0) * PXH }} />
              ))}

              {day.isToday && nowDecimalHour !== null && nowDecimalHour >= h0 && nowDecimalHour <= h1 ? (
                <>
                  <div className="sg-now-line" style={{ top: (nowDecimalHour - h0) * PXH }} />
                  <div className="sg-now-dot" style={{ top: (nowDecimalHour - h0) * PXH }} />
                </>
              ) : null}

              {day.blocks.map((b) => {
                const style = TYPE_STYLE[b.type];
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="sg-block"
                    data-selected={selectedId === b.id}
                    data-edit={mode === 'edit'}
                    data-past={day.isPast}
                    data-stagger={b.stagger}
                    aria-label={`${b.title}, ${enumLabel(b.type)}, ${b.timeText}${
                      b.groupNames.length > 0 ? `, ${b.groupNames.join(' and ')}` : ''
                    }${b.showBadge ? ', edited' : ''}${b.clashed ? ', clashes with another session' : ''}`}
                    style={
                      {
                        top: b.top,
                        height: b.height,
                        // Inset inside the column so the hairline dividers stay
                        // visible either side. The design uses 6px; this is 4,
                        // because at 6 a block's text box lands on 96px and
                        // "Speed & power testing" measures 96px for its second
                        // line — it lost by a hair and clamped to "power…".
                        // Four buys 4px and the divider is no less visible. The
                        // percentages still come from the clash algorithm, so
                        // staggered blocks keep their split.
                        left: `calc(${b.left}% + 4px)`,
                        width: `calc(${b.width}% - 8px)`,
                        zIndex: b.zIndex,
                        '--tone': style.tone,
                        '--bc': style.bc,
                        '--time': style.text,
                      } as React.CSSProperties
                    }
                    onClick={() => onSelect(b.id)}
                  >
                    {!b.stagger ? (
                      <>
                        <div className="sg-block-row">
                          <span className="sg-block-time mono">{b.timeText}</span>
                          {b.showBadge ? <span className="sg-block-badge">Edited</span> : null}
                          {b.clashed ? <span className="sg-block-dot" aria-label="Clash" /> : null}
                        </div>
                        <div className="sg-block-name" title={b.title}>
                          {b.title}
                        </div>
                        {b.height >= 63 && b.groupNames.length > 0 ? (
                          <div className="sg-block-group">{b.groupNames.join(' + ')}</div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="sg-block-row">
                          <span className="sg-block-name">{b.title}</span>
                          {b.clashed ? <span className="sg-block-dot" aria-label="Clash" /> : null}
                          {b.showBadge ? <span className="sg-block-badge">Edited</span> : null}
                        </div>
                        {b.showTime ? <div className="sg-block-time-below mono">{b.timeText}</div> : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sg-legend-row">
          {(['training', 'gym', 'rehab', 'testing', 'match', 'recovery'] as DbSessionType[]).map((t) => (
            <span key={t} className="sg-legend-item">
              <span
                className="sg-legend-swatch"
                style={{ '--tone': TYPE_STYLE[t].tone, background: TYPE_STYLE[t].bg } as React.CSSProperties}
              />
              {enumLabel(t)}
            </span>
          ))}
          <span className="sg-caption">
            {days.reduce((sum, d) => sum + d.contactMins, 0)} athlete contact minutes · staff sessions excluded ·{' '}
            {clockLabel(h0)} to {clockLabel(h1)} · red line is now
            {mode === 'edit' ? ' · drag a block to move it' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
