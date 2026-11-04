import "./TitleBar.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type JSX, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';

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

export default function TitleBar(): JSX.Element {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const [openExitDialog, setOpenExitDialog] = useState(false);
  const [refPanelOpen, setRefPanelOpen] = useState(false);
  const { setExitApp } = useGlobalShortcut();
  const { showToast, dismissToast } = useGlobalToast();
  const isMac = useGlobalStore((state) => state.isMac);
  const refBtnRef = useRef<HTMLButtonElement>(null);
  const refPanelRef = useRef<HTMLDivElement>(null);
  const moveReferenceToTrash = useReferenceStore((state) => state.moveReferenceToTrash);
  const restoreReference = useReferenceStore((state) => state.restoreReference);

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
              onRequestDelete={handleMoveReferenceToTrash}
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
