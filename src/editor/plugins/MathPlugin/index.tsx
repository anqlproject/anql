import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import { $getRoot, $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, createCommand, LexicalNode } from 'lexical';
import { evaluate } from 'mathjs';
import { useCallback, useEffect } from 'react';

import { useMathVariables } from '@/editor/context/MathVariablesContext';
import { $createMathExpNode, $isMathExpNode } from '@/editor/nodes/MathNode/MathExpNode';

export const INSERT_MATH_COMMAND = createCommand('INSERT_MATH_COMMAND');

// Plugin to update the DOM with results from MathVariablesContext
function MathResultDisplayPlugin() {
  const [editor] = useLexicalComposerContext();
  const { results } = useMathVariables();

  useEffect(() => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const mathNodes: any[] = [];

      const traverse = (node: LexicalNode) => {
        if ($isMathExpNode(node)) {
          mathNodes.push(node);
        }
        if ('getChildren' in node) {
          const children = (node as any).getChildren();
          for (const child of children) {
            traverse(child);
          }
        }
      };

      traverse(root);

      // Mettre à jour le DOM pour chaque noeud math
      for (const node of mathNodes) {
        const key = node.__key;
        const dom = editor.getElementByKey(key);
        if (dom) {
          const result = results[key];
          if (result) {
            if (result.error) {
              dom.classList.add('has-error');
              dom.classList.remove('is-empty');
              dom.setAttribute('data-error', result.error);
              dom.removeAttribute('data-result');
              dom.removeAttribute('data-placeholder');
            } else if (result.result) {
              dom.classList.remove('has-error');
              dom.classList.remove('is-empty');
              dom.setAttribute('data-result', result.result);
              dom.removeAttribute('data-error');
              dom.removeAttribute('data-placeholder');
            } else {
              dom.classList.remove('has-error');
              dom.classList.add('is-empty');
              dom.removeAttribute('data-result');
              dom.removeAttribute('data-error');
              dom.setAttribute('data-placeholder', 'Math');
            }
          } else {
            dom.classList.remove('has-error');
            dom.classList.add('is-empty');
            dom.removeAttribute('data-result');
            dom.removeAttribute('data-error');
            dom.setAttribute('data-placeholder', 'Math');
          }
        }
      }
    });
  }, [editor, results]);

  return null;
}

export default function MathPlugin() {
  const [editor] = useLexicalComposerContext();
  const { setResults } = useMathVariables();

  const evaluateTree = useCallback(() => {
    const results: Record<string, { result: string, error: string | null }> = {};

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const mathNodes: any[] = [];

      const traverse = (node: LexicalNode) => {
        if ($isMathExpNode(node)) {
          mathNodes.push(node);
        }
        if ('getChildren' in node) {
          const children = (node as any).getChildren();
          for (const child of children) {
            traverse(child);
          }
        }
      };

      traverse(root);

      const scope: Record<string, number> = {};

      for (const node of mathNodes) {
        const key = node.__key;
        const expr = node.getTextContent();

        if (!expr.trim()) {
          results[key] = { result: '', error: null };
          continue;
        }

        try {
          const match = expr.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.+)$/);
          if (match) {
            const name = match[1].trim();
            const valueExpr = match[2].trim();

            if (valueExpr.includes('/0') || /\/\s*0(?![0-9])/.test(valueExpr)) {
              throw new Error('Division by zero');
            }
            const val = evaluate(valueExpr, scope);
            if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) throw new Error('Invalid value');
            scope[name] = val;
            results[key] = { result: `${name} = ${val}`, error: null };
          } else {
            if (expr.includes('/0') || /\/\s*0(?![0-9])/.test(expr)) {
              throw new Error('Division by zero');
            }
            const val = evaluate(expr, scope);
            if (typeof val === 'number' && !isFinite(val)) throw new Error('Invalid value');
            results[key] = { result: `= ${val}`, error: null };
          }
        } catch (e: any) {
          results[key] = { result: '', error: e.message };
        }
      }
    });

    setResults(results);
  }, [editor, setResults]);

  // Re-evaluate on Lexical updates (moves, adds, deletes, typing)
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
        if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
          evaluateTree();
        }

        editorState.read(() => {
          const selection = editorState._selection;
          let selectedMathNodeKey: string | null = null;

          if (selection !== null && $isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getType() === 'mathexp' ? anchorNode : anchorNode.getParent();
            if (element && $isMathExpNode(element)) {
              selectedMathNodeKey = element.getKey();
            }
          }

          const mathElements = document.querySelectorAll('.math-exp-node');
          mathElements.forEach(el => el.classList.remove('math-focused'));

          if (selectedMathNodeKey) {
            const dom = editor.getElementByKey(selectedMathNodeKey);
            if (dom) {
              dom.classList.add('math-focused');
            }
          }
        });
      }),
      editor.registerCommand(
        INSERT_MATH_COMMAND,
        () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createMathExpNode());
            }
          });
          return true; // Command handled
        },
        COMMAND_PRIORITY_EDITOR,
      )
    );
  }, [editor, evaluateTree]);

  return (
    <>
      <MathResultDisplayPlugin />
    </>
  );
}