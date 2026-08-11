'use client';

import { H0, H1, PXH, TYPE_STYLE, type DbSessionType } from '@/lib/scheduleGeometry';
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
  onSelect: (id: string) => void;
  onDayHeaderClick: (date: string) => void;
};

const HOURS = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

/** SCHEDULE-SPEC.md §5, "The time grid" — the screen's centre. Every
 *  geometric value below (H0/H1/PXH, the 58px gutter, the 1440px inner
 *  min-width, hour-line tops) is a literal port; ScheduleWorkspace has
 *  already run scheduleGeometry.ts's placement/clash algorithms before
 *  this component ever renders, so this file is pure layout, no math. */
export function TimeGrid({ days, mode, selectedId, nowDecimalHour, onSelect, onDayHeaderClick }: Props) {
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
          <div className="sg-hour-gutter">
            {HOURS.map((h) => (
              <span key={h} className="sg-hour-label mono" style={{ top: (h - H0) * PXH }}>
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div key={day.date} className="sg-day-col" data-today={day.isToday} data-past={day.isPast}>
              {HOURS.map((h) => (
                <div key={h} className="sg-hour-line" style={{ top: (h - H0) * PXH }} />
              ))}

              {day.isToday && nowDecimalHour !== null && nowDecimalHour >= H0 && nowDecimalHour <= H1 ? (
                <>
                  <div className="sg-now-line" style={{ top: (nowDecimalHour - H0) * PXH }} />
                  <div className="sg-now-dot" style={{ top: (nowDecimalHour - H0) * PXH }} />
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
            {days.reduce((sum, d) => sum + d.contactMins, 0)} athlete contact minutes · staff sessions excluded ·
            08:00 to 18:00 · red line is now{mode === 'edit' ? ' · drag a block to move it' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
