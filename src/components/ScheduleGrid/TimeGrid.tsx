'use client';

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
 *  geometric value below (PXH, the 58px gutter, hour-line tops) is a literal
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

        <div className="sg-grid-body">
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
                        left: `${b.left}%`,
                        width: `calc(${b.width}% - 4px)`,
                        zIndex: b.zIndex,
                        '--tone': style.tone,
                        '--bc': style.bc,
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
                        <div className="sg-block-name">{b.title}</div>
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
