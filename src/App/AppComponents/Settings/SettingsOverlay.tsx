import './SettingsOverlay.css';

import { Palette, Shield, Type, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { saveSettings } from '@/App/settings';
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { Button } from '@/components/ui/button';
import { DIMENSIONS } from '@/core/global/defaultValues';
import { logger } from '@/core/logger';
import { useThemeStore } from '@/GlobalState/themeStore';

import AppearanceTab from './SettingsTab/AppearanceTab';
import EditorTab from './SettingsTab/EditorTab';
import PrivacyTab from './SettingsTab/PrivacyTab';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsOverlay({ isOpen, onClose }: SettingsOverlayProps) {
  const { t, i18n } = useTranslation();
  const { theme: storeTheme, setTheme: setStoreTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState('appearance');

  // ── Zustand config store — source of truth ──────────────────────────
  const { config, setConfig } = useGlobalStore(
    useShallow((state) => ({
      config: state.config,
      setConfig: state.setConfig,
    }))
  );

  const { getFileFromDocument } = useSettingsFile();

  const saveConfig = async (newConfig: any) => {
    const errorLoggingChanged = newConfig.privacy?.enableErrorLogging !== config.privacy?.enableErrorLogging;

    // Persist to disk via helper
    await saveSettings(getFileFromDocument, newConfig);

    // Apply theme change immediately
    if (newConfig.appearance.theme !== theme) {
      setTheme(newConfig.appearance.theme as 'light' | 'dark' | 'system');
    }

    // Apply language change immediately
    if (newConfig.appearance.language !== config.appearance.language) {
      i18n.changeLanguage(newConfig.appearance.language);
    }

    // Apply error logging setting
    if (errorLoggingChanged) {
      logger.setErrorLoggingEnabled(newConfig.privacy?.enableErrorLogging !== false);
    }

    // Push to Zustand store
    setConfig(newConfig);
  };

  /** Generic update helper — supports root keys and one level of nesting */
  const updateSetting = (key: string, value: unknown, category?: string) => {
    let newConfig: any;
    if (category) {
      newConfig = {
        ...config,
        [category]: {
          ...(config[category as keyof typeof config] as object),
          [key]: value,
        },
      };
    } else {
      newConfig = { ...config, [key]: value };
    }

    // Fire and forget
    saveConfig(newConfig).catch((err) => {
      logger.error("Failed to save config immediately", err);
    });
  };

  // Alias for readability in JSX
  const settings = config;

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" style={{ paddingTop: DIMENSIONS.overlayTopOffset }}>
      <div className="settings-overlay-backdrop" onClick={onClose}></div>
      <div className="settings-overlay-content" style={{ width: DIMENSIONS.panelWidth, height: DIMENSIONS.panelHeight }}>
        <div className="settings-overlay-header">
          <h2 className="text-lg font-semibold">{t('SETTINGS.title')}</h2>
          <div className="settings-header-actions">
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