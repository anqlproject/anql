/**
 * ChangePlugin2
 *
 * Strategy: registerMutationListener (not registerUpdateListener)
 *
 * Lexical forbids passing abstract classes (ElementNode, DecoratorNode)
 * to registerMutationListener. The solution: iterate over editor._nodes to
 * get ALL concrete classes registered in the editor, and register
 * a listener per class.
 *
 * Advantages vs the original:
 * - registerMutationListener only triggers if a node has actually changed
 *   (created / updated / deleted). It does not react to simple cursor movements.
 * - No JSON checksum calculation on every keystroke.
 * - All SQLite writes go through QueueManager (deduplicated, 1s flush).
 *
 * MOVE detection:
 * - In the "updated" handler, we compare sibling keys (O(1), no JSON)
 *   to determine if the node has changed position.
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  //$getNodeByKey,
  //$getRoot,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  LexicalNode,
} from "lexical";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { BlocChangesType } from "@/App/store/createDocumentSlice";
import { useGlobalStore } from "@/App/store/useGlobalStore";
//import { getNodesByDocumentId } from "@/core/database/useBlocDatabase";
import { DocumentsJson } from "@/core/database/useDocumentDatabase";
import { logger } from "@/core/logger";
import {
  setIdState,
  setNodeTypeState,
  setPositionState,
} from "@/editor/DocumentState/DocumentStateManager";

import { QUEUE_ACTIONS, QueueManager } from "./QueueManager";
import {
  generateIndex,
  getContent,
  getParentFromDeep,
  getSiblingSnapshot,
  hasMoved,
  SiblingSnapshot,
} from "./utils";

export function ChangePlugin(): null {
  const [editor] = useLexicalComposerContext();

  // ── Store ──────────────────────────────────────────────────────────────────
  const { setModified, currentDocument, dynamicState } = useGlobalStore(
    useShallow((state) => ({
      setModified: state.setModified,
      currentDocument: state.currentDocument,
      dynamicState: state.dynamicState,
    }))
  );

  // ── Refs ───────────────────────────────────────────────────────────────────
  const currentDocumentRef = useRef<DocumentsJson | null>(null);
  const currentDocumentIdRef = useRef<string | null>(null);
  currentDocumentRef.current = currentDocument;
  currentDocumentIdRef.current = currentDocument?.id || null;

  /**
   * Tracks whether the plugin has stabilized after mount/document change.
   * During hot reload, dynamicState is empty while Lexical still has nodes.
   * We skip integrity checks during stabilization to prevent false positives.
   */
  const isStabilizedRef = useRef(false);

  /**
   * Snapshot of sibling keys for each root node.
   * Used to detect MOVES in O(1) without serializing JSON.
   */
  const siblingSnapshotRef = useRef<Map<string, SiblingSnapshot>>(new Map());

  /**
   * Track last modified state to avoid redundant setModified calls
   * that could cause infinite recursion with Lexical's update listeners.
   */
  const lastModifiedRef = useRef<BlocChangesType>({ key: '', type: '', id: '' });

  /**
   * Safely call setModified only if the change is different from the last one
   * to prevent infinite recursion with Lexical's update listeners.
   */
  const safeSetModified = (change: BlocChangesType) => {
    const last = lastModifiedRef.current;
    if (change.key !== last.key || change.type !== last.type || change.id !== last.id) {
      lastModifiedRef.current = change;
      setModified(change);
    }
  };

  // ── Queue Manager ──────────────────────────────────────────────────────────
  const queueRef = useRef<QueueManager>(
    new QueueManager({ dynamicState, currentDocumentRef })
  );

  // ── 1. Cleanup of assets and state on document change ─────────
  useEffect(() => {
    if (!currentDocument?.id) return;
    logger.debug("[ChangePlugin] Entering document", { documentId: currentDocument.id });
    siblingSnapshotRef.current.clear();
    isStabilizedRef.current = false;

    // Allow mutation listener to populate dynamicState before enabling integrity check
    const stabilizationTimer = setTimeout(() => {
      isStabilizedRef.current = true;
      logger.debug("[ChangePlugin] Stabilization complete");
    }, 3000);

    return () => {
      clearTimeout(stabilizationTimer);
      logger.debug("[ChangePlugin] Leaving document", { documentId: currentDocument.id });
      queueRef.current.cleanupPendingAssets(currentDocument.id);
      queueRef.current.clear();
    };
  }, [currentDocument?.id]);

  // ── 2. Start / stop of flush interval ─────────────────────────
  useEffect(() => {
    queueRef.current.start();
    return () => {
      queueRef.current.stop(); // final flush on unmount
    };
  }, []);

  // ── 3. Immediate flush on blur ─────────────────────────────────────────────
  useEffect(() => {
    const unregister = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        queueRef.current.flush();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
    return unregister;
  }, [editor]);

  // ── 4. registerMutationListener on each concrete class ────────────────
  // We must use editor._nodes to ensure we catch mutations on ALL nodes,
  // including core nodes like ParagraphNode and TextNode which are missing from anqlNodes.
  useEffect(() => {
    if (!currentDocument?.id) return;

    const unregisters: Array<() => void> = [];

    const registeredNodes = (editor as any)._nodes;
    registeredNodes.forEach((registeredNode: any) => {
      const NodeClass = registeredNode.klass;
      const unregister = editor.registerMutationListener(
        NodeClass,
        (nodeMutations, { prevEditorState }) => {

          // skip mutations if the current document is not the same as the one in the store
          // Use ref to avoid stale closure issues
          if (useGlobalStore.getState().currentDocument?.id !== currentDocumentIdRef.current) {
            return; // exit
          }

          const editorState = editor.getEditorState();

          for (const [nodeKey, mutationType] of nodeMutations) {

            // We only track blocks and their children, the root node itself is ignored
            if (nodeKey === "root") continue;

            // ── CREATED ───────────────────────────────────────────────────
            if (mutationType === "created") {
              editorState.read(() => {
                const node = editorState._nodeMap.get(nodeKey);
                // We only process nodes that are direct children of root
                if (!node || node.__parent !== "root") return;
                // Guard: avoid double-add during undo/redo
                if (dynamicState.current.has(nodeKey)) return;

                const id = crypto.randomUUID();
                const position = generateIndex(node, dynamicState);
                const content = getContent(node, editorState);
                if (!content) return;

                setIdState(content, id);
                setPositionState(content, position);
                setNodeTypeState(content, node.__type);

                // Update dynamicState in memory
                dynamicState.current.set(nodeKey, {
                  id,
                  position,
                  node_type: node.__type,
                });

                // Initialize sibling snapshot for MOVE detection
                siblingSnapshotRef.current.set(nodeKey, getSiblingSnapshot(node));

                queueRef.current.enqueue({
                  type: QUEUE_ACTIONS.ADD,
                  key: nodeKey,
                  id,
                  position,
                  contentStr: JSON.stringify(content),
                  textContent: node.getTextContent?.() ?? "",
                });

                safeSetModified({ key: nodeKey, type: QUEUE_ACTIONS.ADD, id });
                logger.debug("[ChangePlugin2] ADD", { nodeKey, id });
              });
            }

            // ── DESTROYED ─────────────────────────────────────────────────
            else if (mutationType === "destroyed") {
              prevEditorState.read(() => {
                const node = prevEditorState._nodeMap.get(nodeKey);
                if (!node || node.__parent !== "root") return;

                const state = dynamicState.current.get(nodeKey);
                if (!state?.id) {
                  logger.error("[ChangePlugin2] No state for deleted node", undefined, { nodeKey });
                  return;
                }

                queueRef.current.enqueue({
                  type: QUEUE_ACTIONS.DELETE,
                  key: nodeKey,
                  id: state.id,
                });

                safeSetModified({ key: nodeKey, type: QUEUE_ACTIONS.DELETE, id: state.id });
                dynamicState.current.delete(nodeKey);
                siblingSnapshotRef.current.delete(nodeKey);
                logger.debug("[ChangePlugin2] DELETE", { nodeKey, id: state.id });
              });
            }

            // ── UPDATED ───────────────────────────────────────────────────
            else if (mutationType === "updated") {
              editorState.read(() => {
                const mutatedNode = editorState._nodeMap.get(nodeKey);
                if (!mutatedNode) return;

                // Walk up to the root-level ancestor (the actual "bloc").
                // Critical: when typing, Lexical fires "updated" on the TextNode
                // (whose parent is ParagraphNode, not root). We must climb up.
                let rootNode: LexicalNode | null = null;
                try {
                  rootNode = getParentFromDeep(mutatedNode);
                } catch (error) {
                  logger.error("[ChangePlugin2] Error in getParentFromDeep", error as Error, { nodeKey });
                  return;
                }

                if (!rootNode) {
                  logger.warn("[ChangePlugin2] Could not find root ancestor for node", { nodeKey });
                  return;
                }

                if (rootNode.__parent !== "root") {
                  return;
                }

                const rootKey = rootNode.__key;
                const state = dynamicState.current.get(rootKey);
                if (!state?.id) return;

                // ── MOVE detection (O(1), no JSON) ─────────────────
                // Check move on the root-level node, even if the mutation was on a child
                const currentSnapshot = getSiblingSnapshot(rootNode);
                const previousSnapshot = siblingSnapshotRef.current.get(rootKey);

                if (!previousSnapshot) {
                  // First time seeing this node, initialize snapshot
                  siblingSnapshotRef.current.set(rootKey, currentSnapshot);
                } else if (
                  currentSnapshot.prevKey !== previousSnapshot.prevKey ||
                  currentSnapshot.nextKey !== previousSnapshot.nextKey
                ) {
                  // The snapshot changed, update it to avoid re-detecting this change
                  siblingSnapshotRef.current.set(rootKey, currentSnapshot);

                  if (hasMoved(currentSnapshot, previousSnapshot, rootNode, dynamicState)) {
                    // TRUE MOVE: order is broken, recalculate position
                    const newPosition = generateIndex(rootNode, dynamicState);
                    dynamicState.current.set(rootKey, { ...state, position: newPosition });

                    const content = getContent(rootNode, editorState);
                    if (!content) return;

                    setPositionState(content, newPosition);
                    setIdState(content, state.id);
                    setNodeTypeState(content, state.node_type || rootNode.__type);

                    queueRef.current.enqueue({
                      type: QUEUE_ACTIONS.MOVE,
                      key: rootKey,
                      id: state.id,
                      position: newPosition,
                      contentStr: JSON.stringify(content),
                    });

                    safeSetModified({ key: rootKey, type: QUEUE_ACTIONS.MOVE, id: state.id });
                    logger.debug("[ChangePlugin2] MOVE", { rootKey, newPosition });
                    return; // MOVE and UPDATE are mutually exclusive
                  }
                }

                // ── Content UPDATE ─────────────────────────────────────
                const content = getContent(rootNode, editorState);
                if (!content) return;

                const position = state.position || generateIndex(rootNode, dynamicState);
                setPositionState(content, position);
                setIdState(content, state.id);
                setNodeTypeState(content, state.node_type || rootNode.__type);

                queueRef.current.enqueue({
                  type: QUEUE_ACTIONS.UPDATE,
                  key: rootKey,
                  id: state.id,
                  contentStr: JSON.stringify(content),
                  textContent: rootNode.getTextContent?.() ?? "",
                });

                safeSetModified({ key: rootKey, type: QUEUE_ACTIONS.UPDATE, id: state.id });
              });
            }
          }
        },
        // skipInitialization: do not replay initial mutations on mount
        { skipInitialization: true }
      );

      unregisters.push(unregister);
    });

    return () => {
      unregisters.forEach((fn) => fn());
    };
  }, [currentDocument?.id, editor, dynamicState, setModified]);

  // ── 5. Safeguard (Integrity Check) ──────────────────────────────────────────
  /*useEffect(() => {
    if (!currentDocument?.id) return;

    const runIntegrityCheck = async () => {
      // Skip integrity check during stabilization period (prevents hot reload false positives)
      if (!isStabilizedRef.current) {
        logger.debug("[Safeguard] Skipping - not stabilized yet");
        return;
      }

      // Prevent running if document has changed
      if (!currentDocumentIdRef.current) return;
      const dbNodes = await getNodesByDocumentId(currentDocumentIdRef.current);
      const dbNodeIds = new Set(dbNodes.map(node => node.id));

      if (useGlobalStore.getState().currentDocument?.id !== currentDocumentIdRef.current) return;

      // Skip integrity check if QueueManager is currently processing known changes
      if (!queueRef.current.isIdle) return;

      editor.getEditorState().read(async () => {
        const root = $getRoot();
        const lexicalKeys = new Set(root.getChildrenKeys());

        // 1. ADD: Lexical has it, dynamicState doesn't
        for (const key of lexicalKeys) {
          const lexicalNodeid = dynamicState.current.get(key)?.id;
          let dbMissedIt = true;
          if (lexicalNodeid) {
            dbMissedIt = !dbNodeIds.has(lexicalNodeid);
            // Skip if already queued for ADD to prevent duplicates
            if (dbMissedIt && queueRef.current.hasIdInQueue(lexicalNodeid, QUEUE_ACTIONS.ADD)) {
              continue;
            }
          } else {
            logger.warn("[Safeguard] Node not in dynamicState - creation was missed", { key });
          }

          if (dbMissedIt) {
            const node = $getNodeByKey(key);
            if (!node || node.__parent !== "root") continue;

            const id = lexicalNodeid || crypto.randomUUID();
            const position = generateIndex(node, dynamicState);
            const content = getContent(node, editor.getEditorState());
            if (!content) continue;

            setIdState(content, id);
            setPositionState(content, position);
            setNodeTypeState(content, node.__type);

            dynamicState.current.set(key, {
              id,
              position,
              node_type: node.__type,
            });
            siblingSnapshotRef.current.set(key, getSiblingSnapshot(node));

            queueRef.current.enqueue({
              type: QUEUE_ACTIONS.ADD,
              key,
              id,
              position,
              contentStr: JSON.stringify(content),
              textContent: node.getTextContent?.() ?? "",
            });
            console.warn(`[Safeguard] Missed ADD detected for node ${key}`);
            logger.warn("[Safeguard] Missed ADD detected", { key });
          }
        }

        // 2. DELETE: DB has it, Lexical doesn't
        for (const dbNode of dbNodes) {
          // Find if this DB node exists in dynamicState
          let foundInDynamicState = false;
          let dynamicStateKey = '';
          for (const [key, state] of dynamicState.current.entries()) {
            if (state.id === dbNode.id) {
              foundInDynamicState = true;
              dynamicStateKey = key;
              break;
            }
          }

          // If node is in DB but not in Lexical, it should be deleted
          if (foundInDynamicState && !lexicalKeys.has(dynamicStateKey)) {
            // Skip if already queued for DELETE to prevent duplicates
            if (queueRef.current.hasIdInQueue(dbNode.id, QUEUE_ACTIONS.DELETE)) {
              continue;
            }
            queueRef.current.enqueue({
              type: QUEUE_ACTIONS.DELETE,
              key: dynamicStateKey,
              id: dbNode.id,
            });
            dynamicState.current.delete(dynamicStateKey);
            siblingSnapshotRef.current.delete(dynamicStateKey);
            logger.warn("[Safeguard] Missed DELETE detected", { key: dynamicStateKey });
          }
        }

        // 2b. Cleanup dynamicState: remove nodes that are not in DB (already deleted)
        for (const [key, state] of dynamicState.current.entries()) {
          if (!dbNodeIds.has(state.id)) {
            dynamicState.current.delete(key);
            siblingSnapshotRef.current.delete(key);
            logger.warn("[Safeguard] Node already deleted from DB, cleaning dynamicState", { key });
          }
        }

        // 3. MOVE: Lexical-based detection (snapshots)
        const nodesToHash: { key: string, contentStr: string, textContent: string, id: string }[] = [];
        for (const key of lexicalKeys) {
          if (dynamicState.current.has(key)) {
            const node = $getNodeByKey(key);
            if (!node) continue;
            const currentSnapshot = getSiblingSnapshot(node);
            const previousSnapshot = siblingSnapshotRef.current.get(key) || currentSnapshot;

            const state = dynamicState.current.get(key)!;
            let moved = false;

            if (hasMoved(currentSnapshot, previousSnapshot, node, dynamicState)) {
              // Skip if already queued for MOVE to prevent duplicates
              if (queueRef.current.hasIdInQueue(state.id, QUEUE_ACTIONS.MOVE)) {
                continue;
              }

              const newPosition = generateIndex(node, dynamicState);

              dynamicState.current.set(key, { ...state, position: newPosition });
              siblingSnapshotRef.current.set(key, currentSnapshot);

              const content = getContent(node, editor.getEditorState());
              if (!content) continue;

              setPositionState(content, newPosition);
              setIdState(content, state.id);
              setNodeTypeState(content, state.node_type || node.__type);

              queueRef.current.enqueue({
                type: QUEUE_ACTIONS.MOVE,
                key,
                id: state.id,
                position: newPosition,
                contentStr: JSON.stringify(content),
              });
              moved = true;
              logger.warn("[Safeguard] Missed MOVE detected", { key, source: "Lexical snapshot" });
            }

            // Only check UPDATE if it didn't just MOVE, to avoid double-processing
            if (!moved) {
              const content = getContent(node, editor.getEditorState());
              if (!content) continue;

              setPositionState(content, state.position);
              setIdState(content, state.id);
              setNodeTypeState(content, state.node_type || node.__type);

              const contentStr = JSON.stringify(content);
              nodesToHash.push({ key, contentStr, textContent: node.getTextContent?.() ?? "", id: state.id });
            }
          }
        }

        if (nodesToHash.length > 0) {
          try {
            const { computeHashesBatch, getHashesByDocumentId } = await import("@/core/database/useBlocDatabase");
            const contents = nodesToHash.map(n => n.contentStr);
            const hashes = await computeHashesBatch(contents);

            const documentId = useGlobalStore.getState().currentDocument?.id;
            if (!documentId) return;
            const dbHashes = await getHashesByDocumentId(documentId);
            const dbHashesMap = new Map(dbHashes.map(h => [h.id, h.checksum]));

            if (!queueRef.current.isIdle) return; // SKIP if queue became active during async compute

            for (let i = 0; i < hashes.length; i++) {
              const state = dynamicState.current.get(nodesToHash[i].key);
              // Check actual db checksum instead of state.checksum
              const dbChecksum = state ? dbHashesMap.get(state.id) : undefined;

              // Skip if already queued for UPDATE to prevent duplicates
              if (state && dbChecksum !== hashes[i] && queueRef.current.hasIdInQueue(state.id, QUEUE_ACTIONS.UPDATE)) {
                continue;
              }

              // Only enqueue if checksum actually changed and state is still present
              if (state && dbChecksum !== hashes[i]) {
                queueRef.current.enqueue({
                  type: QUEUE_ACTIONS.UPDATE,
                  key: nodesToHash[i].key,
                  id: nodesToHash[i].id,
                  contentStr: nodesToHash[i].contentStr,
                  textContent: nodesToHash[i].textContent,
                });
                logger.warn("[Safeguard] Missed UPDATE detected", { key: nodesToHash[i].key, dbChecksum, newChecksum: hashes[i] });
              }
            }
          } catch (err) {
            logger.error("[Safeguard] Error hashing batch", err as Error);
          }
        }
      });
      logger.debug("[Safeguard] Integrity check completed");
    };

    const intervalId = setInterval(runIntegrityCheck, 5000); // Every 10s
    return () => clearInterval(intervalId);
  }, [currentDocument?.id, editor, dynamicState]);*/

  return null;
}
