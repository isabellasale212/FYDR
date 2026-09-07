import type { DbSessionType, GridSession, NormalWeek } from '@/lib/queries/schedule';

export type { DbSessionType, NormalWeek };

export type GroupOption = { id: string; name: string; group_type: string };

export type TemplateOption = { id: string; name: string };

/** A day-column entry the client works with — `start`/`mins` are decimal
 *  hours so scheduleGeometry.ts's port of §5 can consume them directly,
 *  same shape the spec's own fixture rows use. */
export type BaseSession = {
  id: string;
  dow: string; // ISO date of the day column, e.g. '2026-08-05'
  start: number; // decimal hour
  mins: number;
  title: string;
  type: DbSessionType;
  location: string | null;
  mdOffset: number | null;
  groupIds: string[];
  groupNames: string[];
  athleteIds: string[];
  status: 'planned' | 'completed' | 'cancelled';
  /** The optimistic-lock token — this session's `updated_at` as of this
   *  page's load. Sent back on publish (schedule.ts's `updateSession`) so a
   *  concurrent edit made elsewhere since this page loaded is caught as a
   *  conflict instead of silently overwritten. See that function's own
   *  comment for the full reasoning. */
  updatedAt: string;
  /** Restriction-to-session-card linkage (integration audit Batch 3) — see
   *  GridSession's own field for what this counts and why it's a count
   *  rather than a per-athlete list. */
  restrictionConflictCount: number;
};

/** SCHEDULE-SPEC.md §9's `edits` overlay — only start, duration and group
 *  are ever real overrides; location/type/name are read-only for an
 *  existing session (see ScheduleWorkspace's own header for why). Keyed by
 *  the session's real id, not the spec's mockup `dow|name` composite —
 *  real sessions have stable UUIDs, which is strictly safer than a name
 *  key when two sessions on the same day happen to share a title (this
 *  org's real seed data does: 'Fixture', 'Recovery' repeat weekly). */
export type EditOverlay = {
  start?: number;
  mins?: number;
  groupIds?: string[];
  /* Added when the card grew an Edit action. These three were absent, which is
     why Name, Location and Type were read-only on a saved session: there was
     nowhere for the change to go. `location` is optional AND nullable, and every
     consumer must therefore apply it by PRESENCE ('location' in patch) rather
     than with ??, or clearing a location silently restores the old one. */
  title?: string;
  type?: DbSessionType;
  location?: string | null;
  /* The day the session sits on, as an ISO date. Moving a session across days
     IS a starts_at change, so publish has to rebuild the timestamp from this
     rather than from the snapshot's day — see handlePublish. md_offset is
     deliberately not touched by a move; the schema stores it rather than
     deriving it precisely so a postponed fixture cannot retroactively rewrite
     which MD-n a session was planned under, and the grid labels by the day's
     anchored offset anyway. */
  dow?: string;
};

export type DraftSession = {
  id: string; // synthetic 'new-<uuid>'
  dow: string;
  start: number;
  mins: number;
  title: string;
  type: DbSessionType;
  location: string | null;
  mdOffset: number | null;
  groupIds: string[];
};

export function toBaseSession(s: GridSession, timezone: string, decimalHourInTz: (iso: string, tz: string) => number): BaseSession {
  return {
    id: s.id,
    dow: s.entry_date,
    start: decimalHourInTz(s.starts_at, timezone),
    mins: s.duration_min ?? 30,
    title: s.title,
    type: s.session_type,
    location: s.location,
    mdOffset: s.md_offset,
    groupIds: s.groupIds,
    groupNames: s.groupNames,
    athleteIds: s.athleteIds,
    status: s.status,
    updatedAt: s.updated_at,
    restrictionConflictCount: s.restrictionConflictCount,
  };
}
