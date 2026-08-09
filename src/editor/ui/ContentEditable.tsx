/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import './ContentEditable.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { $getRoot, $getSelection, $isParagraphNode, $isRangeSelection } from 'lexical';
import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from '@/App/store/useGlobalStore';

type Props = {
  className?: string;
  placeholderClassName?: string;
};

export default function LexicalContentEditable({
  className,
}: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const { config } = useGlobalStore(
    useShallow((state) => ({ config: state.config }))
  );
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  useEffect(() => {
    const updatePlaceholder = () => {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        if (children.length !== 1) {
          setShowPlaceholder(false);
          return;
        }

        const firstChild = children[0];
        if (!$isParagraphNode(firstChild)) {
          setShowPlaceholder(false);
          return;
        }

        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          setShowPlaceholder(false);
          return;
        }

        const textContent = firstChild.getTextContent();
        const paragraphChildren = firstChild.getChildren();
        const hasChildren = paragraphChildren.length > 0;

        setShowPlaceholder(textContent.length === 0 && !hasChildren);
      });
    };

    const unregisterUpdateListener = editor.registerUpdateListener(updatePlaceholder);
    updatePlaceholder();

    return () => {
      unregisterUpdateListener();
    };
  }, [editor]);

  return (
    <div style={{ position: 'relative' }}>
      {showPlaceholder && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            color: 'var(--text-secondary)',
            fontSize: '16px',
            fontWeight: '400',
            lineHeight: '1.5',
            letterSpacing: '0.01em',
            opacity: '0.5',
            textAlign: 'center',
            maxWidth: '80%',
            userSelect: 'none',
            fontStyle: 'italic',
          }}
        >
          {t('EDITOR.placeholder') as string}
        </div>
      )}
      <ContentEditable
        className={className ?? 'ContentEditable__root'}
        autoComplete={config.editor.autoComplete ? 'on' : 'off'}
        autoCorrect={config.editor.autoCorrect ? 'on' : 'off'}
        autoCapitalize={config.editor.autoCapitalize ? 'on' : 'off'}
        spellCheck={config.editor.spellCheck}
      />
    </div>
  );
}
