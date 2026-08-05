import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { invoke } from "@tauri-apps/api/core";
import { $createParagraphNode, $createTextNode, $getNodeByKey, $getSelection, $isNodeSelection, CLEAR_HISTORY_COMMAND } from "lexical";
import { useCallback } from "react";
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";
import { NodeStateType } from "@/App/store/useGlobalStore";
import {
  deleteNode,
  getNodesByDocumentId,
  newNode,
  NodeJson,
} from "@/core/database/useBlocDatabase";
import {
  DocumentsJson,
  newDocument,
} from "@/core/database/useDocumentDatabase";
import { addRecentDocument } from "@/core/database/useRecentDocumentsDatabase";
import { DATABASE_PATH } from "@/core/global/defaultSettings";
import {
  getIdState,
  getNodeTypeState,
  getPositionState,
} from "@/editor/DocumentState/DocumentStateManager";
import { AppNodeTypes } from "@/editor/nodes/nodelist";
import { useNavigationStore } from "@/GlobalState/navigationStore";

export function useFile() {
  const { setModified, dynamicState, setCurrentDocument, editorContainerRef, editorRef, setFocusHighlight } = useGlobalStore(useShallow((state) => ({ setModified: state.setModified, dynamicState: state.dynamicState, setCurrentDocument: state.setCurrentDocument, editorContainerRef: state.editorContainerRef, editorRef: state.editorRef, setFocusHighlight: state.setFocusHighlight })));
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const [editor] = useLexicalComposerContext();
  const emptyChanges = { key: "", type: "", id: "" };

  const getEmptyNode = () => {
    let content: any;
    const id = crypto.randomUUID();

    editor.update(() => {
      const paragraphNode = $createParagraphNode();
      const textNode = $createTextNode();
      paragraphNode.append(textNode);
      content = paragraphNode.exportJSON();
    });

    return {
      ...content,
      $: {
        id: id,
        position: "aa",
        node_type: "paragraph",
      },
    } as any;
  };

  const getEmptyEditorState = (node: any) => ({
    root: {
      children: [
        {
          ...node,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });

  const loadEditorState = (editorState: unknown) => {
    editor.update(() => {
      try {
        const cleanState = JSON.parse(JSON.stringify(editorState));

        // Block node that was not defined
        const sanitizeNode = (node: { children?: unknown[]; type?: string; $?: { id?: string } }) => {
          if (node.children && Array.isArray(node.children)) {
            node.children = node.children.filter((child: unknown) => {
              const typedChild = child as { type?: string; $?: { id?: string } };
              if (typedChild.type && !AppNodeTypes.has(typedChild.type)) {
                console.warn(`Blocked unregistered node type: ${typedChild.type}`);
                if (typedChild.$ && typedChild.$.id) {
                  deleteNode(typedChild.$.id).catch(console.error);
                }
                return false;
              }
              return true;
            });
            node.children.forEach((child: unknown) => {
              sanitizeNode(child as { children?: unknown[]; type?: string; $?: { id?: string } });
            });
          }
        };

        if (cleanState.root) {
          sanitizeNode(cleanState.root);
        }

        const parsedState = editor.parseEditorState(JSON.stringify(cleanState));
        editor.setEditorState(parsedState);
      } catch (error) {
        console.error("Failed to parse editor state:", error);
      }
    });

    editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
  };

  const buildDynamicStateMap = () => {
    const editorState = editor.getEditorState();
    const newMap = new Map<string, NodeStateType>();

    editorState._nodeMap.forEach((node, key) => {
      if (node) {
        const tempNode = node.getParent();
        let parentNode;
        if (tempNode?.getKey() === "root") {
          parentNode = node;
        }
        if (parentNode) {
          const content = parentNode.exportJSON();
          newMap.set(key, {
            id: getIdState(content) || "",
            position: getPositionState(content) || "",
            node_type: getNodeTypeState(content) || ""
          });
        }
      }
    });

    dynamicState.current = newMap;
  };

  async function reconstruction(documentId: string) {
    const nodes: NodeJson[] = await getNodesByDocumentId(documentId);
    const contents = nodes.map((node) => {
      const content = JSON.parse(node.content);

      if (!content.$) {
        content.$ = {};
      }

      content.$.id = node.id;
      content.$.position = node.position;
      content.$.node_type = node.node_type;
      return content;
    });

    const ees = {
      root: {
        children: contents,
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    };

    return ees;
  }

  const openEditor = useCallback(async (document: DocumentsJson) => {
    try {
      let editorState = await reconstruction(document.id);
      /*let content: string | null = await getDocumentCache(document.id);
 
          let editorState = null;
          if (content.length === 0 || content === null) {
              editorState = emptyEditorState;
          } else {
              editorState = JSON.parse(content);
    }*/

      if (editorState.root.children.length === 0) {
        const node = getEmptyNode();
        editorState = getEmptyEditorState(node);
        const newItem = {
          id: node.$?.id || crypto.randomUUID(),
          position: node.$?.position || "aa",
          content: JSON.stringify(node),
          full_text: "",
          document_id: document.id,
          node_type: "paragraph",
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        await newNode(newItem);
      }

      setCurrentDocument(document);
      navigateTo("editor", document);
      loadEditorState(editorState);

      editor.read(() => {
        buildDynamicStateMap();
      });
      setModified(emptyChanges);

      // Force focus to editor content, not title
      setTimeout(() => {
        editor.focus();
      }, 0);
    } catch (error) {
      console.error("reading file error : ", error);
      throw error;
    }
  }, [editor, navigateTo, setCurrentDocument, setModified]);

  const handleNewFile = useCallback(async (title?: string): Promise<void> => {
    // TASK : personalize add workspace_id, add path on creation
    const node = getEmptyNode();
    const ees = getEmptyEditorState(node);

    const newDocumentItem = {
      id: crypto.randomUUID(),
      title: title || "",
      path: DATABASE_PATH.HOME_PATH,
      workspace_id: "default",
      cache: JSON.stringify(ees),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await newDocument(newDocumentItem);

    // Add to recent documents database
    try {
      await addRecentDocument(newDocumentItem.id, "");
    } catch (error) {
      console.error("Failed to add to recent documents:", error);
    }

    const newNodeItem = {
      id: node.$?.id || crypto.randomUUID(),
      position: node.$?.position || "aa",
      content: JSON.stringify(node),
      full_text: "",
      document_id: newDocumentItem.id,
      node_type: "paragraph",
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    await newNode(newNodeItem);

    setCurrentDocument(newDocumentItem);
    navigateTo("editor", newDocumentItem);
    loadEditorState(ees);

    editor.read(() => {
      buildDynamicStateMap();
    });

    // Force focus to editor content, not title
    setTimeout(() => {
      editor.focus();
    }, 0);
  }, [editor, navigateTo, setCurrentDocument, setModified, dynamicState]);

  const writeFile = async (filePath: string, contents: string) => {
    await invoke("write_file", { path: filePath, contents: contents });
  };

  const readFile = async (filePath: string): Promise<string> => {
    const content = (await invoke("read_file", { path: filePath })) as string;
    return content;
  };

  const openEditorWithUpdate = useCallback(
    async (document: DocumentsJson) => {
      openEditor(document);

      // Add to recent documents database
      try {
        await addRecentDocument(document.id, "");
      } catch (error) {
        console.error("Failed to add to recent documents:", error);
      }
    },
    [openEditor],
  );

  const openEditorWUFocusOnNode = useCallback(
    async (document: DocumentsJson, targetId: string) => {
      const currentDoc = useGlobalStore.getState().currentDocument;
      if (!currentDoc || currentDoc.id !== document.id) {
        await openEditor(document);
      }

      // Add to recent documents database
      try {
        await addRecentDocument(document.id, "");
      } catch (error) {
        console.error("Failed to add to recent documents:", error);
      }

      // Find the node key from the node id
      let nodeKey: string | null = null;
      for (const [key, value] of dynamicState.current.entries()) {
        if (value.id === targetId) {
          nodeKey = key;
          break;
        }
      }

      editor.update(() => {
        if (nodeKey) {
          const node = $getNodeByKey(nodeKey);
          if (node) {
            node.selectEnd();
          }
        }
      });

      // Scroll to center after DOM update
      requestAnimationFrame(() => {
        if (nodeKey) {
          const element = editor.getElementByKey(nodeKey);
          if (element) {
            // Find the scrollable container (editor-scroller)
            const scrollContainer = editorContainerRef.current;
            if (scrollContainer) {
              const containerRect = scrollContainer.getBoundingClientRect();
              const elementRect = element.getBoundingClientRect();
              const scrollTop = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
              scrollContainer.scrollTo({
                top: scrollContainer.scrollTop + scrollTop,
                behavior: 'smooth'
              });

              // Show focus highlight for 500ms after scroll completes
              setTimeout(() => {
                if (editorRef.current) {
                  const editorRect = editorRef.current.getBoundingClientRect();
                  const updatedElementRect = element.getBoundingClientRect();
                  setFocusHighlight({
                    element: element,
                    elementRect: updatedElementRect,
                    editorRect: {
                      x: editorRect.left,
                      y: editorRect.top,
                      width: editorRect.width,
                      height: editorRect.height,
                    }
                  });
                }
              }, 300); // Wait for smooth scroll to complete
            }
          }
        }
      });
    },
    [openEditor, dynamicState, editor, editorContainerRef, editorRef, setFocusHighlight],
  );

  const openEditorWFocusOnRow = useCallback(
    async (document: DocumentsJson, targetId: string, rowId: string) => {
      const currentDoc = useGlobalStore.getState().currentDocument;
      const isNewDocument = !currentDoc || currentDoc.id !== document.id;

      if (isNewDocument) {
        await openEditor(document);
      }

      try {
        await addRecentDocument(document.id, "");
      } catch (error) {
        console.error("Failed to add to recent documents:", error);
      }

      // Wait for dynamicState to be populated if opening a new document
      if (isNewDocument) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let nodeKey: string | null = null;
      for (const [key, value] of dynamicState.current.entries()) {
        if (value.id === targetId) {
          nodeKey = key;
          break;
        }
      }

      // If still not found, try to find it by rebuilding dynamicState
      if (!nodeKey && isNewDocument) {
        editor.read(() => {
          buildDynamicStateMap();
        });
        // Try again after rebuilding
        for (const [key, value] of dynamicState.current.entries()) {
          if (value.id === targetId) {
            nodeKey = key;
            break;
          }
        }
      }

      editor.update(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          selection.clear();
        }
      });

      requestAnimationFrame(() => {
        if (nodeKey) {
          const tableElement = editor.getElementByKey(nodeKey);
          if (tableElement) {
            const rowElement = tableElement.querySelector(`[data-row-id="${rowId}"]`);
            if (rowElement) {
              const scrollContainer = editorContainerRef.current;
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const elementRect = rowElement.getBoundingClientRect();
                const scrollTop = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
                scrollContainer.scrollTo({
                  top: scrollContainer.scrollTop + scrollTop,
                  behavior: 'smooth'
                });

                setTimeout(() => {
                  window.document.dispatchEvent(
                    new CustomEvent('tableRowNavigate', {
                      detail: { nodeKey, rowId }
                    })
                  );
                }, 300);
              }
            }
          }
        }
      });
    },
    [openEditor, dynamicState, editor, editorContainerRef],
  );

  return {
    handleNewFile,
    openEditor,
    openEditorWithUpdate,
    readFile,
    writeFile,
    openEditorWUFocusOnNode,
    openEditorWFocusOnRow,
  };
}
