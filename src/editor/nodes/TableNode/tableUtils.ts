import type { RefObject } from "react";

import { TableRowData } from "./TableNode";

const FOCUSABLE_CELL_SELECTOR =
  'input:not([type="hidden"]), textarea, button.table-date-btn';

export type TableRowWithId = Record<string, unknown> & { _rowId: string };

/**
 * Ensures a row has a unique _rowId. Generates one if missing.
 * This is the centralized function for row ID generation to ensure consistency.
 */
export function ensureRowId(row: TableRowData): TableRowData & { _rowId: string } {
  if (row._rowId) {
    return row as TableRowData & { _rowId: string };
  }
  return {
    ...row,
    _rowId: `row-${crypto.randomUUID()}`
  };
}

/**
 * Ensures all rows in an array have unique _rowIds.
 * Generates missing IDs while preserving existing ones.
 */
export function ensureRowIds(rows: TableRowData[]): (TableRowData & { _rowId: string })[] {
  return rows.map(ensureRowId);
}

export function focusCellInput(
  rowRefs: RefObject<(HTMLElement | null)[]>,
  rowIndex: number,
  columnIndex: number,
): void {
  const row = rowRefs.current[rowIndex];
  if (!row) return;

  const cells = row.querySelectorAll(".table-cell--data");
  const targetCell = cells[columnIndex];
  const focusable = targetCell?.querySelector(FOCUSABLE_CELL_SELECTOR) as
    | HTMLElement
    | null;
  focusable?.focus();
}

export const ROW_DND_PREFIX = "row:";
export const COL_DND_PREFIX = "col:";

export function toRowDndId(rowId: string) {
  return `${ROW_DND_PREFIX}${rowId}`;
}

export function toColDndId(columnId: string) {
  return `${COL_DND_PREFIX}${columnId}`;
}

export function isRowDndId(id: string | number) {
  return String(id).startsWith(ROW_DND_PREFIX);
}

export function isColDndId(id: string | number) {
  return String(id).startsWith(COL_DND_PREFIX);
}

export function parseRowDndId(id: string | number) {
  return String(id).slice(ROW_DND_PREFIX.length);
}

export function parseColDndId(id: string | number) {
  return String(id).slice(COL_DND_PREFIX.length);
}
