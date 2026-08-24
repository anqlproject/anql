import { $createCodeNode } from "@lexical/code";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/extension";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isRangeSelection,
  BaseSelection,
  LexicalEditor,
  LexicalNode,
} from "lexical";
import {
  Calculator,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LineChartIcon,
  ListCheckIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  TableIcon,
} from "lucide-react";
import { JSX, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { NodeHighlight } from "@/App/AppComponents/NodeHighlight/NodeHighlight";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { MenuPosition } from "@/components/custom/Menu/Menu";
import { MenuItemProps } from "@/components/custom/Menu/MenuItem";
import { OverflowMenu } from "@/components/custom/OverflowMenu/OverflowMenu";
import { ICON_SIZES } from "@/core/global/defaultValues";
import { $createListNode, $isListNode, } from "@/editor/nodes/ListNode";
import { insertImageFromFile } from "@/editor/plugins/ImagesPlugin";
import { INSERT_MATH_COMMAND } from "@/editor/plugins/MathPlugin";

import { INSERT_TABLE_COMMAND } from "../../../editor/plugins/TablePlugin";


export default function CreateNodeMenu({
  editor,
  menuPosition,
  isMenuOpen,
  setIsMenuOpen,
  draggableElement,
}: {
  editor: LexicalEditor;
  menuPosition: MenuPosition;
  isMenuOpen: boolean;
  setIsMenuOpen: (state: boolean) => void;
  draggableElement: HTMLElement | null;
}): JSX.Element | null {
  const { t } = useTranslation();

  const nodeRef = useRef<LexicalNode>(null);

  useEffect(() => {
    if (isMenuOpen && draggableElement) {
      editor.read(() => {
        nodeRef.current = $getNearestNodeFromDOMNode(draggableElement);
      });
      editor.blur();
    }
  }, [isMenuOpen, draggableElement, editor]);

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

  const menuItems: Array<MenuItemProps> = [
    {
      icon: <Code2Icon size={ICON_SIZES.default}/>,
      title: t('NODES.code') as string,
      variant: "default",
      onClick: () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            if (selection.isCollapsed()) {
              $setBlocksType(selection, () => $createCodeNode());
            } else {
              // Will this ever happen?
              const textContent = selection.getTextContent();
              const codeNode = $createCodeNode();
              selection.insertNodes([codeNode]);
              selection.insertRawText(textContent);
            }
          }
          setIsMenuOpen(false);
        });
      },
    },
    {
      icon: <LineChartIcon size={ICON_SIZES.default} />,
      title: t('NODES.line') as string,
      onClick: () => {
        editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
        setIsMenuOpen(false);
      },
    },
    {
      icon: <Calculator size={ICON_SIZES.default} />,
      title: t('INLINES.math') as string,
      onClick: () => {
        editor.dispatchCommand(INSERT_MATH_COMMAND, undefined);
        setIsMenuOpen(false);
      },
    },
    {
      icon: <ImageIcon size={ICON_SIZES.default} />,
      title: t('NODES.image') as string,
      onClick: () => {
        insertImageFromFile(editor);
        setIsMenuOpen(false);
      },
    },
    {
      icon: <TableIcon size={ICON_SIZES.default} />,
      title: t('NODES.table') as string,
      onClick: () => {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, {
          columns: [{ header: "", id: "a" }],
          data: [{ a: "" }],
        });
        setIsMenuOpen(false);
      },
    },
    {
      title: t('NODES.h1') as string,
      icon: <Heading1Icon size={ICON_SIZES.default} />,
      onClick: () => {
        applyToNodes((node, selection) => {
          if (node.__type !== "h1") {
            $setBlocksType(selection, () => $createHeadingNode("h1"));
          }
        });
      },
    },
    {
      title: t('NODES.h2') as string,
      icon: <Heading2Icon size={ICON_SIZES.default} />,
      onClick: () => {
        applyToNodes((node, selection) => {
          if (node.__type !== "h2") {
            $setBlocksType(selection, () => $createHeadingNode("h2"));
          }
        });
      },
    },
    {
      title: t('NODES.h3') as string,
      icon: <Heading3Icon size={ICON_SIZES.default} />,
      onClick: () => {
        applyToNodes((node, selection) => {
          if (node.__type !== "h3") {
            $setBlocksType(selection, () => $createHeadingNode("h3"));
          }
        });
      },
    },
    {
      title: t('NODE_MENU.numberList') as string,
      icon: <ListOrderedIcon size={ICON_SIZES.default} />,
      onClick: () => {
        applyToNodes((node, selection) => {
          if ($isListNode(node) && node.getListType() === "number") {
            $setBlocksType(selection, () => $createParagraphNode());
          } else {
            $setBlocksType(selection, () => $createListNode("number"));
          }
        });
      },
    },
    {
      title: t('NODE_MENU.bulletList') as string,
      icon: <ListIcon size={ICON_SIZES.default} />,
      onClick: () => {
        applyToNodes((node, selection) => {
          if ($isListNode(node) && node.getListType() === "bullet") {
            $setBlocksType(selection, () => $createParagraphNode());
          } else {
            $setBlocksType(selection, () => $createListNode("bullet"));
          }
        });
      },
    },
    {
      title: t('NODE_MENU.checkList') as string,
      icon: <ListCheckIcon size={ICON_SIZES.default} />,
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
      title: t('NODES.quote') as string,
      icon: <QuoteIcon size={ICON_SIZES.default} />,
      onClick: () => {
        applyToNodes((node, selection) => {
          if (node.__type !== "quote") {
            $setBlocksType(selection, () => $createQuoteNode());
          }
        });
      },
    },
  ];

  const { editorRef } = useGlobalStore(useShallow((state) => ({ editorRef: state.editorRef })));

  useEffect(() => {
    if (isMenuOpen && draggableElement) {
      editor.blur();
    }
  }, [isMenuOpen, draggableElement, editor]);

  return (
    <>
      {isMenuOpen && (
        <NodeHighlight
          editor={editor}
          draggableElement={draggableElement}
          isOpen={isMenuOpen}
        />
      )}
      {isMenuOpen && (
        <OverflowMenu
          items={menuItems}
          isOpen={isMenuOpen}
          onClose={() => {
            setIsMenuOpen(false);
            setTimeout(() => {
              editor.focus();
            }, 10);
          }}
          position={menuPosition}
          direction="bottom"
          menuRef={editorRef}
          editorRef={editorRef}
        />
      )}
    </>
  );
}
