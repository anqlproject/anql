import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  BaseSelection,
  COMMAND_PRIORITY_LOW,
} from "lexical";
import { useEffect, useRef, useState } from "react";
import { useShallow } from 'zustand/react/shallow';

import useModal from "@/App/hooks/useModal";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { extractLinkTypeFromUrl } from "@/App/utils/url";
import { ContextMenuX } from "@/components/custom/Menu/ContextMenuX";
import { MenuPosition } from "@/components/custom/Menu/MenuX";
import { uploadAssetIfNeeded } from "@/core/database/useAssetDatabase";
import {
  $isLinkNode,
  LinkType,
} from "@/editor/nodes/LinkNode/LinkNode";
import { $isPdfNode } from "@/editor/nodes/PdfNode/PdfNode";
import { $isTableNode } from "@/editor/nodes/TableNode/TableNode";
import { INSERT_LINK_COMMAND, OPEN_CUSTOM_LINK_DIALOG_COMMAND } from "@/editor/plugins/LinkPlugin";
import { CustomLinkDialog } from "@/editor/plugins/LinkPlugin/CustomLinkDialog";
import { INSERT_PDF_COMMAND } from "@/editor/plugins/PdfPlugin";
import { PdfDialog } from "@/editor/plugins/PdfPlugin/PdfDialog";

import { ContextMenuItems } from "./contextMenuList";
import CustomCaret from "./CustomCaret";
import { HightlightSelectedText } from "./HighlightSelectedText";

export default function ContextMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const { editorRef, setIsContextMenuOpen, overlayMenuContainerRef } = useGlobalStore(useShallow((state) => ({ editorRef: state.editorRef, setIsContextMenuOpen: state.setIsContextMenuOpen, overlayMenuContainerRef: state.overlayMenuContainerRef })));

  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    x: 0,
    y: 0,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const relativePositionRef = useRef({ x: 0, y: 0 });
  const reff = useRef<BaseSelection | null>(null);
  const [caretPosition, setCaretPosition] = useState({ x: 0, y: 0 });
  const [showCaret, setShowCaret] = useState(false);
  const [caretTimestamp, setCaretTimestamp] = useState(0);
  const [selectionRects, setSelectionRects] = useState<DOMRect[]>([]);

  /**
   * Force Lexical selection at a screen point X, Y
   * @param {LexicalEditor} editor - Your Lexical editor instance
   * @param {number} x - Horizontal position (clientX)
   * @param {number} y - Vertical position (clientY)
   */
  function selectTextAtPoint(x: number, y: number) {
    let range: Range | null = null;

    // 1. Get the native DOM Range at coordinates X and Y
    if (document.caretRangeFromPoint) {
      // Chrome, Edge, Safari
      range = document.caretRangeFromPoint(x, y);
    } else if ((document as Document).caretPositionFromPoint) {
      // Firefox
      const position = document.caretPositionFromPoint(x, y);
      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.setEnd(position.offsetNode, position.offset);
      }
    }

    // If the browser found text at this location
    if (range) {
      const domNode = range.startContainer;
      const offset = range.startOffset;

      // 2. Open Lexical write cycle to apply selection
      editor.update(() => {
        // Find the Lexical node corresponding to the touched DOM node
        const lexicalNode = $getNearestNodeFromDOMNode(domNode);

        if (lexicalNode !== null) {
          // Create a new Range selection (Cursor or Highlight)
          const selection = $createRangeSelection();

          // Place the anchor (start and end point) at the correct node index
          if ($isElementNode(lexicalNode)) {
            selection.anchor.set(lexicalNode.getKey(), offset, "element");
            selection.focus.set(lexicalNode.getKey(), offset, "element");
          } else if ($isTextNode(lexicalNode)) {
            selection.anchor.set(lexicalNode.getKey(), offset, "text");
            selection.focus.set(lexicalNode.getKey(), offset, "text");
          } else {
            // NOTES : fix error on context menu empty table cell
            const parent = lexicalNode.getParent();
            if (parent && $isElementNode(parent)) {
              const index = lexicalNode.getIndexWithinParent();
              selection.anchor.set(parent.getKey(), index, "element");
              selection.focus.set(parent.getKey(), index, "element");
            }
          }

          // Afficher le custom caret à la position
          const rects = range.getClientRects();
          if (rects && rects.length > 0) {
            const rect = rects[0];
            setCaretPosition({ x: rect.left, y: rect.top });
            setShowCaret(true);
            setCaretTimestamp(Date.now()); // Forcer le re-render même si position identique
          } else {
            // NOTES : custom caret on empty node
            const element = editor.getElementByKey(lexicalNode.getKey());
            if (element) {
              const rect = element.getBoundingClientRect();
              setCaretPosition({ x: rect.left, y: rect.top });
              setShowCaret(true);
              setCaretTimestamp(Date.now());
            }
          }
        }
      });

      // 3. Force the browser to visually display the blinking cursor
      // (Sometimes necessary to force visual focus outside the Lexical tree)
      const windowSelection = window.getSelection();
      if (windowSelection) {
        windowSelection.removeAllRanges();
        windowSelection.addRange(range);
      }
    }
  }

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    const handleContextMenu = (event: MouseEvent) => {
      // Check if right-clicked on a LinkNode
      let isCustomLink = false;
      let isPdf = false;
      editor.read(() => {
        const node = $getNearestNodeFromDOMNode(event.target as HTMLElement);
        if ($isLinkNode(node)) {
          // Show edit dialog for the link with current values
          setEditLinkDialog({
            nodeKey: node.getKey(),
            url: node.getUrl(),
            name: node.getName(),
            linkType: node.getLinkType(),
          });
          isCustomLink = true;
        } else if ($isPdfNode(node)) {
          // Show edit dialog for the PDF with current values
          setEditPdfDialog({
            nodeKey: node.getKey(),
            url: node.getUrl(),
            name: node.getName(),
          });
          isPdf = true;
        }
      });

      // If it's a link or PDF, don't show the regular context menu
      if (isCustomLink || isPdf) {
        event.preventDefault();
        return;
      }

      let isTableNode = false;
      let node = null;
      editor.read(() => {
        node = $getNearestNodeFromDOMNode(event.target as HTMLElement);
        if ($isTableNode(node)) {
          isTableNode = true;
        }
      });

      if (isTableNode || !node) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }

        const rawTextContent = selection.getTextContent().replace(/\n/g, "");
        if (selection.isCollapsed() && rawTextContent === "") {
          selectTextAtPoint(event.clientX, event.clientY);
        }

        if (editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect();
          relativePositionRef.current = {
            x: event.clientX - editorRect.left,
            y: event.clientY - editorRect.top,
          };
        }

        reff.current = selection;

        // Capture selection rects before blur
        const domSelection = window.getSelection();
        if (domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          if (!range.collapsed) {
            setSelectionRects(Array.from(range.getClientRects()));
          } else {
            setSelectionRects([]);
          }
        } else {
          setSelectionRects([]);
        }

        setIsContextMenuOpen(true);
        setIsMenuOpen(true);
        setMenuPosition({ x: event.clientX, y: event.clientY });
      });

      // NOTES: prevent focus on editor when right click
      editor.blur();
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (target === overlayMenuContainerRef.current) {
        // nothing
      }
    };

    const handleResize = () => {
      if (!isMenuOpen || !editorRef.current) return;
      const editorRect = editorRef.current.getBoundingClientRect();
      setMenuPosition({
        x: editorRect.left + relativePositionRef.current.x,
        y: editorRect.top + relativePositionRef.current.y,
      });
    };

    if (editorRef.current) {
      editorRef.current.addEventListener("contextmenu", handleContextMenu);
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleResize);

    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener("contextmenu", handleContextMenu);
      }
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleResize);
    };
  }, [editor, editorRef, isMenuOpen]);

  useEffect(() => {
    return editor.registerCommand(
      OPEN_CUSTOM_LINK_DIALOG_COMMAND,
      (payload) => {
        setCustomLinkDialog({
          initialUrl: payload.url,
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  const [modal, showModal] = useModal();
  const [customLinkDialog, setCustomLinkDialog] = useState<{
    initialUrl?: string;
  } | null>(null);
  const [editLinkDialog, setEditLinkDialog] = useState<{
    nodeKey: string;
    url: string;
    name: string;
    linkType: LinkType;
  } | null>(null);
  const [pdfDialog, setPdfDialog] = useState<boolean | null>(false);
  const [editPdfDialog, setEditPdfDialog] = useState<{
    nodeKey: string;
    url: string;
    name: string;
  } | null>(null);
  const contextMenuItems = ContextMenuItems(
    setIsMenuOpen,
    showModal,
    setCustomLinkDialog,
    setPdfDialog,
  );


  const handleCustomLinkConfirm = (url: string, name: string) => {
    const linkType = extractLinkTypeFromUrl(url);

    editor.dispatchCommand(INSERT_LINK_COMMAND, {
      url,
      linkType,
      targetId:
        linkType === "row"
          ? url.replace("@row:", "")
          : linkType === "document"
            ? url.replace("@document:", "").replace("@", "")
            : linkType === "node"
              ? url.replace("@node:", "")
              : "",
      name,
    });
    setCustomLinkDialog(null);
  };

  const handleEditLinkConfirm = (url: string, name: string) => {
    if (editLinkDialog) {
      const linkType = extractLinkTypeFromUrl(url);
      editor.update(() => {
        const node = $getNodeByKey(editLinkDialog.nodeKey);
        if ($isLinkNode(node)) {
          node.setUrl(url);
          node.setName(name);
          node.setLinkType(linkType);
          // Update targetId based on the new URL and linkType
          const newTargetId =
            linkType === "row"
              ? url.replace("@row:", "")
              : linkType === "document"
                ? url.replace("@document:", "").replace("@", "")
                : linkType === "node"
                  ? url.replace("@node:", "")
                  : "";
          node.setTargetId(newTargetId);
        }
      });
    }
    setEditLinkDialog(null);
  };

  const handlePdfConfirm = async (url: string, name: string) => {
    const finalUrl = await uploadAssetIfNeeded(url, name, 'application/pdf');
    editor.dispatchCommand(INSERT_PDF_COMMAND, { url: finalUrl, name });
    setPdfDialog(null);
  };

  const handleEditPdfConfirm = async (url: string, name: string) => {
    if (editPdfDialog) {
      const finalUrl = await uploadAssetIfNeeded(url, name, 'application/pdf');
      editor.update(() => {
        const node = $getNodeByKey(editPdfDialog.nodeKey);
        if ($isPdfNode(node)) {
          node.setUrl(finalUrl);
          node.setName(name);
        }
      });
    }
    setEditPdfDialog(null);
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.addEventListener("focusin", () => {
        setShowCaret(false);
      });
    }
  });

  const handleDeleteLink = () => {
    if (editLinkDialog) {
      editor.update(() => {
        const node = $getNodeByKey(editLinkDialog.nodeKey);
        if ($isLinkNode(node)) {
          node.remove();
        }
      });
    }
    setEditLinkDialog(null);
  };

  return (
    <>
      <HightlightSelectedText isMenuOpen={isMenuOpen} selectionRects={selectionRects} />
      {showCaret && isMenuOpen && (
        <CustomCaret
          position={caretPosition}
          visible={showCaret}
          timestamp={caretTimestamp}
        />
      )}
      {isMenuOpen && (
        <ContextMenuX
          items={contextMenuItems}
          isOpen={isMenuOpen}
          onClose={() => {
            setIsMenuOpen(false);
            setIsContextMenuOpen(false);
            setShowCaret(false);
          }}
          position={menuPosition}
          direction="right"
        />
      )}
      {modal}
      {customLinkDialog && (
        <CustomLinkDialog
          onClose={() => setCustomLinkDialog(null)}
          leftButton={{
            text: 'Cancel',
            onClick: () => setCustomLinkDialog(null)
          }}
          rightButton={{
            text: 'Insert',
            onClick: handleCustomLinkConfirm
          }}
          initialUrl={customLinkDialog.initialUrl}
        />
      )}
      {editLinkDialog && (
        <CustomLinkDialog
          onClose={() => setEditLinkDialog(null)}
          leftButton={{
            text: 'Delete',
            onClick: handleDeleteLink
          }}
          rightButton={{
            text: 'Insert',
            onClick: handleEditLinkConfirm
          }}
          initialUrl={editLinkDialog.url}
          initialName={editLinkDialog.name}
        />
      )}
      {pdfDialog && (
        <PdfDialog
          onClose={() => setPdfDialog(null)}
          onConfirm={handlePdfConfirm}
        />
      )}
      {editPdfDialog && (
        <PdfDialog
          onClose={() => setEditPdfDialog(null)}
          onConfirm={handleEditPdfConfirm}
          initialName={editPdfDialog.name}
        />
      )}
    </>
  );
}
