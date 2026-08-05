import './List.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $setBlocksType } from '@lexical/selection';
import {
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  createCommand,
  INDENT_CONTENT_COMMAND,
  LexicalCommand,
  LexicalNode,
  mergeRegister,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

import {
  $createListNode,
  $isListNode,
  ListNode,
  ListType,
} from '@/editor/nodes/ListNode';

export const FORMAT_LIST_COMMAND: LexicalCommand<ListType> =
  createCommand('FORMAT_LIST_COMMAND');

export const INSERT_LIST_COMMAND: LexicalCommand<ListType> =
  createCommand('INSERT_LIST_COMMAND');

function $updateNumberedListCounters() {
  const root = $getRoot();
  let currentNumber = 0;
  let previousWasNumber = false;

  root.getChildren().forEach((node: LexicalNode) => {
    if ($isListNode(node) && node.getListType() === 'number') {
      const number = previousWasNumber ? currentNumber + 1 : 1;
      if (node.getListNumber() !== number) {
        node.setListNumber(number);
      }
      currentNumber = number;
      previousWasNumber = true;
    } else {
      previousWasNumber = false;
      currentNumber = 0;
    }
  });
}

export default function ListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  // Automatically fix list counters if we load an old document (or if they somehow get out of sync)
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      let isOutdated = false;

      editorState.read(() => {
        const root = $getRoot();
        let currentNumber = 0;
        let previousWasNumber = false;

        root.getChildren().forEach((node: LexicalNode) => {
          if ($isListNode(node) && node.getListType() === 'number') {
            const expected = previousWasNumber ? currentNumber + 1 : 1;
            if (node.getListNumber() !== expected) {
              isOutdated = true;
            }
            currentNumber = expected;
            previousWasNumber = true;
          } else {
            previousWasNumber = false;
            currentNumber = 0;
          }
        });
      });

      if (isOutdated) {
        editor.update(() => {
          $updateNumberedListCounters();
        });
      }
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (payload: MouseEvent) => {
          const event = payload;
          const target = event.target as HTMLElement;
          if (target.classList.contains('list-check')) {
            const rect = target.getBoundingClientRect();
            // Assuming the checkbox is rendered on the left, within 24px
            if (event.clientX < rect.left + 24) {
              editor.update(() => {
                const node = $getNearestNodeFromDOMNode(target);
                if ($isListNode(node) && node.getListType() === 'check') {
                  node.toggleChecked();
                }
              });
              event.preventDefault();
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        FORMAT_LIST_COMMAND,
        (payload) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createListNode(payload));
            }
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        INSERT_LIST_COMMAND,
        (payload) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createListNode(payload));
            }
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      // Use registerNodeTransform like ListPlugin for efficient counter updates
      editor.registerNodeTransform(ListNode, () => {
        $updateNumberedListCounters();
      }),
      // Handle Tab (indent) and Shift+Tab (outdent) for lists
      editor.registerCommand(
        INDENT_CONTENT_COMMAND,
        () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const nodes = selection.getNodes();
              for (const node of nodes) {
                let listNode: LexicalNode | null = node;
                // Find the parent ListNode if the selected node is not one
                while (listNode && !$isListNode(listNode)) {
                  listNode = listNode.getParent();
                }
                if ($isListNode(listNode)) {
                  listNode.setIndent(listNode.getIndent() + 1);
                }
              }
            }
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        OUTDENT_CONTENT_COMMAND,
        () => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const nodes = selection.getNodes();
              for (const node of nodes) {
                let listNode: LexicalNode | null = node;
                // Find the parent ListNode if the selected node is not one
                while (listNode && !$isListNode(listNode)) {
                  listNode = listNode.getParent();
                }
                if ($isListNode(listNode) && listNode.getIndent() > 0) {
                  listNode.setIndent(listNode.getIndent() - 1);
                }
              }
            }
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  return null;
}
