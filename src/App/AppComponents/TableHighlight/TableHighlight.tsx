import "./TableHighlight.css";

import { useCallback, useEffect, useState } from "react";
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";

interface TableHighlightProps {
  highlightType?: "row" | "column" | null;
  targetIndex?: number;
  isOpen?: boolean;
  rowRefs?: React.RefObject<(HTMLElement | null)[]>;
  columnRefs?: React.RefObject<(HTMLElement | null)[]>;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export function TableHighlight({
  highlightType,
  targetIndex,
  isOpen,
  rowRefs,
  columnRefs,
  scrollContainerRef,
}: TableHighlightProps) {
  const { editorRef } = useGlobalStore(useShallow((state) => ({ editorRef: state.editorRef })));
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const [editorShellDimensions, setEditorShellDimensions] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const updateHighlightRect = useCallback(() => {
    if (
      !highlightType ||
      targetIndex === undefined ||
      targetIndex < 0
    ) {
      setHighlightRect(null);
      return;
    }

    if (highlightType === "row") {
      const targetRow = rowRefs?.current?.[targetIndex];
      if (!targetRow) {
        setHighlightRect(null);
        return;
      }
      setHighlightRect(targetRow.getBoundingClientRect());
      return;
    }

    const targetHeaderCell = columnRefs?.current?.[targetIndex];
    if (!targetHeaderCell) {
      setHighlightRect(null);
      return;
    }

    const headerRect = targetHeaderCell.getBoundingClientRect();
    let minTop = headerRect.top;
    let maxBottom = headerRect.bottom;

    rowRefs?.current?.forEach((row) => {
      if (!row) return;
      const cells = row.querySelectorAll(".table-cell--data");
      const targetCell = cells[targetIndex] as HTMLElement | undefined;
      if (!targetCell) return;
      const cellRect = targetCell.getBoundingClientRect();
      minTop = Math.min(minTop, cellRect.top);
      maxBottom = Math.max(maxBottom, cellRect.bottom);
    });

    setHighlightRect(
      new DOMRect(
        headerRect.left,
        minTop,
        headerRect.width,
        maxBottom - minTop,
      ),
    );
  }, [highlightType, targetIndex, rowRefs, columnRefs]);

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
      if (isOpen) updateHighlightRect();
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [editorRef, isOpen, updateHighlightRect]);

  useEffect(() => {
    if (isOpen) updateHighlightRect();
    else setHighlightRect(null);
  }, [isOpen, updateHighlightRect]);

  useEffect(() => {
    if (!isOpen) return;
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl) return;
    const handleScroll = () => updateHighlightRect();
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isOpen, scrollContainerRef, updateHighlightRect]);

  useEffect(() => {
    if (!isOpen) return;
    const observer = new ResizeObserver(() => updateHighlightRect());
    rowRefs?.current?.forEach((row) => row && observer.observe(row));
    columnRefs?.current?.forEach((cell) => cell && observer.observe(cell));
    return () => observer.disconnect();
  }, [isOpen, rowRefs, columnRefs, updateHighlightRect]);

  const isVisible =
    isOpen &&
    highlightRect &&
    !Number.isNaN(editorShellDimensions.x) &&
    !Number.isNaN(highlightRect.top);

  if (!isVisible || !highlightRect) return null;

  return (
    <div
      className="table-highlight-container"
      style={{
        position: "fixed",
        top: editorShellDimensions.y,
        left: editorShellDimensions.x,
        width: editorShellDimensions.width,
        height: editorShellDimensions.height,
        overflow: "hidden",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div
        className={`table-highlight-border table-highlight-border--${highlightType}`}
        style={{
          position: "absolute",
          top: highlightRect.top - editorShellDimensions.y - 1,
          left: highlightRect.left - editorShellDimensions.x - 1,
          width: highlightRect.width + 2,
          height: highlightRect.height + 2,
        }}
      />
    </div>
  );
}
