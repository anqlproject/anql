import { resolveResource } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { JSX } from 'react';
import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { importAnqlDocument } from '@/App/AppComponents/ImportExport/importDocument';
import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { getUnexpectedKeys, loadSettings, removeUnexpectedKeys } from '@/App/settings';
import { useGlobalStore } from '@/App/store/useGlobalStore';
import { useBackgroundTaskRunner } from '@/core/BackgroundTask/BackgroundTaskRunner';
import {
  cleanupOldPendingDeletions,
  cleanupUnusedAssets,
  getUnusedAssets
} from '@/core/database/useAssetDatabase';
import {
  checkOrphanAssets,
  checkUnauthorizedTables,
  cleanupDatabase,
  cleanupOrphanAssets,
  initDatabase,
  quickCheckDb
} from '@/core/database/useDatabase';
import { getDocumentsByWorkspaceId } from '@/core/database/useDocumentDatabase';
import { APP_PATH, DEFAULT_SETTINGS } from '@/core/global/defaultSettings';
import { logger, logStorage } from '@/core/logger';
import { normalizeTheme, useThemeStore } from '@/GlobalState/themeStore';

interface AppInitializerProps {
  children: React.ReactNode;
}

const templateResources = new Map([
  ['Overviews', 'templates/Overviews.anql'],
  ['Budget_management', 'templates/Budget_management.anql'],
  ['Physics_exercise', 'templates/Physics_exercise.anql'],
]);

let templateImportPromise: Promise<void> | null = null;

function importTemplateDocuments(): Promise<void> {
  if (templateImportPromise) return templateImportPromise;

  templateImportPromise = (async () => {
    const templateUrls = new Map<string, string>();
    const existingDocuments = await getDocumentsByWorkspaceId('default');
    const normalizeTitle = (title: string) => title.replace(/_/g, ' ').trim().toLowerCase();
    const existingTitles = new Set(existingDocuments.map((document) => normalizeTitle(document.title)));

    for (const [name, resourcePath] of templateResources) {
      if (existingTitles.has(normalizeTitle(name))) continue;
      templateUrls.set(name, await resolveResource(resourcePath));
    }

    for (const templateUrl of templateUrls.values()) {
      await importAnqlDocument(templateUrl);
    }
  })().catch((error) => {
    templateImportPromise = null;
    throw error;
  });

  return templateImportPromise;
}

export function AppInitializer({ children }: AppInitializerProps): JSX.Element {
  const { config, setConfig } = useGlobalStore(useShallow((state: any) => ({
    setConfig: state.setConfig,
    config: state.config
  })));
  const { getFileFromDocument } = useSettingsFile();

  const [isDbLoading, setIsDbLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      try {
        const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);
        const rawDbPath = APP_PATH.DATABASE_FILE;
        const isAbsolute = rawDbPath.startsWith('/') || /^[A-Z]:[/\\]/.test(rawDbPath);
        const databasePath = isAbsolute ? rawDbPath : await getFileFromDocument(rawDbPath);
        const isNewInstallation = Boolean(
          configPath && databasePath && !(await exists(configPath)) && !(await exists(databasePath)),
        );
        if (configPath && await exists(configPath)) {
          try {
            const content = await readTextFile(configPath);
            const parsedConfig = JSON.parse(content);
            const unexpectedKeys = getUnexpectedKeys(parsedConfig, DEFAULT_SETTINGS);

            if (unexpectedKeys.length > 0) {
              logger.info(`Cleaning up ${unexpectedKeys.length} unexpected config keys...`);
              const cleanedConfig = removeUnexpectedKeys(parsedConfig, DEFAULT_SETTINGS);
              await writeTextFile(configPath, JSON.stringify(cleanedConfig, null, 2));
            }
            await loadSettings(getFileFromDocument, setConfig);
          } catch (e) {
            console.error('Error checking config integrity:', e);
            // Fallback: still load settings even if integrity check fails
            await loadSettings(getFileFromDocument, setConfig).catch(console.error);
          }
        } else {
          await loadSettings(getFileFromDocument, setConfig);
        }

        // Apply theme from config (config.json is the single source of truth)
        useThemeStore.getState().setTheme(normalizeTheme(useGlobalStore.getState().config.appearance.theme));

        if (!databasePath) throw new Error("Database path not found");

        // Configure the log directory using APP_PATH.LOG_DIR
        const logDir = isAbsolute ? APP_PATH.LOG_DIR : await getFileFromDocument(APP_PATH.LOG_DIR);
        if (logDir) {
          logStorage.setLogDirectory(logDir);
          await logStorage.cleanupIfTooLarge();
        }

        logger.setErrorLoggingEnabled(config.privacy?.enableErrorLogging !== false);

        // Initialize logger with privacy setting
        await initDatabase(databasePath);

        if (isNewInstallation || (await getDocumentsByWorkspaceId('default')).length === 0) {
          await importTemplateDocuments();
        }

        if (isMounted) {
          setIsDbLoading(false);
          console.log("Database initialized from path:", databasePath);
        }

        // Run heavy maintenance checks sequentially in a single background task
        // to prevent SQLite concurrency issues (e.g. PRAGMA quick_check failing
        // because another task is running a massive DELETE).
        const { run } = useBackgroundTaskRunner.getState();

        run(
          async () => {
            logger.info('Starting background database maintenance...');

            // 1. Cleanup old pending deletions
            try {
              await cleanupOldPendingDeletions(24 * 60 * 60);
              logger.info('Pending deletions cleanup completed');
            } catch (e) {
              logger.error('Failed to cleanup old pending deletions', e instanceof Error ? e : new Error(String(e)));
            }

            // 2. Integrity check
            try {
              await quickCheckDb();
              logger.info('Database integrity check completed');
            } catch (dbError) {
              logger.error('Database integrity check failed', dbError instanceof Error ? dbError : new Error(String(dbError)));
            }

            // 3. Unauthorized tables check
            try {
              const unauthorized = await checkUnauthorizedTables();
              if (unauthorized.length > 0) {
                logger.info(`Cleaning up ${unauthorized.length} unauthorized tables...`);
                await cleanupDatabase(unauthorized);
              } else {
                logger.info('Unauthorized tables check completed: none found');
              }
            } catch (e) {
              logger.error('Unauthorized tables check failed', e instanceof Error ? e : new Error(String(e)));
            }

            // 4. Unused assets check
            try {
              const unused = await getUnusedAssets();
              if (unused.length > 0) {
                logger.info(`Cleaning up ${unused.length} unused assets...`);
                await cleanupUnusedAssets();
              } else {
                logger.info('Unused assets check completed: none found');
              }
            } catch (e) {
              logger.error('Unused assets check failed', e instanceof Error ? e : new Error(String(e)));
            }

            // 5. Orphan assets check
            try {
              const assetsPath = await getFileFromDocument(APP_PATH.ASSETS_DIR);
              if (assetsPath) {
                const orphans = await checkOrphanAssets(assetsPath);
                if (orphans.length > 0) {
                  logger.info(`Cleaning up ${orphans.length} orphan assets...`);
                  await cleanupOrphanAssets(orphans);
                } else {
                  logger.info('Orphan assets check completed: none found');
                }
              } else {
                logger.warn('Assets path not found, skipping orphan assets check');
              }
            } catch (e) {
              logger.error('Orphan assets check failed', e instanceof Error ? e : new Error(String(e)));
            }

            logger.info('Background database maintenance finished.');
          },
          'Database maintenance'
        );
      } catch (error) {
        if (isMounted) {
          console.error("Database init failed:", error);
          setIsDbLoading(false);
        }
      }
    };

    initApp();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isDbLoading) return <></>;

  return <>{children}</>;
}
