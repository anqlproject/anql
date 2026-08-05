import { useTranslation } from 'react-i18next';

import { SettingsItem, SettingsTab } from '../SettingsComponents/index';

interface AppearanceTabProps {
  settings: any;
  updateSetting: (key: string, value: unknown, category?: string) => void;
}

export default function AppearanceTab({ settings, updateSetting }: AppearanceTabProps) {
  const { t } = useTranslation();

  return (
    <SettingsTab title={t('SETTINGS.appearanceTab')}>
      <SettingsItem
        label={t('SETTINGS.appearance.theme') as string}
        description={t('SETTINGS.appearance.themeDescription') as string}
      >
        <select
          className="settings-input"
          value={settings.appearance.theme}
          onChange={(e) => updateSetting('theme', e.target.value, 'appearance')}
          style={{ maxWidth: '200px' }}
        >
          <option value="system">{t('SETTINGS.appearance.system')}</option>
          <option value="light">{t('SETTINGS.appearance.light')}</option>
          <option value="dark">{t('SETTINGS.appearance.dark')}</option>
        </select>
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.appearance.language') as string}
        description={t('SETTINGS.appearance.languageDescription') as string}
      >
        <select
          className="settings-input"
          value={settings.appearance.language}
          onChange={(e) => updateSetting('language', e.target.value, 'appearance')}
          style={{ maxWidth: '200px' }}
        >
          <option value="en">{t('SETTINGS.appearance.english')}</option>
          <option value="fr">{t('SETTINGS.appearance.french')}</option>
        </select>
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.appearance.sidebarVariant') as string}
        description={t('SETTINGS.appearance.sidebarVariantDescription') as string}
      >
        <select
          className="settings-input"
          value={settings.sidebar.variant}
          onChange={(e) => updateSetting('variant', e.target.value as 'floating' | 'inset', 'sidebar')}
          style={{ maxWidth: '200px' }}
        >
          <option value="inset">{t('SETTINGS.appearance.inset')}</option>
          <option value="floating">{t('SETTINGS.appearance.floating')}</option>
        </select>
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.appearance.collapsibleSidebar') as string}
        description={t('SETTINGS.appearance.collapsibleSidebarDescription') as string}
      >
        <input
          type="checkbox"
          checked={settings.sidebar.collapsible}
          onChange={(e) => updateSetting('collapsible', e.target.checked, 'sidebar')}
          className="settings-checkbox"
        />
      </SettingsItem>
    </SettingsTab>
  );
}
