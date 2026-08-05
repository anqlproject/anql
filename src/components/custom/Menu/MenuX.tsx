import "./Menu.css";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import React from "react";

import { cn } from "@/lib/utils";

import { MenuItemProps } from "./MenuItem";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface MenuXProps {
  items: (MenuItemProps & { submenu?: MenuItemProps[] })[];
  isOpen: boolean;
  onClose: () => void;
  position?: MenuPosition;
  direction?: "left" | "top" | "right" | "bottom";
  align?: "center" | "start" | "end";
  overFlowOption?: {
    height: string;
    minHeight: number;
    overflow: "hidden" | "scroll";
  };
  collisionPadding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  children?: React.ReactNode; // For extra content inside the menu (like a search bar)
  trigger?: React.ReactNode; // The button that opens the menu (for automatic anchoring)
}

export function MenuX({
  items,
  isOpen,
  onClose,
  position,
  direction = "right",
  align,
  overFlowOption,
  collisionPadding,
  children,
  trigger,
}: MenuXProps) {
  if (!isOpen && !trigger) return null;

  const overflowStyle = overFlowOption
    ? {
      maxHeight: overFlowOption.height,
      minHeight: overFlowOption.minHeight,
      overflowY: overFlowOption.overflow === "scroll" ? "auto" : "hidden",
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
              left: position?.x ?? 0,
              top: position?.y ?? 0,
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
          style={overflowStyle as React.CSSProperties}
          loop={true}
          collisionPadding={collisionPadding}
          onCloseAutoFocus={(e) => e.preventDefault()}
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
