import './TableHeader.css';

import { Header, Table } from '@tanstack/react-table';
import { CSSProperties } from 'react';

import { TableRowData } from '../TableNode';
import EditableCell from './TableCell';

type TableRowWithId = TableRowData & { _rowId: string };

interface DraggableHeaderProps {
  header: Header<TableRowWithId, unknown>;
  table: Table<TableRowWithId>;
  columnIndex: number;
  columnRef: (el: HTMLDivElement | null) => void;
  isDropTarget?: boolean;
  isNew?: boolean;
}

export default function DraggableHeader({
  header,
  table,
  columnIndex,
  columnRef,
  isDropTarget,
  isNew,
}: DraggableHeaderProps) {
  const headerName = header.column.columnDef.header as string;

  const style: CSSProperties = {
    width: header.getSize(),
    flex: `0 0 ${header.getSize()}px`,
    position: 'relative',
  };

  return (
    <div
      ref={columnRef}
      style={style}
      className={`table-cell table-cell--header ${isDropTarget ? 'table-cell--drop-target' : ''} ${isNew ? 'table-col--new' : ''}`}
      data-column-index={columnIndex}
    >
      <div className="table-header-inner">
        <EditableCell
          getValue={() => headerName || ''}
          row={{ index: -1 } as any}
          column={
            {
              ...header.column,
              columnDef: {
                ...header.column.columnDef,
                meta: {
                  ...(header.column.columnDef.meta as any),
                  type: 'text',
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
          className={`table-resizer ${header.column.getIsResizing() ? 'table-resizer-active' : 'table-resizer-inactive'}`}
        />
      )}
    </div>
  );
}

