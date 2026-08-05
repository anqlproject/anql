import { invoke } from '@tauri-apps/api/core';

import { useDocumentsStore } from '@/GlobalState/documentsStore';

// Utility function to emit database change events via Zustand
export const emitDatabaseChange = () => {
  if (typeof window !== 'undefined') {
    useDocumentsStore.getState().refreshDocuments();
  }
};

export interface DocumentsJson {
  id: string,
  path: string,
  workspace_id: string,
  title: string,
  created_at: number,
  updated_at: number,
}

export const updateDynamically = () => {
  emitDatabaseChange();
}

export const newDocument = async (documentJson: DocumentsJson): Promise<string> => {
  try {
    const id = await invoke('new_document', { document: documentJson }) as string;
    emitDatabaseChange();
    return id;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateDocument = async (documentJson: DocumentsJson): Promise<boolean> => {
  try {
    const success = await invoke('update_document', { document: documentJson }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateDocumentPath = async (id: string, path: string): Promise<boolean> => {
  try {
    const success = await invoke('update_document_path', { id: id, path: path }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateDocumentTitle = async (id: string, title: string): Promise<boolean> => {
  try {
    const success = await invoke('update_document_title', { id: id, title: title }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateDocumentWorkspaceId = async (id: string, workspaceId: string): Promise<boolean> => {
  try {
    const success = await invoke('update_document_workspace_id', { document_id: id, workspace_id: workspaceId }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateDocumentTimestamp = async (id: string, updatedAt: number): Promise<boolean> => {
  try {
    const success = await invoke('update_document_timestamp', { id: id, updatedAt: updatedAt }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('Failed to update document timestamp:', error);
    throw error;
  }
}

export const deleteDocument = async (id: string): Promise<boolean> => {
  try {
    const success = await invoke('delete_document', { id: id }) as boolean;
    emitDatabaseChange();
    return success;
  } catch (error) {
    console.error('deletedocument Failed:', error);
    throw error;
  }
}

export const getDocumentsByPath = async (path: string): Promise<DocumentsJson[]> => {
  try {
    const documents = await invoke('get_documents_by_path', { path: path }) as DocumentsJson[];
    return documents;
  } catch (error) {
    console.error('getDocumentsByPath Failed:', error);
    throw error;
  }
}

export const getDocumentsByWorkspaceId = async (workspaceId: string): Promise<DocumentsJson[]> => {
  try {
    const documents = await invoke('get_documents_by_workspace_id', { workspaceId: workspaceId }) as DocumentsJson[];
    return documents;
  } catch (error) {
    console.error('getDocumentsByWorkspaceId Failed:', error);
    throw error;
  }
}

export const getDocumentById = async (documentId: string): Promise<DocumentsJson | null> => {
  try {
    const document = await invoke('get_document_by_id', { documentId: documentId }) as DocumentsJson;
    return document;
  } catch (error) {
    console.warn('Failed to get document by id:', error);
    return null;
  }
}