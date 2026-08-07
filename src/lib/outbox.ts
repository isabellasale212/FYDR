import type { WellnessEntryInput } from '@/lib/validation/wellness';
import type { TrainingEntryInput } from '@/lib/validation/training';

/* A one table outbox in localStorage, one key per domain.
 *
 * screens/wellness-entry.md and screens/training-entry.md: the entry is saved
 * on the phone first and sent when there is signal. An athlete standing in a
 * gym with no bars must never be shown a network error for something he has
 * already done, so a submission that cannot reach the server stays here and
 * is retried on the next load.
 *
 * The entry id is generated before the write, so a retry after a crash inserts
 * the same row rather than a second one. */

const KEY = 'fydr-outbox-wellness';
const TRAINING_KEY = 'fydr-outbox-training';

export type PendingWellness = {
  input: WellnessEntryInput;
  queuedAt: string;
};

export type PendingTraining = {
  input: TrainingEntryInput;
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
