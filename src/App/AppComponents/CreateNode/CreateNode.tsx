import "./CreateNode.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
} from "lexical";
import { MoreHorizontalIcon } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useGlobalStore } from "@/App/store/useGlobalStore";
import { MenuPosition } from "@/components/custom/Menu/Menu";

import CreateNodeMenu from "./CreateNodeMenu";

interface CreateNodeProps {
  anchorElem: HTMLElement;
  draggableElement: HTMLElement | null;
  onMenuPositionChange?: (position: MenuPosition) => void;
  onMenuOpenChange?: (isOpen: boolean) => void;
  isMenuOpen?: boolean;
  menuPosition?: MenuPosition;
}

export default function CreateNode({ anchorElem, draggableElement, onMenuPositionChange, onMenuOpenChange, isMenuOpen, menuPosition }: CreateNodeProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const insertButtonRef = useRef<HTMLButtonElement>(null);
  const relativePositionRef = useRef({ x: 0, y: 0 });

  const { editorRef } = useGlobalStore(useShallow((state) => ({ editorRef: state.editorRef })));

  const [showInsertButton, setShowInsertButton] = useState<boolean>(false);
  const [localMenuPosition, setLocalMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  // Handle showing/hiding insert button based on node state
  useEffect(() => {
    if (
      !editor ||
      !draggableElement ||
      draggableElement.textContent.length > 0
    ) {
      setShowInsertButton(false);
      return;
    }

    const checkAndShowButton = () => {
      editor.read(() => {
        const node = $getNearestNodeFromDOMNode(draggableElement);
        const shouldShow =
          node !== null &&
          node.isAttached() &&
          $isParagraphNode(node) &&
          node.isEmpty();

        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const focusNode = selection.anchor.getNode();
          if (focusNode === node && shouldShow) {
            setShowInsertButton(true);
          } else {
            setShowInsertButton(false);
          }
        }
      });
    };

    const handleClick = () => {
      checkAndShowButton();
    };

    function handleKeyDown(e: KeyboardEvent) {
      // settimeout help the undisplay when write
      setTimeout(() => {
        editor.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const focusNode = selection.anchor.getNode();
            if (focusNode.getTextContent().length > 0) {
              setShowInsertButton(false);
            } else if ($isParagraphNode(focusNode)) {
              setShowInsertButton(true);
            } else {
              setShowInsertButton(false);
            }
          }
        });

        // If Enter was pressed, check and show button on the new block
        if (e.key === 'Enter') {
          checkAndShowButton();
        }
      }, 100);
    }

    checkAndShowButton();

    draggableElement.addEventListener("click", handleClick);
    if (editorRef.current) {
      editorRef.current.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      draggableElement.removeEventListener("click", handleClick);
      if (editorRef.current) {
        editorRef.current.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [draggableElement, editor, editorRef]);

  // Position insert button using transform for stable positioning
  useEffect(() => {
    if (
      !showInsertButton ||
      !insertButtonRef.current ||
      !draggableElement ||
      isMenuOpen
    ) {
      if (insertButtonRef.current) {
        insertButtonRef.current.style.display = "none";
      }
      return;
    }

    editor.read(() => {
      const node = $getNearestNodeFromDOMNode(draggableElement);
      if (!node) {
        if (insertButtonRef.current) {
          insertButtonRef.current.style.display = "none";
        }
        return;
      }

      const domElement = editor.getElementByKey(node.getKey());
      if (!domElement) {
        if (insertButtonRef.current) {
          insertButtonRef.current.style.display = "none";
        }
        return;
      }

      const targetRect = domElement.getBoundingClientRect();
      const anchorElementRect = anchorElem.getBoundingClientRect();

      // Calculate position relative to anchor element
      const top = targetRect.top - anchorElementRect.top + anchorElem.scrollTop + 3;
      const left = targetRect.left - anchorElementRect.left + 70;

      if (insertButtonRef.current) {
        insertButtonRef.current.style.display = "flex";
        insertButtonRef.current.style.transform = `translate(${left}px, ${top}px)`;
      }
    });
  }, [showInsertButton, draggableElement, editor, anchorElem, isMenuOpen]);

  // Handle resize to keep menu in correct position
  useEffect(() => {
    const handleResize = () => {
      if (!isMenuOpen || !editorRef.current) return;
      const editorRect = editorRef.current.getBoundingClientRect();
      onMenuPositionChange?.({
        x: editorRect.left + relativePositionRef.current.x,
        y: editorRect.top + relativePositionRef.current.y,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isMenuOpen, editorRef, onMenuPositionChange]);

  if (!showInsertButton || !draggableElement) {
    return null;
  }

  return (
    <>
      {!isMenuOpen && createPortal(
        <button
          ref={insertButtonRef}
          title={t("CREATE_NODE.buttonTitle") as string}
          className="icon-create"
          onClick={(e) => {
            onMenuOpenChange?.(true);

            if (editorRef.current) {
              const editorRect = editorRef.current.getBoundingClientRect();
              relativePositionRef.current = {
                x: e.clientX - editorRect.left,
                y: e.clientY - editorRect.top,
              };
            }

            const position = { x: e.clientX, y: e.clientY };
            onMenuPositionChange?.(position);
            setLocalMenuPosition(position);
          }}
        >
          <span className="icon-create-wrapper">
            <MoreHorizontalIcon size={14} />
          </span>
        </button>,
        anchorElem,
      )}
      <CreateNodeMenu
        editor={editor}
        menuPosition={menuPosition || localMenuPosition}
        isMenuOpen={isMenuOpen || false}
        setIsMenuOpen={onMenuOpenChange || (() => { })}
        draggableElement={draggableElement}
      />
    </>
  );
}

export { type CreateNodeProps };
