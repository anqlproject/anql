import "./index.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_UP_COMMAND,
} from "lexical";
import React, { useCallback, useEffect, useRef } from "react";
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";
import { updateDocumentTitle } from "@/core/database/useDocumentDatabase";

const TitlePlugin = () => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { setModified,
    modified,
    documentIsModified,
    currentDocument,
    setCurrentDocument,
    config } = useGlobalStore(useShallow((state) => ({ setModified: state.setModified, modified: state.modified, documentIsModified: state.documentIsModified, currentDocument: state.currentDocument, setCurrentDocument: state.setCurrentDocument, config: state.config })));

  const currentTitle = currentDocument.title;
  const lastCaretPos = useRef<number>(0);

  const setCursorToEnd = useCallback((element: HTMLElement) => {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    lastCaretPos.current = element.textContent?.length || 0;
  }, []);

  const updateCaretPos = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && titleRef.current) {
      const range = selection.getRangeAt(0);
      if (titleRef.current.contains(range.startContainer)) {
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          lastCaretPos.current = range.startOffset;
        } else if (range.startContainer === titleRef.current) {
          // Fallback if the selection is on the element itself
          lastCaretPos.current = 0;
        }
      }
    }
  };

  // Update title when currentTitle changes
  useEffect(() => {
    if (titleRef.current && currentTitle !== titleRef.current.textContent) {
      titleRef.current.textContent = currentTitle;
      setCursorToEnd(titleRef.current);
    }
  }, [currentTitle, setCursorToEnd]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      // Replace the first node with a paragraph node
      editor.update(() => {
        const root = $getRoot();
        const firstNode = root.getFirstChild();
        const paragraphNode = $createParagraphNode();

        if (firstNode) {
          firstNode.replace(paragraphNode);
        } else {
          root.append(paragraphNode);
        }

        // Set selection to the paragraph node
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          paragraphNode.selectStart();
        }
      });
      editor.focus();
    }
    // We don't update caret pos here because if we are moving focus,
    // we want to keep the position BEFORE the move.
    // If we are just typing or moving cursor within title, onKeyUp/onInput handles it.
  };

  const handleKeyUp = () => {
    updateCaretPos();
  };

  const handleMouseUp = () => {
    updateCaretPos();
  };

  const handleInput = () => {
    updateCaretPos();
    setTimeout(() => {
      if (titleRef.current) {
        const newTitle = titleRef.current.textContent || "";

        setModified({
          type: "title",
          key: currentDocument.id,
          id: newTitle,
        });
      }
    }, 100);
  };

  // Focus on title on mount
  /*useEffect(() => {
    if (titleRef.current) {
      titleRef.current.focus();
    }
  }, []);*/

  // Handle arrow up key command - move focus to title when user scrolls up from editor
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const rootElement = editor.getRootElement();
            if (rootElement) {
              const rootRect = rootElement.getBoundingClientRect();
              const lineHeight =
                parseInt(window.getComputedStyle(rootElement).lineHeight) || 20;

              // Use Lexical selection to get current node and check content
              const hasContent = editor.getEditorState().read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return false;

                // Get the current node from Lexical selection
                const currentNode = selection.anchor.getNode();
                if (!currentNode) return false;

                // Check if the node has meaningful content
                const nodeText = currentNode.getTextContent();
                return nodeText.trim().length > 0;
              });

              // Only navigate to title if we're on first line AND node has content
              if (hasContent && rect.top - rootRect.top < lineHeight) {
                if (titleRef.current) {
                  titleRef.current.focus();

                  // Restore caret position
                  const textNode = titleRef.current.firstChild;
                  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                    const newRange = document.createRange();
                    const len = textNode.textContent?.length || 0;
                    const pos = Math.min(lastCaretPos.current, len);
                    try {
                      newRange.setStart(textNode, pos);
                      newRange.setEnd(textNode, pos);
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(newRange);
                    } catch (e) {
                      console.warn(
                        "Failed to restore caret position in title",
                        e,
                      );
                    }
                  } else if (titleRef.current.textContent === "") {
                    // Handle empty title case
                    // focus() already puts caret at start, which is correct for empty.
                  }

                  event.preventDefault();
                  return true;
                }
              }
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  function titleUpdateFunction() {
    if (titleRef.current && documentIsModified() && modified.type === "title") {
      try {
        console.log("auto save title");
        const titleContent = titleRef.current.textContent || "";
        updateDocumentTitle(currentDocument.id, titleContent);
        setModified({ type: "", key: "", id: "" });

        // Update local document state without fetching from DB to avoid cursor jump
        setCurrentDocument({
          ...currentDocument,
          title: titleContent,
        });
      } catch (error) {
        console.error("Error updating title:", error);
      }
    }
  }

  const handleTitleBlur = () => {
    titleUpdateFunction();
  };

  // NOTE : auto save title every 1s
  useEffect(() => {
    const interval = setInterval(() => {
      titleUpdateFunction();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [modified, currentDocument.id]);

  return (
    <h1
      ref={titleRef}
      className={`title-plugin`}
      contentEditable={isEditable}
      suppressContentEditableWarning
      spellCheck={config.editor.spellCheck}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseUp={handleMouseUp}
      onInput={handleInput}
      onBlur={handleTitleBlur}
      data-placeholder="Enter title..."
    />
  );
};

export default TitlePlugin;
