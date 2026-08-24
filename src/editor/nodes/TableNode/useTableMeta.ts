import { $getNodeByKey, $getRoot, LexicalEditor, NodeKey } from "lexical";

import { $isLinkNode } from "@/editor/nodes/LinkNode/LinkNode";

import { $isTableNode } from "./TableNode";
import { ensureRowId, focusCellInput } from "./tableUtils";

interface UseTableMetaOptions {
  editor: LexicalEditor;
  nodeKey: NodeKey;
  columnOrder: string[];
  closeMenus: () => void;
  columnCount: number;
  tableDataLength: number;
  rowRefs: React.RefObject<(HTMLElement | null)[]>;
}

// Helper function to check if any links point to a specific row
function checkRowLinks(editor: LexicalEditor, nodeKey: NodeKey, rowId: string): boolean {
  let hasLinks = false;
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const linkTargetId = `${nodeKey}:${rowId}`;

    // Recursively traverse all nodes to find LinkNodes
    const traverse = (node: any) => {
      if ($isLinkNode(node)) {
        if (node.getLinkType() === "row" && node.getTargetId() === linkTargetId) {
          hasLinks = true;
          return;
        }
      }

      // Check children if node has them
      if (node.getChildren) {
        const children = node.getChildren();
        for (const child of children) {
          if (hasLinks) return; // Early exit if link found
          traverse(child);
        }
      }
    };

    traverse(root);
  });

  return hasLinks;
}

export function useTableMeta({
  editor,
  nodeKey,
  columnOrder,
  closeMenus,
  columnCount,
  tableDataLength,
  rowRefs,
}: UseTableMetaOptions) {
  return {
    nodeKey,
    closeMenus,
    getColumnIndex: (columnId: string) => columnOrder.indexOf(columnId),

    updateData: (rowIndex: number, columnId: string, value: unknown) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const newData = [...node.__data];
          newData[rowIndex] = {
            ...newData[rowIndex],
            [columnId]: value as string | number | boolean | null | undefined,
          };
          // Ensure _rowId is preserved using centralized function
          newData[rowIndex] = ensureRowId(newData[rowIndex]);
          node.updateData(newData);
        }
      });
    },

    updateColumnType: (
      columnId: string,
      type: "text" | "checkbox" | "date" | "number",
    ) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          node.updateColumns(
            node.__columns.map((c) =>
              c.id === columnId
                ? { ...c, meta: { ...c.meta, type } }
                : c,
            ),
          );
        }
      });
    },

    updateColumnHeader: (columnId: string, headerName: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          node.updateColumns(
            node.__columns.map((c) =>
              c.id === columnId
                ? { ...c, header: headerName }
                : c,
            ),
          );
        }
      });
    },

    deleteColumn: (columnId: string) => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          node.updateColumns(
            node.__columns.filter((c) => c.id !== columnId),
          );
        }
      });
    },

    addColumn: () => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const newColId = `col_${Date.now()}`;
          node.updateColumns([
            ...node.__columns,
            { header: "", id: newColId, meta: { type: "text" } },
          ]);
        }
      });
    },

    addColumnLeft: (columnId: string) => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const idx = node.__columns.findIndex(
            (c) => c.id === columnId,
          );
          const newColId = `col_${Date.now()}`;
          node.updateColumns([
            ...node.__columns.slice(0, idx),
            { header: "", id: newColId, meta: { type: "text" } },
            ...node.__columns.slice(idx),
          ]);
        }
      });
    },

    addColumnRight: (columnId: string) => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const idx = node.__columns.findIndex(
            (c) => c.id === columnId,
          );
          const newColId = `col_${Date.now()}`;
          node.updateColumns([
            ...node.__columns.slice(0, idx + 1),
            { header: "", id: newColId, meta: { type: "text" } },
            ...node.__columns.slice(idx + 1),
          ]);
        }
      });
    },

    deleteRow: (rowIndex: number) => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const rowId = node.__data[rowIndex]?._rowId;

          // Check if any links point to this row before deletion
          if (rowId && checkRowLinks(editor, nodeKey, String(rowId))) {
            const confirmed = window.confirm(
              "Cette ligne a des liens qui pointent vers elle. La supprimer cassera ces liens. Voulez-vous continuer ?"
            );
            if (!confirmed) {
              return; // Cancel deletion
            }
          }

          const newData = [...node.__data];
          newData.splice(rowIndex, 1);
          node.updateData(newData);
        }
      });
    },

    addRow: () => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          node.updateData([...node.__data, ensureRowId({})]);
        }
      });
    },

    addRowAbove: (rowIndex: number) => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const newData = [...node.__data];
          newData.splice(rowIndex, 0, ensureRowId({}));
          node.updateData(newData);
        }
      });
    },

    addRowBelow: (rowIndex: number) => {
      closeMenus();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTableNode(node)) {
          const newData = [...node.__data];
          newData.splice(rowIndex + 1, 0, ensureRowId({}));
          node.updateData(newData);
        }
      });
    },

    goToNextCell: (rowIndex: number, columnIndex: number) => {
      let nextRow = rowIndex;
      let nextCol = columnIndex + 1;
      if (nextCol >= columnCount) {
        nextCol = 0;
        nextRow += 1;
      }
      if (nextRow >= tableDataLength) return;
      focusCellInput(rowRefs, nextRow, nextCol);
    },

    goToPreviousCell: (rowIndex: number, columnIndex: number) => {
      let prevRow = rowIndex;
      let prevCol = columnIndex - 1;
      if (prevCol < 0) {
        prevCol = columnCount - 1;
        prevRow -= 1;
      }
      if (prevRow < 0) return;
      focusCellInput(rowRefs, prevRow, prevCol);
    },

    goToCellBelow: (rowIndex: number, columnIndex: number) => {
      if (rowIndex + 1 >= tableDataLength) return;
      focusCellInput(rowRefs, rowIndex + 1, columnIndex);
    },

    goToCellAbove: (rowIndex: number, columnIndex: number) => {
      if (rowIndex - 1 < 0) return;
      focusCellInput(rowRefs, rowIndex - 1, columnIndex);
    },
  };
}
