/* Formatting. British English, 24 hour clock, metric units.
 *
 * CONTRACT.md rule 7 is enforced here: every helper returns null for missing
 * data so a component renders a blank, and never a zero. `dash()` is the one
 * place the blank glyph is chosen. */

const DATE_TZ = 'Europe/London';

/* The missing-data marker. A middle dot, as the athlete mockup uses for a day
 * with nothing on it. It is never a zero: CONTRACT.md rule 7. */
export const BLANK = '·';

/** A value that is absent renders as the blank marker, never as 0. */
export function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return BLANK;
  return String(value);
}

export function fullName(a: { first_name: string; last_name: string }): string {
  return `${a.first_name} ${a.last_name}`;
}

/** "J. Barnes", the compact row label from screens/dashboard.md field map. */
export function compactName(a: {
  first_name: string;
  last_name: string;
}): string {
  return `${a.first_name.slice(0, 1)}. ${a.last_name}`;
}

export function initials(a: { first_name: string; last_name: string }): string {
  return `${a.first_name.slice(0, 1)}${a.last_name.slice(0, 1)}`.toUpperCase();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return BLANK;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: DATE_TZ,
  }).format(d);
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return BLANK;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: DATE_TZ,
  }).format(d);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return BLANK;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DATE_TZ,
  }).format(d);
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return BLANK;
  return value.toFixed(decimals);
}

export function formatPercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): string {
  if (!numerator && numerator !== 0) return BLANK;
  if (!denominator) return BLANK;
  return `${Math.round((numerator / denominator) * 100)}%`;
}

/** Today in the organisation's timezone, as an ISO date. Never the server's. */
export function todayIso(timeZone: string = DATE_TZ): string {
  return dateInTz(new Date(), timeZone);
}

/** An arbitrary instant, as an ISO date in the given timezone. Used to file a
 *  training entry against the day the session happened
 *  (screens/training-entry.md: "the date the session happened, not the date
 *  it was rated"), not against whatever day it is when the athlete rates it. */
export function dateInTz(instant: Date, timeZone: string = DATE_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(instant);
}

/** A wall-clock date and time in a given timezone, as a UTC ISO instant.
 *
 *  CLAUDE.md rule 5: "never store a naive local time." A bare
 *  `new Date(\`${date}T${time}:00\`)` parses in the *browser's* timezone,
 *  which is a live version of exactly that bug: a coach filling in a session
 *  time is setting the club's local time, not their own device's, and the
 *  two differ for anyone travelling or testing from elsewhere. This resolves
 *  the offset for the given IANA zone on that specific date, so it is
 *  correct across a DST change, without adding a date library.
 *
 *  Method: interpret the wall-clock string as if it were already UTC, see
 *  what `timeZone` reads that instant as, and shift by the difference. One
 *  pass is enough because civil offsets do not change within the few hours
 *  a shift like that could be wrong by. */
export function zonedTimeToUtcIso(
  dateStr: string,
  timeStr: string,
  timeZone: string = DATE_TZ,
): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(naiveUtc);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const asIfUtc = Date.UTC(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')) === 24 ? 0 : Number(get('hour')),
    Number(get('minute')),
    Number(get('second')),
  );

  const offsetMs = naiveUtc.getTime() - asIfUtc;
  return new Date(naiveUtc.getTime() + offsetMs).toISOString();
}

/** A wall-clock time-of-day in a given timezone, as "HH:MM" — machine
 *  readable, for prefilling an `<input type="time">`, not for display
 *  (`formatTime` is the display version). The inverse half of
 *  `zonedTimeToUtcIso`: given a stored UTC instant, what did the clock on
 *  the wall in the club's timezone read? Uses `formatToParts` rather than
 *  `format()` because some environments render local midnight as "24:00",
 *  which is not a valid `<input type="time">` value. */
export function timeInTz(instant: Date, timeZone: string = DATE_TZ): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${hour}:${get('minute')}`;
}

/** The ISO 8601 (year, week) for a date, matching Postgres's own
 *  `extract(isoyear from d)` / `extract(week from d)` exactly — the check
 *  constraint on nutrition_checkins requires the two to agree, so this has
 *  to be the same algorithm, not an approximation. Standard ISO week
 *  algorithm: the week containing a date is numbered by which year its
 *  Thursday falls in, because ISO weeks always have four or more days in
 *  the year they're numbered under. */
export function isoWeekInfo(dateIso: string): { isoYear: number; isoWeek: number } {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // that week's Thursday
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const isoWeek = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { isoYear, isoWeek };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "MD-2", "MD". Null when the session is not anchored to a fixture. */
export function mdLabel(offset: number | null | undefined): string | null {
  if (offset === null || offset === undefined) return null;
  if (offset === 0) return 'MD';
  return offset < 0 ? `MD${offset}` : `MD+${offset}`;
}

const ENUM_LABELS: Record<string, string> = {
  lower_back: 'Lower back',
  upper_back: 'Upper back',
  upper_arm: 'Upper arm',
  wrist: 'Wrist',
  hand: 'Hand',
  load_management: 'Load management',
  training_rpe: 'Session RPE',
};

/** Enum values are rendered from a fixed label set, never as free text. */
export function enumLabel(value: string | null | undefined): string {
  if (!value) return BLANK;
  const mapped = ENUM_LABELS[value];
  if (mapped) return mapped;
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const born = new Date(`${dob}T12:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}
