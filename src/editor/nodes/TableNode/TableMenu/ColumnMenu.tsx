import './TableMenu.css';

import * as Popover from '@radix-ui/react-popover';
import type { Table } from '@tanstack/react-table';
import { Calendar, CheckSquare, Hash, Plus, Trash2, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TableRowData } from '../TableNode';

type TableRowWithId = TableRowData & { _rowId: string };

interface ColumnMenuProps {
  type: string;
  columnId: string;
  table: Table<TableRowWithId>;
}

export function ColumnMenu({ type, columnId, table }: ColumnMenuProps) {
  const { t } = useTranslation();

  return (
    <Popover.Content
      className="table-th-popover-content"
      align="end"
      sideOffset={4}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <div className="table-th-popover-title">{t('TABLE.columnType')}</div>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.updateColumnType(columnId, 'text')}
        className={type === 'text' ? 'table-menu-item-active' : 'table-menu-item'}
      >
        <Type className="w-4 h-4" /> {t('TABLE.text')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.updateColumnType(columnId, 'checkbox')}
        className={type === 'checkbox' ? 'table-menu-item-active' : 'table-menu-item'}
      >
        <CheckSquare className="w-4 h-4" /> {t('TABLE.checkbox')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.updateColumnType(columnId, 'date')}
        className={type === 'date' ? 'table-menu-item-active' : 'table-menu-item'}
      >
        <Calendar className="w-4 h-4" /> {t('TABLE.date')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.updateColumnType(columnId, 'number')}
        className={type === 'number' ? 'table-menu-item-active' : 'table-menu-item'}
      >
        <Hash className="w-4 h-4" /> {t('TABLE.number')}
      </button>
      <div className="table-menu-divider" />
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.addColumnLeft?.(columnId)}
        className="table-menu-item"
      >
        <Plus className="w-4 h-4" /> {t('TABLE.addColumnLeft')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.addColumnRight?.(columnId)}
        className="table-menu-item"
      >
        <Plus className="w-4 h-4" /> {t('TABLE.addColumnRight')}
      </button>
      <div className="table-menu-divider" />
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => table.options.meta?.deleteColumn(columnId)}
        className="table-menu-item-danger"
      >
        <Trash2 className="w-4 h-4" /> {t('TABLE.delete')}
      </button>
    </Popover.Content>
  );
}
