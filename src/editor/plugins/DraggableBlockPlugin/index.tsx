/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import "./index.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNearestNodeOfType } from "@lexical/utils";
import { $getNearestNodeFromDOMNode, $getSelection, $isRangeSelection } from "lexical";
import { GripVertical, SquareSigma } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import CreateNode from "@/App/AppComponents/CreateNode/CreateNode";
import { NodeHighlight } from "@/App/AppComponents/NodeHighlight/NodeHighlight";
import { MenuPosition } from "@/components/custom/Menu/Menu";
import { MathExpNode } from "@/editor/nodes/MathNode/MathExpNode";

import { DraggableBlockPlugin_EXPERIMENTAL } from './LexicalDraggableBlockPlugin';
import MathPanel from "./MathPanel";
import NodeMenu from "./NodeMenu";

const DRAGGABLE_BLOCK_MENU_CLASSNAME = "draggable-block-menu";
const DRAGGABLE_BLOCK_INSERT_BUTTON_CLASSNAME =
  "draggable-block-insert-button";
const MATH_PANEL_BUTTON_CLASSNAME = "math-panel-button";

function isElementOnMenu(element: HTMLElement | null | undefined): boolean {
  return element
    ? !!element.closest(
      `.${DRAGGABLE_BLOCK_MENU_CLASSNAME}, .${DRAGGABLE_BLOCK_INSERT_BUTTON_CLASSNAME}, .${MATH_PANEL_BUTTON_CLASSNAME}, [data-radix-popper-content-wrapper]`,
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
  const [isMathNode, setIsMathNode] = useState(false);
  const [activeMathNodeKey, setActiveMathNodeKey] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    x: 0,
    y: 0,
  });

  const [showSelectNodeMenu, setShowSelectNodeMenu] = useState(false);
  const [selectNodeMenuPosition, setSelectNodeMenuPosition] =
    useState<MenuPosition>({ x: 0, y: 0 });
  const [showMath, setShowMath] = useState(false);
  const [mathPosition, setMathPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [mathCaretPosition, setMathCaretPosition] = useState({ x: 0, y: 0 });
  const [showMathCaret, setShowMathCaret] = useState(false);
  const [mathCaretTimestamp, setMathCaretTimestamp] = useState(0);
  const [mathSelectionRects, setMathSelectionRects] = useState<DOMRect[]>([]);

  // Detect if caret is inside a MathNode AND hovered draggableElement is also a MathExpNode
  useEffect(() => {
    const updateMathNodeState = () => {
      editor.read(() => {
        const selection = $getSelection();
        let caretMathNodeKey: string | null = null;

        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const mathNode = $getNearestNodeOfType(anchorNode, MathExpNode);
          if (mathNode) {
            caretMathNodeKey = mathNode.getKey();
          }
        }

        // Get the Lexical node from the hovered DOM element
        const hoveredNode = draggableElement
          ? $getNearestNodeFromDOMNode(draggableElement)
          : null;
        const hoveredIsMathNode = hoveredNode instanceof MathExpNode;

        // The button should only appear if the hovered node is the EXACT SAME math node as the caret
        if (caretMathNodeKey && hoveredIsMathNode && hoveredNode) {
          if (caretMathNodeKey === hoveredNode.getKey()) {
            setIsMathNode(true);
            setActiveMathNodeKey(caretMathNodeKey);
          } else {
            setIsMathNode(false);
            setActiveMathNodeKey(null);
          }
        } else {
          setIsMathNode(false);
          setActiveMathNodeKey(null);
        }
      });
    };

    updateMathNodeState();

    return editor.registerUpdateListener(() => {
      updateMathNodeState();
    });
  }, [editor, draggableElement]);

  return (
    <>
      <DraggableBlockPlugin_EXPERIMENTAL
        anchorElem={anchorElem}
        menuRef={menuRef}
        targetLineRef={targetLineRef}
        menuComponent={
          <div ref={menuRef} className="draggable-block-menu">
            {isMathNode ? (
              <button
                title="Math functions"
                className="math-panel-button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const rect = e.currentTarget.getBoundingClientRect();
                  setMathPosition({ x: rect.right, y: rect.top });

                  // Capturer la sélection avant le blur
                  const domSel = window.getSelection();
                  if (domSel && domSel.rangeCount > 0) {
                    const range = domSel.getRangeAt(0);
                    if (!range.collapsed) {
                      setMathSelectionRects(Array.from(range.getClientRects()));
                      setShowMathCaret(false);
                    } else {
                      setMathSelectionRects([]);
                      const rects = range.getClientRects();
                      if (rects.length > 0) {
                        setMathCaretPosition({ x: rects[0].left, y: rects[0].top });
                        setShowMathCaret(true);
                        setMathCaretTimestamp(Date.now());
                      }
                    }
                  } else {
                    setMathSelectionRects([]);
                    setShowMathCaret(false);
                  }

                  setShowMath(true);
                }}
              >
                <SquareSigma size={18} />
              </button>
            ) : (
              <div style={{ width: '18px', flexShrink: 0 }} /> /* Placeholder to keep drag handle fixed */
            )}
            <div
              title={t("DRAGGABLE_BLOCK.menuTitle") as string}
              className="drag-handle"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPosition({ x: rect.right, y: rect.top });
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
        isOnMenu={(element) => isMenuOpen || showSelectNodeMenu || showMath || isElementOnMenu(element)}
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

      {/* Math Help Panel */}
      {showMath && (
        <MathPanel
          isOpen={showMath}
          onClose={() => {
            setShowMath(false);
            setShowMathCaret(false);
          }}
          position={mathPosition}
          editor={editor}
          caretPosition={mathCaretPosition}
          showCaret={showMathCaret}
          caretTimestamp={mathCaretTimestamp}
          selectionRects={mathSelectionRects}
          activeNodeKey={activeMathNodeKey}
        />
      )}

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
