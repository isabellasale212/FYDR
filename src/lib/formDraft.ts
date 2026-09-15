'use client';

import { useEffect, useState } from 'react';

/* A part-filled form survives — PATTERN-S6 C3, ruled 2026-09-13 (batch B9):
 * "in localStorage, per form, the gym drafts' own mechanism; it moves into
 * the shared IndexedDB outbox when S11 builds it."
 *
 * The case it is for: the session expires while an athlete is halfway down
 * the wellness sheet. The next tap redirects to /login?next=/check-in, they
 * sign in, they land back on the same sheet — and every answer they gave is
 * still set, because the sheet wrote them here as they were given and reads
 * them back on mount. The same for a phone call, a closed tab, a crash.
 *
 * Exactly the gym logger's mechanism (GymSessionLogger's draftKey): one
 * localStorage key per form INSTANCE (the check-in for 15 Sept, the rating
 * for one session, the check-in for one week — never one key for "the
 * wellness form", or Tuesday's answers would greet Wednesday), restored in
 * an effect rather than in the initial state so the server render and the
 * first client render agree, written on every change while there is content,
 * removed when the form is sent or when it empties. Every access is guarded:
 * a private window or blocked site data throws, and a lost draft is a
 * nuisance where a form that will not render is worse.
 *
 * A draft is not an entry. Nothing here reaches the outbox or the database;
 * sending is still the athlete's tap.
 *
 * EVERY FORM, AND WHEN A DRAFT DIES — Isabella, 15 September 2026
 * (decision-batch-2026-09-15-pm.md #2). The staff forms hold a draft too
 * (the injury form, a new session, a new threshold), because the case is
 * the same. But a held draft lives in browser storage on that device: an
 * athlete's phone is their own, while the injury form may be filled on a
 * shared laptop in the physio room and its draft can hold body area,
 * mechanism and description — the clinical content the column-level
 * separation exists to protect. So:
 *   - every draft is cleared on sign-out (clearAllDrafts, run by the login
 *     page when the sign-out route sends it there — the server cannot reach
 *     this storage, and a session that merely expired must NOT clear, since
 *     the restored draft is the whole point);
 *   - a staff draft is cleared at the end of the working day whether or not
 *     anybody signs out: it is written with the club's day inside it
 *     (`day`), read back only on that day, and swept on the next staff
 *     page load and at the club's midnight while a staff page is open
 *     (DraftHousekeeping in the staff layout).
 * The sign-in button does not read "Sign in and send": the draft is
 * restored, not sent. */

const PREFIX = 'fydr-draft-';
/** The gym logger's own keys (GymSessionLogger's draftKey), swept with the
 *  rest on sign-out. */
const GYM_PREFIX = 'fydr-gym-draft-';

type Envelope<T> = { day: string; value: T };

function isEnvelope<T>(raw: unknown): raw is Envelope<T> {
  return typeof raw === 'object' && raw !== null && 'day' in raw && 'value' in raw && typeof (raw as Envelope<T>).day === 'string';
}

/** Every key this module (and the gym logger) owns. */
function draftKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith(PREFIX) || k.startsWith(GYM_PREFIX))) keys.push(k);
    }
  } catch {
    /* Storage unavailable: nothing to clear. */
  }
  return keys;
}

/** Sign-out: every draft on this device, staff and athlete, gym included. */
export function clearAllDrafts(): number {
  const keys = draftKeys();
  for (const k of keys) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  return keys.length;
}

/** End of the working day: every dated draft whose day is not `today`. A
 *  draft with no day (an athlete's) is not touched. */
export function clearStaleDrafts(today: string): number {
  let cleared = 0;
  for (const k of draftKeys()) {
    try {
      const raw = window.localStorage.getItem(k);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isEnvelope(parsed) && parsed.day !== today) {
        window.localStorage.removeItem(k);
        cleared += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return cleared;
}

/** `day` (staff drafts): the club's day the draft belongs to. A draft written
 *  on another day is not a draft, it is yesterday's clinical content on a
 *  shared laptop — removed on read, not returned. */
export function readDraft<T>(key: string, day?: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (day !== undefined) {
      if (!isEnvelope<T>(parsed)) return null;
      if (parsed.day !== day) {
        window.localStorage.removeItem(PREFIX + key);
        return null;
      }
      return parsed.value;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, value: T | null, day?: string): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(day === undefined ? value : ({ day, value } satisfies Envelope<T>)));
  } catch {
    /* Storage unavailable: the answers still live in React for this visit. */
  }
}

export function clearDraft(key: string): void {
  writeDraft(key, null);
}

/** Restore once on mount, then mirror `value` while `hasContent(value)`.
 *  `key` null disables the hook (a form with nothing to hold, or a
 *  correction of a sent entry, which starts from the entry, not a draft). */
export function useFormDraft<T>(
  key: string | null,
  value: T,
  restore: (draft: T) => void,
  hasContent: (value: T) => boolean,
  /** Staff forms pass the club's day (todayIso(timezone)): the draft is
   *  restored on that day only and swept after it. */
  options: { day?: string } = {},
): void {
  const day = options.day;
  /* `ready` flips in the same batch as the restore's own setState calls, so
     the render that first mirrors the value is the one that already holds
     the restored answers — the mirror never sees the empty initial state and
     wipes the draft it was about to restore. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (key === null) return;
    const draft = readDraft<T>(key, day);
    if (draft !== null) restore(draft);
    setReady(true);
    // restore is the form's own setter bundle; the key is the instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, day]);

  useEffect(() => {
    if (key === null || !ready) return;
    writeDraft(key, hasContent(value) ? value : null, day);
  }, [key, ready, value, hasContent, day]);
}
