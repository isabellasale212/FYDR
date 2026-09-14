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
 * sending is still the athlete's tap. */

const PREFIX = 'fydr-draft-';

export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, value: T | null): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
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
): void {
  /* `ready` flips in the same batch as the restore's own setState calls, so
     the render that first mirrors the value is the one that already holds
     the restored answers — the mirror never sees the empty initial state and
     wipes the draft it was about to restore. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (key === null) return;
    const draft = readDraft<T>(key);
    if (draft !== null) restore(draft);
    setReady(true);
    // restore is the form's own setter bundle; the key is the instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (key === null || !ready) return;
    writeDraft(key, hasContent(value) ? value : null);
  }, [key, ready, value, hasContent]);
}
