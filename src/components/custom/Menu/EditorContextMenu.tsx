import "./Menu.css";

import { flip, offset, shift, useFloating, VirtualElement } from "@floating-ui/react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { MenuItemProps } from "./MenuItem";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface EditorContextMenuProps {
  items: (MenuItemProps & { submenu?: MenuItemProps[] })[];
  isOpen: boolean;
  onClose: () => void;
  position?: MenuPosition;
  direction?: "left" | "top" | "right" | "bottom";
  children?: React.ReactNode;
}

/**
 * ContextMenuPortal — A focus-free context menu rendered via createPortal.
 *
 * Unlike Radix DropdownMenu, this component NEVER steals focus from the
 * editor, so the native text selection remains visible and active.
 * It reuses the same CSS classes as DropdownContextMenu for identical styling.
 */
export function EditorContextMenu({
  items,
  isOpen,
  onClose,
  position,
  direction: _direction = "right",
  children,
}: EditorContextMenuProps) {
  // Virtual element for the main context menu at cursor coordinates
  const virtualEl = React.useMemo<VirtualElement | null>(() => {
    if (!position) return null;
    return {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x: position.x,
        y: position.y,
        top: position.y,
        left: position.x,
        right: position.x,
        bottom: position.y,
      }),
    };
  }, [position]);

  const { refs: mainRefs, floatingStyles: mainStyles } = useFloating({
    placement: _direction === "left" ? "left-start" : _direction === "top" ? "top-start" : _direction === "bottom" ? "bottom-start" : "right-start",
    elements: {
      reference: virtualEl as any,
    },
    middleware: [flip(), shift({ padding: 8 })],
  });

  const [submenuAnchor, setSubmenuAnchor] = useState<HTMLElement | null>(null);

  const { refs: subRefs, floatingStyles: subStyles } = useFloating({
    placement: "right-start",
    elements: {
      reference: submenuAnchor,
    },
    middleware: [flip(), shift({ padding: 8 }), offset(2)],
  });

  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const [openSubmenuIdx, setOpenSubmenuIdx] = useState<number | null>(null);
  const [submenuHighlightedIdx, setSubmenuHighlightedIdx] = useState<number>(-1);

  const actionableIndices = React.useMemo(
    () => items.map((item, i) => ({ item, i })).filter(({ item }) => !item.isSeparator && !item.disabled).map(({ i }) => i),
    [items],
  );

  // Close on click outside + keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const mainEl = mainRefs.floating.current;
      const subEl = subRefs.floating.current;
      if (
        (mainEl && mainEl.contains(target)) ||
        (subEl && subEl.contains(target))
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (openSubmenuIdx !== null) {
          setOpenSubmenuIdx(null);
          setSubmenuHighlightedIdx(-1);
        } else {
          onClose();
        }
        return;
      }

      // If a submenu is open, handle its navigation
      if (openSubmenuIdx !== null) {
        const sub = items[openSubmenuIdx]?.submenu;
        if (!sub) return;
        const subActionable = sub.map((s, i) => ({ s, i })).filter(({ s }) => !s.isSeparator && !s.disabled).map(({ i }) => i);

        if (e.key === "ArrowDown") {
          e.preventDefault();
          const curPos = subActionable.indexOf(submenuHighlightedIdx);
          const next = curPos < subActionable.length - 1 ? subActionable[curPos + 1] : subActionable[0];
          setSubmenuHighlightedIdx(next);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const curPos = subActionable.indexOf(submenuHighlightedIdx);
          const prev = curPos > 0 ? subActionable[curPos - 1] : subActionable[subActionable.length - 1];
          setSubmenuHighlightedIdx(prev);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setOpenSubmenuIdx(null);
          setSubmenuHighlightedIdx(-1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (submenuHighlightedIdx >= 0 && submenuHighlightedIdx < sub.length) {
            const subItem = sub[submenuHighlightedIdx];
            if (!subItem.disabled && !subItem.isSeparator) {
              subItem.onClick?.({} as any);
              onClose();
            }
          }
        }
        return;
      }

      // Main menu navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const curPos = actionableIndices.indexOf(highlightedIdx);
        const next = curPos < actionableIndices.length - 1 ? actionableIndices[curPos + 1] : actionableIndices[0];
        setHighlightedIdx(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const curPos = actionableIndices.indexOf(highlightedIdx);
        const prev = curPos > 0 ? actionableIndices[curPos - 1] : actionableIndices[actionableIndices.length - 1];
        setHighlightedIdx(prev);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (highlightedIdx >= 0 && items[highlightedIdx]?.submenu) {
          setOpenSubmenuIdx(highlightedIdx);
          const sub = items[highlightedIdx].submenu!;
          const firstActionable = sub.findIndex((s) => !s.isSeparator && !s.disabled);
          setSubmenuHighlightedIdx(firstActionable >= 0 ? firstActionable : 0);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIdx >= 0 && highlightedIdx < items.length) {
          const item = items[highlightedIdx];
          if (item.submenu) {
            setOpenSubmenuIdx(highlightedIdx);
            const firstActionable = item.submenu.findIndex((s) => !s.isSeparator && !s.disabled);
            setSubmenuHighlightedIdx(firstActionable >= 0 ? firstActionable : 0);
          } else if (!item.disabled && !item.isSeparator) {
            item.onClick?.({} as any);
          }
        }
      }
    };

    // Use a rAF to avoid immediately closing on the contextmenu event itself
    const id = requestAnimationFrame(() => {
      document.addEventListener("mousedown", handleMouseDown, true);
      document.addEventListener("keydown", handleKeyDown, true);
    });

    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose, highlightedIdx, openSubmenuIdx, submenuHighlightedIdx, items, actionableIndices]);

  // Reset highlighted index when menu opens/closes
  useEffect(() => {
    if (!isOpen) {
      setHighlightedIdx(-1);
      setOpenSubmenuIdx(null);
      setSubmenuHighlightedIdx(-1);
    }
  }, [isOpen]);

  if (!isOpen || !position) return null;

  const renderItem = (
    item: MenuItemProps,
    idx: number,
    _isSubmenu: boolean,
    currentHighlighted: number,
    setCurrentHighlighted: (idx: number) => void,
    onItemClick?: () => void,
    onItemMouseEnter?: () => void,
  ) => {
    if (item.isSeparator) {
      return <hr key={idx} className="menu-separator" />;
    }

    const isHighlighted = currentHighlighted === idx;

    return (
      <div
        key={idx}
        role="menuitem"
        data-highlighted={isHighlighted ? "" : undefined}
        data-disabled={item.disabled ? "" : undefined}
        className={cn(
          "menu-item",
          item.variant === "danger" && "danger",
          item.disabled && "disabled",
          item.className,
        )}
        onMouseEnter={() => {
          if (!item.disabled) {
            setCurrentHighlighted(idx);
          }
          onItemMouseEnter?.();
        }}
        onMouseLeave={() => {
          setCurrentHighlighted(-1);
        }}
        onClick={(e) => {
          if (item.disabled) {
            e.preventDefault();
            return;
          }
          item.onClick?.(e as any);
          onItemClick?.();
        }}
      >
        {item.icon && <div className="menu-item-icon">{item.icon}</div>}
        <div className="menu-item-content">
          <div className="menu-item-title">{item.title}</div>
          {item.description && (
            <div className="menu-item-description">{item.description}</div>
          )}
        </div>
        {item.shortcut && (
          <div className="menu-item-shortcut">{item.shortcut}</div>
        )}
      </div>
    );
  };

  const menuContent = (
    <div
      ref={mainRefs.setFloating}
      role="menu"
      className="modal-content menu-container"
      data-state="open"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        ...mainStyles,
        zIndex: "var(--z-modal)" as any,
      }}
    >
      {children && (
        <div style={{ paddingBottom: 0 }}>
          {children}
          <hr
            className="menu-separator"
            style={{ marginBottom: 0, marginTop: "8px" }}
          />
        </div>
      )}

      {items.map((item, idx) =>
        item.submenu ? (
          <div
            key={idx}
            style={{ position: "relative" }}
            onMouseEnter={(e) => {
              setHighlightedIdx(idx);
              setOpenSubmenuIdx(idx);
              setSubmenuHighlightedIdx(-1);
              setSubmenuAnchor(e.currentTarget);
            }}
            onMouseLeave={() => {
              setHighlightedIdx(-1);
              setOpenSubmenuIdx(null);
            }}
          >
            <div
              role="menuitem"
              data-highlighted={highlightedIdx === idx ? "" : undefined}
              data-disabled={item.disabled ? "" : undefined}
              className={cn(
                "menu-item",
                item.variant === "danger" && "danger",
                item.disabled && "disabled",
                item.className,
              )}
            >
              {item.icon && <div className="menu-item-icon">{item.icon}</div>}
              <div className="menu-item-content">
                <div className="menu-item-title">{item.title}</div>
                {item.description && (
                  <div className="menu-item-description">
                    {item.description}
                  </div>
                )}
              </div>
              <div className="submenu-arrow">›</div>
            </div>

            {openSubmenuIdx === idx && (
              <div
                ref={subRefs.setFloating}
                className="submenu menu-container"
                data-state="open"
                style={{
                  ...subStyles,
                  zIndex: "var(--z-modal)" as any,
                }}
              >
                {item.submenu!.map((subItem, subIdx) =>
                  renderItem(
                    subItem,
                    subIdx,
                    true,
                    submenuHighlightedIdx,
                    setSubmenuHighlightedIdx,
                    onClose,
                  ),
                )}
              </div>
            )}
          </div>
        ) : (
          renderItem(item, idx, false, highlightedIdx, setHighlightedIdx, undefined, () => setOpenSubmenuIdx(null))
        ),
      )}
    </div>
  );

  return createPortal(menuContent, document.body);
}
