import './HelpPanel.css';

import helpDocs from 'docs/Help/helpDocs.json';
import { Box, FileText, Home, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DIMENSIONS } from '@/core/global/defaultValues';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('home');

  if (!isOpen) return null;

  const currentTab = helpDocs.tabs.find(tab => tab.id === activeTab);

  return (
    <div className="help-overlay" style={{ paddingTop: DIMENSIONS.overlayTopOffset }}>
      <div className="help-overlay-backdrop" onClick={onClose}></div>
      <div className="help-overlay-content" style={{ width: DIMENSIONS.panelWidth, height: DIMENSIONS.panelHeight }}>
        <div className="help-overlay-header">
          <h2 className="text-lg font-semibold">{t('HELP_PANEL.title')}</h2>
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
            <div className="help-sidebar-title">{t('HELP_PANEL.sidebarTitle')}</div>
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
              <div className="help-content">
                {/* Page header */}
                <div className="help-page-header">
                  <h2 className="help-page-title">{currentTab.title}</h2>
                </div>

                {/* Content items */}
                {currentTab.content.map((item, itemIndex) => {
                  const hasImage = 'image' in item && item.image && (
                    Array.isArray(item.image) ? item.image.length > 0 : item.image !== ''
                  );
                  const hasMultipleImages = 'image' in item && Array.isArray(item.image) && item.image.length > 1;
                  const isWelcome = item.id === 'welcome';
                  
                  // For welcome item and autocomplete item, we want it full width (not side by side)
                  const useSideLayout = hasImage && !hasMultipleImages && !isWelcome && item.id !== 'autocomplete';
                  const descriptions = Array.isArray(item.description) ? item.description : [item.description];

                  return (
                    <div
                      key={item.id}
                      className={`help-content-item ${useSideLayout ? 'help-content-item--with-image' : ''} ${itemIndex === 0 ? 'help-content-item--first' : ''}`}
                    >
                      {/* Section index badge + title */}
                      <div className="help-item-header">
                        <span className="help-item-index">{String(itemIndex + 1).padStart(2, '0')}</span>
                        <h3 className="help-item-title">{item.title}</h3>
                      </div>

                      {/* Body: text column + image column (or stacked) */}
                      <div className={`help-item-body ${useSideLayout ? 'help-item-body--side' : ''}`}>

                        {/* Text */}
                        <div className="help-item-text">
                          {descriptions.map((paragraph, pIndex) =>
                            paragraph === '' ? (
                              <div key={pIndex} className="help-item-spacer" />
                            ) : paragraph.startsWith('-') || paragraph.startsWith('•') ? (
                              <div key={pIndex} className="help-item-bullet">
                                <span className="help-item-bullet-dot">›</span>
                                <span>{paragraph.replace(/^[-•]\s*/, '')}</span>
                              </div>
                            ) : (
                              <p key={pIndex} className="help-item-paragraph">{paragraph}</p>
                            )
                          )}
                        </div>

                        {/* Single image (side-by-side) */}
                        {hasImage && !hasMultipleImages && (
                          <div className="help-item-image-wrap">
                            <div className="help-item-image-scene">
                              <img
                                src={Array.isArray(item.image) ? item.image[0] : item.image as string}
                                alt={item.title}
                                className="help-item-image"
                              />
                            </div>
                            <span className="help-item-image-caption">{item.title}</span>
                          </div>
                        )}
                      </div>

                      {/* Multiple images — horizontal scroll strip */}
                      {hasMultipleImages && (
                        <div className="help-item-gallery-wrap">
                          <div className="help-item-gallery">
                            {(item.image as string[]).map((img, idx) => (
                              <div key={idx} className="help-item-gallery-thumb">
                                <img src={img} alt={`${item.title} ${idx + 1}`} className="help-item-image" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

