import { $getRoot, LexicalNode, RootNode } from 'lexical';

import { $isMathExpNode, MathExpNode } from '@/editor/nodes/MathNode/MathExpNode';

function traverse(node: LexicalNode, acc: MathExpNode[]): void {
  if ($isMathExpNode(node)) {
    acc.push(node);
  }
  if ('getChildren' in node) {
    const children = (node as any).getChildren();
    for (const child of children) {
      traverse(child, acc);
    }
  }
}

/**
 * Returns all MathExpNodes in document order from a given root.
 * Must be called inside a Lexical read/update callback.
 */
export function $getAllMathNodes(root?: RootNode): MathExpNode[] {
  const nodes: MathExpNode[] = [];
  traverse(root ?? $getRoot(), nodes);
  return nodes;
}
