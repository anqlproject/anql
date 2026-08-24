import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
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

import { evaluateAllMathNodes } from './evaluator';
import { MathResultDisplay } from './MathResultDisplay';
import { $getAllMathNodes, $getAllTableNodes } from './traversal';

export const INSERT_MATH_COMMAND = createCommand('INSERT_MATH_COMMAND');

export default function MathPlugin() {
  const [editor] = useLexicalComposerContext();
  const { setResults, setVariables, setScopes, setTableVariables } = useMathVariables();

  const evaluateTree = useCallback(() => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const mathNodes = $getAllMathNodes(root);
      const tableNodes = $getAllTableNodes(root);

      const tableVariables: Record<string, Record<string, number[]>> = {};

      tableNodes.forEach((node, index) => {
        const rawName = node.__tableName || `Table_${index + 1}`;
        const safeTableName = rawName.replace(/[^a-zA-Z0-9_]/g, '');
        if (!safeTableName) return;

        const tableData: Record<string, number[]> = {};

        node.__columns.forEach(col => {
          if (col.meta?.type === 'number') {
            const safeHeader = (col.header || col.id).replace(/[^a-zA-Z0-9_]/g, '');
            if (safeHeader) {
              tableData[safeHeader] = node.__data.map(row => {
                const val = row[col.id];
                const num = Number(val);
                return isNaN(num) ? 0 : num;
              });
            }
          }
        });

        if (Object.keys(tableData).length > 0) {
          tableVariables[safeTableName] = tableData;
        }
      });

      const { results, variables, scopes } = evaluateAllMathNodes(mathNodes, tableVariables);
      setScopes(scopes);
      setResults(results);
      setVariables(variables);
      setTableVariables(tableVariables);
    });
  }, [editor, setResults, setVariables, setScopes, setTableVariables]);

  useEffect(() => {
    return mergeRegister(
      // Re-evaluate on any document change
      editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState }) => {
        if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
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