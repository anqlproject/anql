import { invoke } from '@tauri-apps/api/core';

import { useRecentDocumentsStore } from '@/GlobalState/recentDocumentsStore';

// Utility function to emit database change events via Zustand
const emitDatabaseChange = () => {
  if (typeof window !== 'undefined') {
    useRecentDocumentsStore.getState().refreshRecentDocuments();
  }
};

export interface RecentDocumentJson {
    id: string,
    opened_at: number,
    last_focused_node_id: string,
}

export const updateDynamically = () => {
    emitDatabaseChange();
}

export const addRecentDocument = async (id: string, last_focused_node_id: string): Promise<void> => {
  try {
    await invoke('add_recent_document', { id: id, lastFocusedNodeId: last_focused_node_id });
    emitDatabaseChange();
  } catch (error) {
    console.error('Failed to add recent document:', error);
    throw error;
  }
}

export const getRecentDocuments = async (limit?: number): Promise<RecentDocumentJson[]> => {
  try {
    const documents = await invoke('get_recent_documents', { limit: limit }) as RecentDocumentJson[];
    return documents;
  } catch (error) {
    console.error('Failed to get recent documents:', error);
    throw error;
  }
}

export const removeRecentDocument = async (id: string): Promise<boolean> => {
  try {
    const success = await invoke('remove_recent_document', { id: id }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to remove recent document:', error);
    throw error;
  }
}

export const clearRecentDocuments = async (): Promise<void> => {
  try {
    await invoke('clear_recent_documents');
    emitDatabaseChange();
  } catch (error) {
    console.error('Failed to clear recent documents:', error);
    throw error;
  }
}

export const updateLastFocusedNode = async (id: string, node_id: string): Promise<boolean> => {
  try {
    const success = await invoke('update_last_focused_node', { id: id, nodeId: node_id }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to update last focused node:', error);
    throw error;
  }
}

export const getRecentDocument = async (id: string): Promise<RecentDocumentJson | null> => {
  try {
    const document = await invoke('get_recent_document', { id: id }) as RecentDocumentJson | null;
    return document;
  } catch (error) {
    console.error('Failed to get recent document:', error);
    throw error;
  }
}
