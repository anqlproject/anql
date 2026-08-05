import type {
  DOMConversionMap,
  DOMConversionOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import {$applyNodeReplacement, DecoratorNode} from 'lexical';
import type {JSX} from 'react';
import * as React from 'react';

const PdfComponent = React.lazy(() => import('./PdfComponent.tsx'));

export type SerializedPdfNode = Spread<
  {
    url: string;
    name: string;
  },
  SerializedLexicalNode
>;

function $convertPdfElement(
  domNode: HTMLElement,
): null | DOMConversionOutput {
  const url = domNode.getAttribute('data-lexical-pdf-url');
  const name = domNode.getAttribute('data-lexical-pdf-name');
  if (url) {
    const node = $createPdfNode(url, name || '');
    return {node};
  }

  return null;
}

export class PdfNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __name: string;

  static getType(): string {
    return 'pdf';
  }

  static clone(node: PdfNode): PdfNode {
    return new PdfNode(node.__url, node.__name, node.__key);
  }

  constructor(url = '', name = '', key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__name = name;
  }

  static importJSON(serializedNode: SerializedPdfNode): PdfNode {
    return $createPdfNode(
      serializedNode.url,
      serializedNode.name,
    ).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedPdfNode {
    return {
      ...super.exportJSON(),
      url: this.getUrl(),
      name: this.getName(),
    };
  }

  createDOM(): HTMLElement {
    const element = document.createElement('span');
    element.className = 'editor-pdf';
    return element;
  }

  exportDOM(): {element: HTMLElement} {
    const element = document.createElement('span');
    element.setAttribute('data-lexical-pdf-url', this.__url);
    element.setAttribute('data-lexical-pdf-name', this.__name);
    return {element};
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-pdf-url')) {
          return null;
        }
        return {
          conversion: $convertPdfElement,
          priority: 1,
        };
      },
    };
  }

  updateDOM(): boolean {
    return false;
  }

  getTextContent(): string {
    return this.__name || this.__url;
  }

  getUrl(): string {
    return this.__url;
  }

  setUrl(url: string): void {
    const writable = this.getWritable();
    writable.__url = url;
  }

  getName(): string {
    return this.__name;
  }

  setName(name: string): void {
    const writable = this.getWritable();
    writable.__name = name;
  }

  decorate(): JSX.Element {
    return (
      <PdfComponent
        url={this.__url}
        name={this.__name}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createPdfNode(
  url = '',
  name = '',
): PdfNode {
  const pdfNode = new PdfNode(url, name);
  return $applyNodeReplacement(pdfNode);
}

export function $isPdfNode(
  node: LexicalNode | null | undefined,
): node is PdfNode {
  return node instanceof PdfNode;
}
