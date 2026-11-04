import "./TitleBar.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type JSX, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';

import { DocumentMenu } from "@/App/AppComponents/DocumentMenu/DocumentMenu";
import ReferencesPanel from "@/App/AppComponents/ReferencesPanel/ReferencesPanel";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { Dialog } from "@/components/custom/Dialog/Dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ReferenceJson } from "@/core/database/useReferenceDatabase";
import { DIMENSIONS } from "@/core/global/defaultValues";
import { logger } from "@/core/logger";
import { useReferenceStore } from "@/core/references/useReferenceStore";

export default function TitleBar(): JSX.Element {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const [openExitDialog, setOpenExitDialog] = useState(false);
  const [refPanelOpen, setRefPanelOpen] = useState(false);
  const [referenceToDelete, setReferenceToDelete] = useState<ReferenceJson | null>(null);
  const [isDeletingReference, setIsDeletingReference] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { setExitApp } = useGlobalShortcut();
  const isMac = useGlobalStore((state) => state.isMac);
  const refBtnRef = useRef<HTMLButtonElement>(null);
  const refPanelRef = useRef<HTMLDivElement>(null);
  const removeReference = useReferenceStore((state) => state.removeReference);

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
    const handleClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (refBtnRef.current?.contains(target) || refPanelRef.current?.contains(target)) return;
      setRefPanelOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [refPanelOpen]);

  const [editor] = useLexicalComposerContext();

  const confirmDeleteReference = async () => {
    if (!referenceToDelete) return;
    if (!referenceToDelete.id) {
      setDeleteError(t('REFERENCE_PANEL.deleteFailed') as string);
      return;
    }

    setIsDeletingReference(true);
    setDeleteError('');
    try {
      await removeReference(referenceToDelete.id);
      setReferenceToDelete(null);
    } catch (error) {
      logger.error('Failed to delete reference', error as Error, {
        referenceId: referenceToDelete.id,
      });
      setDeleteError(t('REFERENCE_PANEL.deleteFailed') as string);
    } finally {
      setIsDeletingReference(false);
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
        }}
      >
        <SidebarTrigger
          size="lg"
          className="sidebar-trigger"
          style={{
            marginLeft: isMac ? "90px" : 0,
            marginRight: "0.5rem"
          }}
          onClick={() => {
            editor.blur();
          }}
        />
        <DocumentMenu />

        <button
          ref={refBtnRef}
          className={`titlebar-ref-btn${refPanelOpen ? ' titlebar-ref-btn--active' : ''}`}
          style={{
            position: 'absolute',
            top: '2px',
            right: isMac ? '3.2rem' : '2.2rem',
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
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setRefPanelOpen((v) => !v);
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

        {refPanelOpen && (
          createPortal(
            <ReferencesPanel
              panelRef={refPanelRef}
              onClose={() => setRefPanelOpen(false)}
              onRequestDelete={(reference) => {
                setDeleteError('');
                setReferenceToDelete(reference);
              }}
            />,
            document.body,
          )
        )}
      </div>

      <Dialog
        isOpen={referenceToDelete !== null}
        onClose={() => {
          if (!isDeletingReference) {
            setReferenceToDelete(null);
            setDeleteError('');
          }
        }}
        title={t('REFERENCE_PANEL.deleteTitle') as string}
        description={
          <div>
            <p>{t('REFERENCE_PANEL.confirmDelete', { name: referenceToDelete?.name ?? '' })}</p>
            {deleteError && <p role="alert">{deleteError}</p>}
          </div>
        }
        mode="urgent"
        leftButton={{
          text: t('REFERENCE_PANEL.cancel') as string,
          onClick: () => {
            setReferenceToDelete(null);
            setDeleteError('');
          },
          disabled: isDeletingReference,
        }}
        rightButton={{
          text: isDeletingReference
            ? t('REFERENCE_PANEL.deleting') as string
            : t('DIALOG.delete') as string,
          onClick: confirmDeleteReference,
          variant: 'danger',
          disabled: isDeletingReference,
        }}
      />

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
