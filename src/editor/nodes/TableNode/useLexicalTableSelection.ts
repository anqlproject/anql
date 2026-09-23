import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createNodeSelection,
  $setSelection,
  NodeKey,
} from "lexical";
import { RefObject, useCallback, useEffect } from "react";

export function useLexicalTableSelection(
  nodeKey: NodeKey,
  containerRef: RefObject<HTMLElement | null>,
) {
  const [editor] = useLexicalComposerContext();

  const selectTableNode = useCallback(() => {
    editor.update(() => {
      const nodeSelection = $createNodeSelection();
      nodeSelection.add(nodeKey);
      $setSelection(nodeSelection);
    });
  }, [editor, nodeKey]);

  const handleContainerMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'input, textarea, button.table-date-btn, .table-resizer, .table-row-handle, .table-col-handle, .table-add-row-strip, .table-add-col-strip',
        )
      ) {
        return;
      }
      // Only select on double-click or intentional selection, not on every click
      if (event.detail === 2) {
        event.preventDefault();
        selectTableNode();
      }
    },
    [selectTableNode],
  );

  // force the focus, to not steal by the table node
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      // Don't auto-select on focus, only on intentional actions
      if (target.closest("input, textarea, button.table-date-btn, .table-add-row-strip, .table-add-col-strip")) {
        // Don't select automatically on focus
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    return () => container.removeEventListener("focusin", handleFocusIn);
  }, [containerRef, selectTableNode]);

  return { handleContainerMouseDown, selectTableNode };
}
