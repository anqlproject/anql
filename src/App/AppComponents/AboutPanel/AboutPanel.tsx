import './AboutPanel.css';

import aboutInfo from 'docs/About/aboutInfo.json';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DIMENSIONS } from '@/core/global/defaultValues';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="help-overlay" style={{ paddingTop: DIMENSIONS.overlayTopOffset }}>
      <div className="help-overlay-backdrop" onClick={onClose}></div>
      <div className="help-overlay-content" style={{ width: DIMENSIONS.panelWidth_medium, height: DIMENSIONS.panelHeight_medium }}>
        <div className="help-overlay-header">
          <h2 className="text-lg font-semibold">About</h2>
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

        <div className="help-main">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <img 
                  src="/app-icon.png" 
                  alt="ANQL Logo" 
                  style={{ 
                    width: '64px', 
                    height: '64px',
                    borderRadius: '12px'
                  }} 
                />
                <h1 style={{ 
                  marginTop: 0, 
                  marginBottom: '8px', 
                  fontSize: '24px', 
                  fontWeight: '700',
                  fontStyle: 'mono',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  {aboutInfo.title}
                </h1>
              </div>
              <p style={{ 
                fontSize: '16px', 
                color: 'var(--text-secondary, #666)',
                margin: 0 
              }}>
                {aboutInfo.subtitle}
              </p>
            </div>
            
            <div style={{ 
              padding: '24px', 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{ 
                display: 'inline-block', 
                padding: '8px 16px', 
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                borderRadius: '20px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '16px'
              }}>
                Version {aboutInfo.version}
              </div>
              
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
                Features
              </h3>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                gap: '12px' 
              }}>
                {aboutInfo.features.map((feature, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '12px',
                    background: 'var(--surface-color, #f5f5f5)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}>
                    <span style={{ 
                      width: '8px', 
                      height: '8px', 
                      background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                      borderRadius: '50%',
                      flexShrink: 0
                    }}></span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
