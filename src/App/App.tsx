import './compartiment.css';
import './index.css';

import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import {
  defineExtension
} from 'lexical';
import { type JSX, useMemo, useState } from 'react';
import { useShallow } from "zustand/react/shallow";

import Toast from "@/components/custom/Toast/Toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DIMENSIONS } from "@/core/global/defaultValues";
import Editor from "@/editor/editor";
import anqlNodes from "@/editor/nodes/anqlNodes";
import { useNavigationStore } from "@/GlobalState/navigationStore";

import { MathVariablesProvider } from "../editor/context/MathVariablesContext";
import { SharedHistoryContext } from "../editor/context/SharedHistoryContext";
import { buildImportMap } from '../editor/LexicalUtils/buildImportMaps';
import EditorTheme from "../editor/styles/EditorTheme";
import Home from "./AppComponents/HomePage/HomePage";
import LeftPanels from "./AppComponents/LeftPanel/LeftPanel";
import TitleBar from "./AppComponents/TitleBar/TitleBar";
import TrashPanel from "./AppComponents/TrashPanel/TrashPanel";
import GlobalShortcut from "./GlobalShortcut/GlobalShortcut";
import GlobalShortcutListener from "./GlobalShortcut/GlobalShortcutListener";
import { useToastContainer } from "./hooks/useGlobalToast";
import { AppInitializer } from "./Init/AppInitializer";
import { useGlobalStore } from "./store/useGlobalStore";
import UpdateDialog from "./AppComponents/UpdateDialog/UpdateDialog";

export default function App(): JSX.Element {
  const app = useMemo(
    () =>
      defineExtension({
        html: { import: buildImportMap() },
        name: "ANQL",
        namespace: "ANQL",
        nodes: anqlNodes,
        theme: EditorTheme,
      }),
    [],
  );


  const { appRef, windowHeight, mainContainerRef, config } = useGlobalStore(useShallow((state) => ({
    appRef: state.appRef,
    windowHeight: state.windowHeight,
    mainContainerRef: state.mainContainerRef,
    config: state.config
  })));
  const toasts = useToastContainer();
  const currentPage = useNavigationStore((state) => state.currentPage);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  return (
    <AppInitializer>
      <UpdateDialog />
      <GlobalShortcut />
      <GlobalShortcutListener />
      <MathVariablesProvider>
        <LexicalExtensionComposer extension={app} contentEditable={null}>
          <SidebarProvider 
            ref={appRef} 
            style={{ paddingTop: DIMENSIONS.titlebarHeight }}
          >
            <TitleBar />
            <LeftPanels onOpenTrash={() => setIsTrashOpen(true)} />
            <div
              className={`main-container ${config.sidebar.variant === 'floating' ? 'floating-sidebar' : ''}`}
              ref={mainContainerRef}
              style={{
                height: windowHeight - DIMENSIONS.titlebarHeight,
              }}
            >
              {currentPage === "home" ? (
                <Home />
              ) : currentPage === "editor" ? (
                <SharedHistoryContext>
                  <Editor />
                </SharedHistoryContext>
              ) : null}
            </div>

            {isTrashOpen && (
              <TrashPanel
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
              />
            )}
          </SidebarProvider>
        </LexicalExtensionComposer>
      </MathVariablesProvider>


      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          persistent={toast.persistent}
        />
      ))}
    </AppInitializer>
  );
}
