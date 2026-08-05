import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { loadSettings, removeUnexpectedKeys } from '@/App/settings';
import { useGlobalStore } from '@/App/store/useGlobalStore';
import { Dialog } from '@/components/custom/Dialog/Dialog';
import { APP_PATH, DEFAULT_SETTINGS } from '@/core/global/defaultSettings';

interface ConfigCleanupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unexpectedKeys: string[];
  onCleanup: () => void;
}

export function ConfigCleanupDialog({
  isOpen,
  onClose,
  unexpectedKeys,
  onCleanup,
}: ConfigCleanupDialogProps) {
  const { t } = useTranslation();
  const { getFileFromDocument } = useSettingsFile();
  const { setConfig } = useGlobalStore(useShallow((state: any) => ({ setConfig: state.setConfig })));

  const handleCleanup = async () => {
    try {
      const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);
      if (configPath) {
        const content = await readTextFile(configPath);
        const config = JSON.parse(content);
        const cleanedConfig = removeUnexpectedKeys(config, DEFAULT_SETTINGS);
        await writeTextFile(configPath, JSON.stringify(cleanedConfig, null, 2));

        await loadSettings(getFileFromDocument, setConfig);
      }
      onCleanup();
    } catch (error) {
      console.error("Config cleanup failed:", error);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('DIALOG.unexpectedConfigKeysTitle') as string}
      description={
        <>
          The following configuration keys are not recognized and will be removed:
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 text-sm" style={{ maxHeight: '30vh', minHeight: '100px', overflowY: 'auto' }}>
            <ul className="list-disc list-inside">
              {unexpectedKeys.map((key) => (
                <li key={key} className="text-gray-700">{key}</li>
              ))}
            </ul>
          </div>
        </>
      }
      mode="request"
      leftButton={{
        text: t('DIALOG.cleanup') as string,
        onClick: handleCleanup
      }}
      rightButton={{
        text: t('DIALOG.close') as string,
        onClick: onClose
      }}
    />
  );
}
