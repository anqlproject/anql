import { arch, family, platform, version } from '@tauri-apps/plugin-os';

export interface SystemInfo {
  platform: string;
  version: string;
  arch: string;
  family: string;
}

/**
 * Get system information using the Tauri OS plugin
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
    console.error('Error retrieving system information:', error);
    throw error;
  }
}

/**
 * Get the operating system (platform)
 */
export async function getPlatform(): Promise<string> {
  return await platform();
}

/**
 * Get the operating system version
 */
export async function getOSVersion(): Promise<string> {
  return await version();
}

/**
 * Get the processor architecture
 */
export async function getArch(): Promise<string> {
  return await arch();
}

/**
 * Get the operating system family
 */
export async function getFamily(): Promise<string> {
  return await family();
}
