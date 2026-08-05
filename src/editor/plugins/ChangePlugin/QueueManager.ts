import React from "react";

import { NodeStateType } from "@/App/store/useGlobalStore";
import {
  addPendingAssetDeletion,
  clearPendingAssetDeletions,
  deleteAsset,
  extractAssetIds,
  getPendingAssetDeletions,
  removePendingAssetDeletion,
} from "@/core/database/useAssetDatabase";
import {
  deleteNode,
  getNodeById,
  newNode,
  NodeJson,
  updateNodeContent,
  updateNodePosition,
} from "@/core/database/useBlocDatabase";
import { DocumentsJson } from "@/core/database/useDocumentDatabase";
import { logger } from "@/core/logger";
import {
  setIdState,
  setNodeTypeState,
  setPositionState,
} from "@/editor/DocumentState/DocumentStateManager";

/** Types of actions that can be queued */
export const QUEUE_ACTIONS = {
  ADD: "add_bloc",
  UPDATE: "update_bloc",
  DELETE: "delete_bloc",
  MOVE: "move_bloc",
} as const;

export type QueueActionType = (typeof QUEUE_ACTIONS)[keyof typeof QUEUE_ACTIONS];

export interface QueueEntry {
  type: QueueActionType;
  /** Lexical node key (used to look up the node in the editor state) */
  key: string;
  /** Database UUID of the bloc */
  id: string;
  /** Pre-serialized JSON content – set by caller before enqueue */
  contentStr?: string;
  /** Full text of the node – for search indexing */
  textContent?: string;
  /** New fractional index position – used for MOVE */
  position?: string;
  /** Timestamp of when the action was queued */
  enqueuedAt: number;
}

export interface QueueManagerDependencies {
  dynamicState: React.MutableRefObject<Map<string, NodeStateType>>;
  currentDocumentRef: React.MutableRefObject<DocumentsJson | null>;
}

/**
 * QueueManager:
 * Accumulates changes detected by the mutation listener and flushes them
 * to SQLite every 1 second. Rapid successive updates to the same key are
 * deduplicated — only the latest entry is kept.
 *
 * Priority order when the same key has multiple action types:
 *   ADD > DELETE > MOVE > UPDATE
 * This prevents an ADD from being shadowed by a later UPDATE for the same key.
 */
export class QueueManager {
  /** Keyed by `${type}_${nodeKey}` so each action type is tracked separately */
  private queue: Map<string, QueueEntry> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private deps: QueueManagerDependencies;

  constructor(deps: QueueManagerDependencies) {
    this.deps = deps;
  }

  /** Start the 1-second auto-flush interval */
  start() {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.flush();
    }, 1000);
  }

  /** Stop the interval and do a final flush */
  async stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.flush();
  }

  /** Clear all pending entries without processing them */
  clear() {
    this.queue.clear();
  }

  /** Enqueue a new action. Deduplication key = `${type}_${key}` */
  enqueue(entry: Omit<QueueEntry, "enqueuedAt">) {
    const dedupeKey = `${entry.type}_${entry.key}`;
    this.queue.set(dedupeKey, { ...entry, enqueuedAt: Date.now() });
  }

  /** Immediately flush all pending entries to SQLite */
  async flush() {
    if (this.isFlushing || this.queue.size === 0) return;

    // Snapshot and clear atomically to avoid race conditions
    const snapshot = new Map(this.queue);
    this.queue.clear();

    this.isFlushing = true;
    try {
      await this._processQueue(snapshot);
    } catch (err) {
      logger.error("[ChangePlugin2] Flush error – re-queuing failed entries", err as Error);
      // Re-add failed entries (don't lose data)
      snapshot.forEach((value, key) => {
        if (!this.queue.has(key)) {
          this.queue.set(key, value);
        }
      });
    } finally {
      this.isFlushing = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal processing
  // ─────────────────────────────────────────────────────────────────────────────

  private async _processQueue(snapshot: Map<string, QueueEntry>) {
    for (const entry of snapshot.values()) {
      try {
        switch (entry.type) {
          case QUEUE_ACTIONS.ADD:
            await this._processAdd(entry);
            break;
          case QUEUE_ACTIONS.DELETE:
            await this._processDelete(entry);
            break;
          case QUEUE_ACTIONS.MOVE:
            await this._processMove(entry);
            break;
          case QUEUE_ACTIONS.UPDATE:
            await this._processUpdate(entry);
            break;
        }
      } catch (err) {
        logger.error(`[ChangePlugin2] Error processing ${entry.type} for key ${entry.key}`, err as Error);
        // Re-queue the individual failed entry
        const dedupeKey = `${entry.type}_${entry.key}`;
        if (!this.queue.has(dedupeKey)) {
          this.queue.set(dedupeKey, entry);
        }
      }
    }
  }

  private async _processAdd(entry: QueueEntry) {
    if (!entry.contentStr || !entry.id) return;
    const { currentDocumentRef, dynamicState } = this.deps;

    const nodeItem: NodeJson = {
      id: entry.id,
      position: entry.position || "aa",
      content: entry.contentStr,
      full_text: entry.textContent || "",
      document_id: currentDocumentRef.current?.id || "",
      node_type: dynamicState.current.get(entry.key)?.node_type || "",
      created_at: entry.enqueuedAt,
      updated_at: entry.enqueuedAt,
    };

    const res = await newNode(nodeItem);
    logger.debug("[ChangePlugin2] ADD bloc", { key: entry.key, id: entry.id });

    // Track assets that come with the new bloc
    const assetIds = extractAssetIds(entry.contentStr);
    if (currentDocumentRef.current?.id && assetIds.length > 0) {
      await Promise.all(
        assetIds.map((id) =>
          removePendingAssetDeletion(id, currentDocumentRef.current!.id)
        )
      ).catch(console.error);
    }

    if (!res || res.length === 0) {
      logger.error("[ChangePlugin2] ADD bloc failed", undefined, { id: entry.id });
    }
  }

  private async _processDelete(entry: QueueEntry) {
    if (!entry.id) return;
    const { currentDocumentRef } = this.deps;

    // Fetch node to extract assets before deletion
    const prevNode = await getNodeById(entry.id);
    if (!prevNode) {
      logger.debug("[ChangePlugin2] DELETE skipped - node not found in database", { id: entry.id });
      return;
    }

    if (currentDocumentRef.current?.id) {
      try {
        const assetIds = extractAssetIds(prevNode.content);
        await Promise.all(
          assetIds.map((assetId) =>
            addPendingAssetDeletion(assetId, currentDocumentRef.current!.id)
          )
        ).catch(console.error);
      } catch (err) {
        logger.error("[ChangePlugin2] Failed to track assets for deletion", err as Error);
      }
    }

    const res = await deleteNode(entry.id);
    logger.debug("[ChangePlugin2] DELETE bloc", { id: entry.id });
    if (!res) {
      logger.error("[ChangePlugin2] DELETE failed", undefined, { id: entry.id });
    }
  }

  private async _processMove(entry: QueueEntry) {
    if (!entry.id || !entry.position || !entry.contentStr) return;

    const res = await updateNodePosition(
      entry.id,
      entry.position,
      entry.contentStr,
      Date.now()
    );
    logger.debug("[ChangePlugin2] MOVE bloc", { key: entry.key, newPosition: entry.position });
    if (typeof res === "string") {
      const state = this.deps.dynamicState.current.get(entry.key);
      if (state) state.checksum = res;
    } else if (res === null) {
      logger.debug("[ChangePlugin2] MOVE no change", { id: entry.id });
    } else {
      logger.error("[ChangePlugin2] MOVE failed", undefined, { id: entry.id });
    }
  }

  private async _processUpdate(entry: QueueEntry) {
    if (!entry.id || !entry.contentStr) return;
    const { currentDocumentRef } = this.deps;

    // Track asset changes: compare previous content with new content
    if (currentDocumentRef.current?.id) {
      try {
        const prevNode = await getNodeById(entry.id);
        const prevAssetIds = prevNode ? extractAssetIds(prevNode.content) : [];
        const currentAssetIds = extractAssetIds(entry.contentStr);

        const deletedAssets = prevAssetIds.filter((id) => !currentAssetIds.includes(id));
        const addedAssets = currentAssetIds.filter((id) => !prevAssetIds.includes(id));

        const docId = currentDocumentRef.current.id;
        await Promise.all(
          deletedAssets.map((id) => addPendingAssetDeletion(id, docId))
        ).catch(console.error);
        await Promise.all(
          addedAssets.map((id) => removePendingAssetDeletion(id, docId))
        ).catch(console.error);
      } catch (err) {
        logger.error("[ChangePlugin2] Failed to track asset changes for update", err as Error);
      }
    }

    const res = await updateNodeContent(
      entry.id,
      entry.contentStr,
      entry.textContent || "",
      Date.now()
    );
    logger.debug("[ChangePlugin2] UPDATE bloc", { key: entry.key });
    if (typeof res === "string") {
      const state = this.deps.dynamicState.current.get(entry.key);
      if (state) state.checksum = res;
    } else if (res === null) {
      logger.debug("[ChangePlugin2] UPDATE no change", { id: entry.id });
    } else {
      logger.error("[ChangePlugin2] UPDATE failed", undefined, { id: entry.id });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Asset cleanup on document exit
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Call this when the user navigates away from a document.
   * Deletes all pending assets accumulated during the session.
   */
  async cleanupPendingAssets(documentId: string) {
    try {
      const assetIds = await getPendingAssetDeletions(documentId);
      await Promise.all(assetIds.map((id) => deleteAsset(id)));
      await clearPendingAssetDeletions(documentId).catch(console.error);
    } catch (err) {
      logger.error("[ChangePlugin2] Failed to cleanup pending assets", err as Error);
    }
  }

  get pendingCount() {
    return this.queue.size;
  }

  get isIdle() {
    return this.queue.size === 0 && !this.isFlushing;
  }

  /** Check if an ID is already queued for a specific operation type */
  hasIdInQueue(id: string, actionType?: QueueActionType): boolean {
    for (const entry of this.queue.values()) {
      if (entry.id === id && (!actionType || entry.type === actionType)) {
        return true;
      }
    }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build the serialized content string for a bloc, injecting metadata
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Injects `$` metadata (id, position, node_type) into a serialized node JSON
 * and returns the resulting JSON string ready for SQLite.
 */
export function buildContentStr(
  content: Record<string, unknown>,
  id: string,
  position: string,
  nodeType: string
): string {
  const copy = { ...content };
  setIdState(copy as any, id);
  setPositionState(copy as any, position);
  setNodeTypeState(copy as any, nodeType);
  return JSON.stringify(copy);
}
