import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { $insertNodes, $setSelection, LexicalEditor } from 'lexical';

import { logger } from '@/core/logger';
import { $createTableNode } from '@/editor/nodes/TableNode/TableNode';

import { parseCsvToTable } from './csvToTable';

/**
 * Opens a native file dialog filtered to .csv files, reads the selected file,
 * parses it, and inserts a TableNode into the editor at the current position.
 *
 * @param editor  The active LexicalEditor instance.
 */
export async function insertTableFromCsv(editor: LexicalEditor): Promise<void> {
  try {
    const selectedPath = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (!selectedPath || typeof selectedPath !== 'string') return;

    const content = await readTextFile(selectedPath);
    const tableData = parseCsvToTable(content);

    if (!tableData || tableData.columns.length === 0) {
      logger.warn('[insertTableFromCsv] CSV is empty or could not be parsed');
      return;
    }

    editor.update(() => {
      const tableNode = $createTableNode(
        tableData.data,
        tableData.columns,
        undefined,
        true,  // showColumnHeaders — first CSV row becomes headers
        false, // showRowHeaders
      );
      $insertNodes([tableNode]);
      $setSelection(null);
    });
  } catch (err) {
    logger.error('[insertTableFromCsv] Failed to import CSV:', err instanceof Error ? err : undefined);
  }
}
