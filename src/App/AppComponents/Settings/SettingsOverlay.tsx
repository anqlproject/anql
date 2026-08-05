import './SettingsOverlay.css';

import { Palette, Shield, Type, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { saveSettings } from '@/App/settings';
import { useGlobalStore } from "@/App/store/useGlobalStore";
import FeedbackButton from '@/components/custom/FeedbackButton/FeedbackButton';
import { Button } from '@/components/ui/button';
import { DIMENSIONS } from '@/core/global/defaultValues';
import { useTheme } from '@/core/global/ThemeContext';
import { logger } from '@/core/logger';

import AppearanceTab from './SettingsTab/AppearanceTab';
import EditorTab from './SettingsTab/EditorTab';
import PrivacyTab from './SettingsTab/PrivacyTab';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('appearance');

  // ── Zustand config store — source of truth ──────────────────────────
  const { config, setConfig } = useGlobalStore(
    useShallow((state) => ({
      config: state.config,
      setConfig: state.setConfig,
    }))
  );

  // ── Local draft — pending edits before Save ─────────────────────────
  // Reset to the store value every time the overlay opens.
  const [draft, setDraft] = useState(config);
  useEffect(() => {
    if (isOpen) setDraft(config);
  }, [isOpen, config]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(config);

  /** Generic update helper — supports root keys and one level of nesting */
  const updateSetting = (key: string, value: unknown, category?: string) => {
    if (category) {
      setDraft(prev => ({
        ...prev,
        [category]: {
          ...(prev[category as keyof typeof prev] as object),
          [key]: value,
        },
      }));
    } else {
      setDraft(prev => ({ ...prev, [key]: value }));
    }
  };

  const { getFileFromDocument } = useSettingsFile();

  const saveConfig = async () => {
    const errorLoggingChanged = draft.privacy?.enableErrorLogging !== config.privacy?.enableErrorLogging;

    // Persist to disk via helper
    await saveSettings(getFileFromDocument, draft);

    // Apply theme change immediately
    if (draft.appearance.theme !== theme) {
      setTheme(draft.appearance.theme as 'light' | 'dark' | 'system');
    }

    // Apply language change immediately
    if (draft.appearance.language !== config.appearance.language) {
      i18n.changeLanguage(draft.appearance.language);
    }

    // Apply error logging setting
    if (errorLoggingChanged) {
      logger.setErrorLoggingEnabled(draft.privacy?.enableErrorLogging !== false);
    }

    // Push to Zustand store
    setConfig(draft);
  };

  // Alias for readability in JSX
  const settings = draft;

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" style={{ paddingTop: DIMENSIONS.overlayTopOffset }}>
      <div className="settings-overlay-backdrop" onClick={onClose}></div>
      <div className="settings-overlay-content" style={{ width: DIMENSIONS.panelWidth, height: DIMENSIONS.panelHeight }}>
        <div className="settings-overlay-header">
          <h2 className="text-lg font-semibold">{t('SETTINGS.title')}</h2>
          <div className="settings-header-actions">
            <FeedbackButton
              onSave={saveConfig}
              disabled={!hasChanges}
              duration={1000}
              label={t('FEEDBACK.save') as string}
              successText={t('FEEDBACK.saved') as string}
              failedText={t('FEEDBACK.error') as string}
              variant="primary"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="close-button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="settings-overlay-body">
          <div className="settings-sidebar">
            <div className="settings-sidebar-title">{t('SETTINGS.title')}</div>
            <div className="settings-sidebar-list">
              <button
                className={`settings-sidebar-item ${activeTab === 'appearance' ? 'active' : ''}`}
                onClick={() => setActiveTab('appearance')}
              >
                <Palette className="w-4 h-4 inline-block mr-2" />
                {t('SETTINGS.appearanceTab')}
              </button>
              <button
                className={`settings-sidebar-item ${activeTab === 'editor' ? 'active' : ''}`}
                onClick={() => setActiveTab('editor')}
              >
                <Type className="w-4 h-4 inline-block mr-2" />
                {t('SETTINGS.editorTab')}
              </button>
              <button
                className={`settings-sidebar-item ${activeTab === 'privacy' ? 'active' : ''}`}
                onClick={() => setActiveTab('privacy')}
              >
                <Shield className="w-4 h-4 inline-block mr-2" />
                {t('SETTINGS.privacyTab')}
              </button>
            </div>
          </div>

          <div className="settings-main">
            {activeTab === 'appearance' && (
              <AppearanceTab settings={settings} updateSetting={updateSetting} />
            )}

            {activeTab === 'editor' && (
              <EditorTab settings={settings} updateSetting={updateSetting} />
            )}

            {activeTab === 'privacy' && (
              <PrivacyTab settings={settings} updateSetting={updateSetting} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}