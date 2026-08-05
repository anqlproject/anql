import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createNodeSelection,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  NodeKey,
} from "lexical";
import { RefObject, useCallback, useEffect, useState } from "react";

export function useLexicalTableSelection(
  nodeKey: NodeKey,
  containerRef: RefObject<HTMLElement | null>,
) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setIsSelected] = useState(false);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          setIsSelected(selection.has(nodeKey));
        } else {
          setIsSelected(false);
        }
      });
    });
  }, [editor, nodeKey]);

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
          'input, textarea, button.table-date-btn, .table-resizer, .table-row-handle, .table-col-handle',
        )
      ) {
        return;
      }
      event.preventDefault();
      selectTableNode();
    },
    [selectTableNode],
  );

  // force the focus, to not steal by the table node
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, button.table-date-btn")) {
        selectTableNode();
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    return () => container.removeEventListener("focusin", handleFocusIn);
  }, [containerRef, selectTableNode]);

  return { isSelected, handleContainerMouseDown, selectTableNode };
}
