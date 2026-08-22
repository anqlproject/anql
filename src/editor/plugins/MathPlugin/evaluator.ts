import { evaluate } from 'mathjs';

import { MathEvaluationResult } from '@/editor/context/MathVariablesContext';
import { MathExpNode } from '@/editor/nodes/MathNode/MathExpNode';

export interface EvaluationOutput {
  results: Record<string, MathEvaluationResult>;
  variables: Record<string, number>;
  scopes: Record<string, Record<string, number>>;
}

const DIVISION_BY_ZERO = /\/\s*0(?![0-9])/;

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
