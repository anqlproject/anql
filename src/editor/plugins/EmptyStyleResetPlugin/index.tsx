import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $getSelection, $isRangeSelection, $isTextNode } from "lexical";
import type { JSX } from "react";
import { useEffect } from "react";

// NOTE: when we delete totally text with format lexical don't remove the the format in selection
export default function EmptyStyleResetPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Listen to each editor update
    return editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      const currentNodeMap = editorState._nodeMap;

      // Find nodes that existed before but no longer exist
      const deletedNodes: string[] = [];
      prevEditorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const key = selection.anchor.getNode().getKey();
          if (!currentNodeMap.has(key)) {
            deletedNodes.push(key);
          }
        }
      });

      let formatIsDeleted = false;
      if (deletedNodes.length > 0) {
        // Check if any of the deleted nodes had format
        prevEditorState.read(() => {
          deletedNodes.forEach((nodeKey) => {
            const prevNode = $getNodeByKey(nodeKey);
            if (prevNode && $isTextNode(prevNode)) {
              // Check if it was a TextNode with format
              const format = prevNode.__format;
              if (format && format !== 0) {
                formatIsDeleted = true;
                //console.log('🎨 Node stylisé supprimé - key:', nodeKey, 'format:', format);
              }
            }
          });
        });
      }

      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.format !== 0) {
          if (deletedNodes.length > 0 && formatIsDeleted) {
            selection.setFormat(0);
          }
        }
      });
    });
  }, [editor]);

  return null;
}