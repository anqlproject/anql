import { useTranslation } from 'react-i18next';

import { SettingsItem, SettingsSelect, SettingsTab } from '../SettingsComponents/index';
import ThemePreferenceTabs from '../SettingsComponents/ThemePreferenceTabs';

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
        <ThemePreferenceTabs
          value={settings.appearance.theme}
          onChange={(theme) => updateSetting('theme', theme, 'appearance')}
        />
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.appearance.language') as string}
        description={t('SETTINGS.appearance.languageDescription') as string}
      >
        <SettingsSelect
          value={settings.appearance.language}
          onChange={(value) => updateSetting('language', value, 'appearance')}
          ariaLabel={t('SETTINGS.appearance.language') as string}
          options={[
            { value: 'en', label: 'SETTINGS.appearance.english' },
            { value: 'fr', label: 'SETTINGS.appearance.french' },
          ]}
        />
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.appearance.sidebarVariant') as string}
        description={t('SETTINGS.appearance.sidebarVariantDescription') as string}
      >
        <SettingsSelect
          value={settings.sidebar.variant}
          onChange={(value) => updateSetting('variant', value as 'floating' | 'inset', 'sidebar')}
          ariaLabel={t('SETTINGS.appearance.sidebarVariant') as string}
          options={[
            { value: 'inset', label: 'SETTINGS.appearance.inset' },
            { value: 'floating', label: 'SETTINGS.appearance.floating' },
          ]}
        />
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
