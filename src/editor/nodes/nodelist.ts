import PlaygroundNodes from './anqlNodes';

// Built-in Lexical core nodes
const coreNodes = [
  'root',
  'paragraph',
  'text',
  'linebreak',
  'tab'
];

// Combine core nodes with all custom nodes registered in PlaygroundNodes
export const AppNodeTypes = new Set([
  ...coreNodes,
  ...PlaygroundNodes.map(NodeClass => NodeClass.getType())
]);
