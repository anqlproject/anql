/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import "./index.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { calculateZoomLevel } from "@lexical/utils";
import { $getSelection, $isRangeSelection } from "lexical";
import { GripVertical } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CreateNode from "@/App/AppComponents/CreateNode/CreateNode";
import { NodeHighlight } from "@/App/AppComponents/NodeHighlight/NodeHighlight";
import { MenuPosition } from "@/components/custom/Menu/Menu";

import { DraggableBlockPlugin_EXPERIMENTAL } from './LexicalDraggableBlockPlugin';
import NodeMenu from "./NodeMenu";

const DRAGGABLE_BLOCK_MENU_CLASSNAME = "draggable-block-menu";
const DRAGGABLE_BLOCK_INSERT_BUTTON_CLASSNAME =
  "draggable-block-insert-button";
const MATH_PANEL_BUTTON_CLASSNAME = "math-panel-button";
const SPACE = 4;

function updateDragHandlePosition(
  targetElem: HTMLElement | null,
  floatingElem: HTMLElement,
  anchorElem: HTMLElement,
  zoomLevel = 1,
) {
  if (!targetElem || !targetElem.isConnected) {
    floatingElem.style.display = "none";
    return;
  }

  const targetRect = targetElem.getBoundingClientRect();
  const targetView = targetElem.ownerDocument.defaultView;
  const targetStyle = targetView
    ? targetView.getComputedStyle(targetElem)
    : null;
  const floatingElemRect = floatingElem.getBoundingClientRect();
  const anchorElementRect = anchorElem.getBoundingClientRect();

  let targetCalculateHeight: number = targetStyle
    ? parseInt(targetStyle.lineHeight, 10)
    : NaN;
  if (isNaN(targetCalculateHeight)) {
    targetCalculateHeight = targetRect.bottom - targetRect.top;
  }
  const floatingHeight = floatingElemRect.height || 22;
  const top =
    (targetRect.top +
      (targetCalculateHeight - floatingHeight) / 2 -
      anchorElementRect.top +
      anchorElem.scrollTop) /
    zoomLevel;

  const left = SPACE;

  floatingElem.style.display = "flex";
  floatingElem.style.opacity = "1";
  floatingElem.style.transform = `translate(${left}px, ${top}px)`;
}

function isElementOnMenu(element: HTMLElement | null | undefined): boolean {
  return element
    ? !!element.closest(
      `.${DRAGGABLE_BLOCK_MENU_CLASSNAME}, .${DRAGGABLE_BLOCK_INSERT_BUTTON_CLASSNAME}, .${MATH_PANEL_BUTTON_CLASSNAME}, .icon-create, [data-radix-popper-content-wrapper]`,
    )
    : false;
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
  scrollRef,
}: {
  anchorElem?: HTMLElement;
  scrollRef?: React.RefObject<HTMLElement | null>;
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

  // Update drag handle position immediately when draggableElement changes
  useEffect(() => {
    if (!menuRef.current) return;
    const zoomLevel = calculateZoomLevel(editor.getRootElement(), true);
    updateDragHandlePosition(draggableElement, menuRef.current, anchorElem, zoomLevel);
  }, [draggableElement, anchorElem, editor]);

  // Synchronize drag handle on document changes (deletion, transformation, height change)
  useEffect(() => {
    return editor.registerUpdateListener(() => {
      if (!draggableElement) return;

      const zoomLevel = calculateZoomLevel(editor.getRootElement(), true);

      // Node was deleted or replaced by a new DOM tag (transformed)
      if (!draggableElement.isConnected) {
        let nextElem: HTMLElement | null = null;
        editor.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const topLevel = anchorNode.getTopLevelElement();
            if (topLevel) {
              nextElem = editor.getElementByKey(topLevel.getKey());
            }
          }
        });

        setDraggableElement(nextElem);
        if (menuRef.current) {
          updateDragHandlePosition(nextElem, menuRef.current, anchorElem, zoomLevel);
        }
        return;
      }

      // Node is still in DOM: reposition if height or line-height changed
      if (menuRef.current) {
        updateDragHandlePosition(draggableElement, menuRef.current, anchorElem, zoomLevel);
      }
    });
  }, [editor, draggableElement, anchorElem]);

  return (
    <>
      <DraggableBlockPlugin_EXPERIMENTAL
        anchorElem={anchorElem}
        menuRef={menuRef}
        targetLineRef={targetLineRef}
        scrollRef={scrollRef}
        menuComponent={
          <div ref={menuRef} className="draggable-block-menu">
            <div
              title={t("DRAGGABLE_BLOCK.menuTitle") as string}
              className="drag-handle"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPosition({ x: rect.left - rect.width - 6, y: rect.top });
                setIsMenuOpen(true);
                editor.blur();
              }}
            >
              <GripVertical size={18} />
            </div>
          </div>
        }
        targetLineComponent={
          <div ref={targetLineRef} className="draggable-block-target-line" />
        }
        isOnMenu={(element) => isMenuOpen || showSelectNodeMenu || isElementOnMenu(element)}
        onElementChanged={(elem) => {
          if (elem === null && (isMenuOpen || showSelectNodeMenu) && draggableElement?.isConnected) {
            return;
          }
          setDraggableElement(elem);
        }}
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
