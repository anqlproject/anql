/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import './EquationComponent.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useLexicalEditable} from '@lexical/react/useLexicalEditable';
import {mergeRegister} from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  NodeKey,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import type {JSX} from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ErrorBoundary} from 'react-error-boundary';

import { logger } from '@/core/logger';
import { useReferenceStore } from '@/core/references/useReferenceStore';

import EquationEditor from './EquationEditor';
import {$isEquationNode} from './EquationNode';
import KatexRenderer from './KatexRenderer';

type EquationComponentProps = {
  equation: string;
  inline: boolean;
  referenceId?: string;
  nodeKey: NodeKey;
};

export default function EquationComponent({
  equation,
  inline,
  referenceId,
  nodeKey,
}: EquationComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [equationValue, setEquationValue] = useState(equation);
  const [showEquationEditor, setShowEquationEditor] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const equationAtEditStartRef = useRef(equation);
  const linkedReference = useReferenceStore((state) =>
    referenceId
      ? state.references.find((reference) => reference.id === referenceId)
      : undefined,
  );
  const referencesLoaded = useReferenceStore((state) => state.isLoaded);
  const loadReferences = useReferenceStore((state) => state.loadReferences);
  const currentEquation =
    linkedReference?.ref_type === 'latex' ? linkedReference.value : equation;

  const showEditor = useCallback(() => {
    equationAtEditStartRef.current = currentEquation;
    setEquationValue(currentEquation);
    setShowEquationEditor(true);
  }, [currentEquation]);

  const onHide = useCallback(
    (restoreSelection?: boolean) => {
      setShowEquationEditor(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isEquationNode(node)) {
          const stillLinked = linkedReference?.ref_type === 'latex';
          const changedLinkedValue =
            referenceId &&
            stillLinked &&
            equationValue !== equationAtEditStartRef.current;

          if (!stillLinked || changedLinkedValue) {
            node.setEquation(equationValue);
          }
          if (referenceId && !stillLinked) {
            node.setReferenceId(undefined);
          } else if (changedLinkedValue) {
            node.setReferenceId(undefined);
          }
          if (restoreSelection) {
            node.selectNext(0, 0);
          }
        }
      });
    },
    [editor, equationValue, linkedReference, nodeKey, referenceId],
  );

  useEffect(() => {
    if (referenceId && !referencesLoaded) {
      loadReferences().catch((error: unknown) => {
        logger.error('Failed to load linked LaTeX reference', error as Error, { referenceId });
      });
    }
  }, [loadReferences, referenceId, referencesLoaded]);

  useEffect(() => {
    if (equation !== currentEquation) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isEquationNode(node) && node.getReferenceId() === referenceId) {
          node.setEquation(currentEquation);
        }
      });
    }

    if (!showEquationEditor && equationValue !== currentEquation) {
      setEquationValue(currentEquation);
    }
  }, [currentEquation, editor, equation, equationValue, nodeKey, referenceId, showEquationEditor]);

  useEffect(() => {
    if (!isEditable) {
      return;
    }
    if (showEquationEditor) {
      return mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          (/*payload*/) => {
            const activeElement = document.activeElement;
            const inputElem = inputRef.current;
            if (inputElem !== activeElement) {
              onHide();
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          (/*payload*/) => {
            const activeElement = document.activeElement;
            const inputElem = inputRef.current;
            if (inputElem === activeElement) {
              onHide(true);
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH,
        ),
      );
    } else {
      return editor.registerUpdateListener(({editorState}) => {
        const isSelected = editorState.read(() => {
          const selection = $getSelection();
          return (
            $isNodeSelection(selection) &&
            selection.has(nodeKey) &&
            selection.getNodes().length === 1
          );
        });
        if (isSelected) {
          showEditor();
        }
      });
    }
  }, [editor, nodeKey, onHide, showEditor, showEquationEditor, isEditable]);

  const tooltipLabel = linkedReference ? `@${linkedReference.name}` : null;

  return (
    <>
      {showEquationEditor && isEditable ? (
        <EquationEditor
          equation={equationValue}
          setEquation={setEquationValue}
          inline={inline}
          ref={inputRef}
        />
      ) : (
        <ErrorBoundary onError={(e: unknown) => editor._onError(e as Error)} fallback={null}>
          {tooltipLabel ? (
            <span
              className={`equation-ref-wrapper${inline ? '' : ' equation-ref-wrapper--block'}`}
            >
              <span className="equation-ref-tooltip">{tooltipLabel}</span>
              <KatexRenderer
                equation={equationValue}
                inline={inline}
                onDoubleClick={() => {
                  if (isEditable) {
                    showEditor();
                  }
                }}
              />
            </span>
          ) : (
            <KatexRenderer
              equation={equationValue}
              inline={inline}
              onDoubleClick={() => {
                if (isEditable) {
                  showEditor();
                }
              }}
            />
          )}
        </ErrorBoundary>
      )}
    </>
  );
}
