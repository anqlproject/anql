import { $isCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { $isMathExpNode } from "@/editor/nodes/MathNode/MathExpNode";
import { INSERT_DATETIME_COMMAND } from "@/editor/plugins/DateTimePlugin";
import { InsertEquationDialog } from "@/editor/plugins/EquationsPlugin";

import { handleCopy, handleCut, handlePaste } from "./contextMenuActions";

export function ContextMenuItems(
  setIsMenuOpen: (isMenuOpen: boolean) => void,
  showModal: (
    title: string,
    getContent: (onClose: () => void) => JSX.Element,
  ) => void,
  setCustomLinkDialog: (dialog: Record<string, any> | null) => void,
  setPdfDialog: (dialog: boolean | null) => void,
) {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Check if there's a selection
  let isInsideCodeNode = false;
  let isInsideMathNode = false;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (selection && $isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      isInsideCodeNode =
        $isCodeNode(anchorNode) || anchorNode.getParents().some($isCodeNode);
      isInsideMathNode =
        $isMathExpNode(anchorNode) ||
        anchorNode.getParents().some($isMathExpNode);
    }
  });

  // Register undo/redo state listeners
  useEffect(() => {
    const unregisterUndo = editor.registerCommand<boolean>(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const unregisterRedo = editor.registerCommand<boolean>(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    return () => {
      unregisterUndo();
      unregisterRedo();
    };
  }, [editor]);

  const isEditable = editor.isEditable();

  const allContextMenuItems: any[] = [
    {
      text: t("CONTEXT_MENU.copy") as string,
      accelerator: "CmdOrControl+C",
      action: () => {
        handleCopy(editor)();
        setIsMenuOpen(false);
      },
    },
    {
      text: t("CONTEXT_MENU.cut") as string,
      accelerator: "CmdOrControl+X",
      action: () => {
        handleCut(editor)();
        setIsMenuOpen(false);
      },
    },
    {
      text: t("CONTEXT_MENU.paste") as string,
      accelerator: "CmdOrControl+V",
      action: () => {
        handlePaste(editor)();
        setIsMenuOpen(false);
      },
    },
    ...(!isInsideCodeNode && !isInsideMathNode
      ? [
              {
                item: "Separator",
              },
              {
                text: t("CONTEXT_MENU.insertDateTime") as string,
                action: () => {
                  editor.dispatchCommand(INSERT_DATETIME_COMMAND, {
                    dateTime: new Date(),
                  });
                  setIsMenuOpen(false);
                },
              },
              {
                text: t("CONTEXT_MENU.insertEquation") as string,
                action: () => {
                  setIsMenuOpen(false);
                  showModal("Insert Equation", (onClose) => (
                    <InsertEquationDialog
                      activeEditor={editor}
                      onClose={onClose}
                    />
                  ));
                },
              },
              {
                text: t("CONTEXT_MENU.insertLink") as string,
                action: () => {
                  setCustomLinkDialog({});
                  setIsMenuOpen(false);
                },
              },
              {
                text: t("CONTEXT_MENU.applyInlineCode") as string,
                action: () => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
                  setIsMenuOpen(false);
                },
              },
              {
                item: "Separator",
              },
              {
                text: t("CONTEXT_MENU.insertPdfDocument") as string,
                action: () => {
                  setPdfDialog(true);
                  setIsMenuOpen(false);
                },
              },
        ]
      : []),
    {
      item: 'Separator',
    },
    {
      text: t("CONTEXT_MENU.undo") as string,
      accelerator: "CmdOrControl+Z",
      action: () => {
        editor.dispatchCommand(UNDO_COMMAND, undefined);
        setIsMenuOpen(false);
      },
      enabled: canUndo,
    },
    {
      text: t("CONTEXT_MENU.redo") as string,
      accelerator: "CmdOrControl+Shift+Z",
      action: () => {
        editor.dispatchCommand(REDO_COMMAND, undefined);
        setIsMenuOpen(false);
      },
      enabled: canRedo,
    },
  ];

  if (!isEditable) {
    return allContextMenuItems.filter(
      (item) => item.text === (t("CONTEXT_MENU.copy") as string),
    );
  }

  return allContextMenuItems;
}
