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

/** `timezone` is required, not defaulted, on these four display formatters —
 *  unlike `todayIso`/`dateInTz`/`zonedTimeToUtcIso`/`timeInTz`/
 *  `decimalHourInTz` below, which keep an optional `= DATE_TZ` fallback
 *  because they're also reachable from non-request-scoped callers. Every
 *  formatDate/formatLongDate/formatTime/formatDateTime call site sits under
 *  `(staff)/**` or `(athlete)/**` (or a shared component/query rendered
 *  from one of those trees), which always has a real org timezone from
 *  `requireStaff()`/`requireAthlete()`'s `ctx.timezone` — CLAUDE.md rule 5
 *  ("display in the organisation's timezone"). A silent `Europe/London`
 *  fallback here would keep every non-UK org's displayed times wrong
 *  without TypeScript ever flagging it; making the parameter required means
 *  a missing timezone is a compile error, not a silent bug. */
export function formatDate(iso: string | null | undefined, timezone: string): string {
  if (!iso) return BLANK;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  }).format(d);
}

export function formatLongDate(iso: string | null | undefined, timezone: string): string {
  if (!iso) return BLANK;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(d);
}

export function formatTime(iso: string | null | undefined, timezone: string): string {
  if (!iso) return BLANK;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(d);
}

/** "8 Aug 2026 09:14" — the audit-trail timestamp shape
 *  screens/user-management.md's own role-history wireframe uses, distinct
 *  from formatDate (no time) and formatTime (no date): a role-history row
 *  needs both, the same way an audit event needs to say not just which
 *  day something happened but when in it. */
export function formatDateTime(iso: string | null | undefined, timezone: string): string {
  if (!iso) return BLANK;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return BLANK;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
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

/** An instant as a decimal hour ("09:30" → 9.5) in a given timezone —
 *  SCHEDULE-SPEC.md §5's grid positions blocks on real clock time, so both
 *  a session's `starts_at` and "now" (for the now-line) need the same
 *  wall-clock-in-this-timezone conversion `timeInTz` already provides,
 *  just expressed as the number the grid's geometry math wants instead of
 *  an "HH:MM" string. */
export function decimalHourInTz(instant: Date, timeZone: string = DATE_TZ): number {
  const [hh = 0, mm = 0] = timeInTz(instant, timeZone).split(':').map(Number);
  return hh + mm / 60;
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

/** Gameplan 4.2 / audit S8: "MD-3" reads as scheduling shorthand to a coach
 *  but is unexplained jargon to a 16-year-old academy athlete. Plain-English
 *  companion to mdLabel, for a title attribute or subtext wherever an MD-n
 *  label renders in the athlete app — CLAUDE.md §6's own definition
 *  ("Matchday minus n days") spelled out, not reworded. */
export function mdExplainer(offset: number | null | undefined): string | null {
  if (offset === null || offset === undefined) return null;
  if (offset === 0) return 'Matchday';
  const n = Math.abs(offset);
  const days = n === 1 ? '1 day' : `${n} days`;
  return offset < 0 ? `${days} before matchday` : `${days} after matchday`;
}

/** Per-week MD-n re-anchoring for week strips and week grids.
 *
 *  Stored `md_offset` counts toward whichever fixture a session was created
 *  against, which for historical weeks can be a fixture in a LATER week —
 *  the audit caught a real matchday labelled "MD-7" because its stored
 *  offset targeted the following week's fixture. A week strip labels days
 *  relative to that week's OWN matchday, so: if any day in the window holds
 *  a match (or a session stored as MD, offset 0), every day is re-anchored
 *  to its nearest such matchday; only a window with no matchday of its own
 *  falls back to the stored countdown toward the next fixture, which is
 *  then genuinely what MD-n means for that week. */
export function anchorMdOffsetsToWeek(
  days: readonly { date: string; isMatch: boolean; storedMdOffset: number | null }[],
): Map<string, number | null> {
  const matchDates = days.filter((d) => d.isMatch || d.storedMdOffset === 0).map((d) => d.date);
  const out = new Map<string, number | null>();
  if (matchDates.length === 0) {
    for (const d of days) out.set(d.date, d.storedMdOffset);
    return out;
  }
  for (const d of days) {
    let best: number | null = null;
    for (const m of matchDates) {
      const offset = daysBetween(m, d.date);
      // Nearest matchday wins; on a tie, the upcoming one (negative offset,
      // "building toward Saturday") reads better than the one just played.
      if (best === null || Math.abs(offset) < Math.abs(best) || (Math.abs(offset) === Math.abs(best) && offset < best)) {
        best = offset;
      }
    }
    out.set(d.date, best);
  }
  return out;
}

const ENUM_LABELS: Record<string, string> = {
  lower_back: 'Lower back',
  upper_back: 'Upper back',
  upper_arm: 'Upper arm',
  wrist: 'Wrist',
  hand: 'Hand',
  load_management: 'Load management',
  training_rpe: 'Session RPE',
  // Acronyms the generic title-case fallback below can't get right on its
  // own — found live on the Flags screen ("Gps" instead of "GPS", a
  // flag_domain value) and the gym programme builder's own Load basis
  // dropdown ("Rpe" instead of "RPE", a load_basis value).
  gps: 'GPS',
  rpe: 'RPE',
  // CLAUDE.md §6: "Fixture: A match. A session with an opponent." The
  // schema/session_type value stays 'match' (not renamed — see the fixture
  // detail route and DbSessionType, which already say 'Fixture' throughout),
  // but every session-type chip, legend and picker that renders this enum
  // through enumLabel() now shows the same word the fixture detail page
  // does, instead of "Match" in one place and "Fixture" one click away.
  match: 'Fixture',
};

/** Enum values are rendered from a fixed label set, never as free text. */
export function enumLabel(value: string | null | undefined): string {
  if (!value) return BLANK;
  const mapped = ENUM_LABELS[value];
  if (mapped) return mapped;
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** English ordinal suffix — 1st/2nd/3rd/4th..., with the 11th/12th/13th
 *  exception. Every percentile and rank label in the app should render
 *  through this rather than hard-coding "th" (found live on the squad
 *  profile page's position benchmarks: "73th percentile", "81th
 *  percentile" — every value not ending in 0, 4-9, 11, 12 or 13 was
 *  wrong). */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Whole years old as of today in `timeZone` — an under-18 gate (leaderboard
 *  consent, minor-specific notification defaults) needs the athlete's own
 *  local "today", not the server's. Used to read raw UTC via `new Date()`
 *  directly; the only real-world effect was a birthday landing on the wrong
 *  side of the cutoff for the few hours each day UTC's date has already
 *  advanced but the athlete's local date hasn't (or vice versa) — audit
 *  minor finding, same anti-pattern class as the dayBounds() fix, just too
 *  narrow a window to matter in practice for most timezones. Fixed the same
 *  way: `dateInTz`, never a raw `Date` component read. */
function ymdParts(iso: string): [number, number, number] | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return [year, month, day];
}

export function ageFrom(dob: string | null | undefined, timeZone: string = DATE_TZ): number | null {
  if (!dob) return null;
  const born = ymdParts(dob);
  if (!born) return null;
  const today = ymdParts(dateInTz(new Date(), timeZone));
  if (!today) return null;
  let age = today[0] - born[0];
  const m = today[1] - born[1];
  if (m < 0 || (m === 0 && today[2] < born[2])) age -= 1;
  return age;
}
