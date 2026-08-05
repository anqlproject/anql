import './SettingsSeparator.css';

interface SettingsSeparatorProps {
  label?: string;
}

export function SettingsSeparator({ label }: SettingsSeparatorProps) {
  return (
    <div className="settings-separator">
      {label && <span className="settings-separator-label">{label}</span>}
      <div className="settings-separator-line" />
    </div>
  );
}
