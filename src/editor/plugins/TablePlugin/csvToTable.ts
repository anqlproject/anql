/**
 * Parses a CSV string and converts it into the table format used by the editor.
 *
 * The first row is treated as column headers.
 * Each subsequent row becomes a data row.
 */

export interface CsvColumn {
  id: string;
  header: string;
}

export interface CsvTableData {
  columns: CsvColumn[];
  data: Record<string, string>[];
}

/**
 * Splits a single CSV line into fields, respecting double-quoted fields
 * that may contain commas or newlines.
 */
function splitCsvLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === separator && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Detects the most likely separator used in a CSV string.
 * Falls back to comma if uncertain.
 */
function detectSeparator(csv: string): string {
  const firstLine = csv.split('\n')[0] ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };

  for (const ch of firstLine) {
    if (ch in counts) counts[ch]++;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Converts a raw CSV string into the column/data format used by the table node.
 *
 * @param csv  Raw CSV file content as a string
 * @returns    An object with `columns` and `data` arrays, or `null` if the CSV is empty.
 */
export function parseCsvToTable(csv: string): CsvTableData | null {
  const separator = detectSeparator(csv);

  // Normalize line endings and remove empty trailing lines
  const lines = csv
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) return null;

  const headerFields = splitCsvLine(lines[0], separator);
  if (headerFields.length === 0) return null;

  // Build column descriptors — each gets a stable UUID
  const columns: CsvColumn[] = headerFields.map((header) => ({
    id: crypto.randomUUID(),
    header: header || '',
  }));

  // Build data rows
  const data: Record<string, string>[] = lines.slice(1).map((line) => {
    const fields = splitCsvLine(line, separator);
    const row: Record<string, string> = {};

    columns.forEach((col, i) => {
      row[col.id] = fields[i] ?? '';
    });

    return row;
  });

  return { columns, data };
}
