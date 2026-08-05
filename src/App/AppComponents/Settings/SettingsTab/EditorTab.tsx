import { useTranslation } from 'react-i18next';

import { CODE_THEMES } from '@/editor/plugins/CodeHighlightShikiPlugin';

import { SettingsItem, SettingsSeparator, SettingsTab } from '../SettingsComponents/index';

interface EditorTabProps {
  settings: any;
  updateSetting: (key: string, value: unknown, category?: string) => void;
}

export default function EditorTab({ settings, updateSetting }: EditorTabProps) {
  const { t } = useTranslation();

  return (
    <SettingsTab title={t('SETTINGS.editorTab')}>
      <SettingsSeparator label={t('SETTINGS.editor.code') as string} />
      <SettingsItem
        label={t('SETTINGS.editor.codeThemeDark') as string}
        description="Default theme for code blocks in dark mode"
      >
        <select
          value={settings.editor.codeThemeDark}
          onChange={(e) => updateSetting('codeThemeDark', e.target.value, 'editor')}
          className="settings-input"
          style={{ maxWidth: '200px' }}
        >
          {CODE_THEMES.map(theme => (
            <option key={theme} value={theme}>{theme}</option>
          ))}
        </select>
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.editor.codeThemeLight') as string}
        description="Default theme for code blocks in light mode"
      >
        <select
          value={settings.editor.codeThemeLight}
          onChange={(e) => updateSetting('codeThemeLight', e.target.value, 'editor')}
          className="settings-input"
          style={{ maxWidth: '200px' }}
        >
          {CODE_THEMES.map(theme => (
            <option key={theme} value={theme}>{theme}</option>
          ))}
        </select>
      </SettingsItem>

      <SettingsSeparator label={t('SETTINGS.editor.markdown') as string} />
      <SettingsItem
        label={t('SETTINGS.editor.useBrackets') as string}
        description={t('SETTINGS.editor.useBracketsDescription') as string}
      >
        <input
          type="checkbox"
          checked={settings.editor.useBrackets}
          onChange={(e) => updateSetting('useBrackets', e.target.checked, 'editor')}
          className="settings-checkbox"
        />
      </SettingsItem>

      <SettingsSeparator label={t('SETTINGS.editor.textEditor') as string} />
      <SettingsItem
        label={t('SETTINGS.editor.spellCheck') as string}
        description={t('SETTINGS.editor.spellCheckDescription') as string}
      >
        <input
          type="checkbox"
          checked={settings.editor.spellCheck}
          onChange={(e) => updateSetting('spellCheck', e.target.checked, 'editor')}
          className="settings-checkbox"
        />
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.editor.autoCorrect') as string}
        description={t('SETTINGS.editor.autoCorrectDescription') as string}
      >
        <input
          type="checkbox"
          checked={settings.editor.autoCorrect}
          onChange={(e) => updateSetting('autoCorrect', e.target.checked, 'editor')}
          className="settings-checkbox"
        />
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.editor.autoCapitalize') as string}
        description={t('SETTINGS.editor.autoCapitalizeDescription') as string}
      >
        <input
          type="checkbox"
          checked={settings.editor.autoCapitalize}
          onChange={(e) => updateSetting('autoCapitalize', e.target.checked, 'editor')}
          className="settings-checkbox"
        />
      </SettingsItem>
      <SettingsItem
        label={t('SETTINGS.editor.autoComplete') as string}
        description={t('SETTINGS.editor.autoCompleteDescription') as string}
      >
        <input
          type="checkbox"
          checked={settings.editor.autoComplete}
          onChange={(e) => updateSetting('autoComplete', e.target.checked, 'editor')}
          className="settings-checkbox"
        />
      </SettingsItem>
    </SettingsTab>
  );
}
