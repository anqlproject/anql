/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DRAG_DROP_PASTE } from '@lexical/rich-text';
import { isMimeType, mediaFileReader } from '@lexical/utils';
import { COMMAND_PRIORITY_LOW } from 'lexical';
import { useEffect } from 'react';

import { INSERT_IMAGE_COMMAND, uploadImageIfNeeded } from '@/editor/plugins/ImagesPlugin';

const ACCEPTABLE_IMAGE_TYPES = [
  'image/',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/webp',
];

export default function DragDropPaste(): null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        (async () => {
          try {
            // Filter files to only process image files
            const imageFiles = Array.from(files).filter(file => 
              isMimeType(file, ACCEPTABLE_IMAGE_TYPES)
            );
            
            if (imageFiles.length === 0) {
              return; // No image files to process
            }

            const filesResult = await mediaFileReader(
              imageFiles,
              [ACCEPTABLE_IMAGE_TYPES].flatMap((x) => x),
            );
            for (const { file, result } of filesResult) {
              if (isMimeType(file, ACCEPTABLE_IMAGE_TYPES)) {
                const finalSrc = await uploadImageIfNeeded(result, file.name);
                editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                  altText: file.name,
                  src: finalSrc,
                });
              }
            }
          } catch (error) {
            console.error('Error handling drag-drop paste:', error);
          }
        })();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);
  return null;
}
