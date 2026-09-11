import type { DraftSession, EditOverlay } from './types';

/* THE WEEK'S PENDING CHANGES SURVIVE A RELOAD — §0al, decided by Isabella
 * 2026-09-11, built 2026-09-12.
 *
 * WHAT WENT WRONG. ScheduleWorkspace holds every unpublished change — edit
 * overlays, staged drafts, removals, the half-filled new draft — in useState
 * and nowhere else. On a network failure at publish the writes threw, the
 * catch set "Not published: Failed to fetch", and then `finally` called
 * router.refresh() unconditionally; offline, the refresh's own RSC fetch
 * failed, Next fell back to a full browser navigation, and the reload
 * destroyed all four pieces of state and the message with them. Reproduced
 * on scratch 2026-09-11: a staged draft, network emulated offline, Publish
 * pressed — the page came back on "The athlete app is up to date" with no
 * draft, no alert, and no row written. A pitch-side phone drops the network,
 * not the server.
 *
 * THE FIX, IN TWO HALVES. (1) The four pieces of pending state round-trip
 * through sessionStorage under a key per organisation and week, restored on
 * mount and cleared on a successful publish or an explicit Discard — so a
 * reload, accidental or forced, never loses the week. sessionStorage, not
 * localStorage: the state belongs to this tab's editing session, and a stale
 * week resurfacing days later in another tab would be a worse surprise than
 * the loss it prevents. (2) After a NETWORK failure the workspace does not
 * refresh at all — the grid, the pending state and the "Not published:" line
 * stay exactly as they are. The refresh is kept for every other failure,
 * where some writes may have landed and the grid must resync.
 *
 * Kept as plain functions over a Storage-shaped parameter so the round-trip
 * is testable without a browser (scripts/test-schedule-offline-publish.ts).
 */

export type PendingWeek = {
  edits: Record<string, EditOverlay>;
  added: DraftSession[];
  removed: Record<string, true>;
  newDraft: DraftSession | null;
};

/** The subset of Storage this module uses, so a test can pass a plain object. */
export type PendingStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const PENDING_KEY_PREFIX = 'fydr-schedule-pending';

export function pendingKey(orgId: string, weekStart: string): string {
  return `${PENDING_KEY_PREFIX}:${orgId}:${weekStart}`;
}

export function isEmptyPending(state: PendingWeek): boolean {
  return (
    Object.keys(state.edits).length === 0 &&
    state.added.length === 0 &&
    Object.keys(state.removed).length === 0 &&
    state.newDraft === null
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Read the stored week, or null when there is none, it cannot be parsed, or
 *  it is not the shape written below. Never throws: a broken or unavailable
 *  store (Safari private mode throws on access) reads as "nothing pending". */
export function readPending(store: PendingStore, key: string): PendingWeek | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const { edits, added, removed, newDraft } = parsed;
    if (!isRecord(edits) || !Array.isArray(added) || !isRecord(removed)) return null;
    if (!(newDraft === null || isRecord(newDraft))) return null;
    const state: PendingWeek = {
      edits: edits as Record<string, EditOverlay>,
      added: added as DraftSession[],
      removed: removed as Record<string, true>,
      newDraft: newDraft as DraftSession | null,
    };
    return isEmptyPending(state) ? null : state;
  } catch {
    return null;
  }
}

/** Write the week, or remove the key when nothing is pending — so a successful
 *  publish and a Discard, which both empty the state, also empty the store. */
export function writePending(store: PendingStore, key: string, state: PendingWeek): void {
  try {
    if (isEmptyPending(state)) store.removeItem(key);
    else store.setItem(key, JSON.stringify(state));
  } catch {
    /* Quota or a private-mode store: the in-memory state is still the truth
       for this page; only the reload insurance is lost. */
  }
}

export function clearPending(store: PendingStore, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* As above. */
  }
}

/* The shapes a dropped connection takes in the three engines, as thrown by
   fetch() or as the message supabase-js passes through:
     Chrome   TypeError: Failed to fetch
     Safari   TypeError: Load failed
     Firefox  TypeError: NetworkError when attempting to fetch resource.
   A server-side refusal ("No current season is set up…", a unique violation,
   a conflict) is never one of these, and those keep the refresh. */
const NETWORK_MESSAGES = [/failed to fetch/i, /load failed/i, /networkerror/i, /network request failed/i];

/** True when a publish error means the request never reached the server —
 *  nothing was written, so the grid must NOT be refreshed away. Accepts the
 *  thrown value or the message string a query helper returned. */
export function isNetworkFailure(error: unknown): boolean {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  return NETWORK_MESSAGES.some((re) => re.test(message));
}
