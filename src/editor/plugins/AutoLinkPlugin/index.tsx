import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_LOW, PASTE_COMMAND } from 'lexical';
import { useEffect } from 'react';

import { OPEN_CUSTOM_LINK_DIALOG_COMMAND } from '@/editor/plugins/LinkPlugin';


export default function AutoLinkPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData || (window as any).clipboardData;
        if (!clipboardData) return false;

        const pastedText = clipboardData.getData('text/plain');
        if (!pastedText) return false;

        const trimmedText = pastedText.trim();

        // Detect if the pasted text is exactly a supported link type
        const isWebLink = /^(https?:\/\/|www\.)[^\s]+$/i.test(trimmedText);
        const isNodeLink = /^@node:[^\s]+$/i.test(trimmedText);
        const isDocumentLink = /^@document:[^\s]+$/i.test(trimmedText) || /^@[a-f0-9-]+$/i.test(trimmedText);
        const isRowLink = /^@row:[^\s]+$/i.test(trimmedText);

        if (isWebLink) {
          event.preventDefault();
          editor.dispatchCommand(OPEN_CUSTOM_LINK_DIALOG_COMMAND, {
            url: trimmedText
          });
          return true;
        }

        if (isNodeLink) {
          event.preventDefault();
          editor.dispatchCommand(OPEN_CUSTOM_LINK_DIALOG_COMMAND, {
            url: trimmedText
          });
          return true;
        }

        if (isDocumentLink) {
          event.preventDefault();
          editor.dispatchCommand(OPEN_CUSTOM_LINK_DIALOG_COMMAND, {
            url: trimmedText
          });
          return true;
        }

        if (isRowLink) {
          event.preventDefault();
          editor.dispatchCommand(OPEN_CUSTOM_LINK_DIALOG_COMMAND, {
            url: trimmedText
          });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}
