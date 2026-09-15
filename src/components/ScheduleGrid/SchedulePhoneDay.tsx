'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { DayColumn } from './TimeGrid';
import type { BaseSession } from './types';
import { TYPE_STYLE, clockLabel } from '@/lib/scheduleGeometry';
import { dayMonthShort, enumLabel, mdLabel, weekdayLong } from '@/lib/format';
import { dayHeadMeta, nextSessionLine, phoneDayDefault, rowMeta } from '@/lib/schedulePhoneDay';

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
 * opens the new-session PAGE for that day — forms stay pages. */

type Props = {
  days: DayColumn[];
  sessions: (BaseSession & { edited: boolean; isNew: boolean })[];
  today: string;
  timezone: string;
  canEdit: boolean;
};

// The date words from lib/format.ts's pinned tables (15 Sept 2026).
const dayMonth = (date: string, timezone: string) => dayMonthShort(date, timezone);

export function SchedulePhoneDay({ days, sessions, today, timezone, canEdit }: Props) {
  const [day, setDay] = useState(() => phoneDayDefault(days.map((d) => d.date), today));
  const col = days.find((d) => d.date === day) ?? days[0];
  const daySessions = sessions.filter((s) => s.dow === day).sort((a, b) => a.start - b.start);
  const dayFixtures = col?.fixtures ?? [];
  const weekday = weekdayLong(day, timezone);
  const next = nextSessionLine(sessions, day, timezone);

  return (
    <div className="sg-phone">
      <div className="sg-phone-strip" role="tablist" aria-label="Days of the week">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            className="sg-phone-tile"
            aria-selected={d.date === day}
            data-today={d.isToday || undefined}
            data-match={d.isMatch || undefined}
            onClick={() => setDay(d.date)}
          >
            <span className="sg-phone-tile-day">{d.weekday}</span>
            <span className="sg-phone-tile-date num">{d.domLabel}</span>
            <span className="sg-phone-tile-meta num">
              {mdLabel(d.mdOffset) ?? '—'} · {d.contactMins}m
            </span>
          </button>
        ))}
      </div>

      <div className="sg-phone-day-head">
        <div>
          <h2 className="sg-phone-day-title">
            {weekday} {dayMonth(day, timezone)}
          </h2>
          <p className="sg-phone-day-meta num">
            {dayHeadMeta({ mdOffset: col?.mdOffset ?? null, sessions: daySessions.length, minutes: daySessions.reduce((n, s) => n + s.mins, 0) })}
          </p>
        </div>
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
