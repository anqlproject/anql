import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { JSX } from 'react';
import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGlobalToast } from '@/App/hooks/useGlobalToast';
import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { getUnexpectedKeys, loadSettings, removeUnexpectedKeys } from '@/App/settings';
import { useGlobalStore } from '@/App/store/useGlobalStore';
import { useBackgroundTaskRunner } from '@/core/BackgroundTask/BackgroundTaskRunner';
import { 
  cleanupOldPendingDeletions,
  cleanupUnusedAssets, 
  getUnusedAssets} from '@/core/database/useAssetDatabase';
import { 
  checkOrphanAssets, 
  checkUnauthorizedTables, 
  cleanupDatabase,
  cleanupOrphanAssets,
  initDatabase, 
  quickCheckDb} from '@/core/database/useDatabase';
import { APP_PATH, DEFAULT_SETTINGS } from '@/core/global/defaultSettings';
import { logger,logStorage } from '@/core/logger';

interface AppInitializerProps {
  children: React.ReactNode;
}

export function AppInitializer({ children }: AppInitializerProps): JSX.Element {
  const { config, setConfig } = useGlobalStore(useShallow((state: any) => ({ 
    setConfig: state.setConfig, 
    config: state.config 
  })));
  const { getFileFromDocument } = useSettingsFile();
  const { showToast } = useGlobalToast();

  const [isDbLoading, setIsDbLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      try {
        const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);
        if (configPath) {
          try {
            const content = await readTextFile(configPath);
            const parsedConfig = JSON.parse(content);
            const unexpectedKeys = getUnexpectedKeys(parsedConfig, DEFAULT_SETTINGS);

            if (unexpectedKeys.length > 0) {
              logger.info(`Cleaning up ${unexpectedKeys.length} unexpected config keys...`);
              const cleanedConfig = removeUnexpectedKeys(parsedConfig, DEFAULT_SETTINGS);
              await writeTextFile(configPath, JSON.stringify(cleanedConfig, null, 2));
              await loadSettings(getFileFromDocument, setConfig);
            }
          } catch (e) {
            console.error('Error checking config integrity:', e);
          }
        }

        const rawDbPath =  APP_PATH.DATABASE_FILE;
        const isAbsolute = rawDbPath.startsWith('/') || /^[A-Z]:[/\\]/.test(rawDbPath);
        const databasePath = isAbsolute ? rawDbPath : await getFileFromDocument(rawDbPath);

        if (!databasePath) throw new Error("Database path not found");

        // Configurer le répertoire des logs en utilisant APP_PATH.LOG_DIR
        const logDir = isAbsolute ? APP_PATH.LOG_DIR : await getFileFromDocument(APP_PATH.LOG_DIR);
        if (logDir) {
          logStorage.setLogDirectory(logDir);
          // Nettoyer les logs s'ils sont trop gros
          await logStorage.cleanupIfTooLarge();
        }

        // Initialiser le logger avec le setting de confidentialité
        logger.setErrorLoggingEnabled(config.privacy?.enableErrorLogging !== false);

        await initDatabase(databasePath);
        cleanupOldPendingDeletions(24 * 60 * 60).catch(console.error);

        if (isMounted) {
          setIsDbLoading(false);
          console.log("Database initialized from path:", databasePath);
        }

        // Run heavy checks in background without visual indicator
        const { run } = useBackgroundTaskRunner.getState();

        run(
          async () => {
            logger.info('Starting database integrity check...');
            try {
              await quickCheckDb();
              logger.info('Database integrity check completed');
            } catch (dbError) {
              logger.error('Database integrity check failed', dbError instanceof Error ? dbError : new Error(String(dbError)));
              showToast(`Database Integrity Check Failed: ${dbError}`, 'error', 10000);
            }
          },
          'Checking database integrity...'
        );

        run(
          async () => {
            logger.info('Checking for unauthorized tables...');
            const unauthorized = await checkUnauthorizedTables();
            if (unauthorized.length > 0) {
              logger.info(`Cleaning up ${unauthorized.length} unauthorized tables...`);
              await cleanupDatabase(unauthorized);
            } else {
              logger.info('Unauthorized tables check completed: none found');
            }
          },
          'Checking for unauthorized tables...'
        );

        run(
          async () => {
            logger.info('Checking for unused assets...');
            const unused = await getUnusedAssets();
            if (unused.length > 0) {
              logger.info(`Cleaning up ${unused.length} unused assets...`);
              await cleanupUnusedAssets();
            } else {
              logger.info('Unused assets check completed: none found');
            }
          },
          'Checking for unused assets...'
        );

        run(
          async () => {
            const assetsPath = await getFileFromDocument(APP_PATH.ASSETS_DIR);
            if (assetsPath) {
              logger.info('Checking for orphan assets...');
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
          },
          'Checking for orphan assets...'
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
