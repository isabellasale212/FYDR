/* PATTERN-S8 C7 (2026-09-13): the audit log's filters on a phone — the
 * count of active filters the header carries, and the sentence the
 * sheet's button reads back before the page is asked for the rows. Pure;
 * the page, the sheet and the guard read the same words. */

export type AuditFilterState = {
  type: string;
  from: string;
  to: string;
  actor: string;
  athlete: string;
  q: string;
  /** `?range=all` — the 30-day default lifted. */
  allTime: boolean;
  /** No date parameter at all: the default 30-day window is not a filter
   *  the person chose, so it is not counted. */
  usingDefaultWindow: boolean;
};

export function activeFilterCount(f: AuditFilterState): number {
  let n = 0;
  if (f.type) n++;
  if (!f.usingDefaultWindow && (f.from || f.to || f.allTime)) n++;
  if (f.actor) n++;
  if (f.athlete) n++;
  if (f.q.trim()) n++;
  return n;
}

/** The phone button that opens the sheet: "Filters" or "Filters · 3". */
export function filtersButtonLabel(active: number): string {
  return active > 0 ? `Filters · ${active}` : 'Filters';
}

/** The sheet's apply button, reading back what it will show. Never a bare
 *  number, never "0": a filter that matches nothing says so and still
 *  applies (the page's own empty state then offers the way out). */
export function showEntriesLabel(count: number | null, counting: boolean): string {
  if (counting) return 'Counting…';
  if (count === null) return 'Show entries';
  if (count === 0) return 'Show — nothing matches';
  return `Show ${count.toLocaleString('en-GB')} entr${count === 1 ? 'y' : 'ies'}`;
}
