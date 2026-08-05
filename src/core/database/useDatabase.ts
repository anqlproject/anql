// src/hooks/useDatabase.ts
import { invoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && 'isTauri' in window;
export const initDatabase = async (dbPath: string) => {
  try {
    // Check if we're in a Tauri environment
    if (typeof window !== 'undefined' && isTauri) {
      await invoke('init_db', { dbPath });
      return true;
    } else {
      // In browser environment, just log and continue
      console.log('Database initialization skipped - not in Tauri environment');
      return true;
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Don't throw error in browser environment
    if (typeof window !== 'undefined' && isTauri) {
      throw error;
    }
    return true;
  }
}


export const checkUnauthorizedTables = async () => {
  try {
    const result = await invoke('check_unauthorized_tables');
    return result as string[];
  } catch (error) {
    console.error('Failed to check unauthorized tables:', error);
    throw error;
  }
}

export const cleanupDatabase = async (unauthorizedTables: string[]) => {
  try {
    await invoke('cleanup_database', { unauthorizedTables });
  } catch (error) {
    console.error('Failed to cleanup database:', error);
    throw error;
  }
}

export const checkOrphanAssets = async (assetsPath: string): Promise<string[]> => {
  try {
    const result = await invoke('check_orphan_assets', { assetsPath });
    return result as string[];
  } catch (error) {
    console.error('Failed to check orphan assets:', error);
    return [];
  }
}

export const cleanupOrphanAssets = async (orphanPaths: string[]): Promise<number> => {
  try {
    const result = await invoke('cleanup_orphan_assets', { orphanPaths });
    return result as number;
  } catch (error) {
    console.error('Failed to cleanup orphan assets:', error);
    throw error;
  }
}

export const quickCheckDb = async (): Promise<void> => {
  try {
    if (typeof window !== 'undefined' && isTauri) {
      await invoke('quick_check_db');
    }
  } catch (error) {
    console.error('Database quick check failed:', error);
    throw error;
  }
}
