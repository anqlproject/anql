import "react-day-picker/dist/style.css";
import "./TableComponent.css";

import {
  closestCenter,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BlockWithAlignableContents } from "@lexical/react/LexicalBlockWithAlignableContents";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  RowData,
  useReactTable,
} from "@tanstack/react-table";
import type { ElementFormatType } from "lexical";
import { $getNodeByKey, COMMAND_PRIORITY_LOW, NodeKey } from "lexical";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TableHighlight } from "@/App/AppComponents/TableHighlight/TableHighlight";

import { TABLE_ROW_NAVIGATE_COMMAND, TABLE_SEARCH_NAVIGATE_COMMAND } from "../../plugins/TablePlugin";
import EditableCell from "./TableCell/TableCell";
import DraggableHeader from "./TableCell/TableHeader";
import { DraggableRow } from "./TableCell/TableRow";
import { CellMenu } from "./TableMenu/CellMenu";
import { $isTableNode } from "./TableNode";
import { TableColumn, TableRowData } from "./TableNode";
import {
  isColDndId,
  isRowDndId,
  parseColDndId,
  parseRowDndId,
  toColDndId,
  toRowDndId,
} from "./tableUtils";
import { useLexicalTableSelection } from "./useLexicalTableSelection";
import { useTableMeta } from "./useTableMeta";

type TableRowWithId = TableRowData & { _rowId: string };

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    type?: "text" | "checkbox" | "date" | "number";
  }

  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    updateColumnType: (
      columnId: string,
      type: "text" | "checkbox" | "date" | "number",
    ) => void;
    updateColumnHeader: (columnId: string, headerName: string) => void;
    deleteColumn: (columnId: string) => void;
    addColumn: () => void;
    addColumnLeft: (columnId: string) => void;
    addColumnRight: (columnId: string) => void;
    deleteRow: (rowIndex: number) => void;
    addRow: () => void;
    addRowAbove: (rowIndex: number) => void;
    addRowBelow: (rowIndex: number) => void;
    goToNextCell: (rowIndex: number, columnIndex: number) => void;
    goToPreviousCell: (rowIndex: number, columnIndex: number) => void;
    goToCellBelow: (rowIndex: number, columnIndex: number) => void;
    goToCellAbove: (rowIndex: number, columnIndex: number) => void;
    getColumnIndex: (columnId: string) => number;
  }
}

interface TableComponentProps {
  nodeKey: NodeKey;
  data: (TableRowData & { _rowId?: string })[];
  columns: (TableColumn & { size?: number; meta?: { type?: string } })[];
  format: ElementFormatType | null;
  className: Readonly<{ base: string; focus: string }>;
}

export function TableComponent({
  nodeKey,
  data: initialData,
  columns: initialColumns,
  format,
  className,
}: TableComponentProps) {
  const [editor] = useLexicalComposerContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { isSelected, handleContainerMouseDown } = useLexicalTableSelection(
    nodeKey,
    containerRef,
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    initialColumns
      .map((c) => c.accessorKey || c.id)
      .filter((id): id is string => Boolean(id)),
  );

  const [prevInitialColumns, setPrevInitialColumns] = useState(initialColumns);
  if (initialColumns !== prevInitialColumns) {
    setPrevInitialColumns(initialColumns);
    setColumnOrder(
      initialColumns
        .map((c) => c.accessorKey || c.id)
        .filter((id): id is string => Boolean(id))
    );
  }

  const [tableData, setTableData] = useState<TableRowWithId[]>(() =>
    initialData.map((row) => ({
      ...row,
      _rowId: row._rowId || `row-${crypto.randomUUID()}`,
    })),
  );

  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
  const [openRowMenuIndex, setOpenRowMenuIndex] = useState<number | null>(null);
  const [openColMenuIndex, setOpenColMenuIndex] = useState<number | null>(null);

  const [highlightState, setHighlightState] = useState<{
    type: "row" | "column" | null;
    index: number;
    isOpen: boolean;
  }>({ type: null, index: -1, isOpen: false });

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    activeInput: HTMLInputElement | HTMLTextAreaElement | null;
    nodeKey?: string;
    rowId?: string;
    columnId?: string;
  }>({ isOpen: false, position: { x: 0, y: 0 }, activeInput: null });

  // Truncate refs to remove dead DOM nodes when rows/columns are deleted
  rowRefs.current = rowRefs.current.slice(0, tableData.length);
  columnRefs.current = columnRefs.current.slice(0, initialColumns.length);

  // NOTE : handle column hover logic to display drag handle
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let currentHoveredColIndex: string | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest(".table-cell") as HTMLElement | null;

      const colIndex = cell?.getAttribute("data-column-index");

      if (colIndex !== currentHoveredColIndex) {
        if (currentHoveredColIndex !== null) {
          const oldHeader = grid.querySelector(`.table-cell--header[data-column-index="${currentHoveredColIndex}"]`);
          oldHeader?.classList.remove("table-cell--hovered-col");
        }

        if (colIndex != null) {
          const newHeader = grid.querySelector(`.table-cell--header[data-column-index="${colIndex}"]`);
          newHeader?.classList.add("table-cell--hovered-col");
        }

        currentHoveredColIndex = colIndex || null;
      }
    };

    const handleMouseLeave = () => {
      if (currentHoveredColIndex !== null) {
        const oldHeader = grid.querySelector(`.table-cell--header[data-column-index="${currentHoveredColIndex}"]`);
        oldHeader?.classList.remove("table-cell--hovered-col");
        currentHoveredColIndex = null;
      }
    };

    grid.addEventListener("mouseover", handleMouseOver);
    grid.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      grid.removeEventListener("mouseover", handleMouseOver);
      grid.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // NOTE : update row id if not exist (for example when we paste data)
  useEffect(() => {
    setTableData(
      initialData.map((row) => ({
        ...row,
        _rowId: row._rowId || `row-${crypto.randomUUID()}`,
      })) as TableRowWithId[]
    );
  }, [initialData]);

  // NOTE : desactive scrolling when menu is open
  useEffect(() => {
    if (!highlightState.isOpen) return;
    const preventScroll = (e: Event) => e.preventDefault();
    const preventKeyScroll = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("keydown", preventKeyScroll);
    return () => {
      document.removeEventListener("wheel", preventScroll);
      document.removeEventListener("touchmove", preventScroll);
      document.removeEventListener("keydown", preventKeyScroll);
    };
  }, [highlightState.isOpen]);

  // NOTE : handle table search navigation
  useEffect(() => {
    return editor.registerCommand(
      TABLE_SEARCH_NAVIGATE_COMMAND,
      ({ nodeKey: targetKey, rowIndex, columnId }) => {
        if (targetKey !== nodeKey) return false;

        const columnIndex = initialColumns.findIndex(
          (c) => (c.accessorKey || c.id) === columnId
        );

        if (rowIndex >= -1 && columnIndex >= 0) {
          if (rowIndex === -1) {
            const columnElement = columnRefs.current[columnIndex];
            if (columnElement) {
              columnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            const rowElement = rowRefs.current[rowIndex];
            const columnElement = columnRefs.current[columnIndex];

            if (rowElement && columnElement) {
              const cellSelector = `.table-cell--data`;
              const cells = rowElement.querySelectorAll(cellSelector);
              const targetCell = cells[columnIndex];

              if (targetCell) {
                targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        }
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, nodeKey, initialColumns, rowRefs, columnRefs]);

  // NOTE : handle table row navigate
  useEffect(() => {
    return editor.registerCommand(
      TABLE_ROW_NAVIGATE_COMMAND,
      ({ nodeKey: targetKey, rowId }) => {
        if (targetKey !== nodeKey) return false;
        const rowIndex = tableDataRef.current.findIndex((r) => r._rowId === rowId);

        if (rowIndex >= 0) {
          setHighlightState({
            type: "row",
            index: rowIndex,
            isOpen: true,
          });
        }
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, nodeKey]);

  // NOTE : close highlight when clicking anywhere except on drag handles
  useEffect(() => {
    if (!highlightState.isOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on drag handles (they open menus)
      if (target.closest('.table-row-handle, .table-col-handle')) {
        return;
      }
      setHighlightState({ type: null, index: -1, isOpen: false });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [highlightState.isOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const memoizedColumns = useMemo<ColumnDef<TableRowWithId>[]>(
    () =>
      initialColumns.map((col) => ({
        ...col,
        cell: EditableCell,
        size: col.size || 180,
        meta: col.meta
          ? {
            type: col.meta.type as
              | "text"
              | "checkbox"
              | "date"
              | "number",
          }
          : undefined,
      })),
    [initialColumns],
  );

  const columnCount = initialColumns.length;

  const tableDataRef = useRef(tableData);
  tableDataRef.current = tableData;

  const columnOrderRef = useRef(columnOrder);
  columnOrderRef.current = columnOrder;

  const isDraggingRef = useRef(false);

  const closeMenus = useCallback(() => {
    setOpenRowMenuIndex(null);
    setOpenColMenuIndex(null);
  }, []);

  const tableMeta = useTableMeta({
    editor,
    nodeKey,
    columnOrder,
    closeMenus,
    columnCount,
    tableDataLength: tableData.length,
    rowRefs,
  });

  const table = useReactTable({
    data: tableData,
    columns: memoizedColumns,
    state: { columnOrder },
    enableColumnResizing: true,
    getRowId: (row) => row._rowId,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    meta: tableMeta,
  });

  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn;
  const columnSizing = table.getState().columnSizing;
  const wasResizingRef = useRef(false);

  // NOTE : update size of the columns, when resizing is finished
  useEffect(() => {
    if (isResizingColumn) {
      wasResizingRef.current = true;
    } else if (wasResizingRef.current) {
      wasResizingRef.current = false;
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          let changed = false;
          const newColumns = node.__columns.map((c) => {
            const colId = c.accessorKey || c.id;
            if (!colId) return c;
            const newSize = columnSizing[colId];
            if (newSize && newSize !== c.size) {
              changed = true;
              return { ...c, size: newSize };
            }
            return c;
          });
          if (changed) node.updateColumns(newColumns);
        }
      });
    }
  }, [isResizingColumn, columnSizing, editor, nodeKey]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    isDraggingRef.current = true;
    setIsDragging(true);
    closeMenus();

    if (isColDndId(id)) {
      setActiveColumnId(parseColDndId(id));
      setActiveRowId(null);
    } else if (isRowDndId(id)) {
      setActiveRowId(parseRowDndId(id));
      setActiveColumnId(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (isColDndId(activeId) && isColDndId(overId) && activeId !== overId) {
      setColumnOrder((order) => {
        const oldIndex = order.indexOf(parseColDndId(activeId));
        const newIndex = order.indexOf(parseColDndId(overId));
        return arrayMove(order, oldIndex, newIndex);
      });
      return;
    }

    if (isRowDndId(activeId) && isRowDndId(overId) && activeId !== overId) {
      const overRowId = parseRowDndId(overId);
      const overIndex = tableData.findIndex((r) => r._rowId === overRowId);
      setDragOverRowIndex(overIndex >= 0 ? overIndex : null);

      setTableData((rows) => {
        const oldIndex = rows.findIndex(
          (r) => r._rowId === parseRowDndId(activeId),
        );
        const newIndex = rows.findIndex((r) => r._rowId === overRowId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return rows;
        }
        return arrayMove(rows, oldIndex, newIndex);
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const wasCol = isColDndId(activeId);

    setActiveRowId(null);
    setActiveColumnId(null);
    setDragOverRowIndex(null);

    if (wasCol) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const newColumns = columnOrderRef.current
            .map((id) =>
              initialColumns.find((c) => (c.accessorKey || c.id) === id),
            )
            .filter((c): c is TableColumn => c !== undefined);
          node.updateColumns(newColumns);
        }
      });
    } else if (isRowDndId(activeId)) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          // Preserve _rowId when updating node data after row drag
          node.updateData(
            tableDataRef.current.map(({ _rowId, ...rest }) => ({ ...rest, _rowId })),
          );
        }
      });
    }

    requestAnimationFrame(() => {
      isDraggingRef.current = false;
      setIsDragging(false);
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const cell = target.closest(".table-cell");
    if (!cell) return;

    e.preventDefault();
    const input =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA"
        ? (target as HTMLInputElement | HTMLTextAreaElement)
        : (cell.querySelector("input, textarea") as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null);

    // Find the row element and get its rowId (only for data rows, not header)
    const rowElement = cell.closest(".table-row");
    let rowId: string | undefined;
    let nodeKeyToUse: string | undefined;
    let columnId: string | undefined;

    if (rowElement) {
      const rowIndex = rowRefs.current.indexOf(rowElement as HTMLDivElement);
      // Only provide row link for data rows (header has no _rowId)
      if (rowIndex >= 0 && tableData[rowIndex]?._rowId) {
        rowId = tableData[rowIndex]._rowId;
        nodeKeyToUse = nodeKey;
      }
    }

    // Get column ID from cell's data-column-index
    const colIndex = cell.getAttribute("data-column-index");
    if (colIndex !== null) {
      const columnIndex = parseInt(colIndex, 10);
      const column = table.getAllColumns()[columnIndex];
      if (column) {
        columnId = column.id;
      }
    }

    setContextMenuState({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      activeInput: input,
      nodeKey: nodeKeyToUse,
      rowId,
      columnId,
    });
  };

  const activeColumn = activeColumnId
    ? table.getColumn(activeColumnId)
    : null;
  const activeRow = activeRowId
    ? table.getRowModel().rows.find((r) => r.original._rowId === activeRowId)
    : null;

  const totalWidth = table.getCenterTotalSize() + 48;

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    const filtered = isColDndId(activeId)
      ? args.droppableContainers.filter((c) => isColDndId(String(c.id)))
      : isRowDndId(activeId)
        ? args.droppableContainers.filter((c) => isRowDndId(String(c.id)))
        : args.droppableContainers;
    return closestCenter({ ...args, droppableContainers: filtered });
  }, []);

  const modifiers: Modifier[] = activeColumnId
    ? [restrictToHorizontalAxis, restrictToParentElement]
    : [restrictToVerticalAxis, restrictToParentElement];

  return (
    <BlockWithAlignableContents
      className={className}
      format={format}
      nodeKey={nodeKey}
    >
      <div
        ref={containerRef}
        className={`table-container ${isSelected ? "table-container--selected" : ""}`}
        contentEditable={false}
        onMouseDown={handleContainerMouseDown}
        onContextMenu={handleContextMenu}
        data-node-key={nodeKey}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          modifiers={modifiers}
        >
          <div
            ref={gridRef}
            className="table-grid"
            style={{ minWidth: totalWidth }}
          >
            <div className="table-row table-row--header">
              <div className="table-gutter" aria-hidden="true" />
              <SortableContext
                items={columnOrder.map(toColDndId)}
                strategy={horizontalListSortingStrategy}
              >
                {table.getHeaderGroups()[0]?.headers.map((header, index) => (
                  <DraggableHeader
                    key={header.id}
                    header={header}
                    table={table}
                    columnIndex={index}
                    menuOpen={openColMenuIndex === index}
                    onMenuOpenChange={(open) => {
                      setOpenColMenuIndex(open ? index : null);
                      setOpenRowMenuIndex(null);
                      setHighlightState({
                        type: "column",
                        index,
                        isOpen: open,
                      });
                    }}
                    columnRef={(el) => {
                      columnRefs.current[index] = el;
                    }}
                  />
                ))}
              </SortableContext>
            </div>

            <SortableContext
              items={tableData.map((r) => toRowDndId(r._rowId))}
              strategy={verticalListSortingStrategy}
            >
              {table.getRowModel().rows.map((row, index) => (
                <DraggableRow
                  key={row.id}
                  row={row}
                  table={table}
                  rowIndex={index}
                  menuOpen={openRowMenuIndex === index}
                  onMenuOpenChange={(open) => {
                    setOpenRowMenuIndex(open ? index : null);
                    setOpenColMenuIndex(null);
                    setHighlightState({
                      type: "row",
                      index,
                      isOpen: open,
                    });
                  }}
                  rowRef={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  isDropTarget={dragOverRowIndex === index}
                  suppressMenuClick={isDragging}
                />
              ))}
            </SortableContext>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeColumn && (
              <div
                className="table-drag-preview table-drag-preview--column"
                style={{ width: activeColumn.getSize() }}
              >
                <div className="table-cell table-cell--header">
                  <span className="table-header-label">
                    {(activeColumn.columnDef.header as string) || ""}
                  </span>
                </div>
                {table.getRowModel().rows.map((row) => {
                  const cell = row
                    .getVisibleCells()
                    .find((c) => c.column.id === activeColumnId);
                  return (
                    <div
                      key={row.id}
                      className="table-cell table-cell--data"
                    >
                      {cell
                        ? flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )
                        : null}
                    </div>
                  );
                })}
              </div>
            )}
            {activeRow && (
              <div className="table-drag-preview table-drag-preview--row">
                <div className="table-gutter">
                  <span className="table-row-handle table-row-handle--overlay">
                    <svg viewBox="0 0 10 10" className="table-handle-dots">
                      <circle cx="2" cy="2" r="1" fill="currentColor" />
                      <circle cx="2" cy="5" r="1" fill="currentColor" />
                      <circle cx="2" cy="8" r="1" fill="currentColor" />
                      <circle cx="6" cy="2" r="1" fill="currentColor" />
                      <circle cx="6" cy="5" r="1" fill="currentColor" />
                      <circle cx="6" cy="8" r="1" fill="currentColor" />
                    </svg>
                  </span>
                </div>
                {activeRow.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="table-cell table-cell--data"
                    style={{
                      width: cell.column.getSize(),
                      flex: `0 0 ${cell.column.getSize()}px`,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <TableHighlight
          scrollContainerRef={containerRef}
          isOpen={highlightState.isOpen}
          highlightType={highlightState.type}
          targetIndex={highlightState.index}
          rowRefs={rowRefs}
          columnRefs={columnRefs}
        />

        <CellMenu
          isOpen={contextMenuState.isOpen}
          onClose={() =>
            setContextMenuState((prev) => ({ ...prev, isOpen: false, activeInput: null }))
          }
          position={contextMenuState.position}
          activeInput={contextMenuState.activeInput}
        />
      </div>
    </BlockWithAlignableContents>
  );
}
