/* Availability history — PATTERN-S3 C7 (decided 2026-09-12): one row per
 * change, newest first; the time, the status word, the restriction line as
 * it read then, what changed against the row before, and who set it. Never
 * edited and never removed: `availability` is already a ledger — every
 * change closes the open interval and inserts a new row (setAvailability),
 * and 0005's one-open-per-athlete constraint keeps it one line — so the
 * history is the rows themselves, oldest to newest, with no trigger and no
 * view. A correction adds a row; it does not rewrite one.
 *
 * What a reader is told is what the reader may read: the restriction line
 * goes through lib/restrictions.ts's rule (no protocol, no stage, no
 * diagnosis) for everyone, and "what changed" names only the four things
 * this table holds — status, restrictions, the reason category, the injury
 * link. Nothing clinical is derived here; the medic's clinical record has
 * its own screen.
 */
import { restrictionLine } from '@/lib/restrictions';
import { AVAILABILITY_STATUS } from '@/lib/status';
import { enumLabel } from '@/lib/format';
import type { AvailabilityReason, AvailabilityStatus } from '@/lib/types/database';

/** The restriction line as the squad list reads it: the clinical terms
 *  filtered out, the rest in words, joined. */
function lineOf(restrictions: readonly string[] | null): string {
  return restrictionLine(restrictions).map(enumLabel).join(' · ');
}

export type AvailabilityLedgerRow = {
  id: string;
  status: AvailabilityStatus;
  restrictions: string[] | null;
  reason_category: AvailabilityReason | null;
  injury_id: string | null;
  effective_from: string;
  effective_to: string | null;
  set_by: string | null;
  note: string | null;
};

export type HistoryRow = {
  id: string;
  at: string;
  status: AvailabilityStatus;
  statusLabel: string;
  restrictionLine: string;
  changed: string;
  setBy: string | null;
  /** True while this row is the open interval. */
  current: boolean;
};

const REASON_WORD: Record<string, string> = {
  injury: 'injury',
  illness: 'illness',
  personal: 'personal',
  academic: 'academic',
  representative: 'representative',
  suspension: 'suspension',
  load_management: 'load management',
  other: 'other',
};

function reasonWord(r: AvailabilityReason | null): string | null {
  return r ? (REASON_WORD[r] ?? String(r).replace(/_/g, ' ')) : null;
}

/** What this row changed against the one before it, in words. The first row
 *  is "Added to the record"; an unchanged status with a changed line says
 *  which line; a row identical in every field is "Re-recorded" — a fact,
 *  not an error, since a second identical write is a real event. */
export function whatChanged(prev: AvailabilityLedgerRow | null, row: AvailabilityLedgerRow): string {
  const statusWord = (s: AvailabilityStatus) => AVAILABILITY_STATUS[s]?.label ?? s;
  if (!prev) {
    const how = row.injury_id
      ? 'Injury-linked'
      : row.status !== 'available' && row.reason_category && row.reason_category !== 'injury'
        ? `Absence recorded · ${reasonWord(row.reason_category)}`
        : null;
    return how ? `${statusWord(row.status)} · ${how}` : `Added to the record · ${statusWord(row.status)}`;
  }
  const parts: string[] = [];
  if (prev.status !== row.status) parts.push(`${statusWord(prev.status)} → ${statusWord(row.status)}`);
  const before = lineOf(prev.restrictions);
  const after = lineOf(row.restrictions);
  if (before !== after) parts.push(after ? `Restrictions now ${after}` : 'Restrictions cleared');
  if ((prev.injury_id ?? null) !== (row.injury_id ?? null)) {
    parts.push(row.injury_id ? 'Injury-linked' : prev.injury_id ? 'No longer injury-linked' : '');
  }
  /* The reason names an absence only on a row that IS one: the coach's
     Available write carries a reason too (the insert policy requires one),
     and "Absence · personal" on an Available row would be a false fact. */
  if (row.status !== 'available' && !row.injury_id && row.reason_category && row.reason_category !== 'injury' && prev.reason_category !== row.reason_category) {
    parts.push(`Absence · ${reasonWord(row.reason_category)}`);
  }
  const line = parts.filter(Boolean).join(' · ');
  return line || 'Re-recorded, nothing changed';
}

/** Rows oldest → newest in; history newest → oldest out. */
export function buildHistory(rows: readonly AvailabilityLedgerRow[], names: ReadonlyMap<string, string>): HistoryRow[] {
  const ordered = [...rows].sort((a, b) => a.effective_from.localeCompare(b.effective_from) || a.id.localeCompare(b.id));
  const out: HistoryRow[] = [];
  let prev: AvailabilityLedgerRow | null = null;
  for (const row of ordered) {
    out.push({
      id: row.id,
      at: row.effective_from,
      status: row.status,
      statusLabel: AVAILABILITY_STATUS[row.status]?.label ?? row.status,
      restrictionLine: lineOf(row.restrictions) || 'None',
      changed: whatChanged(prev, row),
      setBy: row.set_by ? (names.get(row.set_by) ?? null) : null,
      current: row.effective_to === null,
    });
    prev = row;
  }
  return out.reverse();
}
