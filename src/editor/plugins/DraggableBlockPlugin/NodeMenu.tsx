import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import type { Menu as TauriMenu } from "@tauri-apps/api/menu";
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $parseSerializedNode,
  BaseSelection,
  ElementNode,
  LexicalEditor,
  LexicalNode,
} from "lexical";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useGlobalToast } from "@/App/hooks/useGlobalToast";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { MenuPosition } from "@/components/custom/Menu/MenuX";
import { TOAST_DURATION } from "@/core/global/defaultValues";
import { $isImageNode } from "@/editor/nodes/ImageNode/ImageNode";
import { $createListNode, $isListNode } from "@/editor/nodes/ListNode";
import { $isPdfNode } from "@/editor/nodes/PdfNode/PdfNode";
import { safeWriteText } from "@/editor/plugins/ContextMenuPlugin/contextMenuActions";
import { EDITOR_SHORTCUTS } from "@/GlobalState/shortcutStore";

type NativeMenuItem = {
  text?: string;
  accelerator?: string;
  item?: "Separator";
  action?: () => void | Promise<void>;
  items?: NativeMenuItem[];
};

export default function NodeMenu({
  isMenuOpen,
  setIsMenuOpen,
  editor,
  draggableElement,
  trigger,
  menuPosition,
}: {
  isMenuOpen: boolean;
  setIsMenuOpen: Dispatch<SetStateAction<boolean>>;
  editor: LexicalEditor;
  menuPosition?: MenuPosition;
  draggableElement: HTMLElement | null;
  trigger?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { dynamicState } = useGlobalStore(
    useShallow((state) => ({
      dynamicState: state.dynamicState,
    })),
  );
  const { showToast } = useGlobalToast();
  const nodeRef = useRef<LexicalNode>(null);
  const [canTransform, setCanTransform] = useState(false);
  const [isCodeNode, setIsCodeNode] = useState(false);
  const [isMenuReady, setIsMenuReady] = useState(false);
  const isNativeMenuOpening = useRef(false);

  const formatAccelerator = (modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }, key: string): string => {
    const parts: string[] = [];
    if (modifiers.ctrlKey) parts.push("Ctrl");
    if (modifiers.metaKey) parts.push("CmdOrControl");
    if (modifiers.altKey) parts.push("Alt");
    if (modifiers.shiftKey) parts.push("Shift");

    let keyName = key.replace('Key', '').replace('Digit', '');
    if (key === "Comma") keyName = ",";
    if (key === "Period") keyName = ".";
    if (key === "BracketRight") keyName = "]";
    if (key === "BracketLeft") keyName = "[";
    if (key === "Backslash") keyName = "\\";
    if (key === "ArrowUp") keyName = "Up";
    if (key === "ArrowDown") keyName = "Down";

    parts.push(keyName);
    return parts.join("+");
  };

  const getSelectedTopLevelNodes = () => {
    if (!nodeRef.current) return [];
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const nodes = selection.getNodes();
      if (
        nodes.some((n) => n.getKey() === nodeRef.current?.getKey()) &&
        nodes.length > 1
      ) {
        const topLevelNodes = new Set<LexicalNode>();
        nodes.forEach((n) => {
          let topLevel = n;
          while (
            topLevel.getParent() &&
            topLevel.getParent()?.getKey() !== "root"
          ) {
            topLevel = topLevel.getParent() as LexicalNode;
          }
          topLevelNodes.add(topLevel);
        });
        return Array.from(topLevelNodes);
      }
    }
    return [nodeRef.current];
  };

  useEffect(() => {
    setIsMenuReady(false);
    if (isMenuOpen && draggableElement) {
      editor.read(() => {
        const node = $getNearestNodeFromDOMNode(draggableElement);
        if (node) {
          nodeRef.current = node;

          const topLevelNodes = getSelectedTopLevelNodes();
          const allowedTypes = [
            "paragraph",
            "heading",
            "quote",
            "code",
            "list",
            "listitem",
          ];
          const allAllowed = topLevelNodes.every((n) =>
            allowedTypes.includes(n.getType()),
          );
          setCanTransform(allAllowed);
          setIsCodeNode(topLevelNodes.some((n) => n.getType() === "code"));
          setIsMenuReady(true);
        } else {
          console.error("node not found");
          setCanTransform(false);
          setIsCodeNode(false);
          setIsMenuReady(false);
        }
      });
      editor.blur();
    }
  }, [isMenuOpen, draggableElement, editor]);

  const applyToNodes = (
    action: (node: LexicalNode, selection: BaseSelection) => void,
  ) => {
    editor.update(() => {
      const topLevelNodes = getSelectedTopLevelNodes();
      if (topLevelNodes.length === 0) return;

      topLevelNodes.forEach((node) => {
        // Only select the node if it is still attached to the DOM
        if (node.isAttached()) {
          node.selectEnd();
          const selection = $getSelection();
          if (selection) {
            action(node, selection);
          }
        }
      });
      setIsMenuOpen(false);
    });
  };

  const findAssetIdsInNode = (node: LexicalNode): string[] => {
    const ids: string[] = [];
    if ($isImageNode(node)) {
      const src = node.getSrc();
      if (src.startsWith("asset://")) {
        ids.push(src.substring(8));
      }
    } else if ($isPdfNode(node)) {
      const url = node.getUrl();
      if (url.startsWith("asset://")) {
        ids.push(url.substring(8));
      }
    } else if ($isElementNode(node)) {
      node.getChildren().forEach((child) => {
        ids.push(...findAssetIdsInNode(child));
      });
    }
    return ids;
  };

  const calculateMenuDimensions = (items: NativeMenuItem[]) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
    }

    let width = 0;
    let height = 8;

    items.forEach((item) => {
      if (item.item === "Separator") {
        height += 8;
        return;
      }

      const textWidth = context?.measureText(item.text ?? "").width ?? 0;
      const acceleratorWidth = item.accelerator
        ? context?.measureText(item.accelerator).width ?? 0
        : 0;
      width = Math.max(width, textWidth + acceleratorWidth);
      height += 28;
    });

    return { width: Math.ceil(width), height };
  };

  const insertParagraph = useCallback((position: "above" | "below") => {
    editor.update(() => {
      if (!nodeRef.current) return;

      const paragraphNode = $createParagraphNode();
      if (position === "above") {
        nodeRef.current.insertBefore(paragraphNode);
      } else {
        nodeRef.current.insertAfter(paragraphNode);
      }
      paragraphNode.select();
    });
    setIsMenuOpen(false);
  }, [editor, setIsMenuOpen]);

  const menuItems: NativeMenuItem[] = useMemo(() => [
    {
      text: t("NODE_MENU.addAbove") as string,
      accelerator: "Alt+Shift+Up",
      action: () => insertParagraph("above"),
    },
    {
      text: t("NODE_MENU.addBelow") as string,
      accelerator: "Alt+Shift+Down",
      action: () => insertParagraph("below"),
    },
    {
      item: "Separator",
    },
    {
      text: t("NODE_MENU.copyId") as string,
      action: async () => {
        editor.read(() => {
          if (nodeRef.current) {
            const nodeKey = nodeRef.current.getKey();
            const nodeState = dynamicState.current.get(nodeKey);
            if (!nodeState) {
              console.error("null nodeState");
              return;
            }
            navigator.clipboard
              .writeText(`@node:${nodeState.id}`)
              .then(() => {
                showToast(t("LOCAL_SEARCH.linkCopied") as string, "success", TOAST_DURATION);
              })
              .catch(() => {
                showToast(t("LOCAL_SEARCH.linkCopyFailed") as string, "error", TOAST_DURATION);
              });
          }
        });
        setIsMenuOpen(false);
      },
    },
    ...(canTransform
      ? [
        {
          text: t("NODE_MENU.transform") as string,
          items: [
            {
              text: t("NODE_MENU.normal") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.FORMAT_PARAGRAPH.modifiers, EDITOR_SHORTCUTS.FORMAT_PARAGRAPH.key),
              action: () => {
                // FIX : this list
                applyToNodes((_, selection) => {
                  $setBlocksType(selection, () => $createParagraphNode());
                });
              },
            },
            {
              text: t("NODES.h1") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.HEADING1.modifiers, EDITOR_SHORTCUTS.HEADING1.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "h1") {
                    $setBlocksType(selection, () => $createHeadingNode("h1"));
                  }
                });
              },
            },
            {
              text: t("NODES.h2") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.HEADING2.modifiers, EDITOR_SHORTCUTS.HEADING2.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "h2") {
                    $setBlocksType(selection, () => $createHeadingNode("h2"));
                  }
                });
              },
            },
            {
              text: t("NODES.h3") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.HEADING3.modifiers, EDITOR_SHORTCUTS.HEADING3.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "h3") {
                    $setBlocksType(selection, () => $createHeadingNode("h3"));
                  }
                });
              },
            },
            {
              text: t("NODE_MENU.numberList") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.NUMBERED_LIST.modifiers, EDITOR_SHORTCUTS.NUMBERED_LIST.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if ($isListNode(node) && node.getListType() === "number") {
                    $setBlocksType(selection, () => $createParagraphNode());
                  } else {
                    $setBlocksType(selection, () =>
                      $createListNode("number"),
                    );
                  }
                });
              },
            },
            {
              text: t("NODE_MENU.bulletList") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.BULLET_LIST.modifiers, EDITOR_SHORTCUTS.BULLET_LIST.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if ($isListNode(node) && node.getListType() === "bullet") {
                    $setBlocksType(selection, () => $createParagraphNode());
                  } else {
                    $setBlocksType(selection, () =>
                      $createListNode("bullet"),
                    );
                  }
                });
              },
            },
            {
              text: t("NODE_MENU.checkList") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.CHECK_LIST.modifiers, EDITOR_SHORTCUTS.CHECK_LIST.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if ($isListNode(node) && node.getListType() === "check") {
                    $setBlocksType(selection, () => $createParagraphNode());
                  } else {
                    $setBlocksType(selection, () => $createListNode("check"));
                  }
                });
              },
            },
            {
              text: t("NODES.quote") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.FORMAT_QUOTE.modifiers, EDITOR_SHORTCUTS.FORMAT_QUOTE.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "quote") {
                    $setBlocksType(selection, () => $createQuoteNode());
                  }
                });
              },
            },
            {
              text: t("NODES.code") as string,
              accelerator: formatAccelerator(EDITOR_SHORTCUTS.FORMAT_CODE.modifiers, EDITOR_SHORTCUTS.FORMAT_CODE.key),
              action: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "code") {
                    $setBlocksType(selection, () => $createCodeNode());
                  }
                });
              },
            },
          ],
        },
      ]
      : []),
    ...(isCodeNode
      ? [
        {
          text: t("NODE_MENU.copyCode") as string,
          action: async () => {
            editor.update(() => {
              const codeNode = nodeRef.current;
              if ($isCodeNode(codeNode)) {
                const code = codeNode.getTextContent();
                if (code) {
                  try {
                    safeWriteText(code);
                  } catch (err) {
                    console.error(err);
                  }
                }
              }
            });
            setIsMenuOpen(false);
          },
        },
      ]
      : []),
    {
      text: t("NODE_MENU.duplicate") as string,
      action: () => {
        editor.update(() => {
          const topLevelNodes = getSelectedTopLevelNodes();
          if (topLevelNodes.length === 0) return;

          let insertAfterNode = topLevelNodes[topLevelNodes.length - 1];
          const copiedNodes: LexicalNode[] = [];

          topLevelNodes.forEach((node) => {
            const copiedNode = $parseSerializedNode(node.exportJSON());

            if ($isElementNode(node) && $isElementNode(copiedNode)) {
              (node as ElementNode).getChildren().forEach((child) => {
                (copiedNode as ElementNode).append(
                  $parseSerializedNode(child.exportJSON()),
                );
              });
            }
            copiedNodes.push(copiedNode);
          });

          copiedNodes.forEach((copiedNode) => {
            insertAfterNode.insertAfter(copiedNode);
            insertAfterNode = copiedNode;
          });

          if (copiedNodes.length > 0) {
            copiedNodes[0].selectStart();
          }

          setIsMenuOpen(false);

          // Update list numbers after duplication because, we can't undo after duplicate custom list
          //$updateNumberedListCounters();
        });
      },
    },
    {
      text: t("NODE_MENU.delete") as string,
      action: () => {
        editor.update(() => {
          const topLevelNodes = getSelectedTopLevelNodes();
          if (topLevelNodes.length === 0) return;

          const nextNode =
            topLevelNodes[topLevelNodes.length - 1].getNextSibling();
          const prevNode = topLevelNodes[0].getPreviousSibling();

          topLevelNodes.forEach((node) => {
            node.remove();
          });

          if (nextNode) {
            nextNode.selectEnd();
          } else if (prevNode) {
            prevNode.selectEnd();
          }

          setIsMenuOpen(false);
        });
      },
    },
  ], [canTransform, dynamicState, editor, insertParagraph, isCodeNode, setIsMenuOpen, showToast, t]);

  useEffect(() => {
    if (!isMenuOpen || !isMenuReady || isNativeMenuOpening.current) return;
    isNativeMenuOpening.current = true;

    const showNativeMenu = async () => {
      try {
        const [{ Menu }, { LogicalPosition }] = await Promise.all([
          import("@tauri-apps/api/menu"),
          import("@tauri-apps/api/dpi"),
        ]);

        const menuDimensions = calculateMenuDimensions(menuItems);
        const nativeMenu = await Menu.new({
          items: menuItems as unknown as NonNullable<Parameters<typeof TauriMenu.new>[0]>["items"],
        });
        const position = menuPosition
          ? new LogicalPosition(
            Math.max(8, menuPosition.x - menuDimensions.width),
            Math.min(
              Math.max(8, menuPosition.y),
              Math.max(8, window.innerHeight - menuDimensions.height - 8),
            ),
          )
          : undefined;
        await nativeMenu.popup(position);
      } catch (error) {
        console.error("Failed to show native node menu", error);
      } finally {
        isNativeMenuOpening.current = false;
        setIsMenuOpen(false);
      }
    };

    void showNativeMenu();
  }, [isMenuOpen, isMenuReady, menuPosition, menuItems, setIsMenuOpen]);

  return (
    <>{trigger}</>
  );
}
