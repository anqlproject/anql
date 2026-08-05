import './SettingsTab.css';

import React from 'react';

interface SettingsTabProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsTab({ title, children }: SettingsTabProps) {
  return (
    <div>
      <h3 className="settings-section-title">{title}</h3>
      <div className="settings-tab-content">
        {children}
      </div>
    </div>
  );
}
