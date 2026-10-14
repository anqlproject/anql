import { TableColumn, TableRowData } from '@/editor/nodes/TableNode/TableNode';

export interface TableToCsvOptions {
  /** Whether to output the header row. Defaults to true. */
  includeHeaders?: boolean;
  /** Whether to include the row header / index column. Defaults to false. */
  showRowHeaders?: boolean;
  /** Field separator delimiter. Defaults to ','. */
  separator?: string;
}

/**
 * Escapes a single cell value for CSV output in compliance with RFC 4180.
 *
 * If the value contains a comma, semicolon, newline, carriage return,
 * or double quote, it is enclosed in double quotes with existing quotes doubled.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes(';') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts table columns and rows into a formatted CSV string.
 *
 * @param columns Array of table column definitions.
 * @param data Array of table row objects mapping column IDs to cell values.
 * @param options Formatting options (includeHeaders, showRowHeaders, separator).
 * @returns RFC 4180 compliant CSV string with CRLF line endings.
 */
export function tableToCsv(
  columns: TableColumn[],
  data: TableRowData[],
  options: TableToCsvOptions = {},
): string {
  const {
    includeHeaders = true,
    showRowHeaders = false,
    separator = ',',
  } = options;

  const lines: string[] = [];

  if (includeHeaders && columns.length > 0) {
    const headerRow: string[] = [];
    if (showRowHeaders) {
      headerRow.push('');
    }
    for (const col of columns) {
      headerRow.push(escapeCsvField(col.header ?? ''));
    }
    lines.push(headerRow.join(separator));
  }

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    const rowCells: string[] = [];

    if (showRowHeaders) {
      const rowHeaderVal = row.rowHeader || String(rowIndex + 1);
      rowCells.push(escapeCsvField(rowHeaderVal));
    }

    for (const col of columns) {
      const val = col.id ? row[col.id] : undefined;
      rowCells.push(escapeCsvField(val));
    }

    lines.push(rowCells.join(separator));
  }

  return lines.join('\r\n');
}
