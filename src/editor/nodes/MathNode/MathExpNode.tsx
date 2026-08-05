import './MathComponent.css';

import { $createParagraphNode, DOMConversionMap, DOMConversionOutput, DOMExportOutput, EditorConfig, ElementNode, LexicalEditor, LexicalNode, NodeKey, ParagraphNode, RangeSelection, SerializedElementNode, Spread } from 'lexical';

import i18n from '@/core/locales';

export type SerializedMathExpNode = Spread<
  {
    type: 'mathexp';
    version: number;
    result?: string;
    error?: string | null;
  },
  SerializedElementNode
>;

export class MathExpNode extends ElementNode {
  static getType(): string {
    return 'mathexp';
  }

  static clone(node: MathExpNode): MathExpNode {
    const cloned = new MathExpNode(node.__key);
    return cloned;
  }

  insertNewAfter(_selection: RangeSelection, restoreSelection?: boolean): ParagraphNode | MathExpNode {
    if (this.isEmpty()) {
      const paragraph = $createParagraphNode();
      this.replace(paragraph);
      return paragraph;
    }

    const newElement = $createMathExpNode();
    const direction = this.getDirection();
    newElement.setDirection(direction);
    newElement.setFormat(this.getFormatType());
    newElement.setIndent(this.getIndent());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  collapseAtStart(): boolean {
    const paragraph = $createParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => paragraph.append(child));
    this.replace(paragraph);
    return true;
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement('div');
    const theme = config.theme;
    const baseClassName = theme?.mathComponent || 'math-component';
    const nodeClassName = theme?.mathExpNode || 'math-exp-node';
    dom.className = `${baseClassName} ${nodeClassName}`;
    // Add placeholder when node is empty
    dom.classList.add('is-empty');
    dom.setAttribute('data-placeholder', i18n.t('NODES.math'));

    return dom;
  }

  updateDOM(): boolean {
    return false; // Lexical manages the children (text nodes)
  }

  exportJSON(): SerializedMathExpNode {
    return {
      ...super.exportJSON(),
      type: 'mathexp',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedMathExpNode & { $?: { id?: string; position?: string; node_type?: string } }): MathExpNode {
    const node = $createMathExpNode();
    // Preserve all custom metadata (including $ field) via updateFromJSON
    return node.updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.classList.contains('math-exp-node')) {
          return null;
        }
        return {
          conversion: convertMathExpElement,
          priority: 1,
        };
      },
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);
    if (element && element instanceof HTMLElement) {
      element.classList.add('math-component', 'math-exp-node');
    }
    return { element };
  }
}

export function $createMathExpNode(): MathExpNode {
  return new MathExpNode();
}

export function $isMathExpNode(
  node: LexicalNode | null | undefined,
): node is MathExpNode {
  return node instanceof MathExpNode;
}

function convertMathExpElement(): DOMConversionOutput {
  const node = $createMathExpNode();
  return { node };
}