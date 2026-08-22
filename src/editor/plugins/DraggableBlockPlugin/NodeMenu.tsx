import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
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
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Layers2,
  Link2Icon,
  ListCheckIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  RecycleIcon,
  TextIcon,
  TrashIcon,
} from "lucide-react";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useGlobalToast } from "@/App/hooks/useGlobalToast";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { MenuPosition, MenuX as Menu } from "@/components/custom/Menu/MenuX";
import { DIMENSIONS, ICON_SIZES, TOAST_DURATION } from "@/core/global/defaultValues";
import { $isImageNode } from "@/editor/nodes/ImageNode/ImageNode";
import { $createListNode, $isListNode } from "@/editor/nodes/ListNode";
import { $isPdfNode } from "@/editor/nodes/PdfNode/PdfNode";
import { safeWriteText } from "@/editor/plugins/ContextMenuPlugin/contextMenuActions";
import { EDITOR_SHORTCUTS } from "@/GlobalState/shortcutStore";

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
  const { dynamicState, isMac } = useGlobalStore(
    useShallow((state) => ({
      dynamicState: state.dynamicState,
      isMac: state.isMac,
    })),
  );
  const { showToast } = useGlobalToast();
  const nodeRef = useRef<LexicalNode>(null);
  const [canTransform, setCanTransform] = useState(false);
  const [isCodeNode, setIsCodeNode] = useState(false);
  const ICON_SIZE = ICON_SIZES.default;

  // Helper to format shortcut for display
  const formatShortcut = (modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }, key: string): string => {
    const parts: string[] = [];
    if (modifiers.ctrlKey) parts.push(isMac ? '⌃' : 'Ctrl');
    if (modifiers.metaKey) parts.push(isMac ? '⌘' : 'Win');
    if (modifiers.altKey) parts.push(isMac ? '⌥' : 'Alt');
    if (modifiers.shiftKey) parts.push(isMac ? '⇧' : 'Shift');

    // Format key name
    let keyName = key.replace('Key', '').replace('Digit', '');
    if (key === 'Comma') keyName = ',';
    if (key === 'Period') keyName = '.';
    if (key === 'BracketRight') keyName = ']';
    if (key === 'BracketLeft') keyName = '[';
    if (key === 'Backslash') keyName = '\\';

    parts.push(keyName);
    return parts.join(isMac ? '' : '+');
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
            "list",
          ];
          const allAllowed = topLevelNodes.every((n) =>
            allowedTypes.includes(n.getType()),
          );
          setCanTransform(allAllowed);
        } else {
          console.error("node not found");
          setCanTransform(false);
        }
      });
      editor.blur();
    }
  }, [isMenuOpen, draggableElement, editor]);

  useEffect(() => {
    if (isMenuOpen && draggableElement) {
      editor.read(() => {
        const node = $getNearestNodeFromDOMNode(draggableElement);
        if (node) {
          nodeRef.current = node;

          const topLevelNodes = getSelectedTopLevelNodes();
          setIsCodeNode(topLevelNodes.some((n) => n.getType() === "code"));
        } else {
          console.error("node not found");
          setIsCodeNode(false);
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

  const menuItems = [
    {
      icon: <ArrowUpIcon size={ICON_SIZE} />,
      title: t("NODE_MENU.addAbove") as string,
      shortcut: isMac ? "⌥⇧↑" : "Alt+Shift+↑",
      onClick: () => {
        editor.update(() => {
          if (!nodeRef.current) return;
          const pNode = $createParagraphNode();
          nodeRef.current.insertBefore(pNode);
          pNode.select();
        });
        setIsMenuOpen(false);
      },
    },
    {
      icon: <ArrowDownIcon size={ICON_SIZE} />,
      title: t("NODE_MENU.addBelow") as string,
      shortcut: isMac ? "⌥⇧↓" : "Alt+Shift+↓",
      onClick: () => {
        editor.update(() => {
          if (!nodeRef.current) return;
          const pNode = $createParagraphNode();
          nodeRef.current.insertAfter(pNode);
          pNode.select();
        });
        setIsMenuOpen(false);
      },
    },
    {
      title: "sep1",
      isSeparator: true,
    },
    {
      icon: <Link2Icon size={ICON_SIZE} />,
      title: t("NODE_MENU.copyId") as string,
      onClick: async () => {
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
          icon: <RecycleIcon size={ICON_SIZE} />,
          title: t("NODE_MENU.transformMenu") as string,
          hasSubmenu: true,
          submenu: [
            {
              title: t("NODE_MENU.normal") as string,
              icon: <TextIcon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.FORMAT_PARAGRAPH.modifiers, EDITOR_SHORTCUTS.FORMAT_PARAGRAPH.key),
              onClick: () => {
                // FIX : this list
                applyToNodes((_, selection) => {
                  $setBlocksType(selection, () => $createParagraphNode());
                });
              },
            },
            {
              title: t("NODES.h1") as string,
              icon: <Heading1Icon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.HEADING1.modifiers, EDITOR_SHORTCUTS.HEADING1.key),
              onClick: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "h1") {
                    $setBlocksType(selection, () => $createHeadingNode("h1"));
                  }
                });
              },
            },
            {
              title: t("NODES.h2") as string,
              icon: <Heading2Icon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.HEADING2.modifiers, EDITOR_SHORTCUTS.HEADING2.key),
              onClick: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "h2") {
                    $setBlocksType(selection, () => $createHeadingNode("h2"));
                  }
                });
              },
            },
            {
              title: t("NODES.h3") as string,
              icon: <Heading3Icon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.HEADING3.modifiers, EDITOR_SHORTCUTS.HEADING3.key),
              onClick: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "h3") {
                    $setBlocksType(selection, () => $createHeadingNode("h3"));
                  }
                });
              },
            },
            {
              title: t("NODE_MENU.numberList") as string,
              icon: <ListOrderedIcon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.NUMBERED_LIST.modifiers, EDITOR_SHORTCUTS.NUMBERED_LIST.key),
              onClick: () => {
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
              title: t("NODE_MENU.bulletList") as string,
              icon: <ListIcon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.BULLET_LIST.modifiers, EDITOR_SHORTCUTS.BULLET_LIST.key),
              onClick: () => {
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
              title: t("NODE_MENU.checkList") as string,
              icon: <ListCheckIcon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.CHECK_LIST.modifiers, EDITOR_SHORTCUTS.CHECK_LIST.key),
              onClick: () => {
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
              title: t("NODES.quote") as string,
              icon: <QuoteIcon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.FORMAT_QUOTE.modifiers, EDITOR_SHORTCUTS.FORMAT_QUOTE.key),
              onClick: () => {
                applyToNodes((node, selection) => {
                  if (node.__type !== "quote") {
                    $setBlocksType(selection, () => $createQuoteNode());
                  }
                });
              },
            },
            {
              title: t("NODES.code") as string,
              icon: <Code2Icon size={ICON_SIZE} />,
              shortcut: formatShortcut(EDITOR_SHORTCUTS.FORMAT_CODE.modifiers, EDITOR_SHORTCUTS.FORMAT_CODE.key),
              onClick: () => {
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
          icon: <Code2Icon size={ICON_SIZE} />,
          title: t("NODE_MENU.copyCode") as string,
          onClick: async () => {
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
      icon: <Layers2 size={ICON_SIZE} />,
      title: t("NODE_MENU.duplicate") as string,
      onClick: () => {
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
      icon: <TrashIcon size={ICON_SIZE} />,
      title: t("NODE_MENU.delete") as string,
      variant: "danger" as const,
      onClick: () => {
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
  ];

  return (
    <>


      <Menu
        items={menuItems}
        isOpen={isMenuOpen}
        onClose={() => {
          setIsMenuOpen(false);
          setTimeout(() => {
            editor.update(() => {
              if (nodeRef.current) {
                //nodeRef.current.selectEnd();
              }
            });
          }, 50);
        }}
        direction="left"
        align="center"
        trigger={trigger}
        position={menuPosition}
        collisionPadding={{ top:DIMENSIONS.titlebarHeight }}
      />
    </>
  );
}
