/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import "./index.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DraggableBlockPlugin_EXPERIMENTAL } from '@lexical/react/LexicalDraggableBlockPlugin';
import { GripVertical } from "lucide-react";
import type { JSX } from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CreateNode from "@/App/AppComponents/CreateNode/CreateNode";
import { NodeHighlight } from "@/App/AppComponents/NodeHighlight/NodeHighlight";
import { MenuPosition } from "@/components/custom/Menu/Menu";

import NodeMenu from "./NodeMenu";

const DRAGGABLE_BLOCK_MENU_CLASSNAME = "draggable-block-menu";
const DRAGGABLE_BLOCK_INSERT_BUTTON_CLASSNAME =
  "draggable-block-insert-button";

function isElementOnMenu(element: HTMLElement | null | undefined): boolean {
  return element
    ? !!element.closest(
      `.${DRAGGABLE_BLOCK_MENU_CLASSNAME}, .${DRAGGABLE_BLOCK_INSERT_BUTTON_CLASSNAME}, [data-radix-popper-content-wrapper]`,
    )
    : false;
}


export default function DraggableBlockPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  const [draggableElement, setDraggableElement] = useState<HTMLElement | null>(
    null,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    x: 0,
    y: 0,
  });

  const [showSelectNodeMenu, setShowSelectNodeMenu] = useState(false);
  const [selectNodeMenuPosition, setSelectNodeMenuPosition] =
    useState<MenuPosition>({ x: 0, y: 0 });

  return (
    <>
      <DraggableBlockPlugin_EXPERIMENTAL
        anchorElem={anchorElem}
        menuRef={menuRef}
        targetLineRef={targetLineRef}
        menuComponent={
          <div ref={menuRef} className="draggable-block-menu">
            <button
              title={t("DRAGGABLE_BLOCK.menuTitle") as string}
              className="drag-handle"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPosition({ x: rect.right, y: rect.top });
                setIsMenuOpen(true);
                editor.blur();
              }}
            >
              <GripVertical size={18} />
            </button>
          </div>
        }
        targetLineComponent={
          <div ref={targetLineRef} className="draggable-block-target-line" />
        }
        isOnMenu={(element) => isMenuOpen || showSelectNodeMenu || isElementOnMenu(element)}
        onElementChanged={setDraggableElement}
      />

      <CreateNode
        anchorElem={anchorElem}
        draggableElement={draggableElement}
        onMenuPositionChange={setSelectNodeMenuPosition}
        onMenuOpenChange={setShowSelectNodeMenu}
        isMenuOpen={showSelectNodeMenu}
        menuPosition={selectNodeMenuPosition}
      />

      {/* Rendered via portal to document.body to avoid CSS transform offset from drag handle container */}
      {isMenuOpen &&
        <NodeHighlight
          editor={editor}
          draggableElement={draggableElement}
          isOpen={isMenuOpen}
        />
      }

      {isMenuOpen && (
        <NodeMenu
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          editor={editor}
          draggableElement={draggableElement}
          menuPosition={menuPosition}
        />
      )}
    </>
  );
}
