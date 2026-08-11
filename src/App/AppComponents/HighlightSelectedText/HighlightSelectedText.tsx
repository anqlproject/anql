import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface HightlightSelectedTextProps {
    isMenuOpen: boolean;
    selectionRects?: DOMRect[];
}

export interface HighlightRef {
    updateRects: () => void;
}

export const HightlightSelectedText = forwardRef<HighlightRef, HightlightSelectedTextProps>(
    ({ isMenuOpen, selectionRects }, ref) => {
    const [rects, setRects] = useState<DOMRect[]>([]);
    const savedRangeRef = useRef<Range | null>(null);

    const updateRects = () => {
            let rangeToUse: Range | null = null;
            const domSelection = window.getSelection();

            if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                // Don't highlight if it's just a cursor (collapsed)
                if (!range.collapsed) {
                    rangeToUse = range;
                    savedRangeRef.current = range.cloneRange();
                }
            }

            // Fallback to saved range if selection is lost during resize
            if (!rangeToUse && savedRangeRef.current) {
                rangeToUse = savedRangeRef.current;
            }

            if (rangeToUse) {
                const clientRects = Array.from(rangeToUse.getClientRects());
                if (clientRects.length > 0) {
                    setRects(clientRects);
                }
            } else {
                setRects([]);
            }
        };

    useImperativeHandle(ref, () => ({
        updateRects
    }));

    useEffect(() => {
        if (isMenuOpen) {
            // Use provided selectionRects if available (captured before blur)
            if (selectionRects && selectionRects.length > 0) {
                setRects(selectionRects);
            } else {
                // Fallback to DOM selection capture
                const timer = setTimeout(updateRects, 0);
                window.addEventListener("scroll", updateRects, true);
                window.addEventListener("resize", updateRects);

                return () => {
                    clearTimeout(timer);
                    window.removeEventListener("scroll", updateRects, true);
                    window.removeEventListener("resize", updateRects);
                    savedRangeRef.current = null;
                };
            }
        } else {
            setRects([]);
            savedRangeRef.current = null;
        }
    }, [isMenuOpen, selectionRects]);

    if (!isMenuOpen || rects.length === 0) return null;

    return (
        <>
            {rects.map((rect, index) => (
                <div
                    key={index}
                    style={{
                        position: "fixed",
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        backgroundColor: "rgba(51, 144, 255, 0.4)",
                        pointerEvents: "none",
                        zIndex: 40,
                        //mixBlendMode: "multiply", // Optional: improves text readability
                    }}
                />
            ))}
        </>
    );
});
