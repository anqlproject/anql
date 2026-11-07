import './ReferencePlugin.css';

import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { $createCodeNode, $isCodeNode } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  $setState,
  COMMAND_PRIORITY_HIGH,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  getDOMSelectionFromTarget,
  isHTMLElement,
  LexicalEditor,
  TextNode,
} from 'lexical';
import { Code2, FileText, Image, Plus, Sigma, Type } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { isReferenceInTrash, ReferenceJson } from '@/core/database/useReferenceDatabase';
import { logger } from '@/core/logger';
import {
  REFERENCE_CODE_DRAG_TYPE,
  REFERENCE_DRAG_TYPE,
  REFERENCE_IMAGE_DRAG_TYPE,
  REFERENCE_LATEX_DRAG_TYPE,
  REFERENCE_PDF_DRAG_TYPE,
  REFERENCE_TEXT_DRAG_TYPE,
} from '@/core/references/referenceDragTypes';
import { useReferenceStore } from '@/core/references/useReferenceStore';
import { $createEquationNode } from '@/editor/nodes/EquationNode/EquationNode';
import { $createImageNode } from '@/editor/nodes/ImageNode/ImageNode';
import { $isMathExpNode } from '@/editor/nodes/MathNode/MathExpNode';
import { $createPdfNode } from '@/editor/nodes/PdfNode/PdfNode';
import { $isTableNode } from '@/editor/nodes/TableNode/TableNode';

const BLOCK_REFERENCE_DRAG_TYPES = [REFERENCE_CODE_DRAG_TYPE, REFERENCE_IMAGE_DRAG_TYPE];

function hasReferenceDragData(event: DragEvent): boolean {
  return Boolean(
    event.dataTransfer &&
    Array.from(event.dataTransfer.types).some((type) =>
      [
        REFERENCE_DRAG_TYPE,
        REFERENCE_CODE_DRAG_TYPE,
        REFERENCE_IMAGE_DRAG_TYPE,
        REFERENCE_LATEX_DRAG_TYPE,
        REFERENCE_PDF_DRAG_TYPE,
        REFERENCE_TEXT_DRAG_TYPE,
      ].includes(type),
    ),
  );
}

function isDropInsideEditor(event: DragEvent, editor: LexicalEditor): boolean {
  const target = event.target;
  const rootElement = editor.getRootElement();
  return isHTMLElement(target) && rootElement !== null && rootElement.contains(target);
}

function getReferenceDropRange(event: DragEvent, editor: LexicalEditor): Range | null {
  const target = event.target;
  if (isHTMLElement(target)) {
    const tableContainer = target.closest<HTMLElement>('.table-container');
    const tableNodeKey = tableContainer?.dataset.nodeKey;
    const tableElement = tableNodeKey ? editor.getElementByKey(tableNodeKey) : null;
    if (tableElement) {
      const cell = target.closest<HTMLElement>('.table-cell');
      if (cell) {
        const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
        if (range && cell.contains(range.startContainer)) return range;

        const cellRange = document.createRange();
        cellRange.selectNodeContents(cell);
        cellRange.collapse(event.clientX >= cell.getBoundingClientRect().left + cell.getBoundingClientRect().width / 2);
        return cellRange;
      }

      const tableRect = tableElement.getBoundingClientRect();
      const range = document.createRange();
      if (event.clientY < tableRect.top + tableRect.height / 2) {
        range.setStartBefore(tableElement);
      } else {
        range.setStartAfter(tableElement);
      }
      range.collapse(true);
      return range;
    }
  }

  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (range) return range;

  const domSelection = getDOMSelectionFromTarget(target);
  if (event.rangeParent && domSelection) {
    domSelection.collapse(event.rangeParent, event.rangeOffset ?? 0);
    return domSelection.getRangeAt(0);
  }

  return null;
}

function insertReferenceIntoTableCell(
  event: DragEvent,
  editor: LexicalEditor,
  reference: ReferenceJson,
): boolean | null {
  const target = event.target;
  if (!isHTMLElement(target)) return null;

  const tableContainer = target.closest<HTMLElement>('.table-container');
  const cell = target.closest<HTMLElement>('.table-cell');
  if (!tableContainer || !cell) return null;

  const row = cell?.closest<HTMLElement>('.table-row[data-row-id]');
  const tableKey = tableContainer?.dataset.nodeKey;
  const rowId = row?.dataset.rowId;
  const columnIndex = Number(cell?.dataset.columnIndex);
  if (!tableKey || !rowId || !Number.isInteger(columnIndex)) return false;

  const input = target.closest<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  const range = getReferenceDropRange(event, editor);
  let insertionOffset = 0;
  const display = cell.querySelector<HTMLElement>('.table-cell-display');
  const currentText = input?.value ?? display?.textContent ?? cell.textContent ?? '';

  if (input) {
    insertionOffset = input.selectionStart ?? currentText.length;
  } else if (range && display?.contains(range.startContainer)) {
    const prefixRange = document.createRange();
    prefixRange.selectNodeContents(display);
    prefixRange.setEnd(range.startContainer, range.startOffset);
    insertionOffset = prefixRange.toString().length;
  } else {
    insertionOffset = currentText.length;
  }
  insertionOffset = Math.max(0, Math.min(insertionOffset, currentText.length));

  let inserted = false;
  editor.update(() => {
    const tableNode = $getNodeByKey(tableKey);
    if (!$isTableNode(tableNode)) return;

    const rowIndex = tableNode.__data.findIndex((tableRow) => tableRow._rowId === rowId);
    if (rowIndex < 0) return;

    const valueToInsert = reference.value || reference.name;
    const updatedText =
      currentText.slice(0, insertionOffset) +
      valueToInsert +
      currentText.slice(insertionOffset);
    const updatedData = tableNode.__data.map((tableRow, index) => {
      if (index !== rowIndex) return tableRow;
      if (columnIndex === -1) return { ...tableRow, rowHeader: updatedText };

      const column = tableNode.__columns[columnIndex];
      if (!column || (column.meta?.type && column.meta.type !== 'text')) return tableRow;
      return { ...tableRow, [column.id]: updatedText };
    });

    if (updatedData[rowIndex] !== tableNode.__data[rowIndex]) {
      tableNode.updateData(updatedData);
      inserted = true;
    }
  });

  return inserted;
}

import {
  codeReferenceIdState,
  codeReferenceValueVersionState,
  getReferenceValueVersion,
} from './referenceState';

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
  const activeReferences = references.filter((reference) => !isReferenceInTrash(reference));
  const isLoaded = useReferenceStore((state) => state.isLoaded);
  const loadReferences = useReferenceStore((state) => state.loadReferences);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dragScrollContainerRef = useRef<HTMLElement | null>(null);
  const dragScrollDirectionRef = useRef<-1 | 0 | 1>(0);
  const dragScrollIntervalRef = useRef<number | null>(null);
  const dropCaretRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isLoaded) {
      loadReferences().catch((error: unknown) => {
        logger.error('Failed to load references for autocomplete', error as Error);
      });
    }
  }, [isLoaded, loadReferences]);

  React.useEffect(() => {
    const stopDragAutoScroll = () => {
      dragScrollDirectionRef.current = 0;
      if (dragScrollIntervalRef.current !== null) {
        window.clearInterval(dragScrollIntervalRef.current);
        dragScrollIntervalRef.current = null;
      }
      dragScrollContainerRef.current = null;
    };

    const hideDropCaret = () => {
      if (dropCaretRef.current) dropCaretRef.current.style.display = 'none';
    };

    const showDropCaret = (range: Range, event: DragEvent) => {
      const caret = dropCaretRef.current;
      if (!caret) return;

      const rect = range.getBoundingClientRect();
      const isVisibleRect = rect.height > 0;
      caret.style.left = `${isVisibleRect ? rect.left : event.clientX}px`;
      caret.style.top = `${isVisibleRect ? rect.top : event.clientY - 10}px`;
      caret.style.height = `${isVisibleRect ? rect.height : 20}px`;
      caret.style.display = 'block';
    };

    const updateDragAutoScroll = (event: DragEvent) => {
      const root = editor.getRootElement();
      const scrollContainer = root?.closest<HTMLElement>('.editor-container') ?? null;
      if (!scrollContainer) {
        stopDragAutoScroll();
        return;
      }

      const rect = scrollContainer.getBoundingClientRect();
      const edgeSize = 48;
      const canScrollUp = scrollContainer.scrollTop > 0;
      const canScrollDown =
        scrollContainer.scrollTop + scrollContainer.clientHeight < scrollContainer.scrollHeight;
      const direction = event.clientY <= rect.top + edgeSize && canScrollUp
        ? -1
        : event.clientY >= rect.bottom - edgeSize && canScrollDown
          ? 1
          : 0;

      dragScrollContainerRef.current = scrollContainer;
      dragScrollDirectionRef.current = direction;
      if (direction === 0 || dragScrollIntervalRef.current !== null) return;

      dragScrollIntervalRef.current = window.setInterval(() => {
        const container = dragScrollContainerRef.current;
        const currentDirection = dragScrollDirectionRef.current;
        if (!container || currentDirection === 0) {
          stopDragAutoScroll();
          return;
        }

        container.scrollTop += currentDirection * 10;
        const reachedEdge = currentDirection < 0
          ? container.scrollTop <= 0
          : container.scrollTop + container.clientHeight >= container.scrollHeight;
        if (reachedEdge) stopDragAutoScroll();
      }, 20);
    };

    const handleDragEndWithCaret = () => {
      stopDragAutoScroll();
      hideDropCaret();
    };
    const handleDocumentDragOver = (event: DragEvent) => {
      if (
        !hasReferenceDragData(event) ||
        Array.from(event.dataTransfer?.types ?? []).some((type) =>
          BLOCK_REFERENCE_DRAG_TYPES.includes(type),
        )
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node) || !dragScrollContainerRef.current?.contains(target)) {
        stopDragAutoScroll();
      }
      if (!(target instanceof Node) || !editor.getRootElement()?.contains(target)) {
        hideDropCaret();
      }
    };
    document.addEventListener('dragend', handleDragEndWithCaret);
    document.addEventListener('dragover', handleDocumentDragOver);

    const unregisterDragOver = editor.registerCommand<DragEvent>(
      DRAGOVER_COMMAND,
      (event) => {
        if (!editor.isEditable() || !hasReferenceDragData(event) || !isDropInsideEditor(event, editor)) {
          return false;
        }

        if (
          Array.from(event.dataTransfer?.types ?? []).some((type) =>
            BLOCK_REFERENCE_DRAG_TYPES.includes(type),
          )
        ) {
          return false;
        }

        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        updateDragAutoScroll(event);
        const range = getReferenceDropRange(event, editor);
        if (range) showDropCaret(range, event);
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
    const unregisterDrop = editor.registerCommand<DragEvent>(
      DROP_COMMAND,
      (event) => {
        if (!editor.isEditable() || !hasReferenceDragData(event) || !isDropInsideEditor(event, editor)) {
          return false;
        }

        event.preventDefault();
        stopDragAutoScroll();
        hideDropCaret();
        const dragValue = event.dataTransfer?.getData(REFERENCE_DRAG_TYPE);
        const reference = references.find(
          (item) =>
            !isReferenceInTrash(item) &&
            (item.id === dragValue || `name:${item.name}` === dragValue),
        );
        if (reference?.ref_type === 'text') {
          const tableCellDrop = insertReferenceIntoTableCell(event, editor, reference);
          if (tableCellDrop !== null) return true;
        }

        const range = getReferenceDropRange(event, editor);
        if (!reference || !range) return true;

        const rangeSelection = $createRangeSelection();
        rangeSelection.applyDOMRange(range);
        $setSelection(rangeSelection);

        if (reference.ref_type === 'latex') {
          $insertNodes([$createEquationNode(reference.value, true, reference.id ?? undefined)]);
        } else if (reference.ref_type === 'pdf') {
          $insertNodes([$createPdfNode(reference.value, reference.name, reference.id ?? undefined)]);
        } else if (reference.ref_type === 'image' || reference.ref_type === 'code') {
          const parentBlock = rangeSelection.anchor.getNode().getTopLevelElementOrThrow();
          const blockNode = reference.ref_type === 'image'
            ? $createImageNode({
                src: reference.value,
                altText: reference.name,
                maxWidth: 600,
                referenceId: reference.id ?? undefined,
              })
            : $createCodeNode().append($createTextNode(reference.value));
          if (reference.ref_type === 'code' && reference.id) {
            $setState(blockNode, codeReferenceIdState, reference.id);
            $setState(blockNode, codeReferenceValueVersionState, getReferenceValueVersion(reference.value));
          }

          if (
            parentBlock.getType() === 'paragraph' &&
            parentBlock.getTextContent().trim() === ''
          ) {
            parentBlock.replace(blockNode);
          } else {
            const blockElement = editor.getElementByKey(parentBlock.getKey());
            const blockRect = blockElement?.getBoundingClientRect();
            if (blockRect && event.clientY < blockRect.top) {
              parentBlock.insertBefore(blockNode);
            } else {
              parentBlock.insertAfter(blockNode);
            }
          }

          const nextParagraph = $createParagraphNode();
          blockNode.insertAfter(nextParagraph);
          nextParagraph.select();
        } else {
          $insertNodes([$createTextNode(reference.value || reference.name)]);
        }

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      document.removeEventListener('dragend', handleDragEndWithCaret);
      document.removeEventListener('dragover', handleDocumentDragOver);
      stopDragAutoScroll();
      hideDropCaret();
      unregisterDragOver();
      unregisterDrop();
    };
  }, [editor, references]);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const options = useMemo(() => {
    if (queryString === null || !isLoaded) return [];
    const q = queryString.toLowerCase().trim();

    const filtered = q
      ?       activeReferences.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.value.toLowerCase().includes(q),
        )
      : activeReferences;

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
  }, [queryString, activeReferences, isLoaded]);

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
        const originalText = nodeToReplace.getTextContent();
        try {
          const reference = await useReferenceStore.getState().addReference(
            selectedOption.createName,
            'text',
            '',
          );
          editor.update(() => {
            const currentNode = $getNodeByKey(nodeKey);
            if (!$isTextNode(currentNode) || currentNode.getTextContent() !== originalText) return;
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
            referenceId: ref.id ?? undefined,
          });

          if (parentBlock.getTextContent().trim() === '') {
            parentBlock.replace(imageNode);
          } else {
            parentBlock.insertAfter(imageNode);
          }

          const nextParagraph = $createParagraphNode();
          imageNode.insertAfter(nextParagraph);
          nextParagraph.select();
        } else if (ref.ref_type === 'latex') {
          const equationNode = $createEquationNode(ref.value, true, ref.id ?? undefined);
          nodeToReplace.replace(equationNode);
          equationNode.selectNext();
        } else if (ref.ref_type === 'pdf') {
          const pdfNode = $createPdfNode(ref.value, ref.name, ref.id ?? undefined);
          nodeToReplace.replace(pdfNode);
          pdfNode.selectNext();
        } else if (ref.ref_type === 'code') {
          const parentBlock = nodeToReplace.getTopLevelElementOrThrow();
          nodeToReplace.remove();

          const codeNode = $createCodeNode().append($createTextNode(ref.value));
          if (ref.id) {
            $setState(codeNode, codeReferenceIdState, ref.id);
            $setState(codeNode, codeReferenceValueVersionState, getReferenceValueVersion(ref.value));
          }
          if (parentBlock.getTextContent().trim() === '') {
            parentBlock.replace(codeNode);
          } else {
            parentBlock.insertAfter(codeNode);
          }

          const nextParagraph = $createParagraphNode();
          codeNode.insertAfter(nextParagraph);
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
    <>
    {createPortal(<div ref={dropCaretRef} className="reference-drop-caret" />, document.body)}
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
                if (popoverRef.current !== node) {
                  popoverRef.current = node;
                }
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
                        ) : ref?.ref_type === 'code' ? (
                          <Code2 size={12} />
                        ) : ref?.ref_type === 'pdf' ? (
                          <FileText size={12} />
                        ) : ref?.ref_type === 'latex' ? (
                          <Sigma size={12} />
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
                                : ref.ref_type === 'pdf'
                                  ? '[PDF]'
                                : ref.ref_type === 'latex'
                                  ? '[LaTeX]'
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
    </>
  );
}
