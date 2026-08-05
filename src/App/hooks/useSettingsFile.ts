import { appDataDir } from "@tauri-apps/api/path";

export function useSettingsFile() {
  
  const getFileFromDocument = async (file: string): Promise<string | null> => {
    try {
      const appDir = await appDataDir();
      return `${appDir}/${file}`;
    } catch (error) {
      console.error("Failed to get app data directory:", error);
      throw error;
    }
  };

  return {
    getFileFromDocument,
  };
}
