import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isNodeSelection, $isRangeSelection } from "lexical";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { useFile } from "@/App/hooks/FileHooks";
import { useGlobalToast } from "@/App/hooks/useGlobalToast";
import { Dialog } from "@/components/custom/Dialog/Dialog";
import { getDocumentId, getNodeById } from "@/core/database/useBlocDatabase";
import { getDocumentById } from "@/core/database/useDocumentDatabase";

import { LinkType } from "./LinkNode";

interface LinkNodeComponentProps {
  nodeKey: string;
  url: string;
  linkType: LinkType;
  targetId: string;
  name: string;
}

export default function LinkNodeComponent({
  nodeKey,
  url,
  linkType,
  targetId,
  name,
}: LinkNodeComponentProps) {
  const [targetName, setTargetName] = useState<string>("");
  const [isValid, setIsValid] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { openEditorWithUpdate, openEditorWUFocusOnNode, openEditorWFocusOnRow } = useFile();
  const { showToast } = useGlobalToast();
  const [editor] = useLexicalComposerContext();
  const [isSelected, setIsSelected] = useState(false);

  // NOTE:  color the link when it is selected
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const nodes = selection.getNodes();
          setIsSelected(!selection.isCollapsed() && nodes.some((node) => node.getKey() === nodeKey));
        } else if ($isNodeSelection(selection)) {
          setIsSelected(selection.has(nodeKey));
        } else {
          setIsSelected(false);
        }
      });
    });
  }, [editor, nodeKey]);

  useEffect(() => {
    const fetchTargetName = async () => {
      if (linkType === "document" && targetId) {
        try {
          const doc = await getDocumentById(targetId);
          setTargetName(doc?.title || targetId);
          setIsValid(!!doc);
        } catch {
          setTargetName(targetId);
          setIsValid(false);
        }
      } else if (linkType === "node" && targetId) {
        try {
          const node = await getNodeById(targetId);
          setTargetName(node?.content?.substring(0, 50) || targetId);
          setIsValid(!!node);
        } catch {
          setTargetName(targetId);
          setIsValid(false);
        }
      } else if (linkType === "row" && targetId) {
        // Validate row existence by checking if the rowId exists in the table data
        const [blocId, rowId] = targetId.split(':');
        if (!blocId || !rowId) {
          setTargetName("Ligne invalide");
          setIsValid(false);
          return;
        }

        try {
          const node = await getNodeById(blocId);
          if (node && node.content) {
            const content = typeof node.content === 'string' ? JSON.parse(node.content) : node.content;
            // Check if this is a table node and if the rowId exists in its data
            if (content.data && Array.isArray(content.data)) {
              const rowExists = content.data.some((row: any) => row._rowId === rowId);
              setTargetName(rowExists ? "Row" : "Row deleted");
              setIsValid(rowExists);
            } else {
              setTargetName("Row");
              setIsValid(false);
            }
          } else {
            setTargetName("Table not found");
            setIsValid(false);
          }
        } catch {
          setTargetName("Erreur de validation");
          setIsValid(false);
        }
      } else {
        setTargetName("");
        setIsValid(true);
      }
    };

    fetchTargetName();
  }, [linkType, targetId]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      // Handle external links with confirmation
      if (linkType === "external") {
        const finalUrl = url.startsWith("http") ? url : `https://${url}`;
        e.preventDefault();
        setPendingUrl(finalUrl);
        setShowConfirmation(true);
      } else {
        // Handle internal links (document and bloc)
        e.preventDefault();

        if (linkType === "document" && targetId) {
          try {
            const doc = await getDocumentById(targetId);
            if (doc) {
              await openEditorWithUpdate(doc);
            } else {
              console.error("Document not found:", targetId);
            }
          } catch (error) {
            console.error("Failed to open document:", error);
          }
        } else if (linkType === "node" && targetId) {
          const documentId = await getDocumentId(targetId);
          try {
            const doc = await getDocumentById(documentId);
            if (doc) {
              openEditorWUFocusOnNode(doc, targetId);
            } else {
              console.error("Document not found:", targetId);
            }
          } catch (error) {
            console.error("Failed to open document:", error);
          }
        } else if (linkType === "row" && targetId) {
          const [blocId, rowId] = targetId.split(':');
          
          try {
            const documentId = await getDocumentId(blocId);
            const doc = await getDocumentById(documentId);
            
            // Check if the row exists before navigating
            const node = await getNodeById(blocId);
            let rowExists = false;
            if (node && node.content) {
              const content = typeof node.content === 'string' ? JSON.parse(node.content) : node.content;
              if (content.data && Array.isArray(content.data)) {
                rowExists = content.data.some((row: any) => row._rowId === rowId);
              }
            }
            
            if (doc) {
              if (rowExists) {
                openEditorWFocusOnRow(doc, blocId, rowId);
              } else {
                // Row doesn't exist - scroll to table and show error toast
                openEditorWUFocusOnNode(doc, blocId);
                showToast("Row not found: this row has been deleted", "error", 4000);
              }
            } else {
              console.error("Document not found:", blocId);
            }
          } catch (error) {
            console.error("Failed to open document:", error);
          }
        }
      }
    },
    [url, linkType, targetId, openEditorWithUpdate, openEditorWUFocusOnNode, openEditorWFocusOnRow, showToast],
  );

  const handleConfirmOpen = useCallback(() => {
    setShowConfirmation(false);
    // Use React ref to trigger the link click
    if (linkRef.current) {
      linkRef.current.click();
    }
    setPendingUrl("");
  }, []);

  const handleCancelOpen = useCallback(() => {
    setShowConfirmation(false);
    setPendingUrl("");
  }, []);

  const getLinkColor = (): string => {
    if (linkType === "external") {
      return "var(--primary-color)";
    }
    return "var(--primary-green)";
  };

  const getDisplayText = (): string => {
    if (linkType === "external") {
      return name || url;
    }
    return name || targetName || url;
  };

  return (
    <>
      <a
        href="#"
        onClick={handleClick}
        style={{
          color: getLinkColor(),
          textDecoration: isValid ? "underline" : "line-through",
          cursor: "pointer",
          opacity: isValid ? 1 : 0.6,
          backgroundColor: isSelected ? "rgba(51, 144, 255, 0.4)" : "transparent",
          borderRadius: "2px",
          display: "inline-block",
          marginLeft: "3px",
          marginRight: "3px",
          verticalAlign: "baseline",
          lineHeight: "1",
        }}
        title={linkType === "external" ? url : `${linkType}: ${targetId}`}
      >
        {getDisplayText()}
      </a>
      {/* Hidden anchor for opening external links */}
      <a
        ref={linkRef}
        href={pendingUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "none" }}
      />
      {showConfirmation && (
        <Dialog
          isOpen={showConfirmation}
          onClose={handleCancelOpen}
          title="Ouvrir le lien"
          description={
            <div>
              Voulez-vous vraiment ouvrir ce lien ?
              <br /><br />
              <div style={{ wordBreak: 'break-all', opacity: 0.8, fontSize: '0.9em' }}>
                {pendingUrl}
              </div>
            </div>
          }
          mode="request"
          leftButton={{
            text: "Annuler",
            onClick: handleCancelOpen
          }}
          rightButton={{
            text: "Ouvrir",
            onClick: handleConfirmOpen
          }}
        />
      )}
    </>
  );
}
