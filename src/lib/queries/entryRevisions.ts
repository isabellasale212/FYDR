import type { Db } from './groups';

/**
 * The revision chain. Read by both sides — the coach's player profile and the athlete's
 * own My Data.
 *
 * Why this file exists
 *   adr-005-immutable-entries.md O-28 specifies: "the athlete sees their own chain in
 *   full, the coach sees the current value plus an edited marker and can expand it, and
 *   any expansion is written to the audit log." None of that existed. Every read in this
 *   app goes through `wellness_entries_current` / `training_entries_current`, which by
 *   construction cannot show anyone that a value was corrected, let alone what it used
 *   to be. This file is the missing read.
 *
 * Why the same functions serve the athlete
 *   The clause O-28 puts FIRST is the athlete's, and it is the one the coach-only
 *   correction change made urgent: a coach can now change a number the athlete reported,
 *   and until this was wired the athlete was shown nothing at all. Nothing here needed a
 *   separate athlete-scoped query, because the scoping is not in the query — it is in
 *   the policy. `wellness_athlete_select` / `training_athlete_select` (0012) are
 *   `athlete_id = auth_athlete_id()` with no `superseded_by` predicate, so an athlete
 *   reading these functions gets their own chains in full and physically cannot get
 *   anyone else's; a coach gets the same shape for the athlete they asked for. Writing a
 *   second, near-identical read would have meant two places for a chain-walk bug to
 *   live. The one athlete-side difference is deliberate and is at the call site, not
 *   here: `recordRevisionChainView` is a staff-only concern (see its comment).
 *
 * The base-table read, which is deliberate and is the one place it is right
 *   ADR-005 rule 3 and this repo's own convention are blunt: read the `_current` view,
 *   never the base table, because a forgotten `superseded_by is null` silently
 *   double-counts. That rule protects code that wants CURRENT data. This file wants the
 *   opposite — the superseded rows are the product — so the view cannot serve it.
 *
 *   The protection is kept by construction rather than by the view: the shape returned
 *   below never mixes the two. Exactly one row per chain is the `current` value; every
 *   other row is inside `priorRevisions`, which is history and is typed as such. No
 *   caller can accidentally sum a list that contains both. Nothing here feeds an
 *   aggregate, a chart or a threshold — it feeds one panel that is about the chain.
 *
 * Tenancy
 *   `wellness_staff_select` / `training_staff_select` (migration 0012) already scope
 *   these tables to the caller's org and to coach/medical. The explicit `org_id` filter
 *   below is belt-and-braces in the same spirit as the rest of this query layer: RLS
 *   would turn a wrong org into an empty result anyway, so stating it means a leak would
 *   have to be two bugs, not one.
 */

/** One row in a chain. Deliberately the whole correctable surface plus provenance —
 *  a coach expanding "what did this say before" needs the values AND who changed them. */
export type WellnessRevisionRow = {
  id: string;
  entry_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
  comment: string | null;
  source: string | null;
  submitted_at: string | null;
  created_by: string | null;
  revision_of: string | null;
  /** Non-null means this row has been corrected and is history. Carried on the type
   *  (rather than filtered away at the query) because `chainsOf` below needs it to
   *  find the head of each chain — see this file's header on why the base table is
   *  read here at all. */
  superseded_by: string | null;
};

export type TrainingRevisionRow = {
  id: string;
  entry_date: string;
  session_id: string | null;
  rpe: number | null;
  duration_min: number | null;
  session_load: number | null;
  comment: string | null;
  source: string | null;
  submitted_at: string | null;
  created_by: string | null;
  revision_of: string | null;
  /** See WellnessRevisionRow.superseded_by. */
  superseded_by: string | null;
};

/** A live entry plus its history. `priorRevisions` is oldest-first and EXCLUDES the
 *  live row, so `priorRevisions.length === 0` is precisely "never corrected" and is
 *  what the "Corrected" marker keys off. `correctedBy` names the person who wrote the
 *  live row when it is itself a revision (null on an original), which is the difference
 *  between "the athlete fixed this" and "a coach fixed this" — the whole reason the
 *  club asked for this feature. */
export type WithRevisions<T> = {
  current: T;
  priorRevisions: T[];
  correctedBy: string | null;
  correctedAt: string | null;
};

const WELLNESS_COLUMNS =
  'id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress, mood, comment, source, submitted_at, created_by, revision_of, superseded_by';

const TRAINING_COLUMNS =
  'id, entry_date, session_id, rpe, duration_min, session_load, comment, source, submitted_at, created_by, revision_of, superseded_by';

type Chainable = { id: string; revision_of: string | null; superseded_by: string | null };

/** Walk each live row backwards down `revision_of` and return the chain behind it,
 *  oldest first.
 *
 *  Written as a loop with a visited set rather than recursion for one specific reason:
 *  the chain is guaranteed linear by `revise_*` (ADR-005 rule 1, "only the current
 *  revision may be revised") but this code is reading data, not enforcing it. A cycle
 *  in `revision_of` — which no code path can currently create, but a bad restore or a
 *  future migration could — would hang the request rather than render a page. The
 *  visited set makes that impossible; `rows` being finite bounds the loop regardless. */
function chainsOf<T extends Chainable>(rows: T[]): WithRevisions<T>[] {
  const byId = new Map(rows.map((r) => [r.id, r]));

  return rows
    .filter((r) => r.superseded_by === null)
    .map((current) => {
      const prior: T[] = [];
      const seen = new Set<string>([current.id]);
      let cursor = current.revision_of;
      while (cursor !== null && !seen.has(cursor)) {
        seen.add(cursor);
        const parent = byId.get(cursor);
        /* A parent outside the fetched window is not an error and must not be treated
         * as one: a January entry corrected in March has its original outside a 14-day
         * fetch. The chain stops here and the panel still says "corrected", because
         * `current.revision_of` being non-null is the marker, not the presence of the
         * parent row. */
        if (!parent) break;
        prior.push(parent);
        cursor = parent.revision_of;
      }
      prior.reverse(); // oldest first: the reader wants "was 4 → then 6 → now 7"
      return {
        current,
        priorRevisions: prior,
        correctedBy: null as string | null,
        correctedAt: null as string | null,
      };
    });
}

/** Resolve `created_by` on each live-but-revised row to a display name. One extra query
 *  for the whole page, never one per row. `users_org_select` (0012) makes this readable
 *  by any staff member in the org. A null name (a deleted user, or a row written by a
 *  service process) renders as "a staff member" at the UI edge rather than blank — the
 *  caller decides, this function only reports what it found. */
async function attachAuthors<T extends Chainable & { created_by: string | null; submitted_at: string | null }>(
  db: Db,
  orgId: string,
  chains: WithRevisions<T>[],
): Promise<WithRevisions<T>[]> {
  const ids = Array.from(
    new Set(
      chains
        .filter((c) => c.current.revision_of !== null && c.current.created_by !== null)
        .map((c) => c.current.created_by as string),
    ),
  );
  if (ids.length === 0) return chains;

  const { data, error } = await db
    .from('users')
    .select('id, full_name')
    .eq('org_id', orgId)
    .in('id', ids);
  if (error) throw new Error(error.message);

  const nameById = new Map((data ?? []).map((u) => [u.id, u.full_name]));
  return chains.map((c) =>
    c.current.revision_of === null
      ? c
      : {
          ...c,
          correctedBy: c.current.created_by ? (nameById.get(c.current.created_by) ?? null) : null,
          correctedAt: c.current.submitted_at,
        },
  );
}

export async function fetchWellnessWithRevisions(
  db: Db,
  orgId: string,
  athleteId: string,
  range: { from: string; to: string },
): Promise<WithRevisions<WellnessRevisionRow>[]> {
  const { data, error } = await db
    .from('wellness_entries')
    .select(WELLNESS_COLUMNS)
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to)
    .order('entry_date', { ascending: false });

  if (error) throw new Error(error.message);
  const chains = chainsOf((data ?? []) as unknown as WellnessRevisionRow[]);
  return attachAuthors(db, orgId, chains);
}

/** RPE chains without the session lookup. Split out of `fetchTrainingWithRevisions`
 *  below for the athlete's My Data, whose Training tab already has the session rows it
 *  is rendering and only needs to know which of them carry a correction. Same query,
 *  same chain walk, one fewer round trip. */
export async function fetchTrainingRevisionChains(
  db: Db,
  orgId: string,
  athleteId: string,
  range: { from: string; to: string },
): Promise<WithRevisions<TrainingRevisionRow>[]> {
  const { data, error } = await db
    .from('training_entries')
    .select(TRAINING_COLUMNS)
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to)
    .order('entry_date', { ascending: false });

  if (error) throw new Error(error.message);

  return attachAuthors(db, orgId, chainsOf((data ?? []) as unknown as TrainingRevisionRow[]));
}

export type TrainingWithSession = WithRevisions<TrainingRevisionRow> & {
  sessionTitle: string | null;
  sessionStartsAt: string | null;
};

/** RPE entries with their chain, plus the session each one rates.
 *
 *  The session lookup is a second query rather than a PostgREST embed on purpose: the
 *  embed would be `sessions!inner(...)`, which silently DROPS any entry whose session
 *  row is soft-deleted or otherwise unreadable — and an entry whose session vanished is
 *  exactly the kind of thing a coach may need to correct. The title falls back to null
 *  and the UI says "session not found" rather than the row disappearing. */
export async function fetchTrainingWithRevisions(
  db: Db,
  orgId: string,
  athleteId: string,
  range: { from: string; to: string },
): Promise<TrainingWithSession[]> {
  const chains = await fetchTrainingRevisionChains(db, orgId, athleteId, range);

  const sessionIds = Array.from(
    new Set(chains.map((c) => c.current.session_id).filter((id): id is string => id !== null)),
  );
  if (sessionIds.length === 0) {
    return chains.map((c) => ({ ...c, sessionTitle: null, sessionStartsAt: null }));
  }

  const { data: sessions, error: sessionError } = await db
    .from('sessions')
    .select('id, title, starts_at')
    .eq('org_id', orgId)
    .in('id', sessionIds);
  if (sessionError) throw new Error(sessionError.message);

  const byId = new Map((sessions ?? []).map((s) => [s.id, s]));
  return chains.map((c) => {
    const session = c.current.session_id ? byId.get(c.current.session_id) : undefined;
    return {
      ...c,
      sessionTitle: session?.title ?? null,
      sessionStartsAt: session?.starts_at ?? null,
    };
  });
}

/** ADR-005 O-28's third clause, the one that is easy to skip: "any expansion is written
 *  to the audit log."
 *
 *  The reasoning behind it is the reasoning behind the whole ADR. Full chain visibility
 *  is more honest, but an athlete who knows a coach can read the value they corrected
 *  will hesitate to correct a genuine mistake. Making the LOOK auditable is what keeps
 *  both properties: the coach can see what they need, and there is a record of who
 *  looked, in the same admin-visible log that already records a physio opening clinical
 *  notes.
 *
 *  Fire-and-forget on purpose. `write_audit_event` (migration 0010) is security definer
 *  and takes org and actor from the caller's own claims, so this cannot be pointed at
 *  another club and cannot falsify the actor. It is called from the client because the
 *  expansion is a client interaction; a failed audit write must never block the coach's
 *  read, so the promise is swallowed — the alternative (an error toast saying "could
 *  not record that you looked") is noise the coach can do nothing about.
 *
 *  Callers must call this ONCE per entry per mount, not on every toggle, or a coach
 *  fidgeting with a disclosure triangle writes twenty identical evidence rows.
 *  EntryCorrectionPanel keeps that set.
 *
 *  STAFF ONLY. My Data reads the same chains but does not call this: the event records
 *  one person reading another person's revised self-report, and an athlete looking at
 *  their own history is not that. Auditing it would file the subject of the data as if
 *  they were a third party looking in.
 *
 *  It is also no longer the only audit event this feature writes, which it was when it
 *  was first added — migration 0058's `revise_*` functions write
 *  `entry_revision.created` on the WRITE path, in-transaction. That is the important
 *  one; this is the read-side complement O-28 asked for. */
export async function recordRevisionChainView(
  db: Db,
  athleteId: string,
  domain: 'wellness' | 'training',
  entryId: string,
): Promise<void> {
  try {
    await db.rpc('write_audit_event', {
      p_action: 'entry_revision.view',
      p_entity_type: domain === 'wellness' ? 'wellness_entry' : 'training_entry',
      p_entity_id: entryId,
      p_athlete_id: athleteId,
      p_metadata: { domain },
    });
  } catch {
    /* Deliberately silent — see the comment above. */
  }
}
