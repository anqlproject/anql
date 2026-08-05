import './HelpPanel.css';

import helpDocs from 'docs/Help/helpDocs.json';
import { Box, FileText, Home, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DIMENSIONS } from '@/core/global/defaultValues';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  const [activeTab, setActiveTab] = useState('home');

  if (!isOpen) return null;

  const currentTab = helpDocs.tabs.find(tab => tab.id === activeTab);

  return (
    <div className="help-overlay" style={{ paddingTop: DIMENSIONS.overlayTopOffset }}>
      <div className="help-overlay-backdrop" onClick={onClose}></div>
      <div className="help-overlay-content" style={{ width: DIMENSIONS.panelWidth, height: DIMENSIONS.panelHeight }}>
        <div className="help-overlay-header">
          <h2 className="text-lg font-semibold">Documentation d'aide</h2>
          <div className="help-header-actions">
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

        <div className="help-overlay-body">
          <div className="help-sidebar">
            <div className="help-sidebar-title">Aide</div>
            <div className="help-sidebar-list">
              {helpDocs.tabs.map((tab) => {
                const Icon = tab.id === 'home' ? Home : tab.id === 'create-document' ? FileText : Box;
                return (
                  <button
                    key={tab.id}
                    className={`help-sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="w-4 h-4 inline-block mr-2" />
                    {tab.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="help-main">
            {currentTab && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ marginTop: 0 }}>{currentTab.title}</h2>
                {currentTab.content.map((item) => (
                  <div key={item.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '8px', fontWeight: 'bold' }}>{item.title}</h3>
                    {Array.isArray(item.description) ? (
                      item.description.map((paragraph, index) => (
                        <p key={index} style={{ margin: index === item.description.length - 1 ? '0 0 12px 0' : '0 0 8px 0' }}>
                          {paragraph}
                        </p>
                      ))
                    ) : (
                      <p style={{ margin: '0 0 12px 0' }}>{item.description}</p>
                    )}
                    {Array.isArray(item.image) ? (
                      item.image.map((img, index) => (
                        <img key={index} src={img} alt={item.title} style={{ maxWidth: '100%', borderRadius: '6px', marginTop: index === 0 ? '12px' : '8px' }} />
                      ))
                    ) : item.image && item.image !== "" && (
                      <img src={item.image} alt={item.title} style={{ maxWidth: '100%', borderRadius: '6px', marginTop: '12px' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
