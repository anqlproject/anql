import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@/components/custom/Dialog/Dialog';
import { logStorage } from '@/core/logger';

import { SettingsItem, SettingsTab } from '../SettingsComponents/index';

interface PrivacyTabProps {
  settings: any;
  updateSetting: (key: string, value: unknown, category?: string) => void;
}

export default function PrivacyTab({ settings, updateSetting }: PrivacyTabProps) {
  const { t } = useTranslation();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const handleClearLogs = async () => {
    try {
      await logStorage.clearLogs();
      setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  return (
    <SettingsTab title={t('SETTINGS.privacyTab')}>
      {/* Logs Section */}
      <SettingsItem
        label={t('SETTINGS.privacy.errorReports') as string}
        description={t('SETTINGS.privacy.errorReportsDescription') as string}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.privacy?.enableErrorLogging !== false}
            onChange={(e) => updateSetting('enableErrorLogging', e.target.checked, 'privacy')}
            className="settings-checkbox"
          />
          <span className="text-sm">{t('SETTINGS.privacy.recordErrorsLocally')}</span>
        </label>
      </SettingsItem>

      <SettingsItem
        label={t('SETTINGS.logs.management') as string}
        description={t('SETTINGS.logs.managementDescription') as string}
      >
        <button
          className="settings-action-button"
          onClick={() => setConfirmDialog({
            isOpen: true,
            title: t('SETTINGS.logs.clearTitle') as string,
            message: t('SETTINGS.logs.confirmClear') as string,
            onConfirm: handleClearLogs,
          })}
        >
          <Trash2 className="w-4 h-4" />
          {t('SETTINGS.logs.clear')}
        </button>
      </SettingsItem>

      <Dialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { } })}
        title={confirmDialog.title}
        description={confirmDialog.message}
        mode="urgent"
        leftButton={{
          text: t('DIALOG.cancel') as string,
          onClick: () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => { } })
        }}
        rightButton={{
          text: t('DIALOG.delete') as string,
          onClick: confirmDialog.onConfirm,
          variant: 'danger'
        }}
      />
    </SettingsTab>
  );
}
