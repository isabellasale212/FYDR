/* The bounded-write toolkit. Audit S5 (athlete findings 11 and 18, coach
 * finding 11): a correction hung on "Saving correction…" forever, a weekly
 * nutrition check-in hung on "Saving…" and lost the answer, and a failed
 * attendance write's only feedback was a raw Postgres string. The rule this
 * file exists to enforce: no write may ever fail silently or hang forever.
 *
 * Three pieces, used together by every non-queued mutation:
 *
 *  - `withWriteTimeout` puts a ceiling (10 s) on how long a submit button is
 *    allowed to say "Saving…". The underlying request is not cancelled — it
 *    may still land — so the timeout copy never claims the write failed,
 *    only that it did not confirm.
 *  - `humanizeDbError` turns raw driver strings ("permission denied for
 *    table session_attendance", "Failed to fetch") into a sentence written
 *    for the person on screen. It must never let a raw Postgres message
 *    through: the default case is a generic safe sentence.
 *  - `HumanError` marks a message that is already written for the screen
 *    (e.g. the bespoke `entry_not_revisable` translations in the query
 *    layer), so `toUserMessage` can pass it through instead of flattening
 *    it into the generic fallback.
 *
 * Writes that go through the offline outbox (`lib/outbox.ts`) do not use
 * this: their contract is stronger — queued locally, never an error at all.
 */

export const WRITE_TIMEOUT_MS = 10_000;

/** Thrown by `withWriteTimeout`. The message doubles as the match token for
 *  `humanizeDbError`, so a caller can also just pass `err.message` along. */
export class WriteTimeoutError extends Error {
  constructor() {
    super('write_timed_out');
    this.name = 'WriteTimeoutError';
  }
}

/** An error whose message was already written for the person on screen.
 *  `toUserMessage` shows it verbatim instead of humanizing it. */
export class HumanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanError';
  }
}

/** Refuse to start a write the session cannot finish.
 *
 *  This file's rule is that no write may fail silently, and one did. A staff
 *  member left the new-fixture form open past the 30-minute token, submitted,
 *  and landed on the sign-in page with no message — the fixture was not
 *  created, but nothing on screen said so, and re-submitting after signing in
 *  risks a duplicate for anyone who assumes the opposite. A page rendered from
 *  the client router cache looks perfectly alive while the session behind it
 *  is gone, so the form cannot tell from its own state.
 *
 *  Calling this first turns that into an ordinary error the form already knows
 *  how to show. It costs one round-trip on writes that create something, which
 *  is the case where a silent failure is most expensive.
 *
 *  It is a guard, not a guarantee: a token can expire between this check and
 *  the insert. That residual case still lands in humanizeDbError's `jwt`
 *  branch, which now also says nothing was saved. */
export async function assertLiveSession(db: {
  auth: { getUser: () => Promise<{ data: { user: unknown | null }; error: unknown }> };
}): Promise<void> {
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user) throw new HumanError(SENTENCES.session);
}

/** Race a write against the clock so `isPending` can never be permanent.
 *  Rejects with `WriteTimeoutError` after `ms`; the promise itself is left
 *  running (fetch cannot be un-sent), which is why timeout copy says
 *  "didn't confirm", never "didn't happen". */
export async function withWriteTimeout<T>(
  promise: Promise<T>,
  ms: number = WRITE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new WriteTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export type WriteAudience = 'athlete' | 'staff';

/* Every sentence this module can produce, so humanizeDbError can recognise
 * its own output and pass it through unchanged. */
const SENTENCES = {
  permissionStaff:
    'That didn’t save — you may not have permission for this. If that seems wrong, ask your club admin to check your role.',
  permissionAthlete:
    'That didn’t save — this account isn’t allowed to. If that seems wrong, tell your coach.',
  session:
    'Your session has expired, so nothing was saved. Sign in again, then re-enter it.',
  duplicate: 'This looks like it was already saved. Refresh to check before sending it again.',
  connectionStaff:
    'That didn’t save — the connection dropped or timed out. Check your connection and try again.',
  /* PATTERN-S6 A3 (2026-09-12): ATH-ADULT-03's approved words for a send
     that failed, with the instruction kept. */
  connectionAthlete:
    'That did not send — check your signal and try again. Your answer is still here.',
  defaultStaff: 'That didn’t save. Try again in a moment.',
  defaultAthlete: 'Couldn’t save. Try again in a moment — your answer is still here.',
} as const;

const OWN_OUTPUTS = new Set<string>(Object.values(SENTENCES));

/** Map a raw error string to a sentence for the screen. Substring matches on
 *  the strings Postgres, PostgREST and the browsers actually produce; the
 *  default is deliberately generic — an unrecognised message is *more*
 *  reason to hide it, not less. */
export function humanizeDbError(
  message: string,
  audience: WriteAudience = 'athlete',
): string {
  /* Idempotent: some call paths humanize at the query layer and again in a
   * component's error handler. A sentence this function already wrote must
   * survive the second pass instead of degrading to the generic default. */
  if (OWN_OUTPUTS.has(message)) return message;

  const m = message.toLowerCase();
  const staff = audience === 'staff';

  if (
    m.includes('permission denied') ||
    m.includes('row-level security') ||
    m.includes('not_permitted')
  ) {
    return staff ? SENTENCES.permissionStaff : SENTENCES.permissionAthlete;
  }

  if (m.includes('jwt') || m.includes('refresh_token') || m.includes('not_authenticated')) {
    return SENTENCES.session;
  }

  if (m.includes('duplicate key')) {
    return SENTENCES.duplicate;
  }

  if (
    m.includes('write_timed_out') ||
    m.includes('timed out') ||
    m.includes('timeout') ||
    m.includes('failed to fetch') || // Chrome
    m.includes('networkerror') || // Firefox
    m.includes('load failed') || // Safari
    m.includes('fetch failed') ||
    m.includes('network request failed')
  ) {
    return staff ? SENTENCES.connectionStaff : SENTENCES.connectionAthlete;
  }

  return staff ? SENTENCES.defaultStaff : SENTENCES.defaultAthlete;
}

/** The one-liner for `onError` handlers: bespoke messages pass through,
 *  everything else is humanized. Never returns a raw driver string. */
export function toUserMessage(err: unknown, audience: WriteAudience = 'athlete'): string {
  if (err instanceof HumanError) return err.message;
  const message = err instanceof Error ? err.message : String(err);
  return humanizeDbError(message, audience);
}
