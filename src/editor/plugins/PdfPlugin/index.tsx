import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, createCommand, LexicalCommand } from 'lexical';
import { $insertNodes } from 'lexical';
import { useEffect } from 'react';

import { $createPdfNode, $isPdfNode, PdfNode } from '@/editor/nodes/PdfNode/PdfNode';

export type PdfCommandPayload = {
  url: string;
  name?: string;
};

export const INSERT_PDF_COMMAND: LexicalCommand<PdfCommandPayload> = createCommand(
  'INSERT_PDF_COMMAND',
);

export default function PdfPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([PdfNode])) {
      throw new Error('PdfPlugin: PdfNode not registered on editor');
    }

    return editor.registerCommand(
      INSERT_PDF_COMMAND,
      (payload) => {
        const { url, name } = payload;

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }

          const pdfNode = $createPdfNode(url, name || '');
          $insertNodes([pdfNode]);
        });

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

export { $createPdfNode, $isPdfNode };
