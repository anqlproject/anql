import { evaluate } from 'mathjs';

import { MathEvaluationResult } from '@/editor/context/MathVariablesContext';
import { MathExpNode } from '@/editor/nodes/MathNode/MathExpNode';

export interface EvaluationOutput {
  results: Record<string, MathEvaluationResult>;
  variables: Record<string, number>;
  scopes: Record<string, Record<string, number>>;
}

const DIVISION_BY_ZERO = /\/\s*0(?![0-9])/;

// Matches "TableName.colName" patterns where TableName starts with uppercase
const DOT_ACCESS_PATTERN = /\b([A-Z][a-zA-Z0-9_]*)\.([a-zA-Z0-9_]*)/g;

/**
 * Detects table-specific errors in the expression and returns a user-friendly
 * message. Runs BEFORE mathjs so the user sees clear messages instead of
 * cryptic mathjs errors like "undefined".
 *
 * Also returns a suggestion string when the user typed just a table name
 * or an incomplete "Table." accessor.
 */
function checkTableIssues(
  expr: string,
  tableVariables: Record<string, Record<string, number[]>>
): string | null {
  const tableNames = Object.keys(tableVariables);
  if (tableNames.length === 0) return null;

  // Case 1: expression is exactly a known table name → suggest columns as an info "error"
  const exactTable = tableNames.find(name => expr === name);
  if (exactTable) {
    const cols = Object.keys(tableVariables[exactTable]);
    if (cols.length === 0) return `Table '${exactTable}' has no numeric columns.`;
    return `Table '${exactTable}' exists. Use ${exactTable}.ColumnName[index] or sum(${exactTable}.ColumnName). Available columns: ${cols.join(', ')}`;
  }

  // Case 2: expression starts with "KnownTable." but column is incomplete/missing
  const partialTable = tableNames.find(name => expr.startsWith(name + '.'));
  if (partialTable) {
    const afterDot = expr.slice(partialTable.length + 1);
    const cols = Object.keys(tableVariables[partialTable]);
    if (!cols.includes(afterDot)) {
      if (cols.length === 0) return `Table '${partialTable}' has no numeric columns.`;
      return `Column not found or incomplete. Available columns for '${partialTable}': ${cols.join(', ')}`;
    }
  }

  // Case 3: expression contains "UppercaseName.something" pattern — validate it
  DOT_ACCESS_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DOT_ACCESS_PATTERN.exec(expr)) !== null) {
    const potentialTable = match[1];
    const potentialCol = match[2];

    if (!tableNames.includes(potentialTable)) {
      return `Table '${potentialTable}' does not exist. Please check the name.`;
    }

    if (potentialCol) {
      const cols = Object.keys(tableVariables[potentialTable]);
      if (!cols.includes(potentialCol)) {
        return `Column '${potentialCol}' not found in '${potentialTable}'. Available columns: ${cols.join(', ')}`;
      }
    }
  }

  return null;
}

/**
 * Pure evaluation function — no React, no Lexical editor dependency.
 * Takes an ordered list of MathExpNodes and evaluates them sequentially,
 * accumulating variables in scope as the document progresses.
 *
 * Must be called inside a Lexical read callback.
 */
export function evaluateAllMathNodes(nodes: MathExpNode[], tableVariables: Record<string, Record<string, number[]>> = {}): EvaluationOutput {
  const results: Record<string, MathEvaluationResult> = {};
  const variables: Record<string, number> = {};
  const scopes: Record<string, Record<string, number>> = {};

  const scope: Record<string, any> = { ...tableVariables };

  for (const node of nodes) {
    const key = node.__key;

    // Snapshot the variables available AT THIS POINT in the document
    scopes[key] = { ...scope };

    const expr = node.getTextContent();

    if (!expr.trim()) {
      results[key] = { result: '', error: null };
      continue;
    }

    // Check for table-specific messages BEFORE mathjs
    const tableMessage = checkTableIssues(expr.trim(), tableVariables);
    if (tableMessage !== null) {
      results[key] = { result: '', error: tableMessage };
      continue;
    }

    try {
      const assignMatch = expr.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.+)$/);

      if (assignMatch) {
        const name = assignMatch[1].trim();
        const valueExpr = assignMatch[2].trim();

        if (valueExpr.includes('/0') || DIVISION_BY_ZERO.test(valueExpr)) {
          throw new Error('Division by zero');
        }

        const val = evaluate(valueExpr, scope);
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
          throw new Error('Invalid value');
        }

        scope[name] = val;
        variables[name] = val;
        results[key] = { result: `${name} = ${val}`, error: null };
      } else {
        if (expr.includes('/0') || DIVISION_BY_ZERO.test(expr)) {
          throw new Error('Division by zero');
        }

        const val = evaluate(expr, scope);
        if (typeof val === 'number' && !isFinite(val)) {
          throw new Error('Invalid value');
        }

        results[key] = { result: `= ${val}`, error: null };
      }
    } catch (e: any) {
      results[key] = { result: '', error: e.message };
    }
  }

  return { results, variables, scopes };
}
