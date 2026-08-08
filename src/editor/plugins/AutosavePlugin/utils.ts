import { $isElementNode, EditorState, LexicalNode, SerializedLexicalNode } from "lexical";

import { NodeStateType } from "@/App/store/useGlobalStore";
import { generateKeyBetween } from "@/App/utils/fractional_indexing";
import { logger } from "@/core/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Content helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively serializes a LexicalNode (and its children) to plain JSON.
 * This is equivalent to exportJSON() but always includes children.
 */
export function getFullNodeJSON(node: LexicalNode): SerializedLexicalNode {
  const json: any = node.exportJSON();
  if ($isElementNode(node)) {
    json.children = node.getChildren().map((child) => getFullNodeJSON(child));
  }
  return json as SerializedLexicalNode;
}

/**
 * Serializes a node within a given editorState.read() context.
 * Safe to call from inside or outside a read() block.
 */
export function getContent(
  node: LexicalNode,
  editorState: EditorState
): SerializedLexicalNode | null {
  let serializedNode: SerializedLexicalNode | null = null;
  editorState.read(() => {
    serializedNode = getFullNodeJSON(node);
  });
  if (!serializedNode) {
    logger.error("[AutosavePlugin] getContent: exportJSON failed", undefined, { nodeKey: node.__key });
  }
  return serializedNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fractional indexing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a new fractional index for `node` based on its neighbours'
 * positions stored in `dynamicState`.
 *
 * Walks backwards/forwards through siblings if the immediate neighbour
 * doesn't have a position yet (e.g. during a batch add).
 */
export function generateIndex(
  node: LexicalNode | null,
  dynamicState: React.RefObject<Map<string, NodeStateType>>
): string {
  if (!node) return generateKeyBetween(null, null);

  const prevNode = node.getPreviousSibling();
  const nextNode = node.getNextSibling();

  let prevPosition: string | null = null;
  let nextPosition: string | null = null;

  if (prevNode) {
    const data = dynamicState.current.get(prevNode.__key);
    if (data && data.position !== "") {
      prevPosition = data.position;
    } else {
      let prev = prevNode.getPreviousSibling();
      while (prev) {
        const d = dynamicState.current.get(prev.__key);
        if (d && d.position !== "") {
          prevPosition = d.position;
          break;
        }
        prev = prev.getPreviousSibling();
      }
    }
  }

  if (nextNode) {
    const data = dynamicState.current.get(nextNode.__key);
    if (data && data.position !== "") {
      nextPosition = data.position;
    } else {
      let next = nextNode.getNextSibling();
      while (next) {
        const d = dynamicState.current.get(next.__key);
        if (d && d.position !== "") {
          nextPosition = d.position;
          break;
        }
        next = next.getNextSibling();
      }
    }
  }

  // Guard against inverted positions (can happen during rapid reordering)
  if (prevPosition && nextPosition && prevPosition >= nextPosition) {
    return generateKeyBetween(nextPosition, null);
  }

  try {
    return generateKeyBetween(prevPosition, nextPosition);
  } catch {
    return generateKeyBetween(null, null);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Move detection helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface SiblingSnapshot {
  prevKey: string | null;
  nextKey: string | null;
}

/**
 * Reads the current previous/next sibling keys of a node from the editor state.
 * Call this inside an editorState.read() context.
 */
export function getSiblingSnapshot(
  node: LexicalNode
): SiblingSnapshot {
  return {
    prevKey: node.getPreviousSibling()?.__key ?? null,
    nextKey: node.getNextSibling()?.__key ?? null,
  };
}

/**
 * Returns true if the node has moved relative to its previous sibling snapshot.
 */
export function hasMoved(
  current: SiblingSnapshot,
  previous: SiblingSnapshot,
  node: LexicalNode,
  dynamicState: React.RefObject<Map<string, NodeStateType>>
): boolean {
  if (
    current.prevKey === previous.prevKey &&
    current.nextKey === previous.nextKey
  ) {
    return false;
  }

  let prevPosition: string | null = null;
  let p = node.getPreviousSibling();
  while (p && !prevPosition) {
    const d = dynamicState.current.get(p.__key);
    if (d && d.position) prevPosition = d.position;
    p = p.getPreviousSibling();
  }

  let nextPosition: string | null = null;
  let n = node.getNextSibling();
  while (n && !nextPosition) {
    const d = dynamicState.current.get(n.__key);
    if (d && d.position) nextPosition = d.position;
    n = n.getNextSibling();
  }

  const state = dynamicState.current.get(node.__key);
  const currentPos = state?.position;

  if (!currentPos) return true;

  const isOrderValid =
    (!prevPosition || prevPosition < currentPos) &&
    (!nextPosition || currentPos < nextPosition);

  return !isOrderValid;
}

/**
 * Walks up the parent chain of a deep node until it reaches a
 * direct child of root, and returns that ancestor node.
 */
export function getParentFromDeep(targetNode: LexicalNode | null): LexicalNode | null {
  if (!targetNode || targetNode.__key === "root") return null;
  
  let current = targetNode;
  while (current) {
    const parentNode = current.getParent();
    if (parentNode?.__key === "root") {
      break;
    }
    if (parentNode) {
      current = parentNode;
    } else {
      // Node is likely detached
      return null;
    }
  }
  return current;
}
