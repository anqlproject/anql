import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  LexicalEditor,
} from 'lexical';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';

import { ComponentDialog } from '@/components/custom/ComponentDialog/ComponentDialog';
import { $createTableNode, TableColumn, TableNode, TableRowData } from '@/editor/nodes/TableNode/TableNode';
import TextInput from '@/editor/ui/TextInput';

export type InsertTablePayload = {
  data: TableRowData[];
  columns: TableColumn[];
};

export const INSERT_TABLE_COMMAND: LexicalCommand<InsertTablePayload> =
  createCommand('INSERT_TABLE_COMMAND');

export const TABLE_SEARCH_NAVIGATE_COMMAND: LexicalCommand<{ nodeKey: string; rowIndex: number; columnId: string }> = createCommand('TABLE_SEARCH_NAVIGATE_COMMAND');
export const TABLE_ROW_NAVIGATE_COMMAND: LexicalCommand<{ nodeKey: string; rowId: string }> = createCommand('TABLE_ROW_NAVIGATE_COMMAND');

export default function TablePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([TableNode])) {
      throw new Error(
        'TablePlugin: TableNode not registered on editor',
      );
    }

    const handleSearchNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeKey: string; rowIndex: number; columnId: string }>;
      editor.dispatchCommand(TABLE_SEARCH_NAVIGATE_COMMAND, customEvent.detail);
    };

    const handleRowNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeKey: string; rowId: string }>;
      editor.dispatchCommand(TABLE_ROW_NAVIGATE_COMMAND, customEvent.detail);
    };

    document.addEventListener('tableSearchNavigate', handleSearchNavigate);
    document.addEventListener('tableRowNavigate', handleRowNavigate);

    const unregisterCommand = editor.registerCommand(
      INSERT_TABLE_COMMAND,
      (payload: InsertTablePayload) => {
        const tableNode = $createTableNode(
          payload.data,
          payload.columns,
        );
        $insertNodes([tableNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      document.removeEventListener('tableSearchNavigate', handleSearchNavigate);
      document.removeEventListener('tableRowNavigate', handleRowNavigate);
      unregisterCommand();
    };
  }, [editor]);

  return null;
}

export function InsertTableDialog({
  activeEditor,
  onClose,
}: {
  activeEditor: LexicalEditor;
  onClose: () => void;
}): JSX.Element {
  const [rows, setRows] = useState('5');
  const [columns, setColumns] = useState('5');
  const [isDisabled, setIsDisabled] = useState(true);

  useEffect(() => {
    const row = Number(rows);
    const column = Number(columns);
    if (row && row > 0 && row <= 500 && column && column > 0 && column <= 50) {
      setIsDisabled(false);
    } else {
      setIsDisabled(true);
    }
  }, [rows, columns]);

  const onClick = () => {
    const rowCount = Number(rows);
    const colCount = Number(columns);

    const generatedColumns: TableColumn[] = Array.from({ length: colCount }).map((_, i) => ({
      header: `Colonne ${i + 1}`,
      accessorKey: `col_${i}`,
      meta: { type: 'text' },
    }));

    const generatedData = Array.from({ length: rowCount }).map((): TableRowData => {
      const row: TableRowData = {};
      for (let i = 0; i < colCount; i++) {
        row[`col_${i}`] = '';
      }
      return row;
    });

    activeEditor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: generatedColumns,
      data: generatedData,
    });

    onClose();
  };

  return (
    <ComponentDialog
      title="Insert Table"
      onClose={onClose}
      rightButton={{
        text: 'Confirm',
        onClick: onClick,
        disabled: isDisabled
      }}
    >
      <TextInput
        placeholder={'# of rows (1-500)'}
        label="Rows"
        onChange={setRows}
        value={rows}
        data-test-id="table-modal-rows"
        type="number"
      />
      <TextInput
        placeholder={'# of columns (1-50)'}
        label="Columns"
        onChange={setColumns}
        value={columns}
        data-test-id="table-modal-columns"
        type="number"
      />
    </ComponentDialog>
  );
}
