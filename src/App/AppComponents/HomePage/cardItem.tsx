import './cardItem.css';

import { Calendar, Check, Clock, Copy, Download, MoreVertical, Square, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useExportDocument } from "@/App/AppComponents/ImportExport/exportDocument";
import { useFile } from '@/App/hooks/FileHooks';
import { useGlobalToast } from '@/App/hooks/useGlobalToast';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DocumentsJson, updateDocumentPath } from '@/core/database/useDocumentDatabase';
import { TOAST_DURATION } from '@/core/global/defaultValues';
import { MoveToTrash } from '@/core/TrashSystem/TrashSystem';

type ViewMode = 'grid' | 'list';

interface DocumentItemProps {
  document: DocumentsJson;
  formatDate: (timestamp: number) => string;
  viewMode: ViewMode;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (documentId: string) => void;
  sortBy?: { field: 'title' | 'created_at' | 'updated_at'; direction: 'asc' | 'desc' };
}

export default function DocumentItem({ document, formatDate, viewMode, selectionMode = false, isSelected = false, onToggleSelection, sortBy }: DocumentItemProps) {
  const { t } = useTranslation();
  const { openEditorWithUpdate } = useFile();
  const { showToast, dismissToast } = useGlobalToast();
  const { exportDocument } = useExportDocument();
  const [menuOpen, setMenuOpen] = useState(false);
  const documentRef = useRef<DocumentsJson>(null);
  documentRef.current = document;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.id !== "home-page") {
      const docToDelete = documentRef.current;
      const originalPath = docToDelete?.path;

      MoveToTrash(document);
      setMenuOpen(false);

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

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    const documentId = documentRef.current?.id;
    if (documentId) {
      navigator.clipboard.writeText(`@document:${documentId}`).then(() => {
        console.log('Document ID copied to clipboard');
      }).catch((err) => {
        console.error('Failed to copy document ID:', err);
      });
    }
    setMenuOpen(false);
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    // Get document content from database
    const { getDocumentById } = await import('@/core/database/useDocumentDatabase');
    const doc = await getDocumentById(document.id);
    if (doc) {
      const jsonString = JSON.stringify(doc, null, 2);
      exportDocument(jsonString, document.title);
    }
  };


  const handleOpen = () => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(document.id);
    } else {
      openEditorWithUpdate(document);
    }
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
    <div className={`document-card document-card--${viewMode} ${isSelected ? 'selected' : ''} ${selectionMode ? 'selection-mode' : ''} ${menuOpen ? 'menu-open' : ''}`} onClick={handleOpen}>

      {selectionMode && (
        <div className="document-card__checkbox" onClick={handleCheckboxClick}>
          {isSelected ? <Check className="checkbox-icon" /> : <Square className="checkbox-icon" />}
        </div>
      )}

      <div className="document-card__main">
        <span className="document-card__title">{document.title || t('HOME_PAGE.untitled')}</span>
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
              ? `Modifié: ${new Date(document.updated_at).toLocaleString()}` 
              : `Créé: ${new Date(document.created_at).toLocaleString()}`
            }
          >
            {formatDate(displayDate)}
          </span>
        </div>
      </div>

      <div className="document-card__actions">
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="document-card__menu-button" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="document-card__menu-icon" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="document-dropdown" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onClick={handleCopyId} className="dropdown-menu-item">
              <Copy size={16} style={{ marginRight: '8px' }} />
              {t('DOCUMENT_MENU.copyDocumentId')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport} className="dropdown-menu-item">
              <Download size={16} style={{ marginRight: '8px' }} />
              {t('DOCUMENT_MENU.export')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="delete-menu-item">
              <Trash2 size={16} style={{ marginRight: '8px' }} />
              {t('HOME_PAGE.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}
