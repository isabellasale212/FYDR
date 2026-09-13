/* PATTERN-S8 C11 (2026-09-13): the words around a held import row. Pure. */

export type HeldRowWords = { row_number: number; filename: string | null; record_date: string; reason: string; values: Record<string, number | null> };

export function heldSummary(n: number): string {
  if (n === 0) return 'Nothing held';
  return `${n} row${n === 1 ? '' : 's'} held for a name to match`;
}

/** "Row 14 of session.csv · 2026-09-02 · 5,320 m · No athlete on the roster matches "J Barnes"" */
export function heldRowLine(r: HeldRowWords): string {
  const parts = [`Row ${r.row_number}${r.filename ? ` of ${r.filename}` : ''}`, r.record_date];
  const td = r.values.total_distance_m;
  if (typeof td === 'number') parts.push(`${Math.round(td).toLocaleString('en-GB')} m`);
  parts.push(r.reason);
  return parts.join(' · ');
}

/** After Match: the record written and, when it was, the spelling remembered. */
export function matchedLine(o: { playerName: string; athleteName: string; aliasRemembered: boolean }): string {
  const remembered = o.aliasRemembered ? ` "${o.playerName}" is remembered as ${o.athleteName} — the next file with that spelling matches without asking.` : ` That spelling was already remembered for another athlete, so it was not changed; match it by hand again if it recurs.`;
  return `Matched "${o.playerName}" to ${o.athleteName}: one GPS record written.${remembered}`;
}
