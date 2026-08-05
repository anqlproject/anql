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
    // Écouter uniquement les changements de sélection (ex: clics, touches directionnelles)
    // Cela évite d'écraser les changements de formatage volontaires de l'utilisateur (via la toolbar)
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

        // Si le curseur est dans un texte formatté, et que la mémoire de sélection a été perdue (format === 0)
        // On force la sélection à hériter du format du texte pour que la continuité marche.
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
