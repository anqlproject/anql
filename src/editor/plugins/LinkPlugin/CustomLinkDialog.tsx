import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { extractLinkTypeFromUrl } from '@/App/utils/url';
import { ComponentDialog } from '@/components/custom/ComponentDialog/ComponentDialog';

interface CustomLinkDialogProps {
  onClose: () => void;
  leftButton?: {
    text: string;
    onClick: () => void;
  };
  rightButton?: {
    text: string;
    onClick: (url: string, name: string) => void;
  };
  initialUrl?: string;
  initialName?: string;
}

export function CustomLinkDialog({
  onClose,
  leftButton,
  rightButton,
  initialUrl = '',
  initialName = ''
}: CustomLinkDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [url, setUrl] = useState(initialUrl);
  const [name, setName] = useState(initialName);

  const linkType = extractLinkTypeFromUrl(url);

  const handleConfirm = () => {
    if (url.trim() && rightButton) {
      rightButton.onClick(url, name);
    }
    onClose();
  };

  const getTitle = () => {
    switch (linkType) {
      case 'external':
        return 'Insert External Link';
      case 'document':
        return 'Insert Document Link';
      case 'node':
        return 'Insert Node Link';
      case 'row':
        return 'Insert Row Link';
      default:
        return 'Insert Link';
    }
  };

  return (
    <ComponentDialog
      title={getTitle()}
      onClose={onClose}
      leftButton={leftButton}
      rightButton={{
        text: rightButton?.text || 'Insert',
        onClick: handleConfirm,
        disabled: !url.trim()
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <label
          htmlFor="link-url"
          style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}
        >
          URL / ID:
        </label>
        <textarea
          id="link-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleConfirm();
            } else if (e.key === 'Escape') {
              onClose();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
              e.preventDefault();
              e.currentTarget.select();
            }
          }}
          placeholder={t('INLINES.linkUrlPlaceholder') as string}
          rows={1}
          style={{
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            resize: 'none',
            overflowX: 'auto',
            overflowY: 'hidden',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="no-scrollbar"
          autoFocus
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="link-name"
          style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}
        >
          Link Name:
        </label>
        <textarea
          id="link-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleConfirm();
            } else if (e.key === 'Escape') {
              onClose();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
              e.preventDefault();
              e.currentTarget.select();
            }
          }}
          placeholder={t('INLINES.linkNamePlaceholder') as string}
          rows={1}
          style={{
            width: '100%',
            padding: '10px',
            boxSizing: 'border-box',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
            resize: 'none',
            overflowX: 'auto',
            overflowY: 'hidden',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="no-scrollbar"
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
      </div>
    </ComponentDialog>
  );
}
