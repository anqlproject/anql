import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';

export interface AssetJson {
  id: string;
  name: string;
  mime_type: string | null;
  /** Absolute path to the asset file on disk. Use convertFileSrc() to get a displayable URL. */
  file_path: string;
  created_at?: number;
}

// Pending asset deletions
export const addPendingAssetDeletion = async (
  assetId: string,
  documentId: string,
): Promise<void> => {
  try {
    await invoke('add_pending_asset_deletion', { assetId, documentId });
  } catch (error) {
    console.error('Failed to add pending asset deletion:', error);
    throw error;
  }
};

export const removePendingAssetDeletion = async (
  assetId: string,
  documentId: string,
): Promise<void> => {
  try {
    await invoke('remove_pending_asset_deletion', { assetId, documentId });
  } catch (error) {
    console.error('Failed to remove pending asset deletion:', error);
    throw error;
  }
};

export const getPendingAssetDeletions = async (
  documentId: string,
): Promise<string[]> => {
  try {
    return await invoke('get_pending_asset_deletions', { documentId });
  } catch (error) {
    console.error('Failed to get pending asset deletions:', error);
    throw error;
  }
};

export const clearPendingAssetDeletions = async (
  documentId: string,
): Promise<void> => {
  try {
    await invoke('clear_pending_asset_deletions', { documentId });
  } catch (error) {
    console.error('Failed to clear pending asset deletions:', error);
    throw error;
  }
};

export const cleanupOldPendingDeletions = async (
  olderThanSecs: number,
): Promise<number> => {
  try {
    return await invoke('cleanup_old_pending_deletions', { olderThanSecs });
  } catch (error) {
    console.error('Failed to cleanup old pending deletions:', error);
    throw error;
  }
};

export const createAsset = async (
  id: string,
  name: string,
  mimeType: string | null,
  base64Data: string
): Promise<void> => {
  try {
    await invoke('create_asset', { id, name, mimeType, base64Data });
  } catch (error) {
    console.error('Failed to create asset:', error);
    throw error;
  }
};

export const getAsset = async (id: string): Promise<AssetJson> => {
  try {
    const asset = await invoke('get_asset', { id }) as AssetJson;
    return asset;
  } catch (error) {
    console.error('Failed to get asset:', error);
    throw error;
  }
};

export const deleteAsset = async (id: string): Promise<boolean> => {
  try {
    const success = await invoke('delete_asset', { id }) as boolean;
    return success;
  } catch (error) {
    console.error('Failed to delete asset:', error);
    throw error;
  }
};

export const cleanupUnusedAssets = async (): Promise<number> => {
  try {
    return await invoke('cleanup_unused_assets');
  } catch (error) {
    console.error('Failed to cleanup unused assets:', error);
    throw error;
  }
};

export const getUnusedAssets = async (): Promise<AssetJson[]> => {
  try {
    return await invoke('get_unused_assets');
  } catch (error) {
    console.error('Failed to get unused assets:', error);
    throw error;
  }
};

/**
 * If srcOrUrl is a data-URI (base64) or blob URL, upload it as an asset on disk and return
 * the `asset://<uuid>` reference. Otherwise return the URL as-is.
 */
export async function uploadAssetIfNeeded(srcOrUrl: string, name: string, defaultMime = 'application/octet-stream'): Promise<string> {
  // Handle blob URLs
  if (srcOrUrl.startsWith('blob:')) {
    try {
      const response = await fetch(srcOrUrl);
      const blob = await response.blob();
      
      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Recursively call to handle the base64 data
          uploadAssetIfNeeded(base64, name, blob.type || defaultMime)
            .then(resolve)
            .catch(reject);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert blob URL to base64:', error);
      return srcOrUrl;
    }
  }
  
  // Handle data URIs (base64)
  if (srcOrUrl.startsWith('data:')) {
    const id = crypto.randomUUID();
    const match = srcOrUrl.match(/^data:(.*?);base64,(.*)$/);
    if (match) {
      const mimeType = match[1] || defaultMime;
      const base64Data = match[2];

      await createAsset(
        id,
        name,
        mimeType,
        base64Data
      );
      return `asset://${id}`;
    }
  }
  return srcOrUrl;
}

/**
 * Resolve an `asset://<uuid>` reference to a displayable URL.
 * Fetches the file_path from the DB and reads the file to create a base64 data URL.
 * Returns null if the asset cannot be resolved.
 */
export async function resolveAssetUrl(assetRef: string): Promise<string | null> {
  if (!assetRef.startsWith('asset://')) {
    return assetRef;
  }
  try {
    const id = assetRef.substring(8);
    const asset = await getAsset(id);
    if (!asset.file_path) return null;
    
    // Read the file using Tauri's fs API
    const fileData = await readFile(asset.file_path);
    
    // Create a Blob and generate a Blob URL (more efficient for large files)
    const blob = new Blob([fileData], { type: asset.mime_type || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    
    return blobUrl;
  } catch (err) {
    console.error('Failed to resolve asset URL:', err);
    return null;
  }
}

export function extractAssetIds(content: string): string[] {
  const ids: string[] = [];
  const regex = /asset:\/\/([a-f0-9-]{36})/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const id = match[1];
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}
