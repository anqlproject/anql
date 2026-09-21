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
  QUOTE,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  TextMatchTransformer,
  Transformer,
} from "@lexical/markdown";
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { $createTextNode, $getRoot, ElementNode, LexicalNode } from "lexical";

import {
  $createChartNode,
  $isChartNode,
  ChartNode,
  ChartNodeConfig,
} from "@/editor/nodes/ChartNode/ChartNode";
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
import { evaluateAllMathNodes, EvaluationItem } from "@/editor/plugins/MathPlugin/evaluator";
import { $getMathAndTableNodes } from "@/editor/plugins/MathPlugin/traversal";

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

// Markdown: - [ ] text or - [x] text
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

// Markdown: - text, * text, or + text
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

// Markdown: ---, ***, or ___
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

// Markdown: ![alt text](url)
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

    const root = $getRoot();
    const mathAndTableNodes = $getMathAndTableNodes(root);

    const evaluationItems: EvaluationItem[] = [];
    let tableIndex = 0;

    mathAndTableNodes.forEach((tNode) => {
      if ($isTableNode(tNode)) {
        const rawName = (tNode as any).__tableName || `Table_${tableIndex + 1}`;
        tableIndex++;
        const safeTableName = rawName.replace(/[^a-zA-Z0-9_]/g, '');
        if (!safeTableName) {
          evaluationItems.push({ type: 'table', name: '', data: null });
          return;
        }

        const tableData: Record<string, number[]> = {};

        (tNode as any).__columns.forEach((col: any) => {
          if (col.meta?.type === 'number') {
            const safeHeader = (col.header || col.id).replace(/[^a-zA-Z0-9_]/g, '');
            if (safeHeader) {
              tableData[safeHeader] = (tNode as any).__data.map((row: any) => {
                const val = row[col.id];
                const num = Number(val);
                return isNaN(num) ? 0 : num;
              });
            }
          }
        });

        if (Object.keys(tableData).length > 0) {
          evaluationItems.push({ type: 'table', name: safeTableName, data: tableData });
        } else {
          evaluationItems.push({ type: 'table', name: safeTableName, data: null });
        }
      } else {
        evaluationItems.push({ type: 'math', node: tNode as any });
      }
    });

    const { results } = evaluateAllMathNodes(evaluationItems);
    const res = results[node.getKey()];
    const expression = exportChildren(node).trim();

    if (res && res.result) {
      if (expression.includes('=')) {
        return res.result;
      } else {
        return `${expression} ${res.result}`;
      }
    }

    return expression;
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

function escapeInlineEquation(equation: string): string {
  return equation.replace(/([\\$])/g, '\\$1');
}

function unescapeInlineEquation(equation: string): string {
  return equation.replace(/\\([\\$])/g, '$1');
}

// Markdown: $$\nequation\n$$
export const BLOCK_EQUATION: MultilineElementTransformer = {
  dependencies: [EquationNode],
  export: (node) => {
    if (!$isEquationNode(node) || node.__inline) {
      return null;
    }
    return `$$\n${node.getEquation()}\n$$`;
  },
  regExpEnd: /^\$\$\s*$/,
  regExpStart: /^\$\$\s*$/,
  replace: (rootNode, _children, _startMatch, _endMatch, linesInBetween) => {
    const equationLines = linesInBetween ?? [];
    if (equationLines[0] === '') equationLines.shift();
    if (equationLines[equationLines.length - 1] === '') equationLines.pop();
    rootNode.append($createEquationNode(equationLines.join('\n'), false));
  },
  type: "multiline-element",
};

// Markdown: [link name](url)
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

// Markdown: $x$ (inline)
export const EQUATION: TextMatchTransformer = {
  dependencies: [EquationNode],
  export: (node) => {
    if (!$isEquationNode(node) || !node.__inline) {
      return null;
    }
    return `$${escapeInlineEquation(node.getEquation())}$`;
  },
  importRegExp: /\$((?:\\.|[^$\\\n])+?)\$/,
  regExp: /^\$\$([^$]+?)\$\$$|(?:^|[^$])\$((?:\\.|[^$\\\n])+?)\$$/,
  replace: (textNode, match) => {
    const [, firstEquation, secondEquation] = match;
    const isInline = !match[0].startsWith('$$');
    const equation = firstEquation ?? secondEquation;
    const equationNode = isInline
      ? $createEquationNode(unescapeInlineEquation(equation), true)
      : new EquationNode(equation, false);
    if (isInline) {
      const prefix =
        match[0][0] === '$' || match[0][0] === '\\' ? '' : match[0][0];
      if (prefix === '') {
        textNode.replace(equationNode);
      } else {
        textNode.setTextContent(prefix);
        textNode.insertAfter(equationNode);
      }
    } else {
      textNode.getParentOrThrow().replace(equationNode);
    }
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
          String(col.header ?? col.id ?? ""),
        ),
      )
      .join(" | ") +
    " |";
  const dividerRow = "| " + columns.map(() => "---").join(" | ") + " |";
  const dataRows = (data || []).map((row) => {
    const cells = columns.map((col) => {
      const key = col.id;
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
      id: `col_${index}`,
      meta: { type: "text" as const },
    }));

    const data: Record<string, string>[] = [];
    for (let i = 2; i < tableLines.length; i++) {
      const cells = parseMarkdownTableRow(tableLines[i]);
      if (!cells) {
        continue;
      }
      const rowData: Record<string, string> = {};
      columns.forEach((col, index) => {
        rowData[col.id] = cells[index] ?? "";
      });
      data.push(rowData);
    }

    rootNode.append($createTableNode(data, columns));
    return [true, endIndex];
  },
  replace: () => { },
  type: "multiline-element",
};

function parseChartOptionValue(value: string): string {
  return value.trim();
}

export function parseChartNodeConfig(raw: string): Partial<ChartNodeConfig> | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^@chart\((.*)\)$/s);
  if (!match) {
    return null;
  }

  const inner = match[1].trim();
  if (!inner) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const part of inner.split(';')) {
    const entry = part.trim();
    if (!entry || !entry.includes('=')) {
      continue;
    }
    const index = entry.indexOf('=');
    const key = entry.slice(0, index).trim();
    const value = parseChartOptionValue(entry.slice(index + 1));
    if (key) {
      params[key] = value;
    }
  }

  const yValue = params.y ?? '';
  const yColumns = yValue
    ? yValue.split(',').map((column) => column.trim()).filter(Boolean)
    : [];

  if (!params.type || !params.table || !params.x || yColumns.length === 0) {
    return null;
  }

  return {
    chartType: (params.type as ChartNodeConfig['chartType']) || 'line',
    tableName: params.table,
    xColumn: params.x,
    yColumns,
    yAggregation: 'value',
    categoryColumn: params.x,
    valueColumn: yColumns[0] || '',
    colorPalette: 'default',
    yBeginAtZero: true,
  };
}

export function exportChartToMarkdown(config: Partial<ChartNodeConfig>): string {
  const chartType = config.chartType || 'line';
  const tableName = config.tableName || 'Table';
  const xColumn = config.xColumn || '';
  const yColumns = Array.isArray(config.yColumns) && config.yColumns.length > 0
    ? config.yColumns
    : [config.valueColumn || 'value'];

  return `@chart(type=${chartType}; table=${tableName}; x=${xColumn}; y=${yColumns.join(',')})`;
}

export const CHART: ElementTransformer = {
  dependencies: [ChartNode],
  export: (node) => {
    if (!$isChartNode(node)) {
      return null;
    }
    return exportChartToMarkdown(node.getConfig());
  },
  regExp: /^@chart\((.*)\)\s?$/s,
  replace: (parentNode, _children, match, isImport) => {
    const parsed = parseChartNodeConfig(match[0]);
    if (!parsed) {
      return;
    }

    const chartNode = $createChartNode(parsed);
    parentNode.replace(chartNode);
    if (!isImport) {
      chartNode.selectNext();
    }
  },
  type: "element",
};

export const ANQL_MARKDOWN_TRANSFORMERS: Array<Transformer> = [
  HR,
  IMAGE,
  MATH,
  BLOCK_EQUATION,
  EQUATION,
  LINK,
  DATETIME,
  CHECK_LIST,
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHART,
  TABLE,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  // Exclude the native Lexical LINK transformer (depends on @lexical/link's _LinkNode with type 'link')
  // because we handle all link creation via our own 'anql-link' node.
  ...TEXT_MATCH_TRANSFORMERS.filter((t) => !t.dependencies?.some((d) => (d as any).getType?.() === 'link')),
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
