import "./TitleBar.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Braces } from "lucide-react";
import { type JSX, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from 'react-i18next';

import { DocumentMenu } from "@/App/AppComponents/DocumentMenu/DocumentMenu";
import ReferencesPanel from "@/App/AppComponents/ReferencesPanel/ReferencesPanel";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { Dialog } from "@/components/custom/Dialog/Dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DIMENSIONS } from "@/core/global/defaultValues";

export default function TitleBar(): JSX.Element {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const [openExitDialog, setOpenExitDialog] = useState(false);
  const [refPanelOpen, setRefPanelOpen] = useState(false);
  const { setExitApp } = useGlobalShortcut();
  const isMac = useGlobalStore((state) => state.isMac);
  const refBtnRef = useRef<HTMLButtonElement>(null);
  const refPanelRef = useRef<HTMLDivElement>(null);

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

        {/* ── Références button ── */}
        <button
          ref={refBtnRef}
          className={`sidebar-trigger titlebar-ref-btn${refPanelOpen ? ' titlebar-ref-btn--active' : ''}`}
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
            background: 'transparent',
            border: 'none',
          }}
          title="Références (@)"
          aria-label="Ouvrir les références"
          onClick={(e) => {
            e.stopPropagation();
            setRefPanelOpen((v) => !v);
          }}
        >
          <Braces size={16} />
        </button>

        {/* ── References panel ── */}
        {refPanelOpen && (
          createPortal(
            <ReferencesPanel
              panelRef={refPanelRef}
              onClose={() => setRefPanelOpen(false)}
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
