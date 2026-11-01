import './ReferencePlugin.css';

import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { $isCodeNode } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  LexicalEditor,
  TextNode,
} from 'lexical';
import { Image, Plus, Type } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { ReferenceJson } from '@/core/database/useReferenceDatabase';
import { logger } from '@/core/logger';
import { useReferenceStore } from '@/core/references/useReferenceStore';
import { $createImageNode } from '@/editor/nodes/ImageNode/ImageNode';
import { $isMathExpNode } from '@/editor/nodes/MathNode/MathExpNode';

class ReferenceMenuOption extends MenuOption {
  reference?: ReferenceJson;
  isCreateAction: boolean;
  createName?: string;

  constructor(
    title: string,
    reference?: ReferenceJson,
    isCreateAction = false,
    createName?: string,
  ) {
    super(title);
    this.reference = reference;
    this.isCreateAction = isCreateAction;
    this.createName = createName;
  }
}

// Trigger when typing @ followed by alphanumeric / underscore
const AT_TRIGGER_REGEX = /(?:^|[\s(+\-*/=,;:])@([a-zA-Z0-9_]*)$/;

function checkForReferenceMatch(text: string, editor: LexicalEditor) {
  // Do not trigger inside MathExpNode or CodeNode
  let isIgnoredNode = false;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const parent = anchorNode.getParent();
      const topLevel = anchorNode.getTopLevelElement();
      if (
        $isMathExpNode(anchorNode) ||
        $isMathExpNode(parent) ||
        $isCodeNode(anchorNode) ||
        $isCodeNode(parent) ||
        $isCodeNode(topLevel)
      ) {
        isIgnoredNode = true;
      }
    }
  });

  if (isIgnoredNode) {
    return null;
  }

  const match = AT_TRIGGER_REGEX.exec(text);
  if (match !== null) {
    const query = match[1] ?? '';
    const atIndex = match.index + match[0].lastIndexOf('@');
    return {
      leadOffset: atIndex,
      matchingString: query,
      replaceableString: `@${query}`,
    };
  }

  return null;
}

function AnchorUpdater({
  anchorElementRef,
  setReference,
}: {
  anchorElementRef: React.MutableRefObject<HTMLElement | null>;
  setReference: (node: HTMLElement | null) => void;
}) {
  React.useEffect(() => {
    setReference(anchorElementRef.current);
  }, [anchorElementRef, anchorElementRef.current, setReference]);
  return null;
}

export default function ReferencePlugin(): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const references = useReferenceStore((state) => state.references);
  const isLoaded = useReferenceStore((state) => state.isLoaded);
  const loadReferences = useReferenceStore((state) => state.loadReferences);
  const popoverRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isLoaded) {
      loadReferences().catch((error: unknown) => {
        logger.error('Failed to load references for autocomplete', error as Error);
      });
    }
  }, [isLoaded, loadReferences]);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const options = useMemo(() => {
    if (queryString === null) return [];
    const q = queryString.toLowerCase().trim();

    const filtered = q
      ? references.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.value.toLowerCase().includes(q),
        )
      : references;

    const items: ReferenceMenuOption[] = filtered.map(
      (ref) => new ReferenceMenuOption(`@${ref.name}`, ref),
    );

    // If query typed does not exactly match any reference, offer quick creation
    if (q && !references.some((r) => r.name.toLowerCase() === q)) {
      items.push(
        new ReferenceMenuOption(
          `Créer la référence "@${queryString.trim()}"`,
          undefined,
          true,
          queryString.trim().replace(/\s+/g, '_'),
        ),
      );
    }

    return items;
  }, [queryString, references]);

  const onSelectOption = useCallback(
    async (
      selectedOption: ReferenceMenuOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      if (nodeToReplace == null) {
        closeMenu();
        return;
      }

      if (selectedOption.isCreateAction && selectedOption.createName) {
        const nodeKey = nodeToReplace.getKey();
        try {
          const reference = await useReferenceStore.getState().addReference(
            selectedOption.createName,
            'text',
            '',
          );
          editor.update(() => {
            const currentNode = $getNodeByKey(nodeKey);
            if (!$isTextNode(currentNode)) return;
            const textNode = new TextNode(`@${reference.name}`);
            currentNode.replace(textNode);
            textNode.select();
          });
        } catch (error) {
          logger.error('Failed to create reference from autocomplete', error as Error, {
            name: selectedOption.createName,
          });
        } finally {
          closeMenu();
        }
        return;
      }

      editor.update(() => {
        const ref = selectedOption.reference;
        if (!ref) return;

        if (ref.ref_type === 'image') {
          // Insertion dans le bloc suivant pour les images (vrai ImageNode Lexical)
          const parentBlock = nodeToReplace.getTopLevelElementOrThrow();
          nodeToReplace.remove();

          const imageNode = $createImageNode({
            src: ref.value,
            altText: ref.name,
            maxWidth: 600,
          });

          if (parentBlock.getTextContent().trim() === '') {
            parentBlock.replace(imageNode);
          } else {
            parentBlock.insertAfter(imageNode);
          }

          const nextParagraph = $createParagraphNode();
          imageNode.insertAfter(nextParagraph);
          nextParagraph.select();
        } else {
          // Insertion immédiate comme vrai TextNode Lexical
          const textToInsert = ref.value || ref.name;
          const textNode = new TextNode(textToInsert);
          nodeToReplace.replace(textNode);
          textNode.select();
        }
      });

      closeMenu();
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<ReferenceMenuOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForReferenceMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (anchorElementRef.current == null || options.length === 0) {
          return null;
        }

        return (
          <>
            <AnchorUpdater
              anchorElementRef={anchorElementRef}
              setReference={refs.setReference}
            />
            <div
              ref={(node) => {
                refs.setFloating(node);
                popoverRef.current = node;
              }}
              className="reference-typeahead-popover"
              style={floatingStyles}
            >
              <ul>
                {options.map((option, i) => {
                  const isSelected = selectedIndex === i;
                  const isCreate = option.isCreateAction;
                  const ref = option.reference;

                  return (
                    <li
                      key={option.key}
                      tabIndex={-1}
                      className={`reference-typeahead-item${
                        isSelected ? ' selected' : ''
                      }${isCreate ? ' reference-typeahead-item--create' : ''}`}
                      ref={option.setRefElement}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => selectOptionAndCleanUp(option)}
                    >
                      <span className="reference-typeahead-item__icon">
                        {isCreate ? (
                          <Plus size={12} />
                        ) : ref?.ref_type === 'image' ? (
                          <Image size={12} />
                        ) : ref?.ref_type === 'number' ? (
                          '#'
                        ) : (
                          <Type size={12} />
                        )}
                      </span>

                      <div className="reference-typeahead-item__content">
                        <span className="reference-typeahead-item__name">
                          {isCreate ? option.title : `@${ref?.name}`}
                        </span>
                        {!isCreate && ref && (
                          <span className="reference-typeahead-item__preview">
                            {ref.ref_type === 'image'
                              ? '[Image]'
                              : ref.value || '(vide)'}
                          </span>
                        )}
                      </div>

                      {!isCreate && ref && (
                        <span className="reference-typeahead-item__badge">
                          {ref.ref_type}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        );
      }}
    />
  );
}
