/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */


import "./editor.css";

import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { CAN_USE_DOM } from "@lexical/utils";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { useShallow } from 'zustand/react/shallow';

import { NodeHighlight } from "@/App/AppComponents/NodeHighlight/NodeHighlight";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { BREAKPOINTS } from "@/core/global/defaultValues";
import { useSharedHistoryContext } from "@/editor/context/SharedHistoryContext";
import AddNewPlugin from "@/editor/plugins/AddNew";
import AnqlMarkdownShortcutPlugin from "@/editor/plugins/AnqlMarkdownShortcutPlugin";
import AutoLinkPlugin from "@/editor/plugins/AutoLinkPlugin";
import { AutosavePlugin } from "@/editor/plugins/AutosavePlugin";
import CodeActionMenuPlugin from "@/editor/plugins/CodeActionMenuPlugin";
import CodeHighlightShikiPlugin from "@/editor/plugins/CodeHighlightShikiPlugin";
import ContextMenuPlugin from "@/editor/plugins/ContextMenuPlugin";
import CreateOnAutocompletePlugin from "@/editor/plugins/CreateOnAutocompletePlugin";
import DateTimePlugin from "@/editor/plugins/DateTimePlugin";
import DraggableBlockPlugin from "@/editor/plugins/DraggableBlockPlugin";
import EmptyStyleResetPlugin from "@/editor/plugins/EmptyStyleResetPlugin";
import EquationsPlugin from "@/editor/plugins/EquationsPlugin";
import ImagesPlugin from "@/editor/plugins/ImagesPlugin";
import LinkPlugin from "@/editor/plugins/LinkPlugin";
import ListPlugin from "@/editor/plugins/ListPlugin";
import MathPlugin from "@/editor/plugins/MathPlugin";
import MathAutocompletePlugin from "@/editor/plugins/MathAutocompletePlugin";
import PdfPlugin from "@/editor/plugins/PdfPlugin";
import RestoreFormatMemoryPlugin from "@/editor/plugins/RestoreFormatMemoryPlugin";
import ShortcutsPlugin from "@/editor/plugins/ShortcutsPlugin";
import StandardMarkdownPastePlugin from "@/editor/plugins/StandardMarkdownPastePlugin";
import TablePlugin from "@/editor/plugins/TablePlugin";
import TitlePlugin from "@/editor/plugins/TitlePlugin";
import ToolbarPlugin from "@/editor/plugins/ToolbarPlugin";
import ContentEditable from "@/editor/ui/ContentEditable";


export default function Editor(): JSX.Element {
  const { historyState } = useSharedHistoryContext();

  const isEditable = useLexicalEditable();
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] =
    useState<boolean>(false);
  const [editor] = useLexicalComposerContext();
  const { config } = useGlobalStore(useShallow((state) => ({ config: state.config })));

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport =
        CAN_USE_DOM && window.matchMedia(`(max-width: ${BREAKPOINTS.smallViewport}px)`).matches;

      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport);
      }
    };
    updateViewPortWidth();
    window.addEventListener("resize", updateViewPortWidth);

    return () => {
      window.removeEventListener("resize", updateViewPortWidth);
    };
  }, [isSmallWidthViewport]);

  useEffect(() => {
    setTimeout(() => {
      editor.update(() => {
        const root = $getRoot();
        const firstChild = root.getFirstChild();
        if (firstChild) {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            firstChild.selectStart();
          } else {
            editor.focus();
          }
        }
      });
    }, 50);
  }, [editor]);

  const { editorShellRef, editorContainerRef, editorRef, focusHighlight } = useGlobalStore(useShallow((state) => ({ editorShellRef: state.editorShellRef, editorContainerRef: state.editorContainerRef, editorRef: state.editorRef, focusHighlight: state.focusHighlight })));

  const [isOpen, setIsOpen] = useState(false);

  // 1. Trigger opening only when focusHighlight is active
  useEffect(() => {
    if (focusHighlight) {
      editor.blur();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [focusHighlight]);

  // 2. Block scroll when the box is open
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!isOpen || !container) return;

    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    const preventKeyScroll = (e: KeyboardEvent) => {
      const keysToPrevent = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", " "];
      if (keysToPrevent.includes(e.key)) {
        e.preventDefault();
      }
    };

    container.addEventListener("wheel", preventScroll, { passive: false });
    container.addEventListener("touchmove", preventScroll, { passive: false });
    container.addEventListener("keydown", preventKeyScroll, { passive: false });

    return () => {
      container.removeEventListener("wheel", preventScroll);
      container.removeEventListener("touchmove", preventScroll);
      container.removeEventListener("keydown", preventKeyScroll);
    };
  }, [isOpen, editorContainerRef]);

  // 3. Close the box when clicking anywhere
  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentClick = (e: MouseEvent) => {
      setIsOpen(false);
      useGlobalStore.getState().setFocusHighlight(null);
      if (editorContainerRef.current && editorContainerRef.current.contains(e.target as Node)) {
        editor.focus();
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isOpen, editor, editorContainerRef]);

  const setFusedRef = useCallback((element: unknown) => {
    onRef(element as HTMLDivElement);
    editorRef.current = element as HTMLDivElement;
  }, []);



  return (
    <>
      <div className="editor-shell" ref={editorShellRef}>
        <AutosavePlugin />
        <EmptyStyleResetPlugin />
        <RestoreFormatMemoryPlugin />
        <ShortcutsPlugin
          editor={editor}
        />
        <div
          className={"editor-container"}
          ref={editorContainerRef}
        >
          {/* <DragDropPaste /> */}
          <CreateOnAutocompletePlugin />
          <>
            <PdfPlugin />
            <HistoryPlugin externalHistoryState={historyState} />
            <RichTextPlugin
              contentEditable={
                <div className="editor-scroller">
                  <div className="editor" ref={setFusedRef}>
                    <TitlePlugin />
                    <ContentEditable />
                  </div>
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <MathPlugin />
            <MathAutocompletePlugin />
            <TablePlugin />
            <AddNewPlugin />
            <DateTimePlugin />
            <AnqlMarkdownShortcutPlugin useBrackets={config.editor.useBrackets} />
            <StandardMarkdownPastePlugin />
            <CodeHighlightShikiPlugin />
            <ListPlugin />
            <ImagesPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <ClickableLinkPlugin disabled={isEditable} />
            <HorizontalRulePlugin />
            <EquationsPlugin />
            <TabIndentationPlugin maxIndent={7} />
            {floatingAnchorElem && !isSmallWidthViewport && (
              <>
                <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
                <CodeActionMenuPlugin />
                <ToolbarPlugin anchorElem={floatingAnchorElem} />
              </>
            )}
          </>
          <ContextMenuPlugin />
        </div>
      </div>
      {isOpen && (
        <NodeHighlight
          editor={editor}
          elementRect={focusHighlight?.elementRect}
          draggableElement={focusHighlight?.element}
          isOpen={isOpen}
        />
      )}
    </>
  );
}
