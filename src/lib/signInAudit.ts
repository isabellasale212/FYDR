import { actingRole } from '@/lib/access';
import { clientAddress, clientUserAgent } from '@/lib/clientAddress';
import type { FydrClaims } from '@/lib/supabase/claims';
import type { AppRole } from '@/lib/types/database';

/** A durable record of a successful sign-in.
 *
 *  WHY THE APPLICATION WRITES THIS AND NOT A TRIGGER. Ten tables are audited by
 *  trigger (0085, 0086) precisely because an application-level write is
 *  self-reported: the client chooses the action, the metadata, and whether to
 *  write at all. The same objection applies here and it is not answered — it is
 *  accepted, because there is nothing better to hook. `auth.sessions` lives in
 *  Supabase's own schema, outside the migration history they manage, and a
 *  trigger there is the kind of thing that survives until it silently does not
 *  across a platform upgrade. This is the honest second-best.
 *
 *  WHAT IT REPLACES: nothing, which is the point. `auth.sessions` holds only
 *  LIVE sessions — 372 inserts against 362 deletes over 45 days on production —
 *  so roughly 97% of sign-ins have already left no trace, and
 *  `auth.audit_log_entries` has never taken a row on either project. The
 *  question "who signed in, and when" was answerable for about a week.
 *
 *  WHY `audit_log` AND NOT A NEW TABLE. That table already records reads as
 *  well as writes — `injury_clinical.read`, `report.athlete.view` — so it is
 *  the "who did what" trail rather than a write log, and a sign-in belongs
 *  beside the actions it made possible. It is already append-only (0007's three
 *  triggers refuse UPDATE, DELETE and TRUNCATE), already read by a real screen
 *  (`lib/queries/auditLog.ts`), and already carries actor, role, IP and org. A
 *  second table would rebuild all of that and add a second place to look. */

export const SIGN_IN_ACTION = 'auth.signed_in';
export const SIGN_IN_ENTITY = 'session';

/** The other half, added 2026-09-07. `auth.sessions` never recorded a failure
 *  and `login_attempts` deliberately forgets one: it tracks a failure STREAK
 *  and `login_attempt_record_result` deletes the row on success, because
 *  clearing it is what stops yesterday's typo locking somebody out today. Right
 *  for rate limiting, and it means nothing durable said who tried and did not
 *  get in — the half of the sign-in trail that vanished. */
export const SIGN_IN_FAILED_ACTION = 'auth.sign_in_failed';
/** NOT `session`. The success row points at a session that exists; this one
 *  points at nothing, because no session was created. Calling it a session to
 *  group the two in the audit viewer's entity filter would be a small lie in
 *  the table whose job is being true — and the viewer's free-text search covers
 *  `action`, so "auth." still finds both. */
export const SIGN_IN_FAILED_ENTITY = 'sign_in';

/** How the session came to exist. `password` is the sign-in form; the rest are
 *  GoTrue's own OTP types, passed through from /auth/confirm, so an invite
 *  acceptance is distinguishable from an ordinary sign-in without a second
 *  action name. */
export type SignInMethod = 'password' | string;

export type SignInAuditRow = {
  org_id: string;
  actor_id: string;
  /** Null for a failed sign-in: nobody acted, so there is no role they acted in. */
  actor_role: AppRole | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
};

/** The minimum of a Supabase client this needs, written structurally so the
 *  tests can drive it with a stub and so a caller cannot accidentally hand it
 *  the admin client.
 *
 *  `PromiseLike` and not `Promise`: PostgREST's `.insert()` returns a builder
 *  that is thenable but has no `catch`/`finally`, so a `Promise` return type
 *  refuses the real client while happily accepting the test stubs — a shape
 *  that typechecks against everything except production. */
type AuditWriter = {
  from: (table: string) => { insert: (row: SignInAuditRow) => PromiseLike<{ error: unknown } | void> };
};

/** Deliberately one field, and typed rather than `Record<string, unknown>`, so
 *  that "a sign-in stamps last_seen_at" cannot quietly become "a sign-in writes
 *  to the users table". */
export type LastSeenPatch = { last_seen_at: string };

/** The same client, described for the other half of the write.
 *
 *  WHY IT IS A SEPARATE TYPE RATHER THAN TWO METHODS ON AuditWriter. Adding
 *  `update` alongside `insert` and checking the combined shape against the real
 *  PostgREST builder pushes tsc past its instantiation depth limit — /auth/
 *  confirm, and only that one of the three callers, fails with TS2589 while the
 *  code is correct. Split in two, each side is the same check that already
 *  compiled, and the cast at the single call site below carries the reason. */
type LastSeenWriter = {
  from: (table: string) => {
    update: (patch: LastSeenPatch) => { eq: (column: string, value: string) => PromiseLike<{ error: unknown } | void> };
  };
};

/**
 * The row, or null if it is one the database would refuse.
 *
 * THE REFUSAL IS THE INTERESTING HALF. `audit_log`'s insert policy is
 *
 *     with check (org_id = auth_org_id() and actor_id = auth_user_id())
 *
 * and `org_id = auth_org_id()` evaluates to NULL — so, not true — when org_id
 * is null. The column is nullable and 0007's comment explains why ("a platform
 * support access or a failed sign in has no organisation yet"), but the policy
 * cannot accept the null the column allows.
 *
 * So a claimless or org-less sign-in is refused HERE rather than sent and lost.
 * The caller fails open, which means a 42501 from PostgREST would be swallowed
 * and look exactly like a successful write. Refusing in our own code is what
 * keeps the log's silence honest: no row means no row was attempted.
 */
export function signInAuditRow(
  claims: FydrClaims,
  headers: Headers,
  method: SignInMethod,
  sessionId: string | null = null,
): SignInAuditRow | null {
  if (!claims.userId || !claims.orgId) return null;

  const userAgent = clientUserAgent(headers);

  return {
    org_id: claims.orgId,
    actor_id: claims.userId,
    /* NULL for an athlete, and that is deliberate as of 2026-09-08. actingRole
       used to fall back to 'athlete'; SQL's audit_acting_role() has always
       returned null for the same person, so the two disagreed about every
       athlete-written row. actor_role names WHICH STAFF ROLE somebody acted in
       and an athlete holds none. actor_id still says who signed in. */
    actor_role: actingRole(claims.roles),
    action: SIGN_IN_ACTION,
    entity_type: SIGN_IN_ENTITY,
    entity_id: sessionId,
    metadata: {
      method,
      ...(userAgent ? { user_agent: userAgent } : {}),
    },
    ip_address: clientAddress(headers),
  };
}

/**
 * Write it, and never let failing to write it cost somebody their sign-in.
 *
 * The sign-in route already degrades to "not currently rate limited" rather
 * than "nobody can sign in" when the rate limiter is unreachable, and this gets
 * the same treatment for the same reason: logging infrastructure failing must
 * not become an authentication outage. Logged to the console so a real outage
 * is still visible rather than merely survivable.
 */
export async function recordSignIn(
  db: AuditWriter,
  claims: FydrClaims,
  headers: Headers,
  method: SignInMethod,
  sessionId: string | null = null,
): Promise<void> {
  /* THE STAMP GOES FIRST, AND IT IS NOT INSIDE THE AUDIT ROW'S GUARD. Until
     2026-09-08 `users.last_seen_at` was read by three components and written by
     nothing at all — no route, no query, no migration — so every account read
     "Never signed in", including staff who had signed in that morning.

     It is stamped here rather than in each route because all three sign-in
     flows already pass through this function: /auth/sign-in for a password,
     /auth/confirm for an invite or magic link, and /auth/record-sign-in for the
     PKCE reset whose session is established in the browser.

     Above the audit guard, because the two writes fail for different reasons.
     The audit row is refused without an org, since audit_log's insert policy is
     `org_id = auth_org_id() and actor_id = auth_user_id()` and a null org never
     satisfies it. `users_self_update` pins only `id = auth_user_id()` and says
     nothing about the org, so an org-less session can still stamp itself — and
     somebody whose claims are missing an org has still signed in. */
  /* One client, two structural descriptions of it — see LastSeenWriter for why
     they are not one type. The cast asserts nothing the real client does not
     do; every caller passes a request-scoped Supabase client that has both. */
  await stampLastSeen(db as unknown as LastSeenWriter, claims.userId);

  const row = signInAuditRow(claims, headers, method, sessionId);
  if (!row) {
    console.error('sign-in audit skipped: no org or actor in the fresh session claims', {
      hasUser: Boolean(claims.userId),
      hasOrg: Boolean(claims.orgId),
      method,
    });
    return;
  }

  try {
    const result = await db.from('audit_log').insert(row);
    const error = result && typeof result === 'object' && 'error' in result ? result.error : null;
    if (error) throw error;
  } catch (err) {
    console.error('sign-in audit write failed, sign-in itself unaffected', err);
  }
}

/**
 * Record that this account was seen, and never let failing to do so cost
 * somebody their sign-in.
 *
 * WHY THIS WRITES NO AUDIT ROW OF ITS OWN, and why that is enforced in SQL
 * rather than here. `users` has been audited by trigger since 0091, so without
 * intervention every sign-in would write a `users.update` row saying
 * last_seen_at moved, immediately beside the `auth.signed_in` row above, which
 * says the same thing and carries the address, the method and the session as
 * well. Migration 0092 adds `last_seen_at` to the columns audit_row_change()
 * already excludes from an update's changed list — the same treatment
 * `updated_at` has always had, for the same reason: written by machinery, never
 * by a person choosing to change it. Test 480 asserts both halves, including
 * that a write moving status AND last_seen_at still records the status.
 *
 * Fails open, exactly as the audit write and the rate limiter do. A missing
 * "last seen" is a cosmetic loss on one settings screen; a sign-in that 500s
 * because a stamp failed is an outage.
 */
export async function stampLastSeen(db: LastSeenWriter, userId: string | null | undefined): Promise<void> {
  if (!userId) return;

  try {
    const result = await db
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);
    const error = result && typeof result === 'object' && 'error' in result ? result.error : null;
    if (error) throw error;
  } catch (err) {
    console.error('last_seen_at stamp failed, sign-in itself unaffected', err);
  }
}

/**
 * The browser's half: ask the server to record a sign-in that happened here.
 *
 * WHY A ROUND TRIP RATHER THAN WRITING FROM THE BROWSER. The password reset
 * establishes its session client-side — PKCE, `exchangeCodeForSession`, often
 * already exchanged by the SDK's own URL detection before any of our code runs
 * — so there is no server route to hang the write on. The browser COULD insert
 * the row itself, holding a valid session and passing the RLS policy. It would
 * be the one row in this table with a null address, because a page cannot know
 * its own public IP; the server reading `x-forwarded-for` can. An unattributed
 * sign-in row is most of the way to no sign-in row.
 *
 * Fire and forget, and deliberately so: this is called on a screen somebody is
 * about to type a new password into, and it must not block, fail it, or show
 * anything. A lost row here is the same fail-open trade the server side makes.
 */
export function reportSignIn(method: SignInMethod): void {
  void fetch('/auth/record-sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method }),
    keepalive: true,
  }).catch(() => {
    /* Fail open. See recordSignIn. */
  });
}

/** Who the attempt was against. Resolved from the email by the route's existing
 *  `users` lookup — the one it already does to give login_attempts an org. */
export type SignInTarget = { orgId: string | null; userId: string | null };

/** What the rate limiter already knows about this attempt, so the row can say
 *  where in a streak it sits without a second query. */
export type FailureContext = { attemptsRemaining: number | null; locked: boolean };

/**
 * The row for a sign-in that did not succeed, or null if it should not be written.
 *
 * WHY THIS ONE NEEDS THE SERVICE ROLE. `audit_authenticated_insert` is
 * `org_id = auth_org_id() and actor_id = auth_user_id()`, and a failed sign-in
 * has no session — both are null and the row is refused. The alternative was a
 * policy admitting anonymous inserts for this one action, which would have made
 * this the first table row an unauthenticated caller could write, at whatever
 * rate they can POST. Writing it as the service role from a route we control
 * keeps the policy exactly as strict as it was.
 *
 * THE ACTOR IS CLAIMED, NOT PROVEN. `actor_id` is the account somebody tried to
 * reach; the sign-in failed, so nothing establishes that they are that person.
 * It is recorded anyway because "what happened around this account" is the
 * question a review actually asks, and the audit viewer's actor filter is how
 * it gets asked. The action name is what carries the caveat.
 *
 * ONLY FOR ACCOUNTS THAT EXIST, for two reasons. A row without an org can never
 * be read — `lib/queries/auditLog.ts` filters every query by `org_id` — so an
 * unattributable row is invisible in the app meant to surface it. And the
 * submitted email is attacker-controlled: writing an unmatched address verbatim
 * would let anybody put arbitrary text into this table at will. An unknown
 * address is `login_attempts`' business, not this one's.
 */
export function signInFailureRow(
  target: SignInTarget,
  headers: Headers,
  context: FailureContext,
): SignInAuditRow | null {
  if (!target.orgId || !target.userId) return null;
  const userAgent = clientUserAgent(headers);

  return {
    org_id: target.orgId,
    actor_id: target.userId,
    /* Null, and deliberately. actor_role on every other row is the role somebody
       ACTED IN; nobody acted here, and looking up the target's roles would put a
       role on a row that records a failure to authenticate as them. */
    actor_role: null,
    action: SIGN_IN_FAILED_ACTION,
    entity_type: SIGN_IN_FAILED_ENTITY,
    entity_id: null,
    metadata: {
      attempts_remaining: context.attemptsRemaining,
      locked: context.locked,
      /* §0ar (2026-09-11): the same key, cap and omit-when-absent rule as
         the success row above, from the same clientUserAgent(). A review
         asks "browser or curl?" of the FAILURE rows first, and four of them
         on production could not answer it. */
      ...(userAgent ? { user_agent: userAgent } : {}),
    },
    ip_address: clientAddress(headers),
  };
}

/**
 * Write it, and never let failing to write it change the sign-in result.
 *
 * VOLUME IS BOUNDED BY THE LOCKOUT, which is why this writes on every failed
 * attempt rather than only on streak boundaries. Restricting to accounts that
 * exist caps the surface to real addresses, and five failures locks the account
 * for thirty minutes and upward — so the rate limiter this row is about is also
 * the thing that limits the rows.
 */
export async function recordSignInFailure(
  db: AuditWriter,
  target: SignInTarget,
  headers: Headers,
  context: FailureContext,
): Promise<void> {
  const row = signInFailureRow(target, headers, context);
  if (!row) return;

  try {
    const result = await db.from('audit_log').insert(row);
    const error = result && typeof result === 'object' && 'error' in result ? result.error : null;
    if (error) throw error;
  } catch (err) {
    console.error('failed-sign-in audit write failed, sign-in result unaffected', err);
  }
}
