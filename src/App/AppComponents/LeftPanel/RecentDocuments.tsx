import { X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from 'zustand/react/shallow';

import { navigationUtils } from "@/App/AppComponents/navigationUtils";
import { useFile } from "@/App/hooks/FileHooks";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { Dialog } from "@/components/custom/Dialog/Dialog";
import { getDocumentById } from "@/core/database/useDocumentDatabase";
import { DocumentsJson } from "@/core/database/useDocumentDatabase";
import { clearRecentDocuments, getRecentDocuments, removeRecentDocument } from "@/core/database/useRecentDocumentsDatabase";
import { DATABASE_PATH } from "@/core/global/defaultSettings";
import { useDocumentsStore } from "@/GlobalState/documentsStore";
import { useRecentDocumentsStore } from "@/GlobalState/recentDocumentsStore";

const RecentDocuments: React.FC = () => {
  const { t } = useTranslation();
  const { currentDocument } = useGlobalStore(useShallow((state) => ({ currentDocument: state.currentDocument })));

  const { openEditorWithUpdate } = useFile();
  const { goHome } = navigationUtils();

  const [documents, setDocuments] = useState<DocumentsJson[]>([]);
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const recentShouldRefresh = useRecentDocumentsStore((state) => state.shouldRefresh);
  const documentsShouldRefresh = useDocumentsStore((state) => state.shouldRefresh);

  const handleClearAll = () => {
    setOpenClearDialog(true);
  };

  const handleConfirmClear = async () => {
    await clearRecentDocuments();
    goHome();
    setOpenClearDialog(false);
  };

  const handleRemoveItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await removeRecentDocument(id);
  };

  const historyListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadRecentDocuments = async () => {
      try {
        // NOTE : we display 20 items in sidebar but 1000 in special page
        const recent = await getRecentDocuments(20);

        // Load full document details for each recent document
        const docDetails = await Promise.all(
          recent.map(async (r) => {
            try {
              const doc = await getDocumentById(r.id);

              // If document is in trash, remove it from recent documents
              if (doc && doc.path === DATABASE_PATH.TRASH_PATH) {
                await removeRecentDocument(r.id);
                return null;
              }

              return doc;
            } catch {
              return null;
            }
          })
        );
        setDocuments(docDetails.filter((d): d is DocumentsJson => d !== null));
      } catch (error) {
        console.error("Failed to load recent documents:", error);
      }
    };

    loadRecentDocuments();

    return () => {
      // Cleanup if needed
    };
  }, [recentShouldRefresh, documentsShouldRefresh]);

  return (
    <div className="history-list" ref={historyListRef} >
      <div className="history-header">
        <h3 className="history-title">{t('SIDEBAR.history') as string}</h3>
        {documents.length > 0 && (
          <button className="clear-history-btn" onClick={handleClearAll}>
            {t('SIDEBAR.clearAll') as string}
          </button>
        )}
      </div>
      {documents.length > 0 ? (
        <ul className="history-items">
          {documents.map((document) => (
            <li
              key={document.id}
              className={`history-item ${document.id === currentDocument.id ? "active" : ""
                }`}
              onClick={() => {
                openEditorWithUpdate(document);
              }}
            >
              <span className="history-item-name">{document.title || t('SIDEBAR.untitled')}</span>
              <button
                className="history-item-close"
                onClick={(e) => handleRemoveItem(e, document.id)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history-empty">{t('SIDEBAR.noHistoryYet') as string}</p>
      )}

      {openClearDialog && (
        <Dialog
          isOpen={openClearDialog}
          onClose={() => setOpenClearDialog(false)}
          title={t('SIDEBAR.clearAllTitle') as string}
          description={t('SIDEBAR.clearAllDescription') as string}
          mode="urgent"
          leftButton={{
            text: t('DIALOG.cancel') as string,
            onClick: () => setOpenClearDialog(false)
          }}
          rightButton={{
            text: t('DIALOG.clear') as string,
            onClick: handleConfirmClear,
            variant: 'danger'
          }}
        />
      )}
    </div>
  );
};

export default RecentDocuments;
