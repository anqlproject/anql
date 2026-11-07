import "./TitleBar.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { $getRoot } from "lexical";
import { Info } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';
import { useShallow } from "zustand/react/shallow";

import DocumentInfoPanel from "@/App/AppComponents/DocumentInfoPanel/DocumentInfoPanel";
import { DocumentMenu } from "@/App/AppComponents/DocumentMenu/DocumentMenu";
import ReferencesPanel from "@/App/AppComponents/ReferencesPanel/ReferencesPanel";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { useGlobalToast } from "@/App/hooks/useGlobalToast";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { Dialog } from "@/components/custom/Dialog/Dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ReferenceJson } from "@/core/database/useReferenceDatabase";
import { DIMENSIONS, TOAST_DURATION } from "@/core/global/defaultValues";
import { logger } from "@/core/logger";
import { useReferenceStore } from "@/core/references/useReferenceStore";
import { useNavigationStore } from "@/GlobalState/navigationStore";

export default function TitleBar(): JSX.Element {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const [openExitDialog, setOpenExitDialog] = useState(false);
  const [refPanelOpen, setRefPanelOpen] = useState(false);
  const [refPanelLeft, setRefPanelLeft] = useState(8);
  const [documentInfoOpen, setDocumentInfoOpen] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const { setExitApp } = useGlobalShortcut();
  const { showToast, dismissToast } = useGlobalToast();
  const { isMac, currentDocument } = useGlobalStore(useShallow((state) => ({
    isMac: state.isMac,
    currentDocument: state.currentDocument,
  })));
  const currentPage = useNavigationStore((state) => state.currentPage);
  const refBtnRef = useRef<HTMLButtonElement>(null);
  const refPanelRef = useRef<HTMLDivElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const moveReferenceToTrash = useReferenceStore((state) => state.moveReferenceToTrash);
  const restoreReference = useReferenceStore((state) => state.restoreReference);

  const updateReferencesPanelPosition = useCallback(() => {
    const buttonLeft = refBtnRef.current?.getBoundingClientRect().left;
    if (buttonLeft !== undefined) setRefPanelLeft(buttonLeft);
  }, []);

  appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    setOpenExitDialog(true);
  });

  // Register exit app callback
  useEffect(() => {
    setExitApp(() => setOpenExitDialog(true));
  }, [setExitApp]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!refPanelOpen) return;
    updateReferencesPanelPosition();
    window.addEventListener('resize', updateReferencesPanelPosition);
    const handleClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (refBtnRef.current?.contains(target) || refPanelRef.current?.contains(target)) return;
      setRefPanelOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', updateReferencesPanelPosition);
    };
  }, [refPanelOpen, updateReferencesPanelPosition]);

  useEffect(() => {
    if (!documentInfoOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (infoBtnRef.current?.contains(target) || infoPanelRef.current?.contains(target)) return;
      setDocumentInfoOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [documentInfoOpen]);

  const [editor] = useLexicalComposerContext();
  const hasCurrentDocument = currentPage === 'editor' && Boolean(currentDocument?.id);

  useEffect(() => {
    if (!hasCurrentDocument) setDocumentInfoOpen(false);
  }, [hasCurrentDocument]);

  useEffect(() => {
    if (!documentInfoOpen || !hasCurrentDocument) return;

    const updateWordCount = () => {
      editor.getEditorState().read(() => {
        const text = $getRoot().getTextContent();
        const words = text.match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu);
        setWordCount(words?.length ?? 0);
      });
    };

    updateWordCount();
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) updateWordCount();
    });
  }, [currentDocument?.id, documentInfoOpen, editor, hasCurrentDocument]);

  const handleMoveReferenceToTrash = async (reference: ReferenceJson) => {
    if (!reference.id) return;
    const referenceId = reference.id;
    try {
      await moveReferenceToTrash(referenceId);
      const toastIdRef = { current: '' };
      const toastContent = (
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{t('REFERENCE_PANEL.movedToTrash', { name: reference.name })}</span>
          <button
            onClick={async () => {
              dismissToast(toastIdRef.current);
              try {
                await restoreReference(referenceId);
                showToast(t('REFERENCE_PANEL.restored', { name: reference.name }), 'info', TOAST_DURATION);
              } catch (error) {
                logger.error('Failed to restore reference from toast', error as Error, {
                  referenceId,
                });
                showToast(t('REFERENCE_PANEL.restoreFailed') as string, 'error');
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
            {t('FEEDBACK.restore')}
          </button>
        </span>
      );
      toastIdRef.current = showToast(toastContent, 'success', TOAST_DURATION);
    } catch (error) {
      logger.error('Failed to move reference to trash', error as Error, {
        referenceId,
      });
      showToast(t('REFERENCE_PANEL.deleteFailed') as string, 'error');
    }
  };

  return (
    <>
      <div
        data-tauri-drag-region
        className="titlebar"
        style={{
          height: DIMENSIONS.titlebarHeight,
        }}
        onMouseDown={(e) => {
          if (e.buttons === 1) {
            if (e.detail === 2) {
              appWindow.toggleMaximize();
            }
          }
        }}
        onClick={() => {
          editor.blur();
          setRefPanelOpen(false);
          setDocumentInfoOpen(false);
        }}
      >
        <div className="titlebar-controls titlebar-controls--left">
          <SidebarTrigger
            size="lg"
            className="sidebar-trigger"
            style={{
              marginLeft: isMac ? "90px" : 0,
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={() => {
              editor.blur();
            }}
          />

          <button
            ref={refBtnRef}
            className={`titlebar-ref-btn${refPanelOpen ? ' titlebar-ref-btn--active' : ''}`}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: 'none',
            }}
            title={t('REFERENCE_PANEL.title') as string}
            aria-label={t('REFERENCE_PANEL.openPanel') as string}
            aria-expanded={refPanelOpen}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setDocumentInfoOpen(false);
              updateReferencesPanelPosition();
              setRefPanelOpen((isOpen) => !isOpen);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="7" r="4" />
              <circle cx="4" cy="19" r="2" />
              <circle cx="12" cy="19" r="2" />
              <circle cx="20" cy="19" r="2" />
              <path d="M8 7a4 4 0 0 0-4 4v6" />
              <path d="M12 11v6" />
              <path d="M16 7a4 4 0 0 1 4 4v6" />
            </svg>
          </button>
        </div>

        <div
          className="titlebar-controls titlebar-controls--right"
          style={{ marginRight: isMac ? '1rem' : 0 }}
        >
          {hasCurrentDocument && (
            <button
              ref={infoBtnRef}
              className={`titlebar-ref-btn titlebar-info-btn${documentInfoOpen ? ' titlebar-ref-btn--active' : ''}`}
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                border: 'none',
              }}
              title={t('DOCUMENT_INFO.title') as string}
              aria-label={t('DOCUMENT_INFO.openPanel') as string}
              aria-expanded={documentInfoOpen}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setRefPanelOpen(false);
                setDocumentInfoOpen((isOpen) => !isOpen);
              }}
            >
              <Info size={16} aria-hidden="true" />
            </button>
          )}

          <DocumentMenu />
        </div>

        {refPanelOpen && (
          createPortal(
            <ReferencesPanel
              panelRef={refPanelRef}
              panelLeft={refPanelLeft}
              onClose={() => setRefPanelOpen(false)}
              onRequestDelete={handleMoveReferenceToTrash}
            />,
            document.body,
          )
        )}
        {documentInfoOpen && hasCurrentDocument && (
          createPortal(
            <DocumentInfoPanel
              panelRef={infoPanelRef}
              document={currentDocument}
              wordCount={wordCount}
            />,
            document.body,
          )
        )}
      </div>

      {openExitDialog && (
        <Dialog
          isOpen={openExitDialog}
          onClose={() => setOpenExitDialog(false)}
          title={t('DIALOG.exitTitle') as string}
          description={t('DIALOG.exitDescription') as string}
          mode="urgent"
          leftButton={{
            text: t('DIALOG.cancel') as string,
            onClick: () => setOpenExitDialog(false)
          }}
          rightButton={{
            text: t('DIALOG.exit') as string,
            onClick: () => appWindow.destroy(),
            variant: 'danger'
          }}
        />
      )}
    </>
  );
}
