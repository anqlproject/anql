import { DecoratorNode, DOMConversionMap, DOMConversionOutput, EditorConfig, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import React, { JSX } from 'react';

const LinkNodeComponent = React.lazy(() => import('./LinkNodeComponent'));

export type LinkType = 'external' | 'document' | 'node' | 'row';

export type SerializedLinkNode = Spread<
  {
    url: string;
    linkType: LinkType;
    targetId: string;
    name: string;
    type: 'link';
    version: number;
  },
  SerializedLexicalNode
>;

export class LinkNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __linkType: LinkType;
  __targetId: string;
  __name: string;

  static getType(): string {
    return 'link';
  }

  static clone(node: LinkNode): LinkNode {
    return new LinkNode(node.__url, node.__linkType, node.__targetId, node.__name, node.__key);
  }

  constructor(url = '', linkType: LinkType = 'external', targetId = '', name = '', key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__linkType = linkType;
    this.__targetId = targetId;
    this.__name = name;
  }

  destroy(): void {
    this.__url = '';
    this.__linkType = 'external';
    this.__targetId = '';
    this.__name = '';
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const className = config.theme.link;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  setUrl(url: string): void {
    const writable = this.getWritable();
    writable.__url = url;
  }

  getUrl(): string {
    return this.__url;
  }

  setLinkType(linkType: LinkType): void {
    const writable = this.getWritable();
    writable.__linkType = linkType;
  }

  getLinkType(): LinkType {
    return this.__linkType;
  }

  setTargetId(targetId: string): void {
    const writable = this.getWritable();
    writable.__targetId = targetId;
  }

  getTargetId(): string {
    return this.__targetId;
  }

  setName(name: string): void {
    const writable = this.getWritable();
    writable.__name = name;
  }

  getName(): string {
    return this.__name;
  }

  decorate(): JSX.Element {
    return (
      <LinkNodeComponent
        nodeKey={this.__key}
        url={this.__url}
        linkType={this.__linkType}
        targetId={this.__targetId}
        name={this.__name}
      />
    );
  }

  exportJSON(): SerializedLinkNode {
    return {
      url: this.__url,
      linkType: this.__linkType,
      targetId: this.__targetId,
      name: this.__name,
      type: 'link',
      version: 1,
    };
  }

  static importJSON(serializedNode: SerializedLinkNode): LinkNode {
    return $createLinkNode(serializedNode.url, serializedNode.linkType, serializedNode.targetId, serializedNode.name || '');
  }

  static importDOM(): DOMConversionMap | null {
    return {
      a: (domNode: HTMLElement) => {
        if (domNode.hasAttribute('data-lexical-link')) {
          // Our own serialized link — full fidelity conversion
          return {
            conversion: convertLinkElement,
            priority: 1,
          };
        }
        // Any other <a> tag pasted from external sources (chatbots, web pages…)
        // → create an external link so @lexical/link's _LinkNode is never needed
        return {
          conversion: convertExternalAnchor,
          priority: 0,
        };
      },
    };
  }

  exportDOM(): { element: HTMLElement } {
    const element = document.createElement('a');
    element.setAttribute('data-lexical-link', 'true');
    element.setAttribute('href', this.__url);
    element.setAttribute('data-link-type', this.__linkType);
    element.setAttribute('data-target-id', this.__targetId);
    element.setAttribute('data-name', this.__name);
    element.textContent = this.__name || this.__url;
    return { element };
  }
}

export function $createLinkNode(url = '', linkType: LinkType = 'external', targetId = '', name = ''): LinkNode {
  return new LinkNode(url, linkType, targetId, name);
}

export function $isLinkNode(
  node: LexicalNode | null | undefined,
): node is LinkNode {
  return node instanceof LinkNode;
}

function convertLinkElement(domNode: HTMLElement): DOMConversionOutput {
  const url = domNode.getAttribute('href') || '';
  const linkType = (domNode.getAttribute('data-link-type') as LinkType) || 'external';
  const targetId = domNode.getAttribute('data-target-id') || '';
  const name = domNode.getAttribute('data-name') || '';
  const node = $createLinkNode(url, linkType, targetId, name);
  return { node };
}

/** Converts any plain <a> tag (e.g. from chatbots or web pages) to an external link node. */
function convertExternalAnchor(domNode: HTMLElement): DOMConversionOutput {
  const url = domNode.getAttribute('href') || '';
  const name = domNode.textContent?.trim() || url;
  const node = $createLinkNode(url, 'external', '', name);
  return { node };
}


declare module 'lexical' {
  interface LexicalTheme {
    link?: string;
  }
}
