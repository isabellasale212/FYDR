/* PATTERN-S7 C3 / PATTERN-S8 C8 (2026-09-13): what an export is, said the
 * same way in three places — the dialog before the file is written, the
 * file's own header lines, and the audit row. One descriptor, built by the
 * page for the dialog and by the route for the file, from the same fields.
 * Pure. */

export const MEDICAL_EXPORT_LINE = "Contains medical information. Handle under the club's data policy.";

export type ExportDescriptor = {
  /** "compliance-2026-08-17-to-2026-09-13.csv" — named before it exists. */
  fileName: string;
  /** "Compliance report" */
  report: string;
  /** "Last 28 days: 2026-08-17 to 2026-09-13" */
  window: string;
  /** "Forwards (15 athletes)" — the resolved group scope with its count. */
  scope: string;
  /** How many data rows the file holds (headers and comment lines excluded). */
  rows: number;
  /** "athlete", "day", "set" — what one row is. */
  rowNoun: string;
  /** Every filter applied beyond the window and the scope, each a phrase:
   *  "Test: 40m sprint", "Session: Tuesday gym, 9 Sept". Empty = none. */
  filters: string[];
  /** The medic's copy of a clinical report. */
  medical: boolean;
};

export function exportFileName(prefix: string, from: string, to: string): string {
  return `${prefix}-${from}-to-${to}.csv`;
}

const rowsPhrase = (rows: number, noun: string) => `${rows.toLocaleString('en-GB')} row${rows === 1 ? '' : 's'}, one per ${noun}`;

/** The sentences, in reading order, that the dialog shows and the file
 *  carries. `exportedBy` is only known to the route. */
export function exportSentences(d: ExportDescriptor, o?: { exportedBy?: string; at?: string }): string[] {
  const lines = [`${d.report}, ${d.window}. Scope: ${d.scope}.`, d.filters.length > 0 ? `Filters: ${d.filters.join(' · ')}.` : 'No filter beyond the window and the scope above.', `${rowsPhrase(d.rows, d.rowNoun)}.`];
  if (d.medical) lines.push(MEDICAL_EXPORT_LINE);
  lines.push(o?.exportedBy ? `Exported by ${o.exportedBy}${o.at ? ` on ${o.at}` : ''}; written to the audit log with the row count.` : 'Written to the audit log with your name and the row count.');
  return lines;
}

/** The file's header: every sentence above as a `#` line, the definition
 *  first when the catalogue has one (PATTERN-S7 C1). CRLF, as lib/csv.ts. */
export function exportCaption(d: ExportDescriptor, definition: string | null, o?: { exportedBy?: string; at?: string }): string {
  const lines = [...(definition ? [definition] : []), ...exportSentences(d, o)];
  return lines.map((l) => `# ${l}\r\n`).join('');
}

/** The audit row's metadata, from the same descriptor. */
export function exportAuditMetadata(d: ExportDescriptor): { file: string; rows: number; filters: string[]; medical: boolean; format: 'csv' } {
  return { file: d.fileName, rows: d.rows, filters: d.filters, medical: d.medical, format: 'csv' };
}
