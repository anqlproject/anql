import './FooterMenu.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    HelpCircle,
    Info,
    Moon,
    Settings2,
    Sun,
    Trash2,
} from "lucide-react";
import React, { useState } from 'react';
import { useTranslation } from "react-i18next";

import { MenuItemProps } from "@/components/custom/Menu/MenuItem";
import { MenuX } from "@/components/custom/Menu/MenuX";
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
    const [isOpen, setIsOpen] = useState(false);

    const menuItems: MenuItemProps[] = [
        {
            icon: <Settings2 size={16} />,
            title: t('FOOTER_MENU.generalSettings') as string,
            onClick: () => {
                setSettingsOverlayOpen(true);
            },
        },
        {
            icon: resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
            title: (resolvedTheme === 'dark' ? t('FOOTER_MENU.switchToLightMode') : t('FOOTER_MENU.switchToDarkMode')) as string,
            onClick: () => {
                toggleTheme();
            },
        },
        {
            icon: <Trash2 size={16} />,
            title: t('SIDEBAR.trash') as string,
            onClick: () => {
                onOpenTrash?.();
            },
        },
        {
            isSeparator: true,
        },
        {
            icon: <HelpCircle size={16} />,
            title: t('FOOTER_MENU.getHelp') as string,
            onClick: () => {
                setIsHelpOpen(true);
            },
        },
        {
            icon: <Info size={16} />,
            title: t('FOOTER_MENU.about') as string,
            onClick: () => {
                onOpenAbout?.();
            },
        },
    ];
    
    const [editor] = useLexicalComposerContext();

    return (
        <div className="footer-menu-wrapper">
            <MenuX
                items={menuItems}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                direction="right"
                align="end"
                trigger={
                    <button
                        className={`footer-icon-button ${isOpen ? "footer-icon-button--open" : ""}`}
                        onClick={() => {
                            setIsOpen(!isOpen);
                            editor.blur();
                        }}
                    >
                        <Settings2 size={ICON_SIZES.md} />
                    </button>
                }
            />
        </div>
    );
};
