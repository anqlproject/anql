import './SettingsItem.css';

import React from 'react';

interface SettingsItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsItem({ label, description, children }: SettingsItemProps) {
  return (
    <div className="settings-field">
      <div className="settings-field-info">
        <label className="settings-field-label">{label}</label>
        {description && <p className="settings-field-description">{description}</p>}
      </div>
      <div className="settings-field-action">
        {children}
      </div>
    </div>
  );
}
