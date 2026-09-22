import './ColumnGutter.css';

import { useSortable } from '@dnd-kit/sortable';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import * as Popover from '@radix-ui/react-popover';
import { Header, Table } from '@tanstack/react-table';
import { GripHorizontal } from 'lucide-react';
import { useRef } from 'react';

import { ColumnDataType, TableRowData } from '../TableNode';
import { toColDndId } from '../tableUtils';
import { ColumnMenu } from '../TableMenu/ColumnMenu';

type TableRowWithId = TableRowData & { _rowId: string };

interface ColGutterSlotProps {
  header: Header<TableRowWithId, unknown>;
  table: Table<TableRowWithId>;
  columnIndex: number;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

/** One handle slot, DnD-sortable, with a click→menu behaviour. */
function ColGutterSlot({
  header,
  table,
  columnIndex,
  menuOpen,
  onMenuOpenChange,
}: ColGutterSlotProps) {
  const isEditable = useLexicalEditable();
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const { attributes, isDragging, listeners, setNodeRef } = useSortable({
    id: toColDndId(header.column.id),
  });

  const type = (header.column.columnDef.meta?.type as ColumnDataType) || 'text';

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
      style={{ width: header.getSize(), flex: `0 0 ${header.getSize()}px` }}
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
          <ColumnMenu type={type} columnId={header.column.id} table={table} />
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

interface ColumnGutterRowProps {
  headers: Header<TableRowWithId, unknown>[];
  table: Table<TableRowWithId>;
  openColMenuIndex: number | null;
  onColMenuOpenChange: (index: number, open: boolean) => void;
}

/**
 * A zero-height row rendered above the header row.
 * Contains one `ColGutterSlot` per column — exactly like the row gutter
 * rendered to the left of each data row.
 */
export function ColumnGutterRow({
  headers,
  table,
  openColMenuIndex,
  onColMenuOpenChange,
}: ColumnGutterRowProps) {
  return (
    <div className="table-col-gutter-row" aria-hidden="true">
      {headers.map((header, index) => (
        <ColGutterSlot
          key={header.id}
          header={header}
          table={table}
          columnIndex={index}
          menuOpen={openColMenuIndex === index}
          onMenuOpenChange={(open) => onColMenuOpenChange(index, open)}
        />
      ))}
    </div>
  );
}
