import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

import type { AppConfig } from '@/App/store/createConfigSlice';
import { APP_PATH, DEFAULT_SETTINGS } from '@/core/global/defaultSettings';

// ── Config integrity helpers (used in App.tsx) ──────────────────────

/** Returns dot-notation keys present in config but absent from schema */
export const getUnexpectedKeys = (
  config: Record<string, unknown>,
  schema: Record<string, unknown>
): string[] => {
  const unexpected: string[] = [];

  const check = (obj: Record<string, unknown>, ref: Record<string, unknown>, prefix = '') => {
    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in ref)) {
        unexpected.push(path);
      } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        check(
          obj[key] as Record<string, unknown>,
          ref[key] as Record<string, unknown>,
          path
        );
      }
    }
  };

  check(config, schema);
  return unexpected;
};

/** Returns a new object containing only keys that exist in schema */
export const removeUnexpectedKeys = (
  config: Record<string, unknown>,
  schema: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key in schema) {
    if (key in config) {
      if (typeof schema[key] === 'object' && schema[key] !== null && !Array.isArray(schema[key])) {
        result[key] = removeUnexpectedKeys(
          config[key] as Record<string, unknown>,
          schema[key] as Record<string, unknown>
        );
      } else {
        result[key] = config[key];
      }
    } else {
      result[key] = schema[key];
    }
  }
  return result;
};

// ── Typed shallow merge for AppConfig ───────────────────────────────

/**
 * Merges a saved (possibly partial/outdated) config from disk with DEFAULT_SETTINGS.
 * Each section is merged shallowly so new keys added in app updates are picked up,
 * while existing user values are preserved.
 */
export const mergeWithDefaults = (saved: Partial<AppConfig>): AppConfig => ({
  ...DEFAULT_SETTINGS,
  ...saved,
  appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance },
  editor: { ...DEFAULT_SETTINGS.editor, ...saved.editor },
  sidebar: { ...DEFAULT_SETTINGS.sidebar, ...saved.sidebar },
  homePage: {
    ...DEFAULT_SETTINGS.homePage,
    ...saved.homePage,
    sortBy: { ...DEFAULT_SETTINGS.homePage.sortBy, ...saved.homePage?.sortBy },
  },
});

// ── Main loader ──────────────────────────────────────────────────────

/**
 * Loads config from disk, merges with defaults (to handle new keys from app updates),
 * writes back only when the file didn't exist or had missing keys, then hydrates the store.
 */
export const loadSettings = async (
  getFileFromDocument: (path: string) => Promise<string | null>,
  setConfig: (config: AppConfig) => void
): Promise<AppConfig> => {
  const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);

  if (!configPath) {
    // Can't resolve path — use defaults without persisting
    setConfig(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  try {
    const content = await readTextFile(configPath);
    const saved = JSON.parse(content) as Partial<AppConfig>;
    const merged = mergeWithDefaults(saved);

    // Write back only if merge added missing keys (keeps the file stable)
    if (JSON.stringify(saved) !== JSON.stringify(merged)) {
      await writeTextFile(configPath, JSON.stringify(merged, null, 2));
    }

    setConfig(merged);
    return merged;
  } catch {
    // File doesn't exist or is malformed — ensure directory exists, then seed with defaults
    const dirPath = configPath.substring(0, configPath.lastIndexOf('/'));
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (mkdirError) {
      console.error('Failed to create directory:', mkdirError);
    }
    await writeTextFile(configPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    setConfig(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
};

/** Persists the current config to disk */
export const saveSettings = async (
  getFileFromDocument: (path: string) => Promise<string | null>,
  config: AppConfig
): Promise<void> => {
  const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);
  if (!configPath) throw new Error('Config path not found');
  await writeTextFile(configPath, JSON.stringify(config, null, 2));
};
