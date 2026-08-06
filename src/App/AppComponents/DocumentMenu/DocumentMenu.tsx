import "./DocumentMenu.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import {
  CheckCircle2,
  CopyIcon,
  Download,
  Layers2,
  MenuIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useExportDocument } from "@/App/AppComponents/ImportExport/exportDocument";
import LocalSearch from "@/App/AppComponents/LocalSearch/LocalSearch";
import { navigationUtils } from "@/App/AppComponents/navigationUtils";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { useFile } from "@/App/hooks/FileHooks";
import { useGlobalToast } from "@/App/hooks/useGlobalToast";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { MenuX } from "@/components/custom/Menu/MenuX";
import { newNode } from "@/core/database/useBlocDatabase";
import {
  DocumentsJson,
  DocumentMetadataKey,
  newDocument,
  updateDocumentMetadataField,
  updateDocumentPath,
} from "@/core/database/useDocumentDatabase";
import { addRecentDocument } from "@/core/database/useRecentDocumentsDatabase";
import { ICON_SIZES, TOAST_DURATION } from "@/core/global/defaultValues";
import { MoveToTrash } from "@/core/TrashSystem/TrashSystem";
import { useNavigationStore } from "@/GlobalState/navigationStore";
import { logger } from "@/core/logger";

export const DocumentMenu = () => {
  const { t } = useTranslation();
  const { currentDocument } = useGlobalStore(
    useShallow((state) => ({ currentDocument: state.currentDocument })),
  );
  const { goHome } = navigationUtils();
  const currentPage = useNavigationStore((state) => state.currentPage);
  const [editor] = useLexicalComposerContext();
  const { showToast, dismissToast } = useGlobalToast();
  const { handleNewFile } = useFile();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isLocalSearchOpen = useGlobalShortcut(
    (state) => state.isLocalSearchOpen,
  );
  const openLocalSearch = useGlobalShortcut((state) => state.openLocalSearch);
  const closeLocalSearch = useGlobalShortcut((state) => state.closeLocalSearch);
  const { exportDocument } = useExportDocument();
  const [isEditable, setIsEditable] = useState(() => editor.isEditable());
  const currentDocumentRef = useRef<DocumentsJson>(null);
  currentDocumentRef.current = currentDocument;

  useEffect(() => {
    return editor.registerEditableListener((editable) => {
      setIsEditable(editable);
    });
  }, [editor]);

  // Close LocalSearch when leaving editor page
  useEffect(() => {
    if (currentPage !== "editor" && isLocalSearchOpen) {
      closeLocalSearch();
    }
  }, [currentPage, isLocalSearchOpen, closeLocalSearch]);

  const { isMac } = useGlobalStore(
    useShallow((state) => ({ isMac: state.isMac })),
  );
  const ICON_SIZE = ICON_SIZES.default;

  const menuItems = [
    {
      icon: <SearchIcon size={ICON_SIZE} />,
      title: t("DOCUMENT_MENU.searchInDocument") as string,
      onClick: () => {
        setIsMenuOpen(false);
        openLocalSearch();
      },
      shortcut: isMac ? "⌘F" : "Ctrl+F",
    },
    {
      icon: <CopyIcon size={ICON_SIZE} />,
      title: t("DOCUMENT_MENU.copyDocumentId") as string,
      onClick: async () => {
        if (currentDocumentRef.current) {
          const documentId = currentDocumentRef.current.id;
          navigator.clipboard
            .writeText(`@document:${documentId}`)
            .then(() => {
              showToast(
                t("LOCAL_SEARCH.linkCopied") as string,
                "success",
                TOAST_DURATION,
              );
            })
            .catch(() => {
              showToast(
                t("LOCAL_SEARCH.linkCopyFailed") as string,
                "error",
                TOAST_DURATION,
              );
            });
        }
        setIsMenuOpen(false);
      },
    },
    {
      icon: (
        <CheckCircle2
          size={ICON_SIZE}
          className={!isEditable ? "text-green-500" : "text-muted-foreground"}
        />
      ),
      title: t("DOCUMENT_MENU.readModeToggle") as string,
      onClick: async () => {
        const newEditableState = !editor.isEditable();
        editor.setEditable(newEditableState);
        const docId = currentDocumentRef.current?.id;
        if (docId) {
          try {
            await updateDocumentMetadataField(docId, DocumentMetadataKey.readMode, !newEditableState);
          } catch (err) {
            logger.warn('Failed to persist readMode metadata:', err);
          }
        }
      },
    },
    {
      icon: <Layers2 size={ICON_SIZE} />,
      title: t("DOCUMENT_MENU.duplicateDocument") as string,
      onClick: async () => {
        const doc = currentDocumentRef.current;
        if (doc) {
          setIsMenuOpen(false);
          editor.getEditorState().read(async () => {
            const editorState = editor.getEditorState();
            const jsonState = editorState.toJSON();

            // Create new document
            const newDocumentItem = {
              id: crypto.randomUUID(),
              title: doc.title + " (copy)",
              path: doc.path,
              workspace_id: doc.workspace_id || "default",
              cache: JSON.stringify(jsonState),
              created_at: Date.now(),
              updated_at: Date.now(),
            };

            await newDocument(newDocumentItem);

            // Add to recent documents
            try {
              await addRecentDocument(newDocumentItem.id, "");
            } catch (error) {
              console.error("Failed to add to recent documents:", error);
            }

            // Create nodes from the existing editor state
            const createNodesFromState = (node: any, documentId: string) => {
              if (node.children && Array.isArray(node.children)) {
                node.children.forEach((child: any) => {
                  if (child.$ && child.$.id) {
                    const newNodeItem = {
                      id: child.$.id,
                      position: child.$.position || "aa",
                      content: JSON.stringify(child),
                      full_text: "",
                      document_id: documentId,
                      node_type: child.$.node_type || "paragraph",
                      created_at: Date.now(),
                      updated_at: Date.now(),
                    };
                    newNode(newNodeItem);
                  }
                  createNodesFromState(child, documentId);
                });
              }
            };

            if (jsonState.root) {
              createNodesFromState(jsonState.root, newDocumentItem.id);
            }

            // Open the new document
            handleNewFile(newDocumentItem.title);
          });
        }
      },
    },
    {
      icon: <TrashIcon size={ICON_SIZE} />,
      title: t("DOCUMENT_MENU.deleteDocument") as string,
      variant: "danger" as const,
      onClick: () => {
        setIsMenuOpen(false);

        if (
          currentDocumentRef.current &&
          currentDocumentRef.current.id != "home-page"
        ) {
          const docToDelete = currentDocumentRef.current;
          const originalPath = docToDelete.path;

          MoveToTrash(docToDelete);
          goHome();
          setIsMenuOpen(false);

          // Use a ref-like object so the button closure can read the toast id
          // even though it's created before showToast returns the id.
          const toastIdRef = { current: "" };

          const undoContent = (
            <span
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <span>{t("FEEDBACK.movedToTrash")}</span>
              <button
                onClick={() => {
                  dismissToast(toastIdRef.current);
                  updateDocumentPath(docToDelete.id, originalPath);
                  showToast(t("FEEDBACK.restored"), "info", TOAST_DURATION);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid currentColor",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  color: "inherit",
                  opacity: 0.9,
                  whiteSpace: "nowrap",
                }}
              >
                {t("FEEDBACK.undo")}
              </button>
            </span>
          );

          toastIdRef.current = showToast(
            undoContent,
            "success",
            TOAST_DURATION,
          );
        }
      },
    },
    {
      title: "sep",
      isSeparator: true,
    },
    {
      icon: <Download size={ICON_SIZE} />,
      title: t("DOCUMENT_MENU.export") as string,
      onClick: async () => {
        setIsMenuOpen(false);
        editor.getEditorState().read(() => {
          const editorState = editor.getEditorState();
          const jsonState = editorState.toJSON();

          const root = $getRoot();
          const childrenKeys = root.getChildrenKeys();
          const dynamicState = useGlobalStore.getState().dynamicState;

          if (jsonState.root && Array.isArray(jsonState.root.children)) {
            jsonState.root.children.forEach((childJson: any, index: number) => {
              const key = childrenKeys[index];
              const state = dynamicState.current.get(key);
              if (state) {
                childJson.$ = {
                  position: state.position,
                  node_type: state.node_type
                };
              }
            });
          }

          const jsonString = JSON.stringify(jsonState, null, 2);
          exportDocument(jsonString, currentDocument?.title);
        });
      },
    },
  ];

  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {currentPage !== "home" && (
        <div
          className={`documentMenu ${isMenuOpen ? "documentMenu--open" : ""}`}
          ref={triggerRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            right: isMac ? "1rem" : "120px",
          }}
          onClick={() => setIsMenuOpen(true)}
        >
          <MenuX
            items={menuItems}
            isOpen={isMenuOpen}
            onClose={() => {
              if (isMenuOpen) {
                setIsMenuOpen(false);
              }
            }}
            direction="bottom"
            trigger={
              <button
                style={{ position: "relative" }}
              >
                <MenuIcon size={ICON_SIZES.lg} />
              </button>
            }
          />

          {isLocalSearchOpen && <LocalSearch onClose={closeLocalSearch} />}
        </div>
      )}
    </>
  );
};
