import './NodeHighlight.css';

import { $getNearestNodeFromDOMNode, $getSelection, $isRangeSelection,LexicalEditor, LexicalNode } from "lexical";
import { useEffect, useRef, useState } from "react";
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";

interface NodeHighlightProps {
  editor?: LexicalEditor;
  draggableElement?: HTMLElement | null;
  isOpen?: boolean;
  elementRect?: DOMRect;
}

export function NodeHighlight({ editor, draggableElement, isOpen, elementRect }: NodeHighlightProps) {
  const { editorRef } = useGlobalStore(useShallow((state) => ({ editorRef: state.editorRef })));
  const [blockRect, setBlockRect] = useState<DOMRect | null>(null);
  const nodeRef = useRef<LexicalNode>(null);

  const [editorShellDimensions, setEditorShellDimensions] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const updateBlockRect = () => {
    if (!draggableElement || !editor) return;

    let finalRect = draggableElement.getBoundingClientRect();

    editor.read(() => {
      nodeRef.current = $getNearestNodeFromDOMNode(draggableElement);

      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        if (
          nodeRef.current &&
          nodes.some((n) => n.getKey() === nodeRef.current?.getKey()) &&
          nodes.length > 1
        ) {
          let minTop = Infinity;
          let minLeft = Infinity;
          let maxRight = -Infinity;
          let maxBottom = -Infinity;

          nodes.forEach((n) => {
            const domElement = editor.getElementByKey(n.getKey());
            if (domElement) {
              const domRect = domElement.getBoundingClientRect();
              if (domRect.width > 0 && domRect.height > 0) {
                minTop = Math.min(minTop, domRect.top);
                minLeft = Math.min(minLeft, domRect.left);
                maxRight = Math.max(maxRight, domRect.right);
                maxBottom = Math.max(maxBottom, domRect.bottom);
              }
            }
          });

          if (minTop !== Infinity) {
            finalRect = {
              ...finalRect,
              top: minTop,
              left: minLeft,
              right: maxRight,
              bottom: maxBottom,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              x: minLeft,
              y: minTop,
              toJSON: () => { },
            } as DOMRect;
          }
        }
      }
    });

    setBlockRect(finalRect);
  };

  useEffect(() => {
    if (elementRect) {
      setBlockRect(elementRect);
    } else if (draggableElement && isOpen) {
      updateBlockRect();
    }
  }, [elementRect, draggableElement, isOpen, editor]);


  useEffect(() => {
    function handleResize() {
      const editorShellRect = editorRef.current?.getBoundingClientRect();
      if (editorShellRect) {
        setEditorShellDimensions({
          x: editorShellRect.left,
          y: editorShellRect.top,
          width: editorShellRect.width,
          height: editorShellRect.height,
        });
      }

      // Recalculate blockRect on resize when menu is open
      if (isOpen && draggableElement) {
        updateBlockRect();
      }
    }

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const isVisible = elementRect ? true : (isOpen && blockRect);

  if (!isVisible || !blockRect) return null;

  return (
    <div
      className="block-clip-container"
      style={{
        position: "fixed",
        top: editorShellDimensions.y,
        left: editorShellDimensions.x,
        width: editorShellDimensions.width,
        height: editorShellDimensions.height,
        overflow: "hidden",
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <div
        className="block-border"
        style={{
          position: "absolute",
          top: blockRect.top - editorShellDimensions.y - 2,
          left: blockRect.left - editorShellDimensions.x - 2,
          width: blockRect.width + 4,
          height: blockRect.height + 4,
        }}
      />
    </div>
  );
}
