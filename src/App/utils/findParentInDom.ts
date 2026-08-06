import { RefObject } from "react";

interface AncestorRefResult {
  element: HTMLElement;
  level: number;
}

/**
 * Climb the DOM to check if the clicked element is part of the element targeted by the Ref.
 * example : 
      const targetParent = findAncestorWithRef(target, editorRef, 10);
 * * @param startElement The starting element (ex: event.target)
 * @param targetRef The React Ref of the element we are looking for (ex: editorRef or menuRef)
 * @param maxDepth Safety to avoid climbing too high (10 by default)
 */
export function findAncestorWithRef(
  startElement: HTMLElement | null,
  targetRef: RefObject<HTMLElement | null>,
  maxDepth = 10
): AncestorRefResult | null {
  let current = startElement;
  let currentLevel = 0;
  
  // Get the actual element pointed to by the React Ref
  const targetElement = targetRef.current;

  // If the ref is not yet mounted in the DOM, we stop immediately
  if (!targetElement) return null;

  while (current !== null && currentLevel < maxDepth) {
    // Direct physical comparison between the current element and the Ref
    if (current === targetElement) {
      return {
        element: current,
        level: currentLevel // 0 if we clicked exactly on the Ref, 1 if it's the direct parent, etc.
      };
    }

    // Go up one level
    current = current.parentElement;
    currentLevel++;
  }

  return null;
}