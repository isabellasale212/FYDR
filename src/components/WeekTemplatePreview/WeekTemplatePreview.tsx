import { TYPE_STYLE, clockLabel, computeHourRange, type DbSessionType } from '@/lib/scheduleGeometry';
import { mdLabel } from '@/lib/format';

/** A miniature of the week this template will produce.
 *
 *  WHAT IT REPLACED, and why. The builder's header used to be WeekLoadChart —
 *  planned load per position, as bars, over a "Total planned load" caption. That
 *  answers a sports-science question. The question in front of somebody BUILDING
 *  a template is "what does this week actually look like", and a bar chart of
 *  RPE x minutes cannot answer it: two very different weeks with the same load
 *  draw the same picture. This draws the shape instead — every session as a
 *  block, at its real start time, in the colours the live schedule already uses,
 *  so the preview and the thing it previews read as the same object.
 *
 *  THE COLUMNS ARE MD POSITIONS, NOT WEEKDAYS, and that is the data rather than
 *  a preference. A week template is anchored to the fixture: its structure
 *  carries `anchor: 'fixture'`, a `covers` range in MD offsets and a per-day
 *  `mdOffset` from -14 to +7, and no weekday anywhere. A weekday only exists
 *  once the template is APPLIED against a real fixture, which is what
 *  /schedule/planner/apply resolves. Printing Monday to Sunday here would mean
 *  inventing a match day, and would be wrong for every midweek fixture — the
 *  same template applied to a Saturday game and a Tuesday game produces two
 *  different sets of weekday names from identical data.
 *
 *  NOT EDITABLE, deliberately and completely: no button, no input, no handler.
 *  Editing lives in the day cards below, which is also where a session is
 *  removed. A preview that could be half-edited would be a second, worse editor
 *  competing with the real one. */

export type PreviewSession = {
  key: string;
  title: string;
  type: DbSessionType;
  startTime: string; // HH:MM
  durationMin: number | null;
};

export type PreviewDay = {
  mdOffset: number;
  sessions: readonly PreviewSession[];
};

/** Pixels per hour. Far tighter than the real grid's 66: this is a glance, and a
 *  whole day has to fit in a header without scrolling. */
const PXH = 20;

/** A session with no planned duration still has to occupy space, or it would be
 *  invisible in the one view whose job is showing what is there. An hour is the
 *  same assumption the draft card starts from. */
const ASSUMED_MIN = 60;

function toDecimalHour(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) + Number(m) / 60;
}

export function WeekTemplatePreview({ days }: { days: readonly PreviewDay[] }) {
  const all = days.flatMap((d) =>
    d.sessions.map((s) => ({ start: toDecimalHour(s.startTime), mins: s.durationMin ?? ASSUMED_MIN })),
  );

  if (all.length === 0) {
    return (
      <p className="tiny" style={{ color: 'var(--faint)' }}>
        Nothing planned yet. Sessions you add below will appear here, laid out as the week they will
        produce.
      </p>
    );
  }

  /* A TIGHT window, unlike the live grid's. computeHourRange gives that grid a
     stable 07:00-21:00 frame so blocks do not jump around as a week is edited —
     right there, wrong here: this is a thumbnail in a header, and a template
     whose sessions all sit between 09:00 and 13:30 was drawing two thirds of
     itself as empty evening. So the frame is the data's own span, padded by an
     hour each way, floored at two hours so a single session still has context.
     computeHourRange still sets the outer bound, so a template with a 06:00
     start cannot draw outside what the real grid would show. */
  const outer = computeHourRange(all);
  const earliest = Math.min(...all.map((a) => a.start));
  const latest = Math.max(...all.map((a) => a.start + a.mins / 60));
  const h0 = Math.max(outer.h0, Math.floor(earliest) - 1);
  const h1 = Math.max(h0 + 2, Math.min(outer.h1, Math.ceil(latest) + 1));
  const height = Math.max(1, h1 - h0) * PXH;
  const hours = Array.from({ length: Math.max(1, h1 - h0) + 1 }, (_, i) => h0 + i);

  return (
    <div className="wtp">
      <div className="wtp-grid" style={{ gridTemplateColumns: `34px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="wtp-corner" />
        {days.map((d) => (
          <div key={d.mdOffset} className="wtp-head">
            {mdLabel(d.mdOffset)}
          </div>
        ))}

        <div className="wtp-gutter" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="wtp-hour num" style={{ top: (h - h0) * PXH }}>
              {clockLabel(h)}
            </span>
          ))}
        </div>

        {days.map((d) => (
          <div key={d.mdOffset} className="wtp-col" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="wtp-line" style={{ top: (h - h0) * PXH }} />
            ))}
            {d.sessions.map((s) => {
              const start = toDecimalHour(s.startTime);
              const mins = s.durationMin ?? ASSUMED_MIN;
              const style = TYPE_STYLE[s.type];
              const blockH = Math.max(18, (mins / 60) * PXH);
              /* Two lines do not fit in a short block, and the one that
                 identifies the session is the name — the same call TimeGrid
                 makes when a block cannot hold everything. The time is still on
                 the hover title, and in the day card below. */
              const showTime = blockH >= 30;
              return (
                <span
                  key={s.key}
                  className="wtp-block"
                  style={{
                    top: (start - h0) * PXH,
                    /* A 30-minute session at this scale is 10px, which is a
                       line rather than a block, so a floor keeps every session
                       legible without distorting the longer ones. */
                    height: blockH,
                    background: style.bg,
                    borderInlineStart: `2px solid ${style.tone}`,
                  }}
                  title={`${s.title} · ${s.startTime}${s.durationMin === null ? '' : ` · ${s.durationMin}m`}`}
                >
                  <span className="wtp-block-name">{s.title}</span>
                  {showTime ? <span className="wtp-block-time num">{s.startTime}</span> : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
