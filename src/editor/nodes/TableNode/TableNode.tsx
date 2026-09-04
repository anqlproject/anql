import { DecoratorBlockNode, SerializedDecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode';
import type { EditorConfig } from 'lexical';
import { $getRoot, DOMConversionMap, DOMConversionOutput, DOMExportOutput, ElementFormatType, LexicalEditor, LexicalNode, NodeKey, Spread } from 'lexical';
import React from 'react';

import { TableComponent } from './TableComponent';
import { ensureRowIds } from './tableUtils';
import { searchInTableData, TableSearchMatch } from './useTableSearch';

function escapeHTML(str: string) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag as keyof typeof escapeMap] || tag)
  );
}

const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
};

export type ColumnDataType = "text" | "checkbox" | "date" | "number";

export interface TableColumn {
  header: string;
  id: string;
  accessorKey?: string;
  meta?: { type: ColumnDataType };
  size?: number;
}

export interface TableRowData {
  [key: string]: string | number | boolean | null | undefined;
  _rowId?: string;
}

export type SerializedTableNode = Spread<
  {
    data: TableRowData[];
    columns: TableColumn[];
    tableName?: string;
  },
  SerializedDecoratorBlockNode
>;

function convertTableElement(domNode: HTMLElement): DOMConversionOutput | null {
  const table = domNode as HTMLTableElement;
  const columns: TableColumn[] = [];
  const data: TableRowData[] = [];

  // Parse Headers
  const thead = table.tHead;
  const headerCells = thead ? Array.from(thead.rows[0]?.cells || []) : [];
  const firstRow = table.rows[0];

  if (headerCells.length === 0 && firstRow) {
    const cells = Array.from(firstRow.cells);
    cells.forEach((cell, i) => {
      columns.push({
        header: cell.textContent || `Col ${i + 1}`,
        id: `col_${i}`,
        meta: { type: 'text' }
      });
    });
  } else {
    headerCells.forEach((cell, i) => {
      columns.push({
        header: cell.textContent || `Col ${i + 1}`,
        id: `col_${i}`,
        meta: { type: 'text' }
      });
    });
  }

  // Parse Body Rows
  const rows = Array.from(table.rows);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.parentElement?.tagName === 'THEAD') continue;
    // Skip the first row if we used it as header and there is no thead
    if (!thead && i === 0 && rows.length > 1) continue;

    const cells = Array.from(row.cells);
    const rowData: TableRowData = {};

    columns.forEach((col, colIndex) => {
      const cell = cells[colIndex];
      rowData[col.id] = cell ? cell.textContent : '';
    });

    data.push(rowData);
  }

  // Fallback if no columns
  if (columns.length === 0) {
    let maxCols = 0;
    rows.forEach(r => maxCols = Math.max(maxCols, r.cells.length));
    for (let i = 0; i < maxCols; i++) {
      columns.push({
        header: `Col ${i + 1}`,
        id: `col_${i}`,
        meta: { type: 'text' }
      });
    }
  }

  const tableNode = $createTableNode(data, columns);
  return {
    node: tableNode,
    after: () => []
  };
}

export class TableNode extends DecoratorBlockNode {
  __data: TableRowData[];
  __columns: TableColumn[];
  __tableName: string;

  static getType(): string {
    return 'table';
  }

  static clone(node: TableNode): TableNode {
    return new TableNode(node.__data, node.__columns, node.__tableName, node.__format, node.__key);
  }

  afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__data = prevNode.__data;
    this.__columns = prevNode.__columns;
    this.__tableName = prevNode.__tableName;
  }

  constructor(data: TableRowData[], columns: TableColumn[], tableName?: string, format?: ElementFormatType, key?: NodeKey) {
    super(format, key);
    this.__data = data || [];
    this.__columns = columns || [];
    this.__tableName = tableName || '';
  }

  exportJSON(): SerializedTableNode {
    return {
      ...super.exportJSON(),
      data: this.__data,
      columns: this.__columns,
      tableName: this.__tableName,
    };
  }

  static importJSON(serializedNode: SerializedTableNode): TableNode {
    // Migration: convert old accessorKey-based columns to id-based columns
    const migratedColumns = serializedNode.columns.map(col => {
      if (col.accessorKey && !col.id) {
        // Old format: accessorKey was the primary identifier
        return {
          ...col,
          id: col.accessorKey,
          accessorKey: undefined
        };
      }
      return col;
    });

    // Also migrate row data to use the new id field
    const migratedData = serializedNode.data.map(row => {
      const migratedRow: TableRowData = {};
      migratedColumns.forEach(col => {
        const oldKey = col.accessorKey || col.id;
        const newKey = col.id;
        if (oldKey && newKey && oldKey !== newKey && row[oldKey] !== undefined) {
          migratedRow[newKey] = row[oldKey];
        } else if (newKey && row[newKey] !== undefined) {
          migratedRow[newKey] = row[newKey];
        }
      });
      // Preserve _rowId if it exists
      if (row._rowId) {
        migratedRow._rowId = row._rowId;
      }
      return migratedRow;
    });

    return $createTableNode(migratedData, migratedColumns, serializedNode.tableName).updateFromJSON(
      serializedNode,
    );
  }

  updateData(newData: TableRowData[]): void {
    const writable = this.getWritable();
    writable.__data = ensureRowIds(newData);
  }

  updateColumns(newColumns: TableColumn[]): void {
    const writable = this.getWritable();
    writable.__columns = newColumns;
  }

  updateTableName(name: string): void {
    const writable = this.getWritable();
    writable.__tableName = name;
  }

  getSearchMatches(query: string): TableSearchMatch[] {
    return searchInTableData(this.__data, this.__columns, query);
  }

  getTextContent(): string {
    // Return all text content from the table (title + headers + cells)
    const texts: string[] = [];

    if (this.__tableName) {
      texts.push(this.__tableName);
    }

    // Add headers
    this.__columns.forEach((col) => {
      texts.push(col.header || '');
    });

    // Add cell data
    this.__data.forEach((row) => {
      this.__columns.forEach((col) => {
        const columnId = col.id;
        if (columnId) {
          const value = row[columnId];
          if (value !== null && value !== undefined && value !== '') {
            texts.push(String(value));
          }
        }
      });
    });

    return texts.join(' ');
  }

  exportDOM(): DOMExportOutput {
    const tableHtml = `
      <table class="table" style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 0.875rem;">
        <colgroup>
          ${this.__columns
        .map(
          (col) =>
            `<col style="width: ${col.size || 150}px;" />`,
        )
        .join("")}
        </colgroup>
        <thead class="table-thead">
          <tr>
            ${this.__columns
        .map(
          (col) =>
            `<th style="border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; background-color: var(--surface-color); color: var(--text-secondary); font-weight: 500; height: 32px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(col.header || "")}">${escapeHTML(col.header || "")}</th>`,
        )
        .join("")}
          </tr>
        </thead>
        <tbody class="table-tbody">
          ${this.__data
        .map((rowData) => {
          return `<tr>${this.__columns
            .map((col) => {
              const cellContent =
                col.id && rowData[col.id]
                  ? String(rowData[col.id])
                  : "";
              const cellStyle = "border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; color: var(--text-primary); height: 36px; white-space: pre-wrap; overflow-wrap: break-word;";

              return `<td style="${cellStyle}">${escapeHTML(cellContent)}</td>`;
            })
            .join("")}</tr>`;
        })
        .join("")}
        </tbody>
      </table>
    `;
    const element = document.createElement('div');
    element.innerHTML = tableHtml;
    return { element: element.firstElementChild as HTMLElement };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      table: () => {
        // Only convert if it has our custom attribute, or if you want it to catch all tables you can remove the check.
        // We'll catch all tables to allow pasting from Excel/Word as Tables!
        return {
          conversion: convertTableElement,
          priority: 2, // High priority to override standard table plugin
        };
      },
    };
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): React.JSX.Element {
    const embedBlockTheme = config.theme.embedBlock || {};
    const className = {
      base: embedBlockTheme.base || '',
      focus: embedBlockTheme.focus || '',
    };
    return (
      <TableComponent
        nodeKey={this.getKey()}
        data={this.__data}
        columns={this.__columns}
        tableName={this.__tableName}
        format={this.__format}
        className={className}
      />
    );
  }
}

export function $createTableNode(data: TableRowData[], columns: TableColumn[], tableName?: string): TableNode {
  let name = tableName;
  if (name === undefined) {
    try {
      const root = $getRoot();
      if (root) {
        const existingNames: string[] = [];
        const traverse = (node: any) => {
          if ($isTableNode(node)) {
            existingNames.push(node.__tableName);
          }
          if (node.getChildren) {
            node.getChildren().forEach(traverse);
          }
        };
        traverse(root);

        let counter = 1;
        while (existingNames.includes(`Table${counter}`)) {
          counter++;
        }
        name = `Table${counter}`;
      }
    } catch (e) {
      // Ignored if not in a Lexical context
    }
  }

  const dataWithIds = ensureRowIds(data);
  return new TableNode(dataWithIds, columns, name);
}

export function $isTableNode(node: LexicalNode | null | undefined): node is TableNode {
  return node instanceof TableNode;
}
