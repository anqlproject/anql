import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  createCommand,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
} from 'lexical';
import { useCallback, useEffect } from 'react';

import { useMathVariables } from '@/editor/context/MathVariablesContext';
import { $createMathExpNode, $isMathExpNode } from '@/editor/nodes/MathNode/MathExpNode';
import { $isTableNode } from '@/editor/nodes/TableNode/TableNode';

import { evaluateAllMathNodes, EvaluationItem } from './evaluator';
import { MathResultDisplay } from './MathResultDisplay';
import { $getMathAndTableNodes } from './traversal';

export const INSERT_MATH_COMMAND = createCommand('INSERT_MATH_COMMAND');

export default function MathPlugin() {
  const [editor] = useLexicalComposerContext();
  const { setResults, setVariables, setScopes, setTableVariables, setChartTableVariables } = useMathVariables();

  const evaluateTree = useCallback(() => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const mathAndTableNodes = $getMathAndTableNodes(root);

      const tableVariables: Record<string, Record<string, number[]>> = {};
      const chartTableVariables: Record<string, Record<string, (string | number)[]>> = {};
      const evaluationItems: EvaluationItem[] = [];
      let tableIndex = 0;

      mathAndTableNodes.forEach((node) => {
        if ($isTableNode(node)) {
          const rawName = node.__tableName || `Table_${tableIndex + 1}`;
          tableIndex++;
          const safeTableName = rawName.replace(/[^a-zA-Z0-9_]/g, '');
          if (!safeTableName) {
            evaluationItems.push({ type: 'table', name: '', data: null });
            return;
          }

          const tableData: Record<string, number[]> = {};
          const chartData: Record<string, (string | number)[]> = {};

          node.__columns.forEach(col => {
            const safeHeader = (col.header || col.id).replace(/[^a-zA-Z0-9_]/g, '');
            if (safeHeader) {
              chartData[safeHeader] = node.__data.map(row => {
                const value = row[col.id];
                return typeof value === 'number' ? value : String(value ?? '');
              });
            }
            if (safeHeader) {
              const numericValues = node.__data.map(row => {
                const value = row[col.id];
                if (typeof value === 'number') {
                  return Number.isFinite(value) ? value : null;
                }
                if (typeof value === 'string' && value.trim() !== '') {
                  const numberValue = Number(value);
                  return Number.isFinite(numberValue) ? numberValue : null;
                }
                return null;
              });

              if (numericValues.length > 0 && numericValues.every(value => value !== null)) {
                tableData[safeHeader] = numericValues as number[];
              }
            }
          });

          if (Object.keys(tableData).length > 0) {
            tableVariables[safeTableName] = tableData;
            evaluationItems.push({ type: 'table', name: safeTableName, data: tableData });
          } else {
            evaluationItems.push({ type: 'table', name: safeTableName, data: null });
          }
          if (Object.keys(chartData).length > 0) chartTableVariables[safeTableName] = chartData;
        } else {
          // Math node
          evaluationItems.push({ type: 'math', node: node as any });
        }
      });

      const { results, variables, scopes } = evaluateAllMathNodes(evaluationItems);

      setScopes(prev => JSON.stringify(prev) === JSON.stringify(scopes) ? prev : scopes);
      setResults(prev => JSON.stringify(prev) === JSON.stringify(results) ? prev : results);
      setVariables(prev => JSON.stringify(prev) === JSON.stringify(variables) ? prev : variables);
      setTableVariables(prev => JSON.stringify(prev) === JSON.stringify(tableVariables) ? prev : tableVariables);
      setChartTableVariables(prev => JSON.stringify(prev) === JSON.stringify(chartTableVariables) ? prev : chartTableVariables);
    });
  }, [editor, setResults, setVariables, setScopes, setTableVariables, setChartTableVariables]);

  useEffect(() => {
    return mergeRegister(
      // Re-evaluate on any document change
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, prevEditorState, editorState }) => {
        let shouldEvaluate = false;

        if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
          const checkDirtyNodes = (state: typeof editorState) => {
            let found = false;
            state.read(() => {
              for (const key of dirtyElements.keys()) {
                const node = $getNodeByKey(key);
                if (node && (node.getType() === 'table' || node.getType() === 'mathexp')) {
                  found = true; return;
                }
              }
              for (const key of dirtyLeaves.keys()) {
                const node = $getNodeByKey(key);
                if (node && (node.getType() === 'table' || node.getType() === 'mathexp')) {
                  found = true; return;
                }
              }
            });
            return found;
          };

          shouldEvaluate = checkDirtyNodes(editorState) || checkDirtyNodes(prevEditorState);
        }

        if (shouldEvaluate) {
          evaluateTree();
        }

        // Update focused state on the active math node
        editorState.read(() => {
          const selection = editorState._selection;
          let focusedKey: string | null = null;

          if (selection !== null && $isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getType() === 'mathexp' ? anchorNode : anchorNode.getParent();
            if (element && $isMathExpNode(element)) {
              focusedKey = element.getKey();
            }
          }

          document.querySelectorAll('.math-exp-node').forEach(el => el.classList.remove('math-focused'));
          if (focusedKey) {
            editor.getElementByKey(focusedKey)?.classList.add('math-focused');
          }
        });
      }),

      // Insert a new MathExpNode at the current selection
      editor.registerCommand(
        INSERT_MATH_COMMAND,
        () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createMathExpNode());
            }
          });
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      // Delete an empty MathExpNode on Backspace
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          const selection = $getSelection();

          if ($isNodeSelection(selection)) {
            const nodes = selection.getNodes();
            if (nodes.length === 1 && $isMathExpNode(nodes[0])) {
              event.preventDefault();
              const paragraph = $createParagraphNode();
              nodes[0].replace(paragraph);
              paragraph.select();
              return true;
            }
          }

          if ($isRangeSelection(selection) && selection.isCollapsed()) {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getType() === 'mathexp' ? anchorNode : anchorNode.getParent();
            if (element && $isMathExpNode(element) && element.getTextContent().length === 0) {
              event.preventDefault();
              const paragraph = $createParagraphNode();
              element.replace(paragraph);
              paragraph.select();
              return true;
            }
          }

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Delete a selected MathExpNode on Delete key
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        (event) => {
          const selection = $getSelection();
          if ($isNodeSelection(selection)) {
            const nodes = selection.getNodes();
            if (nodes.length === 1 && $isMathExpNode(nodes[0])) {
              event.preventDefault();
              const paragraph = $createParagraphNode();
              nodes[0].replace(paragraph);
              paragraph.select();
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, evaluateTree]);

  return <MathResultDisplay />;
}