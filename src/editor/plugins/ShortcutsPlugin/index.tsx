/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { $isCodeNode } from '@lexical/code';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  LexicalEditor,
  OUTDENT_CONTENT_COMMAND,
  SELECT_ALL_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

import {
  clearFormatting,
  formatCode,
  formatHeading,
  formatParagraph,
  formatQuote,
  updateFontSize,
  UpdateFontSizeType,
} from '@/editor/LexicalUtils/formatUtils';
import { $createListNode, $isListNode } from '@/editor/nodes/ListNode';
import { $isMathExpNode } from '@/editor/nodes/MathNode/MathExpNode';
import { EDITOR_SHORTCUTS, useShortcutStore } from '@/GlobalState/shortcutStore';

export default function ShortcutsPlugin({
  editor,
  blockType = 'paragraph',
  fontSizeInputValue = '15px',
}: {
  editor: LexicalEditor;
  blockType?: string;
  fontSizeInputValue?: string;
}): null {

  useEffect(() => {
    // Register all editor shortcuts with the central store
    const registerShortcut = useShortcutStore.getState().registerShortcut;
    const registerCallback = useShortcutStore.getState().registerCallback;

    // Register shortcut definitions
    Object.entries(EDITOR_SHORTCUTS).forEach(([id, definition]) => {
      registerShortcut(id, definition);
    });

    // Register callbacks
    registerCallback('FORMAT_PARAGRAPH', () => formatParagraph(editor));
    registerCallback('HEADING1', () => formatHeading(editor, blockType, 'h1'));
    registerCallback('HEADING2', () => formatHeading(editor, blockType, 'h2'));
    registerCallback('HEADING3', () => formatHeading(editor, blockType, 'h3'));
    registerCallback('FORMAT_CODE', () => formatCode(editor, blockType));
    registerCallback('FORMAT_QUOTE', () => formatQuote(editor, blockType));
    registerCallback('STRIKETHROUGH', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough'));
    registerCallback('LOWERCASE', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'lowercase'));
    registerCallback('UPPERCASE', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'uppercase'));
    registerCallback('CAPITALIZE', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'capitalize'));
    registerCallback('INDENT', () => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined));
    registerCallback('OUTDENT', () => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined));
    registerCallback('CENTER_ALIGN', () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center'));
    registerCallback('LEFT_ALIGN', () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left'));
    registerCallback('RIGHT_ALIGN', () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right'));
    registerCallback('JUSTIFY_ALIGN', () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify'));
    registerCallback('SUBSCRIPT', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript'));
    registerCallback('SUPERSCRIPT', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript'));
    registerCallback('INSERT_CODE_BLOCK', () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code'));
    registerCallback('INCREASE_FONT_SIZE', () => updateFontSize(editor, UpdateFontSizeType.increment, fontSizeInputValue));
    registerCallback('DECREASE_FONT_SIZE', () => updateFontSize(editor, UpdateFontSizeType.decrement, fontSizeInputValue));
    registerCallback('CLEAR_FORMATTING', () => clearFormatting(editor));
    registerCallback('NUMBERED_LIST', () => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isListNode(anchorNode) && anchorNode.getListType() === 'number') {
            $setBlocksType(selection, () => $createParagraphNode());
          } else {
            $setBlocksType(selection, () => $createListNode('number'));
          }
        }
      });
    });
    registerCallback('BULLET_LIST', () => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isListNode(anchorNode) && anchorNode.getListType() === 'bullet') {
            $setBlocksType(selection, () => $createParagraphNode());
          } else {
            $setBlocksType(selection, () => $createListNode('bullet'));
          }
        }
      });
    });
    registerCallback('CHECK_LIST', () => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isListNode(anchorNode) && anchorNode.getListType() === 'check') {
            $setBlocksType(selection, () => $createParagraphNode());
          } else {
            $setBlocksType(selection, () => $createListNode('check'));
          }
        }
      });
    });
    registerCallback('ADD_ABOVE', () => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const topLevelElement = anchorNode.getTopLevelElement();
          if (topLevelElement) {
            const pNode = $createParagraphNode();
            topLevelElement.insertBefore(pNode);
            pNode.select();
          }
        } else if ($isNodeSelection(selection)) {
          const selectedNode = selection.getNodes()[0];
          const topLevelElement = selectedNode.getTopLevelElement();
          if (topLevelElement) {
            const pNode = $createParagraphNode();
            topLevelElement.insertBefore(pNode);
            pNode.select();
          }
        }
      });
    });
    registerCallback('ADD_BELOW', () => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const topLevelElement = anchorNode.getTopLevelElement();
          if (topLevelElement) {
            const pNode = $createParagraphNode();
            topLevelElement.insertAfter(pNode);
            pNode.select();
          }
        } else if ($isNodeSelection(selection)) {
          const selectedNode = selection.getNodes()[0];
          const topLevelElement = selectedNode.getTopLevelElement();
          if (topLevelElement) {
            const pNode = $createParagraphNode();
            topLevelElement.insertAfter(pNode);
            pNode.select();
          }
        }
      });
    });
    const unregisterSelectAll = editor.registerCommand<KeyboardEvent>(
      SELECT_ALL_COMMAND,
      (event) => {
        let handled = false;
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const isInsideCode = $isCodeNode(anchorNode) || anchorNode.getParents().some($isCodeNode);
            const isInsideMath = $isMathExpNode(anchorNode) || anchorNode.getParents().some($isMathExpNode);

            if (isInsideCode || isInsideMath) {
              const targetNode = isInsideCode
                ? ($isCodeNode(anchorNode) ? anchorNode : anchorNode.getParents().find($isCodeNode))
                : ($isMathExpNode(anchorNode) ? anchorNode : anchorNode.getParents().find($isMathExpNode));

              if (targetNode) {
                const targetElement = editor.getElementByKey(targetNode.getKey());
                if (targetElement) {
                  event.preventDefault();
                  const range = document.createRange();
                  range.selectNodeContents(targetElement);
                  const domSelection = window.getSelection();
                  domSelection?.removeAllRanges();
                  domSelection?.addRange(range);
                  handled = true;
                }
              }
            }
          }
        });
        return handled;
      },
      COMMAND_PRIORITY_CRITICAL
    );

    // Cleanup function
    return () => {
      unregisterSelectAll();
      const unregisterCallback = useShortcutStore.getState().unregisterCallback;
      Object.keys(EDITOR_SHORTCUTS).forEach(id => {
        unregisterCallback(id);
      });
    };
  }, [editor, blockType, fontSizeInputValue]);

  return null;
}
