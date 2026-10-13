import './FooterMenu.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    Settings2,
} from "lucide-react";
import React, { useState } from 'react';
import { useTranslation } from "react-i18next";

import { useSettingsFile } from '@/App/hooks/useSettingsFile';
import { saveSettings } from '@/App/settings';
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { ICON_SIZES } from "@/core/global/defaultValues";
import { useThemeStore } from "@/GlobalState/themeStore";

interface FooterMenuProps {
    setSettingsOverlayOpen: (open: boolean) => void;
    onOpenTrash?: () => void;
    setIsHelpOpen: (open: boolean) => void;
    onOpenAbout?: () => void;
}

export const FooterMenu: React.FC<FooterMenuProps> = ({
    setSettingsOverlayOpen,
    onOpenTrash,
    setIsHelpOpen,
    onOpenAbout
}) => {
    const { t } = useTranslation();
    const { toggleTheme, resolvedTheme } = useThemeStore();
    const { patchConfig } = useGlobalStore();
    const { getFileFromDocument } = useSettingsFile();
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const isNativeMenuOpening = React.useRef(false);

    const [editor] = useLexicalComposerContext();

    React.useEffect(() => {
        if (!isOpen || isNativeMenuOpening.current) return;
        isNativeMenuOpening.current = true;

        const showNativeMenu = async () => {
            try {
                const [{ Menu, CheckMenuItem }, { LogicalPosition }] = await Promise.all([
                    import("@tauri-apps/api/menu"),
                    import("@tauri-apps/api/dpi"),
                ]);

                const darkModeItem = await CheckMenuItem.new({
                    text: t('FOOTER_MENU.darkMode') as string,
                    checked: resolvedTheme === 'dark',
                    action: () => {
                        setIsOpen(false);
                        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
                        toggleTheme();
                        patchConfig('appearance', { theme: newTheme });
                        // Lire le state mis à jour depuis le store puis sauvegarder
                        const updatedConfig = useGlobalStore.getState().config;
                        saveSettings(getFileFromDocument, updatedConfig).catch(console.error);
                    },
                });

                const menuItems: any[] = [
                    {
                        text: t('FOOTER_MENU.generalSettings') as string,
                        action: () => {
                            setIsOpen(false);
                            setSettingsOverlayOpen(true);
                        },
                        accelerator: 'CmdOrCtrl+,',
                    },
                    darkModeItem,
                    {
                        text: t('FOOTER_MENU.openTrash') as string,
                        action: () => {
                            setIsOpen(false);
                            onOpenTrash?.();
                        },
                    },
                    {
                        item: "Separator",
                    },
                    {
                        text: t('FOOTER_MENU.getHelp') as string,
                        action: () => {
                            setIsOpen(false);
                            setIsHelpOpen(true);
                        },
                    },
                    {
                        text: t('FOOTER_MENU.about') as string,
                        action: () => {
                            setIsOpen(false);
                            onOpenAbout?.();
                        },
                    },
                ];

                const measuredTexts = [
                    t('FOOTER_MENU.generalSettings') as string,
                    t('FOOTER_MENU.darkMode') as string,
                    t('FOOTER_MENU.openTrash') as string,
                    t('FOOTER_MENU.getHelp') as string,
                    t('FOOTER_MENU.about') as string,
                ];

                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (context) {
                    context.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
                }

                const menuWidth = Math.max(
                    ...measuredTexts.map((itemText) =>
                        (context?.measureText(itemText ?? "").width ?? 0) + 48,
                    ),
                );
                const menuHeight = menuItems.reduce(
                    (height, item) => height + (item.item === "Separator" ? 8 : 28),
                    8,
                );

                const nativeMenu = await Menu.new({ items: menuItems });
                await nativeMenu.popup(
                    new LogicalPosition(
                        Math.min(
                            Math.max(8, menuPosition.x),
                            Math.max(8, window.innerWidth - menuWidth - 8),
                        ),
                        Math.min(
                            Math.max(8, menuPosition.y),
                            Math.max(8, window.innerHeight - menuHeight - 8),
                        ),
                    ),
                );
            } catch (error) {
                console.error("Failed to show native footer menu", error);
            } finally {
                isNativeMenuOpening.current = false;
                setIsOpen(false);
            }
        };

        void showNativeMenu();
    }, [isOpen, menuPosition, resolvedTheme, t, setSettingsOverlayOpen, onOpenTrash, setIsHelpOpen, onOpenAbout, toggleTheme, patchConfig, getFileFromDocument]);

    return (
        <div className="footer-menu-wrapper">
            <button
                className={`footer-icon-button ${isOpen ? "footer-icon-button--open" : ""}`}
                onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenuPosition({ x: rect.right + 4, y: rect.top });
                    setIsOpen(true);
                    editor.blur();
                }}
            >
                <Settings2 size={ICON_SIZES.md} />
            </button>
        </div>
    );
};
