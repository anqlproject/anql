import "./LeftPanel.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import {
  HomeIcon,
  MoveRightIcon,
  Plus,
  SearchIcon,
  Upload,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from 'zustand/react/shallow';

import { AboutDialog } from "@/App/AppComponents/AboutPanel/AboutPanel";
import SearchOverlay from "@/App/AppComponents/GlobalSearch/SearchOverlay";
import { HelpDialog } from "@/App/AppComponents/HelpPanel/HelpPanel";
import { importDocument } from "@/App/AppComponents/ImportExport/importDocument";
import { FooterMenu } from "@/App/AppComponents/LeftPanel/FooterMenu";
import RecentDocuments from "@/App/AppComponents/LeftPanel/RecentDocuments";
import { navigationUtils } from "@/App/AppComponents/navigationUtils";
import SettingsOverlay from "@/App/AppComponents/Settings/SettingsOverlay";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { useFile } from "@/App/hooks/FileHooks";
import { useSettingsFile } from "@/App/hooks/useSettingsFile";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_PATH } from "@/core/global/defaultSettings";
import { DIMENSIONS, ICON_SIZES } from "@/core/global/defaultValues";
import { useTheme } from "@/core/global/ThemeContext";
import { useNavigationStore } from "@/GlobalState/navigationStore";

interface LeftPanelsProps {
  onOpenTrash?: () => void;
}

const LeftPanels: React.FC<LeftPanelsProps> = ({ onOpenTrash }) => {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const { handleNewFile, openEditorWithUpdate } = useFile();
  const { getFileFromDocument } = useSettingsFile();

  const { isMac, config } = useGlobalStore(useShallow((state) => ({ isMac: state.isMac, config: state.config })));
  const isGlobalSearchOpen = useGlobalShortcut((state) => state.isGlobalSearchOpen);
  const openGlobalSearch = useGlobalShortcut((state) => state.openGlobalSearch);
  const closeGlobalSearch = useGlobalShortcut((state) => state.closeGlobalSearch);
  const globalSearchCount = useGlobalShortcut((state) => state.globalSearchCount);
  const setCreateNewDocument = useGlobalShortcut((state) => state.setCreateNewDocument);
  const [settingsOverlayOpen, setSettingsOverlayOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const isDraggingRef = useRef(false);
  const animationFrameIdRef = useRef<number | null>(null);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  // Register handleNewFile with global shortcut (handleNewFile is now stable with useCallback in FileHooks)
  useEffect(() => {
    setCreateNewDocument(handleNewFile);
  }, [handleNewFile, setCreateNewDocument]);

  // Sidebar config comes directly from the typed Zustand config store
  const sidebarSettings = {
    variant: config.sidebar.variant as 'floating' | 'inset',
    collapsible: config.sidebar.collapsible,
  };

  const { goHome } = navigationUtils();

  const toggleSidebar = () => {
    setOpen(!open);
    editor.blur();
  };

  const menuItems = [
    {
      title: t('SIDEBAR.home') as string,
      id: "home",
      icon: HomeIcon,
      onClick: () => {
        goHome();
      },
    },
    {
      title: t('SIDEBAR.search') as string,
      id: "search",
      icon: SearchIcon,
      onClick: () => {
        openGlobalSearch();
      },
    },
    {
      title: t('DOCUMENT_MENU.newDocument') as string,
      id: "new-document",
      icon: Plus,
      onClick: () => {
        handleNewFile();
      },
    },
    {
      title: t('DOCUMENT_MENU.import') as string,
      id: "import",
      icon: Upload,
      onClick: () => {
        importDocument({
          editor,
          onError: (msg) => console.error(msg),
          openDocument: openEditorWithUpdate,
          handleNewFile,
        });
      },
    },
  ];

  const { setOpen, open, setSidebarWidth, setIsResizing, sidebarWidth } = useSidebar();
  const currentPage = useNavigationStore((state) => state.currentPage);

  const [isHovered, setIsHovered] = useState(false);
  const isInitialLoadRef = useRef(true);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const { sideBarRef } = useGlobalStore(useShallow((state) => ({ sideBarRef: state.sideBarRef })));

  // Disable transitions immediately on mount
  useEffect(() => {
    setIsResizing(true);
  }, []);

  // Load leftPanel config on mount
  useEffect(() => {
    const loadLeftPanelConfig = async () => {
      try {
        const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);
        if (!configPath) {
          throw new Error("Config path not found");
        }
        const content = await readTextFile(configPath);

        if (!content || content.trim() === '') {
          console.warn('Config file is empty');
          return;
        }

        const config = JSON.parse(content);

        if (config.leftPanel) {
          if (config.leftPanel.width) {
            setSidebarWidth(config.leftPanel.width);
          }
          if (typeof config.leftPanel.open === 'boolean') {
            setOpen(config.leftPanel.open);
          }
        }
      } catch (e) {
        console.error('No leftPanel config found or error reading config:', e);
      } finally {
        isInitialLoadRef.current = false;
        // Re-enable transitions after config is loaded and DOM has updated
        setTimeout(() => {
          setIsResizing(false);
          setIsConfigLoaded(true);
        }, 100);
      }
    };

    loadLeftPanelConfig();
  }, []);

  // Save leftPanel config when width or open state changes
  useEffect(() => {
    if (isInitialLoadRef.current) return;

    const saveLeftPanelConfig = async () => {
      try {
        const configPath = await getFileFromDocument(APP_PATH.CONFIG_FILE);
        if (!configPath) {
          throw new Error("Config path not found");
        }

        let content = '{}';
        try {
          content = await readTextFile(configPath);
        } catch (e) {
          // File doesn't exist yet, will create it
        }

        const config = JSON.parse(content);
        config.leftPanel = {
          width: sidebarWidth,
          open
        };

        await writeTextFile(configPath, JSON.stringify(config, null, 2));
      } catch (e) {
        console.error('Error saving leftPanel config:', e);
      }
    };

    saveLeftPanelConfig();
  }, [sidebarWidth, open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }

        animationFrameIdRef.current = requestAnimationFrame(() => {
          const newWidth = e.clientX;
          if (newWidth >= 150 && newWidth <= 500) {
            setSidebarWidth(`${newWidth}px`);
          }
        });
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsResizing(false);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <>
      <SidebarTrigger
        size="lg"
        className="sidebar-trigger"
        style={{
          left: isMac ? "90px" : "1rem",
        }}
        onClick={() => {
          editor.blur();
        }}
      />
      <Sidebar
        variant="inset"
        collapsible={
          sidebarSettings.collapsible === true ? "icon" : "offcanvas"
        }
        ref={sideBarRef}
        className="sidebar"
        style={{
          height: window.innerHeight - DIMENSIONS.titlebarHeight,
          visibility: isConfigLoaded ? 'visible' : 'hidden',
        }}
      >
        {
          // sidebar trigger and resize handle
          <div
            className="sidebar-resize-handle"
            style={{
              width: DIMENSIONS.sidebarWrapperWidth,
            }}
            onMouseDown={handleMouseDown}
            onClick={toggleSidebar}
          ></div>
        }
        <SidebarHeader>
          <SidebarMenu>
            {menuItems.map((item) => (
              <React.Fragment key={item.id}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="hover:bg-[var(--action-hover)]"
                    isActive={item.id === "home" && currentPage === "home"}
                    onClick={() => {
                      item.onClick();
                    }}
                  >
                    <item.icon
                      size={ICON_SIZES.md}
                      style={{ color: item.id === "home" && currentPage === "home" ? "var(--primary-color)" : undefined }} />
                    <span>{item.title}</span>
                    {item.id === "search" && globalSearchCount > 0 && (
                      <span className="search-count-badge">
                        {globalSearchCount}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {item.id === "home"}
              </React.Fragment>
            ))}
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {(!sidebarSettings.collapsible || open) && (
            <RecentDocuments />
          )}
        </SidebarContent>
        <SidebarFooter>
          <FooterMenu
            setSettingsOverlayOpen={setSettingsOverlayOpen}
            toggleTheme={toggleTheme}
            resolvedTheme={resolvedTheme}
            onOpenTrash={onOpenTrash}
            setIsHelpOpen={setIsHelpOpen}
            onOpenAbout={() => setIsAboutOpen(true)}
          />
        </SidebarFooter>
      </Sidebar>

      <SearchOverlay
        isOpen={isGlobalSearchOpen}
        onClose={closeGlobalSearch}
      />

      <SettingsOverlay
        isOpen={settingsOverlayOpen}
        onClose={() => setSettingsOverlayOpen(false)}
      />

      <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {sidebarSettings.collapsible !== true && !open && (
        <div
          className="left-sidebar-wrapper"
          onMouseEnter={() => {
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
        >
          <div
            className={`left-sidebar-trigger ${isHovered ? "visible" : ""}`}
            style={{
              height: window.innerHeight,
              width: DIMENSIONS.sidebarWrapperWidth * 1.6,
            }}
            onClick={() => {
              toggleSidebar();
              setIsHovered(false);
            }}
          >
            <MoveRightIcon size={14} />
          </div>
        </div>
      )}
    </>
  );
};

export default LeftPanels;
