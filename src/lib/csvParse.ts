/* A small, hand-rolled CSV reader — not a dependency. RFC 4180 quoting
 * (quoted fields, "" for an embedded quote, commas and newlines inside
 * quotes) is a short, well-defined state machine, and adding a library for
 * it would be adding a dependency to replace forty lines that do not
 * change. Used by the GPS import route; see its own header for what parsing
 * this build's import does and does not attempt (no delimiter detection, no
 * encoding detection — comma-delimited, UTF-8, a header row, full stop). */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // A leading BOM (common from Excel's "CSV UTF-8" export) is not part of
  // the data.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Final field/row, for a file with no trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Rows as header-keyed objects, the shape the import route actually wants. */
export function parseCsvRecords(text: string): { headers: string[]; records: Record<string, string>[] } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const records = rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (row[idx] ?? '').trim();
    });
    return record;
  });
  return { headers, records };
}
