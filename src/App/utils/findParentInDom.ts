import { RefObject } from "react";

interface AncestorRefResult {
  element: HTMLElement;
  level: number;
}

/**
 * Remonte le DOM pour vérifier si l'élément cliqué fait partie de l'élément ciblé par la Ref.
 * example : 
      const targetParent = findAncestorWithRef(target, editorRef, 10);
 * * @param startElement L'élément de départ (ex: event.target)
 * @param targetRef La Ref React de l'élément que l'on cherche (ex: editorRef ou menuRef)
 * @param maxDepth La sécurité pour éviter de remonter trop haut (10 par défaut)
 */
export function findAncestorWithRef(
  startElement: HTMLElement | null,
  targetRef: RefObject<HTMLElement | null>,
  maxDepth = 10
): AncestorRefResult | null {
  let current = startElement;
  let currentLevel = 0;
  
  // On récupère l'élément réel pointé par la Ref React
  const targetElement = targetRef.current;

  // Si la ref n'est pas encore montée dans le DOM, on s'arrête tout de suite
  if (!targetElement) return null;

  while (current !== null && currentLevel < maxDepth) {
    // Comparaison physique directe entre l'élément actuel et la Ref
    if (current === targetElement) {
      return {
        element: current,
        level: currentLevel // 0 si on a cliqué pile sur la Ref, 1 si c'est le parent direct, etc.
      };
    }

    // On remonte d'un étage
    current = current.parentElement;
    currentLevel++;
  }

  return null;
}