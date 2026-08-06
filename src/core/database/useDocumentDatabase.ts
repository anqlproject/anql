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
  metadata?: string | null,
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

export const getDocumentMetadata = async (id: string): Promise<string | null> => {
  try {
    const metadata = await invoke('get_document_metadata', { id }) as string | null;
    return metadata;
  } catch (error) {
    console.error('Failed to get document metadata:', error);
    throw error;
  }
}

export const setDocumentMetadata = async (id: string, metadata: string): Promise<boolean> => {
  try {
    const success = await invoke('set_document_metadata', { id, metadata }) as boolean;
    return success;
  } catch (error) {
    console.error('Failed to set document metadata:', error);
    throw error;
  }
}

export const removeDocumentMetadata = async (id: string): Promise<boolean> => {
  try {
    const success = await invoke('remove_document_metadata', { id }) as boolean;
    return success;
  } catch (error) {
    console.error('Failed to remove document metadata:', error);
    throw error;
  }
}



export interface DocumentMetadata {
  readMode?: boolean;
}

/** Type-safe key references — use instead of raw strings.
 *  e.g. DocumentMetadataKey.readMode instead of 'readMode' */
export const DocumentMetadataKey = {
  readMode: 'readMode',
} as const satisfies { [K in keyof Required<DocumentMetadata>]: K };

export const DEFAULT_DOCUMENT_METADATA: DocumentMetadata = {
  readMode: false,
};

/** Parse the raw metadata JSON string into a typed DocumentMetadata object (no DB call). */
export const parseDocumentMetadata = (raw: string | null | undefined): DocumentMetadata => {
  if (!raw) return { ...DEFAULT_DOCUMENT_METADATA };
  try {
    return { ...DEFAULT_DOCUMENT_METADATA, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_DOCUMENT_METADATA };
  }
};


/** Read a single field from the document's metadata JSON stored in the DB. */
export const getDocumentMetadataField = async <K extends keyof DocumentMetadata>(
  id: string,
  key: K
): Promise<DocumentMetadata[K]> => {
  const raw = await invoke('get_document_metadata', { id }) as string | null;
  const meta: DocumentMetadata = raw
    ? { ...DEFAULT_DOCUMENT_METADATA, ...JSON.parse(raw) }
    : { ...DEFAULT_DOCUMENT_METADATA };
  return meta[key];
};

/** Inject or update a single field in the document's metadata JSON, then persist it. */
export const updateDocumentMetadataField = async <K extends keyof DocumentMetadata>(
  id: string,
  key: K,
  value: DocumentMetadata[K]
): Promise<boolean> => {
  const raw = await invoke('get_document_metadata', { id }) as string | null;
  const meta: DocumentMetadata = raw
    ? { ...DEFAULT_DOCUMENT_METADATA, ...JSON.parse(raw) }
    : { ...DEFAULT_DOCUMENT_METADATA };
  meta[key] = value;
  return invoke('set_document_metadata', { id, metadata: JSON.stringify(meta) }) as Promise<boolean>;
};

/** Remove a single field from the document's metadata JSON, then persist it. */
export const removeDocumentMetadataField = async <K extends keyof DocumentMetadata>(
  id: string,
  key: K
): Promise<boolean> => {
  const raw = await invoke('get_document_metadata', { id }) as string | null;
  const meta: DocumentMetadata = raw
    ? { ...DEFAULT_DOCUMENT_METADATA, ...JSON.parse(raw) }
    : { ...DEFAULT_DOCUMENT_METADATA };
  delete meta[key];
  return invoke('set_document_metadata', { id, metadata: JSON.stringify(meta) }) as Promise<boolean>;
};
