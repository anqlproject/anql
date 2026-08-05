import { arch, family, platform, version } from '@tauri-apps/plugin-os';

export interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
  family: string;
}

/**
 * Récupère les informations système en utilisant le plugin Tauri OS
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  try {
    const [platformInfo, versionInfo, archInfo, familyInfo] = await Promise.all([
      platform(),
      version(),
      arch(),
      family()
    ]);

    return {
      platform: platformInfo,
      version: versionInfo,
      arch: archInfo,
      family: familyInfo
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des informations système:', error);
    throw error;
  }
}

/**
 * Récupère le système d'exploitation (platform)
 */
export async function getPlatform(): Promise<string> {
  return await platform();
}

/**
 * Récupère la version du système d'exploitation
 */
export async function getOSVersion(): Promise<string> {
  return await version();
}

/**
 * Récupère l'architecture du processeur
 */
export async function getArch(): Promise<string> {
  return await arch();
}

/**
 * Récupère la famille du système d'exploitation
 */
export async function getFamily(): Promise<string> {
  return await family();
}
