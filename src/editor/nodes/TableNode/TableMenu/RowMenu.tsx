import './TableMenu.css';

import * as Popover from '@radix-ui/react-popover';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useGlobalStore } from "@/App/store/useGlobalStore";

interface TableMeta {
  deleteRow?: (rowId: string) => void;
  addRowAbove?: (rowId: string) => void;
  addRowBelow?: (rowId: string) => void;
  nodeKey?: string;
  closeMenus?: () => void;
}

interface TableOptions {
  meta?: TableMeta;
}

interface TableInstance {
  options: TableOptions;
  getRowModel: () => {
    rows: { original: { _rowId: string } }[];
  };
}

interface RowMenuProps {
  rowIndex: number;
  table: TableInstance;
}

export function RowMenu({ rowIndex, table }: RowMenuProps) {
  const { t } = useTranslation();
  const rowId = table.getRowModel().rows[rowIndex]?.original._rowId;

  return (
    <Popover.Content
      className="table-row-popover-content"
      align="end"
      sideOffset={4}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => { if (rowId) table.options.meta?.addRowAbove?.(rowId); }}
        className="table-menu-item"
      >
        <Plus className="w-4 h-4" /> {t('TABLE.addRowAbove')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => { if (rowId) table.options.meta?.addRowBelow?.(rowId); }}
        className="table-menu-item"
      >
        <Plus className="w-4 h-4" /> {t('TABLE.addRowBelow')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={async () => {
          const nodeKey = table.options.meta?.nodeKey;
          let blocId = "";
          if (nodeKey) {
            const dynamicState = useGlobalStore.getState().dynamicState;
            blocId = dynamicState.current.get(nodeKey)?.id || "";
          }
          if (rowId && blocId) {
            const url = `@row:${blocId}:${rowId}`;
            const html = `<a href="${url}" data-lexical-link="true" data-link-type="row" data-target-id="${blocId}:${rowId}" data-name="Ligne">Ligne</a>`;
            
            try {
              const blobText = new Blob([url], { type: 'text/plain' });
              const blobHtml = new Blob([html], { type: 'text/html' });
              const data = [new ClipboardItem({ 'text/plain': blobText, 'text/html': blobHtml })];
              await navigator.clipboard.write(data);
            } catch (err) {
              navigator.clipboard.writeText(url);
            }
            
            table.options.meta?.closeMenus?.();
          }
        }}
        className="table-menu-item"
      >
        <Link2 className="w-4 h-4" /> {t('TABLE.copyLink')}
      </button>
      <div className="table-menu-divider" />
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => { if (rowId) table.options.meta?.deleteRow?.(rowId); }}
        className="table-menu-item-danger"
      >
        <Trash2 className="w-4 h-4" /> {t('TABLE.delete')}
      </button>
    </Popover.Content>
  );
}
