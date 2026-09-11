import "./DocumentMenu.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { MenuIcon } from "lucide-react";
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
import { newNode } from "@/core/database/useBlocDatabase";
import {
  DocumentMetadataKey,
  DocumentsJson,
  newDocument,
  updateDocumentMetadataField,
  updateDocumentPath,
} from "@/core/database/useDocumentDatabase";
import { addRecentDocument } from "@/core/database/useRecentDocumentsDatabase";
import { ICON_SIZES, TOAST_DURATION } from "@/core/global/defaultValues";
import { logger } from "@/core/logger";
import { MoveToTrash } from "@/core/TrashSystem/TrashSystem";
import { useNavigationStore } from "@/GlobalState/navigationStore";

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
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const isNativeMenuOpening = useRef(false);
  const menuItems: any[] = [
    {
      text: t("DOCUMENT_MENU.searchInDocument") as string,
      accelerator: "CmdOrControl+F",
      action: () => {
        setTimeout(() => {
          setIsMenuOpen(false);
          openLocalSearch();
        }, 100);
      },
      shortcut: isMac ? "⌘F" : "Ctrl+F",
    },
    {
      text: t("DOCUMENT_MENU.copyDocumentId") as string,
      action: async () => {
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
      text: t(
        isEditable
          ? "DOCUMENT_MENU.switchToReadMode"
          : "DOCUMENT_MENU.switchToWriteMode",
      ) as string,
      action: async () => {
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
      text: t("DOCUMENT_MENU.duplicateDocument") as string,
      action: async () => {
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
      text: t("DOCUMENT_MENU.deleteDocument") as string,
      action: () => {
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
      item: "Separator",
    },
    {
      text: t("DOCUMENT_MENU.exportDocument") as string,
      action: async () => {
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

  useEffect(() => {
    if (!isMenuOpen || isNativeMenuOpening.current) return;
    isNativeMenuOpening.current = true;

    const showNativeMenu = async () => {
      try {
        const [{ Menu }, { LogicalPosition }] = await Promise.all([
          import("@tauri-apps/api/menu"),
          import("@tauri-apps/api/dpi"),
        ]);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context) {
          context.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
        }

        const menuWidth = Math.max(
          ...menuItems.map((item) =>
            item.item === "Separator"
              ? 0
              : (context?.measureText(item.text ?? "").width ?? 0) + 48,
          ),
        );
        const menuHeight = menuItems.reduce(
          (height, item) => height + (item.item === "Separator" ? 8 : 28),
          8,
        );

        const nativeMenu = await Menu.new({ items: menuItems });
        await nativeMenu.popup(
          new LogicalPosition(
            Math.min(
              Math.max(8, menuPosition.x),
              Math.max(8, window.innerWidth - menuWidth - 8),
            ),
            Math.min(
              Math.max(8, menuPosition.y),
              Math.max(8, window.innerHeight - menuHeight - 8),
            ),
          ),
        );
      } catch (error) {
        console.error("Failed to show native document menu", error);
      } finally {
        isNativeMenuOpening.current = false;
        setIsMenuOpen(false);
      }
    };

    void showNativeMenu();
  }, [isMenuOpen, menuItems, menuPosition, setIsMenuOpen]);

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
          onClick={() => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
              setMenuPosition({ x: rect.left, y: rect.bottom + 4 });
            }
            setIsMenuOpen(true);
          }}
        >
          <button style={{ position: "relative" }}>
            <MenuIcon size={ICON_SIZES.lg} />
            {!isEditable && (
              <div
                style={{
                  position: "absolute",
                  top: "-2px",
                  right: "-2px",
                  width: "8px",
                  height: "8px",
                  backgroundColor: "#22c55e",
                  borderRadius: "50%",
                  border: "1px solid white",
                }}
              />
            )}
          </button>

          {isLocalSearchOpen && <LocalSearch onClose={closeLocalSearch} />}
        </div>
      )}
    </>
  );
};
