import { invoke } from '@tauri-apps/api/core';

import { updateDocumentTimestamp } from './useDocumentDatabase';

// Utility function to emit database change events
const emitDatabaseChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('node-database-changed'));
  }
};

export interface NodeJson {
    id: string,
    position: string,
    content: string,
    full_text: string,
    document_id: string,
    node_type: string,
    metadata?: string | null,
    created_at: number,
    updated_at: number,
    checksum?: string
}

export interface NodeHash {
    id: string,
    checksum: string
}

export const SUCCESS: number = 1;
export const ERROR: number = -1;
export const NO_CHANGE: number = 0;

// NOTES : invoke parameters must be similar to RUST

export const newNode = async (nodeJson: NodeJson): Promise<string> => {
  try {
    const id = await invoke('new_node', { node: nodeJson }) as string;
    emitDatabaseChange();

    // Update document timestamp when new node is created
    try {
      await updateDocumentTimestamp(nodeJson.document_id, nodeJson.updated_at);
    } catch (err) {
      console.warn('Failed to update document timestamp:', err);
    }

    return id;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateNode = async (nodeJson: NodeJson): Promise<boolean> => {
  try {
    const success = await invoke('update_node', { node: nodeJson }) as boolean;
    emitDatabaseChange();

    // Update document timestamp when node is updated
    if (success) {
      try {
        await updateDocumentTimestamp(nodeJson.document_id, nodeJson.updated_at);
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateNodeContent = async (
  id: string,
  newContent: string,
  newFullText: string,
  updatedAt: number
): Promise<string | null> => {
  try {
    const newChecksum = await invoke('update_node_content', { id: id, newContent: newContent, newFullText: newFullText, updatedAt: updatedAt }) as string | null;
    emitDatabaseChange();

    // Update document timestamp when node content changes
    if (newChecksum !== null) {
      try {
        const documentId = await getDocumentId(id);
        await updateDocumentTimestamp(documentId, updatedAt);
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return newChecksum;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateNodePosition = async (
  id: string,
  newPosition: string,
  newContent: string,
  updatedAt: number
): Promise<string | null> => {
  try {
    const newChecksum = await invoke('update_node_position', {
      id: id,
      newPosition: newPosition,
      newContent: newContent,
      updatedAt: updatedAt
    }) as string | null;
    emitDatabaseChange();

    // Update document timestamp when node position changes
    if (newChecksum !== null) {
      try {
        const documentId = await getDocumentId(id);
        await updateDocumentTimestamp(documentId, updatedAt);
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return newChecksum;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateNodeDocumentId = async (id: string, newDocumentId: string): Promise<boolean> => {
  try {
    const success = await invoke('update_node_document_id', { id: id, newDocumentId: newDocumentId }) as boolean;
    emitDatabaseChange();

    // Update document timestamp when node document_id changes
    if (success) {
      try {
        await updateDocumentTimestamp(newDocumentId, Date.now());
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const updateNodeType = async (id: string, newType: string): Promise<number> => {
  try {
    const success = await invoke('update_node_type', { id: id, nodeType: newType }) as number;
    emitDatabaseChange();

    // Update document timestamp when node type changes
    if (success === SUCCESS) {
      try {
        const documentId = await getDocumentId(id);
        await updateDocumentTimestamp(documentId, Date.now());
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const deleteNode = async (id: string): Promise<boolean> => {
  try {
    // Fetch document ID before deleting the node
    let documentId: string | null = null;
    try {
      documentId = await invoke('get_document_id', { nodeId: id }) as string;
    } catch (err) {
      console.warn('Could not fetch documentId before deletion:', err);
    }

    const success = await invoke('delete_node', { id: id }) as boolean;
    emitDatabaseChange();

    // Update document timestamp when node is deleted
    if (success && documentId) {
      try {
        await updateDocumentTimestamp(documentId, Date.now());
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const deleteNodeByDocumentId = async (documentId: string): Promise<boolean> => {
  try {
    const success = await invoke('delete_node_by_document_id', { documentId: documentId }) as boolean;
    emitDatabaseChange();

    // Update document timestamp when nodes are deleted by document_id
    if (success) {
      try {
        await updateDocumentTimestamp(documentId, Date.now());
      } catch (err) {
        console.warn('Failed to update document timestamp:', err);
      }
    }

    return success;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const getChecksum = async (id: string): Promise<string> => {
  try {
    const checksum = await invoke('get_checksum', { id: id }) as string;
    return checksum;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const getNodeById = async (id: string): Promise<NodeJson> => {
  try {
    const node = await invoke('get_node_by_id', { id: id }) as NodeJson;
    return node;
  } catch (error) {
    console.warn('Failed to get node by id:', error);
    return null as unknown as NodeJson;
  }
}

export const getNodesByDocumentId = async (documentId: string): Promise<NodeJson[]> => {
  try {
    const nodes = await invoke('get_nodes_by_document_id', { documentId: documentId }) as NodeJson[];
    return nodes;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const getHashesByDocumentId = async (documentId: string): Promise<NodeHash[]> => {
  try {
    const hashes = await invoke('get_hashes_by_document_id', { documentId: documentId }) as NodeHash[];
    return hashes;
  } catch (error) {
    console.error('Failed to get hashes:', error);
    throw error;
  }
}

export const getDocumentId = async (nodeId: string): Promise<string> => {
  try {
    const documentId = await invoke('get_document_id', { nodeId: nodeId }) as string;
    return documentId;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const getNodesByNodeType = async (nodeType: string): Promise<NodeJson[]> => {
  try {
    const nodes = await invoke('get_nodes_by_node_type', { nodeType: nodeType }) as NodeJson[];
    return nodes;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export const computeHashesBatch = async (contents: string[]): Promise<string[]> => {
  try {
    const hashes = await invoke('compute_hashes_batch', { contents }) as string[];
    return hashes;
  } catch (error) {
    console.error('Failed to compute hashes:', error);
    throw error;
  }
}

export const getNodeMetadata = async (id: string): Promise<string | null> => {
  try {
    const metadata = await invoke('get_node_metadata', { id }) as string | null;
    return metadata;
  } catch (error) {
    console.error('Failed to get node metadata:', error);
    throw error;
  }
}

export const setNodeMetadata = async (id: string, metadata: string): Promise<boolean> => {
  try {
    const success = await invoke('set_node_metadata', { id, metadata }) as boolean;
    return success;
  } catch (error) {
    console.error('Failed to set node metadata:', error);
    throw error;
  }
}

export const removeNodeMetadata = async (id: string): Promise<boolean> => {
  try {
    const success = await invoke('remove_node_metadata', { id }) as boolean;
    return success;
  } catch (error) {
    console.error('Failed to remove node metadata:', error);
    throw error;
  }
}
