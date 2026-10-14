import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

import { logger } from '@/core/logger';
import { TableColumn, TableRowData } from '@/editor/nodes/TableNode/TableNode';

import { tableToCsv, TableToCsvOptions } from './tableToCsv';

export interface ExportTableToCsvOptions extends TableToCsvOptions {
  columns: TableColumn[];
  data: TableRowData[];
  tableName?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Opens a native save file dialog to choose export location,
 * converts the table columns and data to CSV format, and writes the file.
 *
 * @returns true if exported, false if cancelled or failed.
 */
export async function exportTableToCsv({
  columns,
  data,
  tableName,
  includeHeaders = true,
  showRowHeaders = false,
  separator = ',',
  onSuccess,
  onError,
}: ExportTableToCsvOptions): Promise<boolean> {
  try {
    const sanitizedTitle = (tableName?.trim() || 'table')
      .replace(/[/\\?%*:|"<>]/g, '_');
    const defaultFilename = `${sanitizedTitle}.csv`;

    const filePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    const csvContent = tableToCsv(columns, data, {
      includeHeaders,
      showRowHeaders,
      separator,
    });

    await writeTextFile(filePath, csvContent);
    onSuccess?.();
    return true;
  } catch (err) {
    logger.error('[exportTableToCsv] Failed to export table to CSV:', err instanceof Error ? err : undefined);
    onError?.(err);
    return false;
  }
}
