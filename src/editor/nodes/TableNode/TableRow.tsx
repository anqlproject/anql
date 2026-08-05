import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Popover from "@radix-ui/react-popover";
import { flexRender, Table } from "@tanstack/react-table";
import { CSSProperties, useRef } from "react";

import { RowMenu } from "./RowMenu";
import { TableRowData } from "./TableNode";
import { toRowDndId } from "./tableUtils";

type TableRowWithId = TableRowData & { _rowId: string };

interface DraggableRowProps {
  row: ReturnType<Table<TableRowWithId>["getRowModel"]>["rows"][number];
  table: Table<TableRowWithId>;
  rowIndex: number;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  rowRef: (el: HTMLDivElement | null) => void;
  isDropTarget: boolean;
  suppressMenuClick?: boolean;
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
}: DraggableRowProps) {
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: toRowDndId(row.original._rowId),
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
    position: "relative",
    zIndex: isDragging ? 2 : 0,
  };

  const openMenuIfClick = (clientX: number, clientY: number) => {
    if (suppressMenuClick || isDragging) return;
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;
    if (!origin) return;
    const distance = Math.hypot(clientX - origin.x, clientY - origin.y);
    if (distance < 8) {
      onMenuOpenChange(true);
    }
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rowRef(el);
      }}
      style={style}
      className={`table-row ${isDropTarget ? "table-row--drop-target" : ""} ${isDragging ? "table-row--dragging" : ""}`}
      data-row-index={rowIndex}
      data-row-id={row.original._rowId}
    >
      <Popover.Root open={menuOpen} onOpenChange={onMenuOpenChange}>
        <div className="table-gutter">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="table-row-handle"
            title="Glisser pour déplacer · Cliquer pour le menu"
            aria-label="Options de ligne"
            onPointerDown={(e) => {
              pointerOrigin.current = { x: e.clientX, y: e.clientY };
              listeners?.onPointerDown?.(e);
            }}
            onPointerUp={(e) => {
              openMenuIfClick(e.clientX, e.clientY);
            }}
            onPointerCancel={() => {
              pointerOrigin.current = null;
            }}
          >
            <svg
              viewBox="0 0 10 10"
              className="table-handle-dots"
              aria-hidden="true"
            >
              <circle cx="2" cy="2" r="1" fill="currentColor" />
              <circle cx="2" cy="5" r="1" fill="currentColor" />
              <circle cx="2" cy="8" r="1" fill="currentColor" />
              <circle cx="6" cy="2" r="1" fill="currentColor" />
              <circle cx="6" cy="5" r="1" fill="currentColor" />
              <circle cx="6" cy="8" r="1" fill="currentColor" />
            </svg>
          </button>
        </div>
        <Popover.Anchor className="table-row-handle-anchor" />
        <Popover.Portal>
          <RowMenu rowIndex={rowIndex} table={table} />
        </Popover.Portal>
      </Popover.Root>

      {row.getVisibleCells().map((cell, index) => (
        <div
          key={cell.id}
          className="table-cell table-cell--data"
          data-column-index={index}
          style={{
            width: cell.column.getSize(),
            flex: `0 0 ${cell.column.getSize()}px`,
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
}
