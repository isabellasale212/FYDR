/* Shared CSV formatting for report exports. screens/reports.md calls for
 * PDF, CSV and XLSX; this build's export is CSV only — see each report's own
 * export/route.ts for the full reasoning (no PDF rendering pipeline, no
 * XLSX writer, both real cuts). CSV needs neither: it is text, RFC 4180
 * quoting is a handful of rules, and it opens in the spreadsheet a coach was
 * always going to paste this into anyway. */

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Rows as plain objects, headers as [key, label] pairs so the CSV column
 *  order and titles are explicit rather than however Object.keys happens to
 *  iterate. */
export function toCsv<T extends Record<string, unknown>>(rows: readonly T[], headers: readonly [keyof T, string][]): string {
  const headerLine = headers.map(([, label]) => escapeCsvCell(label)).join(',');
  const lines = rows.map((row) => headers.map(([key]) => escapeCsvCell(row[key])).join(','));
  // CRLF per RFC 4180 — Excel is more forgiving of LF but the spec says CRLF
  // and there is no reason to fight it.
  return [headerLine, ...lines].join('\r\n') + '\r\n';
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
