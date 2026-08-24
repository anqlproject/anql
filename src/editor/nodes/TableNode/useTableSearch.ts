import { TableColumn, TableRowData } from './TableNode';

export interface TableSearchMatch {
  rowIndex: number;
  columnId: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

/**
 * Search for a query in table data and return all matches
 */
export function searchInTableData(
  data: TableRowData[],
  columns: TableColumn[],
  query: string
): TableSearchMatch[] {
  const matches: TableSearchMatch[] = [];
  
  if (!query) return matches;
  
  const lowerQuery = query.toLowerCase();

  // Search in headers
  columns.forEach((column) => {
    const headerText = column.header || '';
    const lowerHeader = headerText.toLowerCase();
    let startIndex = 0;
    let index = lowerHeader.indexOf(lowerQuery, startIndex);

    while (index !== -1) {
      matches.push({
        rowIndex: -1, // -1 indicates header
        columnId: column.id || '',
        startOffset: index,
        endOffset: index + query.length,
        text: headerText.slice(index, index + query.length),
      });
      startIndex = index + query.length;
      index = lowerHeader.indexOf(lowerQuery, startIndex);
    }
  });

  // Search in cell data
  data.forEach((row, rowIndex) => {
    columns.forEach((column) => {
      const columnId = column.id;
      if (!columnId) return;

      const cellValue = row[columnId];
      const text = typeof cellValue === 'string' || typeof cellValue === 'number'
        ? String(cellValue)
        : '';

      if (!text) return;

      const lowerText = text.toLowerCase();
      let startIndex = 0;
      let index = lowerText.indexOf(lowerQuery, startIndex);

      while (index !== -1) {
        matches.push({
          rowIndex,
          columnId,
          startOffset: index,
          endOffset: index + query.length,
          text: text.slice(index, index + query.length),
        });
        startIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, startIndex);
      }
    });
  });

  return matches;
}

/**
 * Get the total count of matches in table data
 */
export function getTableMatchCount(
  data: TableRowData[],
  columns: TableColumn[],
  query: string
): number {
  return searchInTableData(data, columns, query).length;
}
