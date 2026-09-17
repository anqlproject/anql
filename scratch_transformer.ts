// We'll replace MATH_BLOCK with EQUATION_BLOCK
export const EQUATION_BLOCK: ElementTransformer = {
  dependencies: [EquationNode],
  export: (node) => {
    if (!$isEquationNode(node)) {
      return null;
    }
    if (node.__inline) return null;
    return `$$\n${node.getEquation()}\n$$`;
  },
  regExp: /^\$\$\s?$/,
  replace: (parentNode, _children, _match, isImport) => {
    const equationNode = $createEquationNode('', false);
    // parentNode is likely a ParagraphNode. If we clear it and append, it remains a paragraph
    // But block equations in Lexical are often just nodes inside a paragraph.
    parentNode.clear();
    parentNode.append(equationNode);
    if (!isImport) {
      equationNode.select();
    }
  },
  type: "element",
};
