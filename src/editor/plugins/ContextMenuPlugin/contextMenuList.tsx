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
import { Code, File, Link2, SquareSigma, Timer } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useGlobalStore } from "@/App/store/useGlobalStore";
import { ICON_SIZES } from "@/core/global/defaultValues";
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

  const { isMac } = useGlobalStore(
    useShallow((state) => ({ isMac: state.isMac })),
  );
  const isEditable = editor.isEditable();
  const ICON_SIZE = ICON_SIZES.default;

  const allContextMenuItems = [
    {
      title: t("CONTEXT_MENU.copy") as string,
      shortcut: isMac ? "⌘C" : "Ctrl+C",
      onClick: handleCopy(editor),
    },
    {
      title: t("CONTEXT_MENU.cut") as string,
      shortcut: isMac ? "⌘X" : "Ctrl+X",
      onClick: handleCut(editor),
    },
    {
      title: t("CONTEXT_MENU.paste") as string,
      shortcut: isMac ? "⌘V" : "Ctrl+V",
      onClick: handlePaste(editor),
    },
    ...(!isInsideCodeNode && !isInsideMathNode
      ? [
          {
            title: t("CONTEXT_MENU.insert") as string,
            hasSubmenu: true,
            submenu: [
              {
                icon: <Timer size={ICON_SIZE} />,
                title: t("INLINES.date") as string,
                onClick: () => {
                  editor.dispatchCommand(INSERT_DATETIME_COMMAND, {
                    dateTime: new Date(),
                  });
                  setIsMenuOpen(false);
                },
              },
              {
                icon: <SquareSigma size={ICON_SIZE} />,
                title: t("INLINES.equation") as string,
                onClick: () => {
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
                icon: <Link2 size={ICON_SIZE} />,
                title: "Link",
                onClick: () => {
                  setCustomLinkDialog({});
                  setIsMenuOpen(false);
                },
              },
              {
                icon: <Code size={ICON_SIZE} />,
                title: t("INLINES.inlineCode") as string,
                onClick: () => {
                  editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
                  setIsMenuOpen(false);
                },
              },
              {
                icon: <File size={ICON_SIZE} />,
                title: "PDF",
                onClick: () => {
                  setPdfDialog(true);
                  setIsMenuOpen(false);
                },
              },
            ],
          },
        ]
      : []),
    {
      isSeparator: true,
    },
    {
      title: t("CONTEXT_MENU.undo") as string,
      shortcut: isMac ? "⌘Z" : "Ctrl+Z",
      onClick: () => {
        editor.dispatchCommand(UNDO_COMMAND, undefined);
        setIsMenuOpen(false);
      },
      disabled: !canUndo,
    },
    {
      title: t("CONTEXT_MENU.redo") as string,
      shortcut: isMac ? "⌘⇧Z" : "Ctrl+Shift+Z",
      onClick: () => {
        editor.dispatchCommand(REDO_COMMAND, undefined);
        setIsMenuOpen(false);
      },
      disabled: !canRedo,
    },
  ];

  if (!isEditable) {
    return allContextMenuItems.filter(
      (item) => item.title === (t("CONTEXT_MENU.copy") as string),
    );
  }

  return allContextMenuItems;
}
