import './HomePage.css';

import { CheckSquare, FileText, LayoutGrid, List, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useFile } from '@/App/hooks/FileHooks';
import { useGlobalToast } from '@/App/hooks/useGlobalToast';
import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { saveSettings } from '@/App/settings';
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { Button } from '@/components/ui/button';
import { getDocumentsByPath } from '@/core/database/useDocumentDatabase';
import { DATABASE_PATH } from '@/core/global/defaultSettings';
import { TOAST_DURATION } from '@/core/global/defaultValues';
import { MoveToTrash } from '@/core/TrashSystem/TrashSystem';
import { useDocumentsStore } from '@/GlobalState/documentsStore';

import DocumentItem from './cardItem';
import SortDropdown from './SortDropdown';

type SortField = 'title' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';
type SortOption = { field: SortField; direction: SortDirection };
type ViewMode = 'grid' | 'list';

export default function Home() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const { documents,
    setDocument,
    dynamicState,
    setModified,
    setCurrentDocument,
    config,
    patchConfig } = useGlobalStore(useShallow((state) => ({
      documents: state.documents,
      setDocument: state.setDocument,
      dynamicState: state.dynamicState,
      setModified: state.setModified,
      setCurrentDocument: state.setCurrentDocument,
      config: state.config,
      patchConfig: state.patchConfig
    })));

  const { getFileFromDocument } = useSettingsFile();

  const sortBy = config.homePage.sortBy as SortOption;
  const viewMode = config.homePage.viewMode as ViewMode;

  const shouldRefresh = useDocumentsStore((state) => state.shouldRefresh);

  // Save config when homePage settings change
  useEffect(() => {
    const saveConfig = async () => {
      try {
        await saveSettings(getFileFromDocument, config);
      } catch (e) {
        console.error('Error saving HomePage config:', e);
      }
    };
    saveConfig();
  }, [config.homePage.viewMode, config.homePage.sortBy, getFileFromDocument]);

  const emptyChanges = { key: "", type: "", id: "" };
  const emptyPageJson = {
    id: "",
    title: "",
    path: "",
    workspace_id: "",
    created_at: 0,
    updated_at: 0,
    tags: "",
  };


  useEffect(() => {
    dynamicState.current = new Map();
    setModified(emptyChanges);
    setCurrentDocument(emptyPageJson);
  }, []);

  const formatDate = useCallback((timestamp: number) => {
    const diff = Date.now() - timestamp;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

    if (diff < 60_000) return rtf.format(-Math.floor(diff / 1_000), 'second');
    if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute');
    if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), 'hour');
    if (diff < 2_592_000_000) return rtf.format(-Math.floor(diff / 86_400_000), 'day');
    return new Date(timestamp).toLocaleDateString();
  }, []);

  const { handleNewFile } = useFile();
  const { showToast } = useGlobalToast();

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedDocuments(new Set());
  };

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = () => {
    selectedDocuments.forEach(id => {
      const doc = documents.find(d => d.id === id);
      if (doc && doc.id !== 'home-page') {
        MoveToTrash(doc);
      }
    });
    setSelectedDocuments(new Set());
    setSelectionMode(false);
    showToast(t('FEEDBACK.movedToTrash'), 'success', TOAST_DURATION);
  };

  const sortedDocuments = useMemo(() => {
    const sorted = [...documents];
    const { field, direction } = sortBy;
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (field) {
        case 'title':
          comparison = (a.title || t('HOME_PAGE.untitled') as string).localeCompare(b.title || t('HOME_PAGE.untitled') as string);
          break;
        case 'created_at':
          comparison = a.created_at - b.created_at;
          break;
        case 'updated_at':
          comparison = a.updated_at - b.updated_at;
          break;
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [documents, sortBy]);

  // Fetch pages on component mount and set up auto-refresh
  // NOTE : auto refresh is needed when document was deleted so no need to display in homepage
  useEffect(() => {
    let lastDataHash = '';

    const fetchPages = async () => {
      try {
        const result = await getDocumentsByPath(DATABASE_PATH.HOME_PATH);

        // Create a simple hash to detect changes
        const currentHash = JSON.stringify(result.map(p => ({
          path: p.path,
          workspace_id: p.workspace_id,
          updated_at: p.updated_at,
          title: p.title
        })));

        // Only update if data actually changed
        if (currentHash !== lastDataHash) {
          setDocument(result);
          lastDataHash = currentHash;
        }
      } catch (error) {
        console.error('Error fetching pages:', error);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchPages();

  }, [shouldRefresh]);



  if (loading) {
    return (
      <div className="home-emptyState">
        <div className="home-emptyStateContent">
          <FileText className="home-emptyStateIcon" />
          <h2 className="home-emptyStateTitle">{t('HOME_PAGE.loading')}</h2>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="home-emptyState">
        <div className="home-emptyStateContent">
          <FileText className="home-emptyStateIcon" />
          <h2 className="home-emptyStateTitle">{t('HOME_PAGE.noDocuments')}</h2>
          <p className="home-emptyStateDescription">
            {t('HOME_PAGE.startByOpening')}
          </p>
          <Button
            variant="default"
            className="home-createDocumentButton"
            onClick={() => {
              handleNewFile();
            }
            }
          >
            {t('HOME_PAGE.createNewDocument')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">{t('HOME_PAGE.documents')}</h1>
        <div className="home-headerActions">
          {selectionMode && selectedDocuments.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="home-deleteButton"
              onClick={handleBulkDelete}
              title={t('HOME_PAGE.deleteSelected') as string}
            >
              <Trash2 className="home-deleteIcon" />
              <span>{selectedDocuments.size}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className={`home-selectionButton ${selectionMode ? 'active' : ''}`}
            onClick={toggleSelectionMode}
            title={selectionMode ? t('HOME_PAGE.exitSelectionMode') as string : t('HOME_PAGE.enterSelectionMode') as string}
          >
            {selectionMode ? <CheckSquare className="home-selectionIcon" /> : <Square className="home-selectionIcon" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="home-viewButton"
            onClick={() => patchConfig('homePage', { viewMode: viewMode === 'grid' ? 'list' : 'grid' })}
            title={viewMode === 'grid' ? t('HOME_PAGE.listView') as string : t('HOME_PAGE.gridView') as string}
          >
            {viewMode === 'grid' ? <List className="home-viewIcon" /> : <LayoutGrid className="home-viewIcon" />}
          </Button>
          <SortDropdown currentSort={sortBy} onSortChange={(newSort) => patchConfig('homePage', { sortBy: newSort })} />

        </div>
      </div>
      <div className={`home-documents-container ${viewMode === 'grid' ? 'grid-view' : 'list-view'} ${selectionMode ? 'selection-mode' : ''}`}>
        {sortedDocuments.map((document, index) => (
          <DocumentItem 
            key={index} 
            document={document} 
            formatDate={formatDate} 
            viewMode={viewMode} 
            selectionMode={selectionMode}
            isSelected={selectedDocuments.has(document.id)}
            onToggleSelection={toggleDocumentSelection}
            sortBy={sortBy}
          />
        ))}
      </div>
    </div>
  );
}