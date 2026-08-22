import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, CLICK_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';
import { useEffect, useState } from 'react';

import { Dialog } from '@/components/custom/Dialog/Dialog';
import { useMathVariables } from '@/editor/context/MathVariablesContext';

import { $getAllMathNodes } from './traversal';

/**
 * Reads results from MathVariablesContext and updates the DOM of each
 * MathExpNode to display the result, error, or empty state.
 *
 * Also handles the "show full result/error" dialog on click.
 */
export function MathResultDisplay() {
  const [editor] = useLexicalComposerContext();
  const { results } = useMathVariables();
  const [detailDialog, setDetailDialog] = useState<string | null>(null);

  // Handle click on the "plus..." overflow button
  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (payload: MouseEvent) => {
        const target = payload.target as HTMLElement;
        const mathNode = target.closest('.math-exp-node');
        if (mathNode && mathNode.classList.contains('has-plus')) {
          const rect = mathNode.getBoundingClientRect();
          // The plus button is in the bottom right corner (approx 45px wide, 20px tall)
          if (payload.clientY > rect.bottom - 24 && payload.clientX > rect.right - 50) {
            const attr = mathNode.classList.contains('has-error')
              ? mathNode.getAttribute('data-full-error')
              : mathNode.getAttribute('data-full-result');
            if (attr) {
              setDetailDialog(attr);
              return true;
            }
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  // Sync results → DOM attributes & classes
  useEffect(() => {
    editor.getEditorState().read(() => {
      const mathNodes = $getAllMathNodes($getRoot());

      for (const node of mathNodes) {
        const key = node.__key;
        const dom = editor.getElementByKey(key);
        if (!dom) continue;

        const result = results[key];

        if (result?.error) {
          const shortError = result.error.length > 30
            ? result.error.substring(0, 30) + '...'
            : result.error;
          dom.classList.add('has-error');
          dom.classList.remove('is-empty');
          dom.setAttribute('data-error', shortError);
          dom.setAttribute('data-full-error', result.error);
          dom.classList.toggle('has-plus', result.error.length > 30);
          dom.removeAttribute('data-result');
          dom.removeAttribute('data-placeholder');
        } else if (result?.result) {
          const shortResult = result.result.length > 50
            ? result.result.substring(0, 50) + '...'
            : result.result;
          dom.classList.remove('has-error');
          dom.classList.remove('is-empty');
          dom.setAttribute('data-result', shortResult);
          dom.setAttribute('data-full-result', result.result);
          dom.classList.toggle('has-plus', result.result.length > 50);
          dom.removeAttribute('data-error');
          dom.removeAttribute('data-placeholder');
        } else {
          dom.classList.remove('has-error', 'has-plus');
          dom.classList.add('is-empty');
          dom.removeAttribute('data-result');
          dom.removeAttribute('data-error');
          dom.setAttribute('data-placeholder', 'Math');
        }
      }
    });
  }, [editor, results]);

  return (
    <Dialog
      isOpen={!!detailDialog}
      onClose={() => setDetailDialog(null)}
      title="Détails"
      mode="info"
      size="md"
      description={
        <div style={{ maxHeight: '60vh', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)' }}>
          {detailDialog}
        </div>
      }
    />
  );
}
