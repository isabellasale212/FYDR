import type { WellnessEntryInput } from '@/lib/validation/wellness';
import type { TrainingEntryInput } from '@/lib/validation/training';
import type { NutritionCheckinInput } from '@/lib/validation/nutrition';
import type { GymSetLogInput } from '@/lib/validation/gym';

/* A one table outbox in localStorage, one key per domain.
 *
 * screens/wellness-entry.md, screens/training-entry.md, screens/nutrition-checkin.md and
 * screens/gym-logging.md: the entry is saved on the phone first and
 * sent when there is signal. An athlete standing in a gym with no bars must
 * never be shown a network error for something they have already done, so a
 * submission that cannot reach the server stays here and is retried on the
 * next load.
 *
 * The entry id is generated before the write, so a retry after a crash inserts
 * the same row rather than a second one. Only *submissions* qualify: they are
 * plain idempotent inserts. Corrections (the revise_* RPCs) are not queued —
 * a replayed revise cannot tell "my own first attempt landed" from "already
 * corrected by someone else" (both raise entry_not_revisable), so those go
 * through the bounded online path in lib/writeErrors.ts instead.
 *
 * "Plain idempotent insert" is only true when this item's own id is the one
 * that ends up live. Wellness/training/nutrition each carry a `conflictAt`
 * (integration-audit majors fix) set when it is not: OutboxFlusher's
 * disambiguation found a DIFFERENT id already holding this item's slot, so
 * this exact content never landed anywhere. Every mutator here still treats
 * that item like any other queued row — it is data, not a sentinel to prune —
 * OutboxFlusher is what reads conflictAt to skip retrying it and to surface
 * it to the athlete instead of silently discarding it. */

const KEY = 'fydr-outbox-wellness';
const TRAINING_KEY = 'fydr-outbox-training';
const NUTRITION_KEY = 'fydr-outbox-nutrition';
const GYM_SET_KEY = 'fydr-outbox-gym-set';

/** conflictAt is set only by OutboxFlusher's disambiguation, never here: a
 *  flush attempt hit a duplicate-key error AND a targeted lookup against the
 *  live *_current row for this item's own (athlete_id, entry_date[, session/
 *  week]) slot found a DIFFERENT id already live there — a genuine second
 *  submission for the same slot, not a safe replay of this one (see
 *  OutboxFlusher.tsx's resolve*Conflict functions). Once set, the item is
 *  left in the queue — CLAUDE.md rule 6, this content must not be destroyed
 *  silently — but excluded from automatic retry, since retrying would just
 *  repeat the same collision on every flush. It is cleared only by the
 *  athlete's own "Discard" action after seeing the visible conflict banner
 *  (dequeue* doubles as that discard — same operation, different meaning). */
export type PendingWellness = {
  input: WellnessEntryInput;
  queuedAt: string;
  conflictAt?: string;
};

export type PendingTraining = {
  input: TrainingEntryInput;
  queuedAt: string;
  conflictAt?: string;
};

export type PendingNutritionCheckin = {
  input: NutritionCheckinInput;
  queuedAt: string;
  conflictAt?: string;
};

export type PendingGymSetLog = {
  input: GymSetLogInput;
  queuedAt: string;
};

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* Storage full or blocked. The in-flight request is still the primary
       path, so losing the fallback is not worth an error the athlete sees. */
  }
}

export function enqueueWellness(input: WellnessEntryInput): void {
  const items = read<PendingWellness>(KEY).filter((item) => item.input.id !== input.id);
  items.push({ input, queuedAt: new Date().toISOString() });
  write(KEY, items);
}

export function dequeueWellness(id: string): void {
  write(
    KEY,
    read<PendingWellness>(KEY).filter((item) => item.input.id !== id),
  );
}

export function pendingWellness(): PendingWellness[] {
  return read<PendingWellness>(KEY);
}

/** See PendingWellness's own conflictAt comment. Idempotent: a repeat call
 *  (the item's next flush attempt is skipped once flagged, but keeps this
 *  cheap to call defensively) does not reset the timestamp. */
export function markWellnessConflict(id: string): void {
  write(
    KEY,
    read<PendingWellness>(KEY).map((item) =>
      item.input.id === id
        ? { ...item, conflictAt: item.conflictAt ?? new Date().toISOString() }
        : item,
    ),
  );
}

export function enqueueTraining(input: TrainingEntryInput): void {
  const items = read<PendingTraining>(TRAINING_KEY).filter(
    (item) => item.input.id !== input.id,
  );
  items.push({ input, queuedAt: new Date().toISOString() });
  write(TRAINING_KEY, items);
}

export function dequeueTraining(id: string): void {
  write(
    TRAINING_KEY,
    read<PendingTraining>(TRAINING_KEY).filter((item) => item.input.id !== id),
  );
}

export function pendingTraining(): PendingTraining[] {
  return read<PendingTraining>(TRAINING_KEY);
}

/** See PendingWellness's conflictAt comment; identical reasoning for the
 *  (athlete_id, entry_date, session_id) slot. */
export function markTrainingConflict(id: string): void {
  write(
    TRAINING_KEY,
    read<PendingTraining>(TRAINING_KEY).map((item) =>
      item.input.id === id
        ? { ...item, conflictAt: item.conflictAt ?? new Date().toISOString() }
        : item,
    ),
  );
}

/* The weekly nutrition check-in qualifies for the queue on the same grounds
 * as the two above: a plain insert under a client-generated uuid, and the
 * schema's own nutrition_checkins_one_live_per_week index exists, in its own
 * words, because "an offline queue replaying twice is the exact race it must
 * survive" (migration 0004). Audit S5 / athlete finding 18: before this
 * queue existed the check-in could hang on "Saving…" and lose the answer. */

export function enqueueNutritionCheckin(input: NutritionCheckinInput): void {
  const items = read<PendingNutritionCheckin>(NUTRITION_KEY).filter(
    (item) => item.input.id !== input.id,
  );
  items.push({ input, queuedAt: new Date().toISOString() });
  write(NUTRITION_KEY, items);
}

export function dequeueNutritionCheckin(id: string): void {
  write(
    NUTRITION_KEY,
    read<PendingNutritionCheckin>(NUTRITION_KEY).filter((item) => item.input.id !== id),
  );
}

export function pendingNutritionCheckins(): PendingNutritionCheckin[] {
  return read<PendingNutritionCheckin>(NUTRITION_KEY);
}

/** See PendingWellness's conflictAt comment; identical reasoning for the
 *  (athlete_id, week_start) slot. */
export function markNutritionCheckinConflict(id: string): void {
  write(
    NUTRITION_KEY,
    read<PendingNutritionCheckin>(NUTRITION_KEY).map((item) =>
      item.input.id === id
        ? { ...item, conflictAt: item.conflictAt ?? new Date().toISOString() }
        : item,
    ),
  );
}

/* screens/gym-logging.md: "All set writes are local SQLite plus an outbox op" — the same
 * offline contract as the three above, added here for blocker B4 (integration audit).
 * gym_set_logs_one_live_per_slot (migration 0044) is what makes a replayed set write safe:
 * a retry under the same client-generated id collides on the primary key, and a retry that
 * somehow mints a fresh id for the same session/exercise/set slot collides on that index
 * instead. Corrections (revise_gym_set_log) are not queued here, same reasoning as every
 * other revise_* RPC in this file's own header comment. */

export function enqueueGymSetLog(input: GymSetLogInput): void {
  const items = read<PendingGymSetLog>(GYM_SET_KEY).filter((item) => item.input.id !== input.id);
  items.push({ input, queuedAt: new Date().toISOString() });
  write(GYM_SET_KEY, items);
}

export function dequeueGymSetLog(id: string): void {
  write(
    GYM_SET_KEY,
    read<PendingGymSetLog>(GYM_SET_KEY).filter((item) => item.input.id !== id),
  );
}

export function pendingGymSetLogs(): PendingGymSetLog[] {
  return read<PendingGymSetLog>(GYM_SET_KEY);
}
