import './TableHeader.css';

import { useSortable } from "@dnd-kit/sortable";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import * as Popover from "@radix-ui/react-popover";
import { Header, Table } from "@tanstack/react-table";
import { GripHorizontal } from "lucide-react";
import { CSSProperties, useRef } from "react";

import { ColumnMenu } from "../TableMenu/ColumnMenu";
import { TableRowData } from "../TableNode";
import { toColDndId } from "../tableUtils";
import EditableCell from "./TableCell";

type TableRowWithId = TableRowData & { _rowId: string };

interface DraggableHeaderProps {
  header: Header<TableRowWithId, unknown>;
  table: Table<TableRowWithId>;
  columnIndex: number;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  columnRef: (el: HTMLDivElement | null) => void;
  isDropTarget?: boolean;
}

export default function DraggableHeader({
  header,
  table,
  columnIndex,
  menuOpen,
  onMenuOpenChange,
  columnRef,
  isDropTarget,
}: DraggableHeaderProps) {
  const isEditable = useLexicalEditable();
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transition,
  } = useSortable({
    id: toColDndId(header.column.id),
  });

  const style: CSSProperties = {
    width: header.getSize(),
    flex: `0 0 ${header.getSize()}px`,
    opacity: isDragging ? 0.35 : 1,
    transition,
    position: "relative",
    zIndex: isDragging ? 2 : 1,
  };

  const type = header.column.columnDef.meta?.type || "text";
  const headerName = header.column.columnDef.header as string;

  const openMenuIfClick = (clientX: number, clientY: number) => {
    if (isDragging) return;
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
        columnRef(el);
      }}
      style={style}
      className={`table-cell table-cell--header ${isDropTarget ? "table-cell--drop-target" : ""} ${isDragging ? "is-dragging" : ""}`}
      data-column-index={columnIndex}
    >
      <Popover.Root open={menuOpen} onOpenChange={onMenuOpenChange}>
        {isEditable && (
          <div
            {...attributes}
            {...listeners}
            className={`table-col-handle ${isDragging ? "is-dragging" : ""}`}
            title="Drag to move · Click for menu"
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
            <GripHorizontal className="table-handle-icon" />
          </div>
        )}
        <Popover.Anchor className="table-col-handle-anchor" />
        <Popover.Portal>
          <ColumnMenu
            type={type}
            columnId={header.column.id}
            table={table}
          />
        </Popover.Portal>
      </Popover.Root>

      <div className="table-header-inner">
        <EditableCell
          getValue={() => headerName || ""}
          row={{ index: -1 } as any}
          column={
            {
              ...header.column,
              columnDef: {
                ...header.column.columnDef,
                meta: {
                  ...(header.column.columnDef.meta as any),
                  type: "text",
                },
              },
            } as any
          }
          table={
            {
              ...table,
              options: {
                ...table.options,
                meta: {
                  ...table.options.meta,
                  updateData: (
                    _rowId: string,
                    columnId: string,
                    value: unknown,
                  ) => {
                    table.options.meta?.updateColumnHeader(
                      columnId,
                      value as string,
                    );
                  },
                },
              },
            } as any
          }
        />
      </div>

      {header.column.getCanResize() && (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`table-resizer ${header.column.getIsResizing() ? "table-resizer-active" : "table-resizer-inactive"}`}
        />
      )}
    </div>
  );
}
