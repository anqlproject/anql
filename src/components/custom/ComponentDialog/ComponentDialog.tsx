import './ComponentDialog.css';

import { XIcon } from 'lucide-react';
import type { JSX, ReactNode } from 'react';
import { createPortal } from 'react-dom';


interface ComponentDialogProps {
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  leftButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
    tag?: string;
  };
  rightButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
  };
  headerButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
  };
  containerStyle?: React.CSSProperties;
}

export function ComponentDialog({
  title,
  children,
  onClose,
  leftButton,
  rightButton,
  headerButton,
  containerStyle
}: ComponentDialogProps): JSX.Element {
  return createPortal(
    <div className="component-dialog-overlay" onMouseDown={onClose}>
      <div className="component-dialog-container" style={containerStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div className="component-dialog-header">
          <h2 className="component-dialog-title">{title}</h2>
          <div className="component-dialog-header-actions">
            {headerButton && (
              <button
                className="component-dialog-button confirm component-dialog-header-button"
                onClick={headerButton.onClick}
                disabled={headerButton.disabled}
              >
                {headerButton.text}
              </button>
            )}
            <button className="component-dialog-close" onClick={onClose} aria-label="Close">
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <div className="component-dialog-content">
          {children}
        </div>

        <div className="component-dialog-actions">
          {leftButton && (
            <button
              className={`component-dialog-button cancel ${leftButton.tag || ''}`}
              onClick={leftButton.onClick}
              disabled={leftButton.disabled}
            >
              {leftButton.text}
            </button>
          )}
          {rightButton && (
            <button
              className="component-dialog-button confirm"
              onClick={rightButton.onClick}
              disabled={rightButton.disabled}
            >
              {rightButton.text}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
