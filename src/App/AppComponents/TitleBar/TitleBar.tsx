import "./TitleBar.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { type JSX, useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';

import { DocumentMenu } from "@/App/AppComponents/DocumentMenu/DocumentMenu";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { Dialog } from "@/components/custom/Dialog/Dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { DIMENSIONS } from "@/core/global/defaultValues";

export default function TitleBar(): JSX.Element {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const [openExitDialog, setOpenExitDialog] = useState(false);
  const { setExitApp } = useGlobalShortcut();
  const isMac = useGlobalStore((state) => state.isMac);

  appWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    setOpenExitDialog(true);
  });

  // Register exit app callback
  useEffect(() => {
    setExitApp(() => setOpenExitDialog(true));
  }, [setExitApp]);

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
          // ...
          editor.blur();
        }}
      >
        <SidebarTrigger
          size="lg"
          className="sidebar-trigger"
          style={{
            marginLeft: isMac ? "90px" : "1rem",
            marginRight: "0.5rem"
          }}
          onClick={() => {
            editor.blur();
          }}
        />
        <DocumentMenu />
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
