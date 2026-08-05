import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_LOW,
  createCommand,
  LexicalCommand,
} from 'lexical';
import { useEffect } from 'react';

import { $createLinkNode, $isLinkNode, LinkNode, LinkType } from '@/editor/nodes/LinkNode/LinkNode';

export type LinkCommandPayload = {
  url: string;
  linkType?: LinkType;
  targetId?: string;
  name?: string;
};

export const INSERT_LINK_COMMAND: LexicalCommand<LinkCommandPayload> = createCommand(
  'INSERT_LINK_COMMAND',
);

export type OpenCustomLinkDialogPayload = {
  url: string;
};

export const OPEN_CUSTOM_LINK_DIALOG_COMMAND: LexicalCommand<OpenCustomLinkDialogPayload> = createCommand(
  'OPEN_CUSTOM_LINK_DIALOG_COMMAND',
);

function detectLinkType(url: string): LinkType {
  // Check if it's an external URL (starts with http://, https://, or www.)
  if (/^(https?:\/\/|www\.)/i.test(url)) {
    return 'external';
  }
  // Check if it's a document reference (e.g., @document:xxx or just @xxx for documents)
  if (url.startsWith('@document:') || /^@[a-f0-9-]+$/i.test(url)) {
    return 'document';
  }
  // Check if it's a node reference (e.g., @node:xxx)
  if (url.startsWith('@node:')) {
    return 'node';
  }
  // Check if it's a row reference
  if (url.startsWith('@row:')) {
    return 'row';
  }
  // Default to external
  return 'external';
}

function extractTargetId(url: string, linkType: LinkType): string {
  if (linkType === 'document') {
    if (url.startsWith('@document:')) {
      return url.replace('@document:', '');
    }
    return url.replace('@', '');
  }
  if (linkType === 'node') {
    return url.replace('@node:', '');
  }
  if (linkType === 'row') {
    return url.replace('@row:', '');
  }
  return '';
}

export default function LinkPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([LinkNode])) {
      throw new Error('LinkPlugin: LinkNode not registered on editor');
    }

    return editor.registerCommand(
      INSERT_LINK_COMMAND,
      (payload) => {
        const { url, linkType, targetId, name } = payload;

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return false;
          }

          const detectedLinkType = linkType || detectLinkType(url);
          const detectedTargetId = targetId || extractTargetId(url, detectedLinkType);

          const linkNode = $createLinkNode(url, detectedLinkType, detectedTargetId, name || '');
          $insertNodes([linkNode]);

          // Wrap LinkNode in a ParagraphNode if it's at root level
          // This ensures ChangePlugin2 treats the ParagraphNode as a bloc
          // and the LinkNode is stored in its JSON content
          if ($isRootOrShadowRoot(linkNode.getParentOrThrow())) {
            $wrapNodeInElement(linkNode, $createParagraphNode).selectEnd();
          }
        });

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

export { $createLinkNode, $isLinkNode };
