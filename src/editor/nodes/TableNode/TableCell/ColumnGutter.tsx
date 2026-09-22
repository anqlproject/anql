import './ColumnGutter.css';

import { useSortable } from '@dnd-kit/sortable';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import * as Popover from '@radix-ui/react-popover';
import { Column, Table } from '@tanstack/react-table';
import { GripHorizontal } from 'lucide-react';
import { useRef } from 'react';

import { ColumnMenu } from '../TableMenu/ColumnMenu';
import { ColumnDataType, TableRowData } from '../TableNode';
import { toColDndId } from '../tableUtils';

type TableRowWithId = TableRowData & { _rowId: string };

interface ColGutterSlotProps {
  /** Structural column — no header abstraction needed here. */
  column: Column<TableRowWithId, unknown>;
  table: Table<TableRowWithId>;
  columnIndex: number;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  resizeHandler?: (e: React.MouseEvent | React.TouchEvent) => void;
}

/** One handle slot, DnD-sortable, with a click→menu behaviour. */
function ColGutterSlot({
  column,
  table,
  columnIndex,
  menuOpen,
  onMenuOpenChange,
  resizeHandler,
}: ColGutterSlotProps) {
  const isEditable = useLexicalEditable();
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const { attributes, isDragging, listeners, setNodeRef } = useSortable({
    id: toColDndId(column.id),
  });

  const type = (column.columnDef.meta?.type as ColumnDataType) || 'text';

  const openMenuIfClick = (clientX: number, clientY: number) => {
    if (isDragging) return;
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
      ref={setNodeRef}
      className="table-col-gutter-slot"
      style={{ width: column.getSize(), flex: `0 0 ${column.getSize()}px` }}
      data-column-index={columnIndex}
    >
      <Popover.Root open={menuOpen} onOpenChange={onMenuOpenChange}>
        {isEditable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className={`table-col-handle ${isDragging ? 'is-dragging' : ''}`}
            title="Drag to move · Click for menu"
            aria-label="Column options"
            onPointerDown={(e) => {
              pointerOrigin.current = { x: e.clientX, y: e.clientY };
              if (menuOpen) e.stopPropagation();
              listeners?.onPointerDown?.(e);
            }}
            onPointerUp={(e) => openMenuIfClick(e.clientX, e.clientY)}
            onPointerCancel={() => { pointerOrigin.current = null; }}
          >
            <GripHorizontal className="table-col-handle-icon" />
          </button>
        )}
        <Popover.Anchor className="table-col-handle-anchor" />
        <Popover.Portal>
          <ColumnMenu type={type} columnId={column.id} table={table} />
        </Popover.Portal>
      </Popover.Root>

      {column.getCanResize() && resizeHandler && (
        <div
          onMouseDown={resizeHandler}
          onTouchStart={resizeHandler}
          className={`table-resizer ${column.getIsResizing() ? 'table-resizer-active' : 'table-resizer-inactive'}`}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

interface ColumnGutterRowProps {
  columns: Column<TableRowWithId, unknown>[];
  resizeHandlers: Record<string, (e: React.MouseEvent | React.TouchEvent) => void>;
  table: Table<TableRowWithId>;
  openColMenuIndex: number | null;
  onColMenuOpenChange: (index: number, open: boolean) => void;
}

/**
 * A zero-height row rendered above the header row.
 * Contains one `ColGutterSlot` per column — exactly like the row gutter
 * rendered to the left of each data row.
 *
 * The gutter consumes columns directly. Labels and header rendering are
 * intentionally outside this control surface.
 */
export function ColumnGutterRow({
  columns,
  resizeHandlers,
  table,
  openColMenuIndex,
  onColMenuOpenChange,
}: ColumnGutterRowProps) {
  return (
    <div className="table-col-gutter-row" aria-hidden="true">
      {columns.map((column, index) => (
        <ColGutterSlot
          key={column.id}
          column={column}
          table={table}
          columnIndex={index}
          menuOpen={openColMenuIndex === index}
          onMenuOpenChange={(open) => onColMenuOpenChange(index, open)}
          resizeHandler={resizeHandlers[column.id]}
        />
      ))}
    </div>
  );
}

