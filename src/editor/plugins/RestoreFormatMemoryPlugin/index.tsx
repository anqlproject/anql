import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type { JSX } from "react";
import { useEffect } from "react";

export default function RestoreFormatMemoryPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Listen only to selection changes (ex: clicks, arrow keys)
    // This avoids overwriting voluntary formatting changes by the user (via toolbar)
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const currentNode = selection.anchor.getNode();
        if (!$isTextNode(currentNode)) {
          return false;
        }
        const currentText = currentNode.getTextContent();

        // If the cursor is in formatted text, and the selection memory was lost (format === 0)
        // We force the selection to inherit the text format for continuity.
        if (currentText.length > 0 && selection.format === 0 && currentNode.getFormat() !== 0) {
          selection.setFormat(currentNode.getFormat());
        }

        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return null;
}
