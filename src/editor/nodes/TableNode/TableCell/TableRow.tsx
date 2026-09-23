import './TableRow.css';

import { useSortable } from "@dnd-kit/sortable";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import * as Popover from "@radix-ui/react-popover";
import { flexRender, Table } from "@tanstack/react-table";
import { GripVertical } from "lucide-react";
import { CSSProperties, useRef } from "react";

import { RowMenu } from "../TableMenu/RowMenu";
import { TableRowData } from "../TableNode";
import { toRowDndId } from "../tableUtils";
import EditableCell from "./TableCell";

type TableRowWithId = TableRowData & { _rowId: string };

const rowHeaderColumn = {
  id: "__row_header__",
  columnDef: { meta: { type: "text" as const } },
};

interface DraggableRowProps {
  row: ReturnType<Table<TableRowWithId>["getRowModel"]>["rows"][number];
  table: Table<TableRowWithId>;
  rowIndex: number;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  rowRef: (el: HTMLDivElement | null) => void;
  isDropTarget: boolean;
  suppressMenuClick?: boolean;
  draggingColumnId?: string | null;
  isNew?: boolean;
  showRowHeaders: boolean;
}

export function DraggableRow({
  row,
  table,
  rowIndex,
  menuOpen,
  onMenuOpenChange,
  rowRef,
  isDropTarget,
  suppressMenuClick,
  draggingColumnId,
  isNew,
  showRowHeaders,
}: DraggableRowProps) {
  const isEditable = useLexicalEditable();
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    isDragging,
  } = useSortable({
    id: toRowDndId(row.original._rowId),
  });

  const style: CSSProperties = {
    transition,
    opacity: isDragging ? 0.25 : 1,
    position: "relative",
    zIndex: isDragging ? 2 : undefined,
  };

  const openMenuIfClick = (clientX: number, clientY: number) => {
    if (suppressMenuClick || isDragging) return;
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;
    if (!origin) return;
    const distance = Math.hypot(clientX - origin.x, clientY - origin.y);
    if (distance < 8) {
      onMenuOpenChange(!menuOpen);
    }
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rowRef(el);
      }}
      style={style}
      className={`table-row ${isDropTarget ? "table-row--drop-target" : ""} ${isDragging ? "table-row--dragging" : ""} ${rowIndex % 2 === 0 ? "table-row--even" : ""} ${isNew ? "table-row--new" : ""}`}
      data-row-index={rowIndex}
      data-row-id={row.original._rowId}
    >
      <Popover.Root open={menuOpen} onOpenChange={onMenuOpenChange}>
        <div className="table-gutter">
          {isEditable && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="table-row-handle"
              title="Drag to move · Click for menu"
              aria-label="Row options"
              onPointerDown={(e) => {
                pointerOrigin.current = { x: e.clientX, y: e.clientY };
                if (menuOpen) {
                  e.stopPropagation();
                }
                listeners?.onPointerDown?.(e);
              }}
              onPointerUp={(e) => {
                openMenuIfClick(e.clientX, e.clientY);
              }}
              onPointerCancel={() => {
                pointerOrigin.current = null;
              }}
            >
              <GripVertical className="table-handle-icon" />
            </button>
          )}
        </div>
        <Popover.Anchor className="table-row-handle-anchor" />
        <Popover.Portal>
          <RowMenu rowIndex={rowIndex} table={table} />
        </Popover.Portal>
      </Popover.Root>

      {showRowHeaders && (
        <div
          className="table-cell table-cell--data table-row-header-cell"
          data-column-index="-1"
          aria-label={`Row ${rowIndex + 1}`}
          style={{ flex: "0 0 96px", width: 96 }}
        >
          <EditableCell
            getValue={() => row.original.rowHeader || String(rowIndex + 1)}
            row={{ index: rowIndex, original: row.original }}
            column={rowHeaderColumn}
            table={{
              options: {
                meta: {
                  ...table.options.meta,
                  updateData: (
                    rowId: string,
                    _columnId: string,
                    value: unknown,
                  ) => {
                    const label = String(value ?? "").trim();
                    // If the user hasn't really changed it from the auto-number, or cleared it,
                    // save it as empty so it continues to auto-renumber when rows are dragged.
                    const finalLabel = label === String(rowIndex + 1) ? "" : label;
                    table.options.meta?.updateRowHeader?.(rowId, finalLabel);
                  },
                  getColumnIndex: () => -1,
                },
              },
            }}
          />
        </div>
      )}

      {row.getVisibleCells().map((cell, index) => (
        <div
          key={cell.id}
          className="table-cell table-cell--data"
          data-column-index={index}
          style={{
            width: cell.column.getSize(),
            flex: `0 0 ${cell.column.getSize()}px`,
            opacity: draggingColumnId && cell.column.id === draggingColumnId ? 0.35 : undefined,
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
}
