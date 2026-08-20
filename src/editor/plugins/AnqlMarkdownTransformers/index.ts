/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  ElementTransformer,
  HEADING,
  isTableRowDivider,
  MULTILINE_ELEMENT_TRANSFORMERS,
  MultilineElementTransformer,
  QUOTE, TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  TextMatchTransformer,
  Transformer,
} from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $createTextNode, ElementNode, LexicalNode } from "lexical";

import {
  $createDateTimeNode,
  $isDateTimeNode,
  DateTimeNode,
} from "@/editor/nodes/DateTimeNode/DateTimeNode";
import {
  $createEquationNode,
  $isEquationNode,
  EquationNode,
} from "@/editor/nodes/EquationNode/EquationNode";
import {
  $createImageNode,
  $isImageNode,
  ImageNode,
} from "@/editor/nodes/ImageNode/ImageNode";
import {
  $createLinkNode,
  $isLinkNode,
  LinkNode,
} from "@/editor/nodes/LinkNode/LinkNode";
import {
  $createListNode,
  $isListNode,
  ListNode,
  ListType,
} from "@/editor/nodes/ListNode/ListNode";
import {
  $createMathExpNode,
  $isMathExpNode,
  MathExpNode,
} from "@/editor/nodes/MathNode/MathExpNode";
import {
  $createTableNode,
  $isTableNode,
  TableNode,
} from "@/editor/nodes/TableNode/TableNode";

const TABLE_ROW_REG_EXP = /^(?:\|)(.+)(?:\|)\s?$/;

const LIST_INDENT_SIZE = 4;
const CHECK_LIST_REGEX = /^(\s*)(?:-\s)?\s?(\[(\s|x)?\])\s/i;
const ORDERED_LIST_REGEX = /^(\s*)(\d{1,})\.\s/;
const UNORDERED_LIST_REGEX = /^(\s*)[-*+]\s/;

function getIndent(whitespaces: string): number {
  const tabs = whitespaces.match(/\t/g);
  const spaces = whitespaces.match(/ /g);

  let indent = 0;

  if (tabs) {
    indent += tabs.length;
  }

  if (spaces) {
    indent += Math.floor(spaces.length / LIST_INDENT_SIZE);
  }

  return indent;
}

const listReplace = (
  listType: ListType,
): ElementTransformer["replace"] => {
  return (parentNode, children, match, isImport) => {
    const checked = listType === "check" ? match[3] === "x" : undefined;
    const listNode = $createListNode(listType, checked);
    const indent = getIndent(match[1]);
    if (indent) {
      listNode.setIndent(indent);
    }
    listNode.append(...children);
    parentNode.replace(listNode);
    if (!isImport) {
      listNode.select(0, 0);
    }
  };
};

const listExport = (
  node: ListNode,
  exportChildren: (node: ElementNode) => string,
): string => {
  const indent = " ".repeat(node.getIndent() * LIST_INDENT_SIZE);
  const listType = node.getListType();
  const prefix =
    listType === "number"
      ? `${node.getListNumber()}. `
      : listType === "check"
        ? `- [${node.getChecked() ? "x" : " "}] `
        : "- ";
  return indent + prefix + exportChildren(node);
};

// Markdown: - [ ] text ou - [x] text
export const CHECK_LIST: ElementTransformer = {
  dependencies: [ListNode],
  export: (node, exportChildren) => {
    return $isListNode(node)
      ? listExport(node, exportChildren)
      : null;
  },
  regExp: CHECK_LIST_REGEX,
  replace: listReplace("check"),
  type: "element",
};

// Markdown: 1. text
export const ORDERED_LIST: ElementTransformer = {
  dependencies: [ListNode],
  export: (node, exportChildren) => {
    return $isListNode(node)
      ? listExport(node, exportChildren)
      : null;
  },
  regExp: ORDERED_LIST_REGEX,
  replace: listReplace("number"),
  type: "element",
};

// Markdown: - text, * text, ou + text
export const UNORDERED_LIST: ElementTransformer = {
  dependencies: [ListNode],
  export: (node, exportChildren) => {
    return $isListNode(node)
      ? listExport(node, exportChildren)
      : null;
  },
  regExp: UNORDERED_LIST_REGEX,
  replace: listReplace("bullet"),
  type: "element",
};

// Markdown: ---, ***, ou ___
export const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? "***" : null;
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }

    line.selectNext();
  },
  type: "element",
};

// Markdown: ![texte alternatif](url)
export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node)) {
      return null;
    }

    return `![${node.getAltText()}](${node.getSrc()})`;
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, src] = match;
    const imageNode = $createImageNode({
      altText,
      maxWidth: 800,
      src,
    });
    textNode.replace(imageNode);
  },
  trigger: ")",
  type: "text-match",
};

// Markdown: @math(expression)
export const MATH: ElementTransformer = {
  dependencies: [MathExpNode],
  export: (node, exportChildren) => {
    if (!$isMathExpNode(node)) {
      return null;
    }
    return `@math(${exportChildren(node)})`;
  },
  regExp: /^@math\(([^)]*)\)\s?$/,
  replace: (parentNode, _children, match, isImport) => {
    const [, expression] = match;
    const mathExpNode = $createMathExpNode();
    const textNode = $createTextNode(expression);
    mathExpNode.append(textNode);
    parentNode.replace(mathExpNode);
    if (!isImport) {
      mathExpNode.selectEnd();
    }
  },
  type: "element",
};

// Markdown: $$
export const MATH_BLOCK: ElementTransformer = {
  dependencies: [MathExpNode],
  export: (node, exportChildren) => {
    if (!$isMathExpNode(node)) {
      return null;
    }
    return `$$\n${exportChildren(node)}\n$$`;
  },
  regExp: /^\$\$\s?$/,
  replace: (parentNode, _children, _match, isImport) => {
    const mathExpNode = $createMathExpNode();
    parentNode.replace(mathExpNode);
    if (!isImport) {
      mathExpNode.select();
    }
  },
  type: "element",
};

// Markdown: [nom du lien](url)
export const LINK: TextMatchTransformer = {
  dependencies: [LinkNode],
  export: (node) => {
    if (!$isLinkNode(node)) {
      return null;
    }
    return `[${node.getName()}](${node.getUrl()})`;
  },
  importRegExp: /\[([^[]+)\]\(([^()]+)\)/,
  regExp: /\[([^[]+)\]\(([^()]+)\)$/,
  replace: (textNode, match) => {
    const [, name, url] = match;
    const linkNode = $createLinkNode(url, undefined, undefined, name);
    textNode.replace(linkNode);
  },
  trigger: ")",
  type: "text-match",
};

// Markdown: @date(2026-06-12T00:00:00Z)
export const DATETIME: TextMatchTransformer = {
  dependencies: [DateTimeNode],
  export: (node) => {
    if (!$isDateTimeNode(node)) {
      return null;
    }
    const dt = node.getDateTime() as Date;
    if (!dt || !dt.toISOString) return null;
    return `@date(${dt.toISOString()})`;
  },
  importRegExp: /@date\(([^)]+)\)/,
  regExp: /@date\(([^)]+)\)$/,
  replace: (textNode, match) => {
    const [, dateStr] = match;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const dateTimeNode = $createDateTimeNode(date);
      textNode.replace(dateTimeNode);
    }
  },
  trigger: ")",
  type: "text-match",
};

export const EQUATION: TextMatchTransformer = {
  dependencies: [EquationNode],
  export: (node) => {
    if (!$isEquationNode(node)) {
      return null;
    }

    return `$${node.getEquation()}$`;
  },
  importRegExp: /\$([^$]+?)\$/,
  regExp: /\$([^$]+?)\$$/,
  replace: (textNode, match) => {
    const [, equation] = match;
    const equationNode = $createEquationNode(equation, true);
    textNode.replace(equationNode);
  },
  trigger: "$",
  type: "text-match",
};

function parseMarkdownTableRow(line: string): string[] | null {
  const match = line.match(TABLE_ROW_REG_EXP);
  if (!match) {
    return null;
  }
  return match[1].split("|").map((cell) => cell.trim());
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function exportTableToMarkdown(node: TableNode): string {
  const { data, columns } = node.exportJSON();
  if (!columns || columns.length === 0) {
    return "";
  }

  const headerRow =
    "| " +
    columns
      .map((col) =>
        escapeMarkdownTableCell(
          String(col.header ?? col.accessorKey ?? col.id ?? ""),
        ),
      )
      .join(" | ") +
    " |";
  const dividerRow = "| " + columns.map(() => "---").join(" | ") + " |";
  const dataRows = (data || []).map((row) => {
    const cells = columns.map((col) => {
      const key = col.accessorKey ?? col.id;
      const value = row[key];
      return escapeMarkdownTableCell(
        value !== undefined && value !== null ? String(value) : "",
      );
    });
    return `| ${cells.join(" | ")} |`;
  });

  return [headerRow, dividerRow, ...dataRows].join("\n");
}

export const TABLE: MultilineElementTransformer = {
  dependencies: [TableNode],
  export: (node) => {
    return $isTableNode(node) ? exportTableToMarkdown(node) : null;
  },
  regExpStart: TABLE_ROW_REG_EXP,
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const headerCells = parseMarkdownTableRow(lines[startLineIndex]);
    if (!headerCells) {
      return null;
    }

    const tableLines: string[] = [lines[startLineIndex]];
    let endIndex = startLineIndex;

    for (let i = startLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!TABLE_ROW_REG_EXP.test(line)) {
        break;
      }
      tableLines.push(line);
      endIndex = i;
    }

    if (tableLines.length < 2 || !isTableRowDivider(tableLines[1])) {
      return null;
    }

    const columns = headerCells.map((header, index) => ({
      header,
      accessorKey: `col_${index}`,
      meta: { type: "text" },
    }));

    const data: Record<string, string>[] = [];
    for (let i = 2; i < tableLines.length; i++) {
      const cells = parseMarkdownTableRow(tableLines[i]);
      if (!cells) {
        continue;
      }
      const rowData: Record<string, string> = {};
      columns.forEach((col, index) => {
        rowData[col.accessorKey] = cells[index] ?? "";
      });
      data.push(rowData);
    }

    rootNode.append($createTableNode(data, columns));
    return [true, endIndex];
  },
  replace: () => { },
  type: "multiline-element",
};

export const ANQL_MARKDOWN_TRANSFORMERS: Array<Transformer> = [
  HR,
  IMAGE,
  MATH,
  MATH_BLOCK,
  EQUATION,
  LINK,
  DATETIME,
  CHECK_LIST,
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  TABLE,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

export const anqlMarkdownTransformersGetTransformers = (useBrackets: boolean): Array<Transformer> => {
  if (useBrackets) {
    return ANQL_MARKDOWN_TRANSFORMERS;
  }

  // Filter out HIGHLIGHT transformer when useBrackets is false
  return ANQL_MARKDOWN_TRANSFORMERS.filter(
    (transformer) =>
      !(transformer.type === 'text-format' &&
        (transformer as any).format?.includes('highlight'))
  );
};
