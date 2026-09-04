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
  getCoreRowModel,
  RowData,
  useReactTable,
} from "@tanstack/react-table";
import type { ElementFormatType } from "lexical";
import { $getNodeByKey, COMMAND_PRIORITY_LOW, NodeKey } from "lexical";
import { Move } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TableHighlight } from "@/App/AppComponents/TableHighlight/TableHighlight";

import { TABLE_ROW_NAVIGATE_COMMAND, TABLE_SEARCH_NAVIGATE_COMMAND } from "../../plugins/TablePlugin";
import EditableCell from "./TableCell/TableCell";
import DraggableHeader from "./TableCell/TableHeader";
import { DraggableRow } from "./TableCell/TableRow";
import { CellMenu } from "./TableMenu/CellMenu";
import { $isTableNode } from "./TableNode";
import { ColumnDataType, TableColumn, TableRowData } from "./TableNode";
import { TableTitle } from "./TableTitle";
import {
  ensureRowIds,
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
    type?: ColumnDataType;
  }

  interface TableMeta<TData extends RowData> {
    updateData: (rowId: string, columnId: string, value: unknown) => void;
    updateColumnType: (
      columnId: string,
      type: ColumnDataType,
    ) => void;
    updateColumnHeader: (columnId: string, headerName: string) => void;
    deleteColumn: (columnId: string) => void;
    addColumn: () => void;
    addColumnLeft: (columnId: string) => void;
    addColumnRight: (columnId: string) => void;
    deleteRow: (rowId: string) => void;
    addRow: () => void;
    addRowAbove: (rowId: string) => void;
    addRowBelow: (rowId: string) => void;
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
  columns: (TableColumn & { size?: number; meta?: { type?: ColumnDataType } })[];
  tableName: string;
  format: ElementFormatType | null;
  className: Readonly<{ base: string; focus: string }>;
}

export function TableComponent({
  nodeKey,
  data: initialData,
  columns: initialColumns,
  tableName,
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

  // Table name is managed by the isolated TableTitle component (see TableTitle.tsx).

  const columnOrder = useMemo(() =>
    initialColumns
      .map((c) => c.id)
      .filter((id): id is string => Boolean(id)),
    [initialColumns]
  );

  const tableData = useMemo(() => ensureRowIds(initialData) as TableRowWithId[], [initialData]);

  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);
  const [dragOverColIndex, setDragOverColIndex] = useState<number | null>(null);
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
          (c) => c.id === columnId
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
        accessorKey: col.id,
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
            const colId = c.id;
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
    if (!over) {
      setDragOverColIndex(null);
      setDragOverRowIndex(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (isColDndId(activeId) && isColDndId(overId) && activeId !== overId) {
      const overColId = parseColDndId(overId);
      const overIndex = columnOrder.indexOf(overColId);
      setDragOverColIndex(overIndex >= 0 ? overIndex : null);
      return;
    }

    if (isRowDndId(activeId) && isRowDndId(overId) && activeId !== overId) {
      const overRowId = parseRowDndId(overId);
      const overIndex = tableData.findIndex((r) => r._rowId === overRowId);
      setDragOverRowIndex(overIndex >= 0 ? overIndex : null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const wasCol = isColDndId(activeId);

    setActiveRowId(null);
    setActiveColumnId(null);
    setDragOverRowIndex(null);
    setDragOverColIndex(null);

    const overId = event.over ? String(event.over.id) : null;

    if (wasCol) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          let finalOrder = columnOrderRef.current;

          if (overId && isColDndId(overId) && activeId !== overId) {
            const oldIndex = finalOrder.indexOf(parseColDndId(activeId));
            const newIndex = finalOrder.indexOf(parseColDndId(overId));
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              finalOrder = arrayMove(finalOrder, oldIndex, newIndex);
            }
          }

          const newColumns = finalOrder
            .map((id) => initialColumns.find((c) => c.id === id))
            .filter((c): c is TableColumn => c !== undefined);
          node.updateColumns(newColumns);
        }
      });
    } else if (isRowDndId(activeId)) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          let finalData = node.__data;

          if (overId && isRowDndId(overId) && activeId !== overId) {
            const oldIndex = finalData.findIndex(r => r._rowId === parseRowDndId(activeId));
            const newIndex = finalData.findIndex(r => r._rowId === parseRowDndId(overId));
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              finalData = arrayMove(finalData, oldIndex, newIndex);
            }
          }

          // Preserve _rowId when updating node data after row drag
          node.updateData(
            finalData.map(({ _rowId, ...rest }) => ({ ...rest, _rowId })),
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
        <TableTitle nodeKey={nodeKey} editor={editor} tableName={tableName} />
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
                    isDropTarget={dragOverColIndex === index}
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
                  draggingColumnId={activeColumnId}
                />
              ))}
            </SortableContext>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeColumn && (
              <div style={{ width: activeColumn.getSize(), display: "flex", justifyContent: "center" }}>
                <Move size={16} color="var(--primary-color)" strokeWidth={2.5} />
              </div>
            )}
            {activeRow && (
              <Move size={16} color="var(--primary-color)" strokeWidth={2.5} />
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
