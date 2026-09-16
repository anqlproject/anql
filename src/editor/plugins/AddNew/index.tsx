import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  LexicalEditor,
} from 'lexical';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from '@/App/store/useGlobalStore';

function handleClick(
  event: MouseEvent,
  editor: LexicalEditor,
  editorRootElement: HTMLElement | null,
) {
  const target = event.target as Node | null;

  // Only handle clicks inside the editor root element
  if (!target || !editorRootElement || !editorRootElement.contains(target)) {
    return;
  }

  // Get the last child of the root
  editor.update(() => {
    const root = $getRoot();
    const lastChild = root.getLastChild();

    // If no content, create a new paragraph
    if (!lastChild) {
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      paragraph.selectEnd();
      return;
    }

    // Check if click is below the last block
    const lastElement = lastChild.getLatest();
    const domElement = editor.getElementByKey(lastElement.__key);

    if (domElement) {
      const rect = domElement.getBoundingClientRect();
      const isClickBelowLastBlock = event.clientY > rect.bottom + 10; // 10px threshold

      if (isClickBelowLastBlock) {
        const selection = $getSelection();
        const paragraph = $createParagraphNode();

        if ($isRangeSelection(selection)) {
          // Only block if the last node is an empty paragraph node
          // Other node types (headings, lists, etc.) should always allow adding a new paragraph
          if ($isParagraphNode(lastChild) && lastChild.getTextContent().trim() === '') {
            lastChild.selectEnd();
            return;
          }

          // Otherwise, create a new paragraph after the last one
          lastChild.insertAfter(paragraph);
          paragraph.select();
        } else {
          // Fallback: append to root
          root.append(paragraph);
          paragraph.selectEnd();
        }
      }
    }
  });
}

export default function ClickToAddParagraphPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const { editorRef } = useGlobalStore(
    useShallow((state) => ({ editorRef: state.editorRef })),
  );

  useEffect(() => {
    const onClick = (event: MouseEvent) =>
      handleClick(event, editor, editorRef.current);

    // Add click event listener
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
    };
  }, [editor, editorRef]);

  return null;
}
