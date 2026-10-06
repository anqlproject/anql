import './cardItem.css';

import { Calendar, Check, Clock, MoreVertical, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { duplicateDocument } from '@/App/AppComponents/duplicateDocument';
import { useExportDocument } from '@/App/AppComponents/ImportExport/exportDocument';
import { useFile } from '@/App/hooks/FileHooks';
import { useGlobalToast } from '@/App/hooks/useGlobalToast';
import { Button } from '@/components/ui/button';
import { getNodesByDocumentId } from '@/core/database/useBlocDatabase';
import { DocumentMetadataKey, DocumentsJson, getDocumentMetadataField, updateDocumentPath } from '@/core/database/useDocumentDatabase';
import { TOAST_DURATION } from '@/core/global/defaultValues';
import { MoveToTrash } from '@/core/TrashSystem/TrashSystem';

type ViewMode = 'grid' | 'list';

interface DocumentItemProps {
  document: DocumentsJson;
  formatDate: (timestamp: number) => string;
  viewMode: ViewMode;
  isSelected?: boolean;
  onToggleSelection?: (documentId: string) => void;
  sortBy?: { field: 'title' | 'created_at' | 'updated_at'; direction: 'asc' | 'desc' };
}

export default function DocumentItem({ document, formatDate, viewMode, isSelected = false, onToggleSelection, sortBy }: DocumentItemProps) {
  const { t } = useTranslation();
  const { openEditorWithUpdate } = useFile();
  const { showToast, dismissToast } = useGlobalToast();
  const { exportDocument } = useExportDocument();
  const documentRef = useRef<DocumentsJson>(null);
  const isNativeMenuOpening = useRef(false);
  const [readMode, setReadMode] = useState(false);
  documentRef.current = document;

  useEffect(() => {
    const loadReadMode = async () => {
      try {
        const isReadMode = await getDocumentMetadataField(document.id, DocumentMetadataKey.readMode);
        setReadMode(isReadMode === true);
      } catch (error) {
        console.error('Failed to load read mode:', error);
      }
    };
    loadReadMode();
  }, [document.id]);

  const handleDelete = () => {
    if (document.id !== "home-page") {
      const docToDelete = documentRef.current;
      const originalPath = docToDelete?.path;

      MoveToTrash(document);

      // Use a ref-like object so the button closure can read the toast id
      // even though it's created before showToast returns the id.
      const toastIdRef = { current: '' };

      const undoContent = (
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{t('FEEDBACK.movedToTrash')}</span>
          <button
            onClick={() => {
              dismissToast(toastIdRef.current);
              if (docToDelete && originalPath) {
                updateDocumentPath(docToDelete.id, originalPath);
                showToast(t('FEEDBACK.restored'), 'info', TOAST_DURATION);
              }
            }}
            style={{
              background: 'transparent',
              border: '1px solid currentColor',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: 'inherit',
              opacity: 0.9,
              whiteSpace: 'nowrap',
            }}
          >
            {t('FEEDBACK.undo')}
          </button>
        </span>
      );

      toastIdRef.current = showToast(undoContent, 'success', TOAST_DURATION);
    }
  };

  const handleCopyId = () => {
    const documentId = documentRef.current?.id;
    if (documentId) {
      navigator.clipboard.writeText(`@document:${documentId}`).then(() => {
        console.log('Document ID copied to clipboard');
      }).catch((err) => {
        console.error('Failed to copy document ID:', err);
      });
    }
  };

  const handleExport = async () => {
    // Get document content from database
    const { getDocumentById } = await import('@/core/database/useDocumentDatabase');
    const doc = await getDocumentById(document.id);
    if (doc) {
      const jsonString = JSON.stringify(doc, null, 2);
      exportDocument(jsonString, document.title);
    }
  };

  const handleDuplicate = async () => {
    try {
      const nodes = await getNodesByDocumentId(document.id);
      await duplicateDocument(
        document,
        nodes,
        `${document.title || t('HOME_PAGE.untitled') || 'Untitled'} (copy)`,
      );
    } catch (error) {
      console.error('Failed to duplicate document:', error);
    }
  };

  const handleMenuOpen = async (
    e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>,
    openAtPointer = false,
  ) => {
    e.stopPropagation();
    if (isNativeMenuOpening.current) return;

    isNativeMenuOpening.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const position = openAtPointer
      ? { x: e.clientX, y: e.clientY }
      : { x: rect.left, y: rect.bottom };

    try {
      const [{ Menu }, { LogicalPosition }] = await Promise.all([
        import("@tauri-apps/api/menu"),
        import("@tauri-apps/api/dpi"),
      ]);

      const menuItems = [
        {
          text: t("DOCUMENT_MENU.copyDocumentId") as string,
          action: handleCopyId,
        },
        {
          text: t("DOCUMENT_MENU.exportDocument") as string,
          action: handleExport,
        },
        {
          text: t("DOCUMENT_MENU.duplicateDocument") as string,
          action: handleDuplicate,
        },
        {
          text: t("DOCUMENT_MENU.deleteDocument") as string,
          action: handleDelete,
        },
      ];

      const nativeMenu = await Menu.new({ items: menuItems });
      await nativeMenu.popup(new LogicalPosition(position.x, position.y));
    } catch (error) {
      console.error("Failed to show native document card menu", error);
    } finally {
      isNativeMenuOpening.current = false;
    }
  };


  const handleOpen = () => {
    openEditorWithUpdate(document);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(document.id);
    }
  };

  // Determine which date to display based on sort
  const shouldShowCreatedDate = sortBy?.field === 'created_at';
  const displayDate = shouldShowCreatedDate ? document.created_at : document.updated_at;
  const isModifiedDate = !shouldShowCreatedDate;

  return (
    <div
      className={`document-card document-card--${viewMode} ${isSelected ? 'selected' : ''}`}
      onClick={handleOpen}
      onContextMenu={(event) => {
        event.preventDefault();
        void handleMenuOpen(event, true);
      }}
    >

      <button
        type="button"
        className="document-card__checkbox"
        onClick={handleCheckboxClick}
        onMouseDown={(event) => event.stopPropagation()}
        aria-label={String(document.title || t('HOME_PAGE.untitled'))}
        aria-pressed={isSelected}
        tabIndex={0}
        title={String(document.title || t('HOME_PAGE.untitled'))}
      >
        {isSelected ? <Check className="checkbox-icon" /> : <Square className="checkbox-icon" />}
      </button>

      <div className="document-card__main">
        <span
          className="document-card__title"
          title={document.title || t('HOME_PAGE.untitled') || undefined}
        >
          {document.title || t('HOME_PAGE.untitled')}
        </span>
        {readMode && <span className="document-card__read-mode-badge" title="Read mode" />}
      </div>

      <div className="document-card__details">
        <div className="document-card__meta">
          {isModifiedDate ? (
            <Clock size={12} className="document-card__meta-icon" />
          ) : (
            <Calendar size={12} className="document-card__meta-icon" />
          )}
          <span
            className="document-card__date"
            title={isModifiedDate
              ? `${t('HOME_PAGE.updatedAt') || 'Updated at'}: ${new Date(document.updated_at).toLocaleString()}`
              : `${t('HOME_PAGE.createdAt') || 'Created at'}: ${new Date(document.created_at).toLocaleString()}`
            }
          >
            {formatDate(displayDate)}
          </span>
        </div>
      </div>

      <div className="document-card__actions">
        <Button
          variant="ghost"
          size="sm"
          className="document-card__menu-button"
          onClick={handleMenuOpen}
        >
          <MoreVertical className="document-card__menu-icon" />
        </Button>
      </div>

    </div>
  );
}
