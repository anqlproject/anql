import "./TableHighlight.css";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

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
      setHighlightRect(getVisibleRect(targetRow.getBoundingClientRect(), scrollContainerRef?.current));
      return;
    }

    const targetHeaderCell = columnRefs?.current?.[targetIndex]
      ?? scrollContainerRef?.current?.querySelector<HTMLElement>(
        `.table-col-gutter-slot[data-column-index="${targetIndex}"]`,
      );
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

    setHighlightRect(getVisibleRect(
      new DOMRect(
        headerRect.left,
        minTop,
        headerRect.width,
        maxBottom - minTop,
      ),
      scrollContainerRef?.current,
    ));
  }, [highlightType, targetIndex, rowRefs, columnRefs, scrollContainerRef]);

  useEffect(() => {
    if (!isOpen) return;
    updateHighlightRect();
    window.addEventListener("resize", updateHighlightRect);
    window.addEventListener("scroll", updateHighlightRect, true);
    return () => {
      window.removeEventListener("resize", updateHighlightRect);
      window.removeEventListener("scroll", updateHighlightRect, true);
    };
  }, [isOpen, updateHighlightRect]);

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
    if (scrollContainerRef?.current) observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, [isOpen, rowRefs, columnRefs, scrollContainerRef, updateHighlightRect]);

  if (!isOpen || !highlightRect) return null;

  return createPortal(
    <div
      className="table-highlight-container"
      style={{
        position: "fixed",
        top: highlightRect.top,
        left: highlightRect.left,
        width: highlightRect.width,
        height: highlightRect.height,
        zIndex: "var(--z-elevated)",
        pointerEvents: "none",
      }}
    >
      <div
        className={`table-highlight-border table-highlight-border--${highlightType}`}
        style={{
          position: "absolute",
          inset: -1,
        }}
      />
    </div>,
    document.body,
  );
}

function getVisibleRect(rect: DOMRect, container: HTMLElement | null | undefined): DOMRect | null {
  if (!container) return rect;

  const containerRect = container.getBoundingClientRect();
  const left = Math.max(rect.left, containerRect.left + container.clientLeft);
  const top = Math.max(rect.top, containerRect.top + container.clientTop);
  const right = Math.min(rect.right, containerRect.left + container.clientLeft + container.clientWidth);
  const bottom = Math.min(rect.bottom, containerRect.top + container.clientTop + container.clientHeight);

  if (right <= left || bottom <= top) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}
