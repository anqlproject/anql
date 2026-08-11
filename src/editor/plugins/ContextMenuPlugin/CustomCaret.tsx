import { useEffect, useRef, useState } from "react";

interface CustomCaretProps {
  position: { x: number, y: number }
  visible: boolean;
  timestamp: number;
}

export default function CustomCaret({ position, visible, timestamp }: CustomCaretProps) {
  const caretRef = useRef<HTMLDivElement>(null);
  const [currentPos, setCurrentPos] = useState(position);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    setCurrentPos(position);
  }, [position, timestamp]);

  useEffect(() => {
    if (!visible) {
      savedRangeRef.current = null;
      return;
    }

    const updatePosition = () => {
      let rangeToUse: Range | null = null;
      const selection = window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        rangeToUse = range;
        savedRangeRef.current = range.cloneRange();
      }

      if (!rangeToUse && savedRangeRef.current) {
        rangeToUse = savedRangeRef.current;
      }

      if (rangeToUse) {
        const rects = rangeToUse.getClientRects();
        if (rects && rects.length > 0) {
          const rect = rects[0];
          setCurrentPos({ x: rect.left, y: rect.top });
        }
      }
    };

    updatePosition(); // Grab initial range and set up

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [visible]);

  useEffect(() => {
    if (caretRef.current) {
      caretRef.current.style.left = `${currentPos.x}px`;
      // Centrer verticalement (hauteur du caret = 20px, donc -10px)
      caretRef.current.style.top = `${currentPos.y}px`;
    }
  }, [currentPos]);

  if (!visible) return null;

  return (
    <>
      <div
        ref={caretRef}
        style={{
          position: "fixed",
          width: "2px",
          height: "20px",
          backgroundColor: "#007AFF",
          zIndex: 9999
        }}
      />
    </>
  );
}
