import './DocumentInfoPanel.css';

import { CalendarDays, Clock3, FileText, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DocumentsJson } from '@/core/database/useDocumentDatabase';
import { DATABASE_PATH } from '@/core/global/defaultSettings';

interface DocumentInfoPanelProps {
  panelRef: React.Ref<HTMLDivElement>;
  document: DocumentsJson;
  wordCount: number;
}

function formatDate(timestamp: number, locale: string): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export default function DocumentInfoPanel({
  panelRef,
  document,
  wordCount,
}: DocumentInfoPanelProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.resolvedLanguage || i18n.language;
  const location = document.path === DATABASE_PATH.HOME_PATH
    ? t('DOCUMENT_INFO.home')
    : document.path === DATABASE_PATH.TRASH_PATH
      ? t('DOCUMENT_INFO.trash')
      : document.path.replace(/\/+$/, '') || t('DOCUMENT_INFO.unknown');

  const rows = [
    {
      label: t('DOCUMENT_INFO.location'),
      value: location,
      icon: <FolderOpen size={14} />,
    },
    {
      label: t('DOCUMENT_INFO.words'),
      value: t('DOCUMENT_INFO.wordCount', { count: wordCount }),
      icon: <FileText size={14} />,
    },
    {
      label: t('DOCUMENT_INFO.created'),
      value: formatDate(document.created_at, dateLocale) || t('DOCUMENT_INFO.notAvailable'),
      icon: <CalendarDays size={14} />,
    },
    {
      label: t('DOCUMENT_INFO.modified'),
      value: formatDate(document.updated_at, dateLocale) || t('DOCUMENT_INFO.notAvailable'),
      icon: <Clock3 size={14} />,
    },
  ];

  return (
    <section
      ref={panelRef}
      className="document-info-panel"
      role="dialog"
      aria-label={t('DOCUMENT_INFO.title') as string}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="document-info-panel__name">
        {document.title.trim() || t('DOCUMENT_INFO.untitled')}
      </div>
      <dl className="document-info-panel__details">
        {rows.map((row) => (
          <div className="document-info-panel__row" key={String(row.label)}>
            <dt>
              {row.icon}
              <span>{row.label}</span>
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
