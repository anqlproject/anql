import {
  $createParagraphNode,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  ParagraphNode,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from "lexical";

export type ListType = "number" | "bullet" | "check";

export type SerializedListNode = Spread<
  {
    listType: ListType;
    checked?: boolean;
    listNumber?: number;
    $?: Record<string, unknown>;
  },
  SerializedElementNode
>;

export class ListNode extends ElementNode {
  __listType: ListType;
  __checked?: boolean;
  __customProps?: Record<string, unknown>;
  __listNumber: number;

  static getType(): string {
    return "list";
  }

  static clone(node: ListNode): ListNode {
    const cloned = new ListNode(
      node.__listType,
      node.__checked,
      node.__customProps,
      node.__key,
    );
    cloned.__listNumber = node.__listNumber;
    return cloned;
  }

  constructor(
    listType: ListType,
    checked?: boolean,
    customProps?: Record<string, unknown>,
    key?: NodeKey,
  ) {
    super(key);
    this.__listType = listType;
    this.__checked = checked;
    this.__customProps = customProps;
    this.__listNumber = 1;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement("p");
    dom.className = `list-item list-${this.__listType}`;
    if (this.__listType === "number") {
      dom.dataset.listNumber = String(this.__listNumber);
    }
    if (this.__listType === "check" && this.__checked) {
      dom.classList.add("list-checked");
    }
    // Set indent level for CSS styling
    const indent = this.getIndent();
    if (indent > 0) {
      dom.dataset.indent = String(indent);
    }
    return dom;
  }

  updateDOM(
    prevNode: ListNode,
    dom: HTMLElement
  ): boolean {
    if (prevNode.__listType !== this.__listType) {
      dom.className = `list-item list-${this.__listType}`;
    }
    if (this.__listType === "number") {
      dom.dataset.listNumber = String(this.__listNumber);
    } else {
      delete dom.dataset.listNumber;
    }
    if (this.__listType === "check") {
      if (this.__checked !== prevNode.__checked) {
        if (this.__checked) {
          dom.classList.add("list-checked");
        } else {
          dom.classList.remove("list-checked");
        }
      }
    } else {
      dom.classList.remove("list-checked");
    }
    // Update indent level
    const currentIndent = this.getIndent();
    const prevIndent = prevNode.getIndent();
    if (currentIndent !== prevIndent) {
      if (currentIndent > 0) {
        dom.dataset.indent = String(currentIndent);
      } else {
        delete dom.dataset.indent;
      }
    }
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      ol: (/*node: Node*/) => ({
        conversion: convertListWrapperElement,
        priority: 0,
      }),
      ul: (/*node: Node*/) => ({
        conversion: convertListWrapperElement,
        priority: 0,
      }),
      li: (/*node: Node*/) => ({
        conversion: convertListItemElement,
        priority: 0,
      }),
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);
    if (element && element instanceof HTMLElement) {
      if (this.__listType === 'check') {
        element.setAttribute('aria-checked', this.__checked ? 'true' : 'false');
      }
      if (this.__listType === 'number') {
        element.setAttribute('value', String(this.__listNumber));
      }
    }
    return { element };
  }

  static importJSON(serializedNode: SerializedListNode): ListNode {
    const node = $createListNode(
      serializedNode.listType,
      serializedNode.checked,
      serializedNode.$,
    );
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    if (serializedNode.listNumber !== undefined) {
      node.setListNumber(serializedNode.listNumber);
    }
    return node;
  }

  exportJSON(): SerializedListNode {
    const baseJson = super.exportJSON();
    return {
      ...baseJson,
      listType: this.__listType,
      checked: this.__checked,
      listNumber: this.__listNumber,
      $: this.__customProps,
      type: "list",
      version: 1,
    };
  }

  getListType(): ListType {
    const self = this.getLatest();
    return self.__listType;
  }

  setListType(listType: ListType): this {
    const self = this.getWritable();
    self.__listType = listType;
    return self;
  }

  getListNumber(): number {
    const self = this.getLatest();
    return self.__listNumber;
  }

  setListNumber(listNumber: number): this {
    const self = this.getWritable();
    self.__listNumber = listNumber;
    return self;
  }

  getChecked(): boolean | undefined {
    const self = this.getLatest();
    return self.__checked;
  }

  setChecked(checked: boolean): this {
    const self = this.getWritable();
    self.__checked = checked;
    return self;
  }

  toggleChecked(): this {
    const self = this.getWritable();
    self.__checked = !self.__checked;
    return self;
  }

  insertNewAfter(
    _selection: RangeSelection,
    restoreSelection?: boolean,
  ): ParagraphNode | ListNode | null {
    if (this.isEmpty()) {
      const paragraph = $createParagraphNode();
      this.replace(paragraph);
      return paragraph;
    }

    const newElement = $createListNode(this.__listType, false);
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
    for (let i = 0; i < children.length; i++) {
      paragraph.append(children[i]);
    }
    this.replace(paragraph);
    return true;
  }

  extractWithChild(
    child: LexicalNode,
    _selection: import("lexical").BaseSelection
  ): boolean {
    if (!_selection) {
      return false;
    }
    const isFirstChild = this.getFirstChild() === child;
    const isLastChild = this.getLastChild() === child;
    return !isFirstChild && !isLastChild;
  }
}

export function $createListNode(
  listType: ListType,
  checked?: boolean,
  customProps?: Record<string, unknown>,
): ListNode {
  return new ListNode(listType, checked, customProps);
}

export function $isListNode(
  node: LexicalNode | null | undefined,
): node is ListNode {
  return node instanceof ListNode;
}

function convertListWrapperElement(/*domNode: HTMLElement*/): DOMConversionOutput | null {
  // We don't create a wrapper node for ul/ol since ListNode is flat.
  // We just return a null node to let Lexical process its children.
  return { node: null };
}

function convertListItemElement(domNode: HTMLElement): DOMConversionOutput | null {
  const parent = domNode.parentNode;
  let listType: ListType = 'bullet';
  let checked: boolean | undefined = undefined;

  if (parent && parent.nodeName === 'OL') {
    listType = 'number';
  } else if (parent && parent.nodeName === 'UL') {
    listType = 'bullet';
    if (domNode.classList.contains('list-checked')) {
      listType = 'check';
      checked = true;
    } else if (
      domNode.getAttribute('aria-checked') === 'true' ||
      domNode.querySelector('input[type="checkbox"]:checked')
    ) {
      listType = 'check';
      checked = true;
    } else if (
      domNode.getAttribute('aria-checked') === 'false' ||
      domNode.querySelector('input[type="checkbox"]')
    ) {
      listType = 'check';
      checked = false;
    }
  }

  const node = $createListNode(listType, checked);

  let indent = 0;
  let curr = parent;
  while (curr && (curr.nodeName === 'UL' || curr.nodeName === 'OL' || curr.nodeName === 'LI')) {
    if (curr.nodeName === 'UL' || curr.nodeName === 'OL') {
      indent++;
    }
    curr = curr.parentNode;
  }
  if (indent > 0) indent--;
  node.setIndent(indent);

  if (listType === 'number') {
    let order = 1;
    const valueAttr = domNode.getAttribute('value');
    if (valueAttr) {
      const parsed = parseInt(valueAttr, 10);
      if (!isNaN(parsed)) order = parsed;
    } else if (parent && parent.nodeName === 'OL') {
      const start = (parent as HTMLOListElement).start;
      order = start !== undefined && start !== 0 ? start : 1;

      // Calculate order based on previous siblings
      let sibling = domNode.previousSibling;
      while (sibling) {
        if (sibling.nodeName === 'LI') order++;
        sibling = sibling.previousSibling;
      }
    }
    node.setListNumber(order);
  }

  return { node };
}
