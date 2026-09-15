'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DayColumn } from './TimeGrid';
import type { BaseSession } from './types';
import { TYPE_STYLE, clockLabel } from '@/lib/scheduleGeometry';
import { dayMonthShort, enumLabel, weekdayLong } from '@/lib/format';
import { dayHeadMeta, dayStep, nextSessionLine, phoneDayDefault, rowMeta } from '@/lib/schedulePhoneDay';

/* PATTERN-S4 C6 / B4 (2026-09-13): the phone schedule is day-first. The
 * board: "No grid at 375px. The dashboard's strip carries the week at 74px
 * a tile: day, date, MD offset, minutes. Five fit, seven scroll, and today
 * is the selected tile. Below it the day is a list, and each session row is
 * the tap target at 44px or more. There is no Read/Edit control on the
 * phone — the day list is read until you tap into something."
 *
 * Drawn by ScheduleWorkspace from the SAME day columns and effective
 * sessions the grid uses, so the two views can never disagree; CSS decides
 * which one is on screen (.sg-phone below 768px, .sg-desktop above). A saved
 * session row opens its page; a fixture row opens the fixture; a held edit
 * or draft (unpublished, made on a desktop) is listed as held rather than
 * linked, because the phone has no editor to open. The + on the day heading
 * opens the new-session PAGE for that day — forms stay pages.
 *
 * THE DAY ONLY, since 16 Sept 2026 (Isabella's overnight queue, 2.1: "show
 * the DAY only, and the day is editable. No week view at phone width. The
 * week stays desktop only."): the seven-tile strip is gone; a day stepper
 * — ‹ the day › — moves through the days, inside the loaded week as a
 * state change and across its edge as a navigation to that week with the
 * day in the address (?date=). The day is edited the way it always was on
 * a phone: a row opens the session's page, + opens the new-session page. */

type Props = {
  days: DayColumn[];
  sessions: (BaseSession & { edited: boolean; isNew: boolean })[];
  today: string;
  /** The day the address asked for (?date=), if any — the stepper's own
   *  navigation across a week's edge. */
  focusDate: string | null;
  /** The address of a day in another week: prefix + date + suffix (the
   *  group filter's query), strings because a function cannot cross the
   *  server boundary. */
  dayHrefPrefix: string;
  dayHrefSuffix: string;
  timezone: string;
  canEdit: boolean;
};

// The date words from lib/format.ts's pinned tables (15 Sept 2026).
const dayMonth = (date: string, timezone: string) => dayMonthShort(date, timezone);

export function SchedulePhoneDay({ days, sessions, today, focusDate, dayHrefPrefix, dayHrefSuffix, timezone, canEdit }: Props) {
  const dates = days.map((d) => d.date);
  const [day, setDay] = useState(() => phoneDayDefault(dates, today, focusDate));
  const col = days.find((d) => d.date === day) ?? days[0];
  const daySessions = sessions.filter((s) => s.dow === day).sort((a, b) => a.start - b.start);
  const dayFixtures = col?.fixtures ?? [];
  const weekday = weekdayLong(day, timezone);
  const next = nextSessionLine(sessions, day, timezone);
  const prev = dayStep(dates, day, -1);
  const after = dayStep(dates, day, 1);
  const stepper = (step: { date: string; inWeek: boolean }, label: string, glyph: string) =>
    step.inWeek ? (
      <button type="button" className="sg-phone-daynav-btn" aria-label={label} onClick={() => setDay(step.date)}>
        {glyph}
      </button>
    ) : (
      <Link href={`${dayHrefPrefix}${step.date}${dayHrefSuffix}`} className="sg-phone-daynav-btn" aria-label={label}>
        {glyph}
      </Link>
    );

  return (
    <div className="sg-phone">
      {/* The day heading is the stepper: ‹ the day › with its meta beneath,
          and + to add a session on it. Today is said as a word. */}
      <div className="sg-phone-day-head" data-today={col?.isToday || undefined} data-match={col?.isMatch || undefined}>
        {stepper(prev, 'Previous day', '‹')}
        <div className="sg-phone-day-titles">
          <h2 className="sg-phone-day-title">
            {col?.isToday ? 'Today · ' : ''}
            {weekday} {dayMonth(day, timezone)}
          </h2>
          <p className="sg-phone-day-meta num">
            {dayHeadMeta({ mdOffset: col?.mdOffset ?? null, sessions: daySessions.length, minutes: daySessions.reduce((n, s) => n + s.mins, 0) })}
          </p>
        </div>
        {stepper(after, 'Next day', '›')}
        {canEdit ? (
          <Link href={`/schedule/new?date=${day}`} className="btn-ghost-pill sg-phone-add" aria-label={`Add a session on ${weekday} ${dayMonth(day, timezone)}`}>
            +
          </Link>
        ) : null}
      </div>

      <div className="sg-phone-rows">
        {dayFixtures.map((f) => (
          <Link key={`f-${f.id}`} href={`/schedule/fixtures/${f.id}`} className="sg-phone-row" data-kind="fixture">
            <span className="sg-phone-row-time num">{f.timeText}</span>
            <span className="sg-phone-row-body">
              <span className="sg-phone-row-title">
                {f.homeAway === 'away' ? 'Away at' : 'Home v'} {f.opponent}
              </span>
              <span className="sg-phone-row-meta">Fixture · kick-off {f.timeText}</span>
            </span>
            <span className="sg-phone-row-chev" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
        {daySessions.map((s) => {
          const body = (
            <>
              <span className="sg-phone-row-time num">
                {clockLabel(s.start)} – {clockLabel(s.start + s.mins / 60)}
              </span>
              <span className="sg-phone-row-body">
                <span className="sg-phone-row-title">
                  <span className="sg-phone-row-dot" style={{ background: TYPE_STYLE[s.type].tone }} aria-hidden="true" />
                  {s.title || enumLabel(s.type)}
                </span>
                <span className="sg-phone-row-meta">
                  {/* The type word on every titled row (a11y sweep step 2, Class
                      3.2, 15 Sept 2026): the dot's hue carried it alone. An
                      untitled row already prints the type as its title. */}
                  {s.title ? `${enumLabel(s.type)} · ` : ''}
                  {rowMeta({ location: s.location, mins: s.mins, groupNames: s.groupNames, expected: s.athleteIds.length })}
                </span>
                {s.isNew || s.edited ? (
                  <span className="sg-phone-row-held">Held on this screen · not yet published — publish from the banner above</span>
                ) : null}
              </span>
            </>
          );
          return s.isNew || s.edited ? (
            <div key={s.id} className="sg-phone-row" data-held="">
              {body}
            </div>
          ) : (
            <Link key={s.id} href={`/schedule/${s.id}`} className="sg-phone-row">
              {body}
              <span className="sg-phone-row-chev" aria-hidden="true">
                ›
              </span>
            </Link>
          );
        })}
        {daySessions.length === 0 && dayFixtures.length === 0 ? (
          <p className="sg-phone-empty">Nothing on {weekday}.</p>
        ) : null}
      </div>

      {next ? (
        <Link href={`/schedule/${next.id}`} className="sg-phone-next">
          <span className="sg-phone-next-k">Next</span>
          <span className="num">{next.text}</span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}
    </div>
  );
}
