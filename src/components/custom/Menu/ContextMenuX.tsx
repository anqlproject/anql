import "./Menu.css";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React, { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { MenuItemProps } from "./MenuItem";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuXProps {
  items: (MenuItemProps & { submenu?: MenuItemProps[] })[];
  isOpen: boolean;
  onClose: () => void;
  position?: MenuPosition;
  direction?: "left" | "top" | "right" | "bottom";
  align?: "center" | "start" | "end";
  menuRef?: React.RefObject<HTMLElement | null> | null;
  editorRef?: React.RefObject<HTMLElement | null> | null;
  overFlowOption?: {
    height: string;
    minHeight: number;
    overflow: "hidden" | "scroll";
  };
  children?: React.ReactNode;
  trigger?: React.ReactNode;
}

/**
 * ContextMenuX — A drop-in replacement for ContextMenu built on
 * @radix-ui/react-dropdown-menu instead of Popover.
 *
 * Radix DropdownMenu gives us for free:
 *  - Full keyboard navigation (↑↓ Enter Esc)
 *  - Submenu safe-area triangles
 *  - Focus trapping
 *  - WAI-ARIA roles
 *  - Scroll locking
 */
export function ContextMenuX({
  items,
  isOpen,
  onClose,
  position,
  direction = "right",
  align,
  overFlowOption,
  children,
  trigger,
}: ContextMenuXProps) {
  const [anchorPos, setAnchorPos] = useState({ x: 0, y: 0 });

  const getAnchorPos = useCallback(() => {
    return { x: position?.x ?? 0, y: position?.y ?? 0 };
  }, [position]);

  useEffect(() => {
    if (isOpen) {
      setAnchorPos(getAnchorPos());
    }
  }, [isOpen, getAnchorPos]);

  if (!isOpen && !trigger) return null;

  const overflowStyle = overFlowOption
    ? {
        maxHeight: overFlowOption.height,
        overflowY: overFlowOption.overflow === "scroll" ? ("auto" as const) : ("hidden" as const),
        overflowX: "hidden" as const,
        minHeight: overFlowOption.minHeight,
      }
    : {};

  const renderItem = (item: MenuItemProps, idx: number) => {
    if (item.isSeparator) {
      return <DropdownMenu.Separator key={idx} className="menu-separator" />;
    }

    return (
      <DropdownMenu.Item
        key={idx}
        disabled={item.disabled}
        className={cn("menu-item", item.variant === "danger" && "danger", item.className)}
        onClick={(e) => {
          if (item.disabled) {
            e.preventDefault();
            return;
          }
          item.onClick?.(e as any);
        }}
      >
        {item.icon && <div className="menu-item-icon">{item.icon}</div>}
        <div className="menu-item-content">
          <div className="menu-item-title">{item.title}</div>
          {item.description && (
            <div className="menu-item-description">{item.description}</div>
          )}
        </div>
        {item.shortcut && <div className="menu-item-shortcut">{item.shortcut}</div>}
      </DropdownMenu.Item>
    );
  };

  return (
    <DropdownMenu.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenu.Trigger asChild>
        {trigger ? (
          trigger
        ) : (
          <div
            style={{
              position: "fixed",
              left: anchorPos.x,
              top: anchorPos.y,
              width: 0,
              height: 0,
              pointerEvents: "none",
            }}
          />
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="modal-content menu-container"
          side={direction}
          align={align || (direction === "top" || direction === "bottom" ? "end" : "start")}
          sideOffset={5}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={overflowStyle as React.CSSProperties}
          loop={true}
        >
          {children && (
            <div style={{ paddingBottom: 0 }}>
              {children}
              <DropdownMenu.Separator className="menu-separator" style={{ marginBottom: 0, marginTop: "8px" }} />
            </div>
          )}

          {items.map((item, idx) =>
            item.submenu ? (
              <DropdownMenu.Sub key={idx}>
                <DropdownMenu.SubTrigger
                  disabled={item.disabled}
                  className={cn("menu-item", item.variant === "danger" && "danger", item.className)}
                >
                  {item.icon && <div className="menu-item-icon">{item.icon}</div>}
                  <div className="menu-item-content">
                    <div className="menu-item-title">{item.title}</div>
                    {item.description && (
                      <div className="menu-item-description">{item.description}</div>
                    )}
                  </div>
                  <div className="submenu-arrow">›</div>
                </DropdownMenu.SubTrigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    className="submenu menu-container"
                    sideOffset={2}
                    alignOffset={-5}
                    loop={true}
                  >
                    {item.submenu.map((subItem, subIdx) => renderItem(subItem, subIdx))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            ) : (
              renderItem(item, idx)
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
