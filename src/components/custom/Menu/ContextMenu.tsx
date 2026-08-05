// src/components/custom/Menu/ContextMenu.tsx
import "./Menu.css";

import * as Popover from "@radix-ui/react-popover";
import { useCallback } from "react";

import { MenuItem, MenuItemProps } from "./MenuItem";
import { SubMenu } from "./SubMenu";
import { MenuPosition,useMenuLogic } from "./useMenuLogic";

export interface ContextMenuProps {
  items: (MenuItemProps & { submenu?: MenuItemProps[] })[];
  isOpen: boolean;
  onClose: () => void;
  position?: MenuPosition;
  direction: "left" | "top" | "right" | "bottom";
  align?: "center";
  menuRef?: React.RefObject<HTMLElement | null> | null;
  editorRef?: React.RefObject<HTMLElement | null> | null;
  overFlowOption?: {
    height: string;
    minHeight: number;
    overflow: "hidden" | "scroll";
  };
  children?: React.ReactNode;
  // The button that opens the menu (uses Popover.Trigger for native anchoring)
  trigger?: React.ReactNode;
}

export function ContextMenu({
  items,
  isOpen,
  onClose,
  position,
  direction,
  align,
  menuRef,
  editorRef,
  overFlowOption,
  children,
  trigger,
}: ContextMenuProps) {
  const posX = position?.x;
  const posY = position?.y;

  const getAnchorPos = useCallback(() => {
    const x = posX ? posX + 10 : 10;
    const y = posY ? posY + 20 : 20;
    return { x, y };
  }, [posX, posY]);

  const {
    modalContentRef,
    activeMenuItemRef,
    submenuRef,
    menuContainerRef,
    activeSubmenu,
    setActiveSubmenu,
    focusedIndex,
    setFocusedIndex,
    submenuFocusedIndex,
    setSubmenuFocusedIndex,
    itemRefs,
    lastFocusedIndexRef,
    anchorPos,
    handleMenuItemMouseEnter,
    handleMenuItemMouseLeave,
    handleCloseSubmenu,
    handleKeyDown,
  } = useMenuLogic({
    items,
    isOpen,
    onClose,
    position,
    menuRef,
    editorRef,
    getAnchorPos,
  });


  if (!isOpen) return null;

  const overflowStyle = overFlowOption
    ? {
      height: overFlowOption.height,
      overflowY: (overFlowOption.overflow === "scroll" ? "auto" : overFlowOption.overflow) as "auto" | "hidden",
      overflowX: "hidden" as const,
      minHeight: overFlowOption.minHeight,
    }
    : {};

  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      modal={false}
    >
      {trigger ? (
        <Popover.Trigger asChild>
          {trigger}
        </Popover.Trigger>
      ) : (
        <Popover.Anchor asChild>
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
        </Popover.Anchor>
      )}
      <Popover.Portal>
        <Popover.Content
          side={
            direction === "left"
              ? "left"
              : direction === "top"
                ? "top"
                : direction === "bottom"
                  ? "bottom"
                  : "right"
          }
          align={align || (direction === "top" || direction === "bottom" ? "end" : "start")}
          sideOffset={5}
          onInteractOutside={(e) => {
            // Check if click was inside submenu, if so, don't close
            const target = e.target as Node;
            if (submenuRef.current && submenuRef.current.contains(target)) {
              e.preventDefault();
            }
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => {
              modalContentRef.current?.focus();
            }, 100);
          }}
          onWheel={(e) => {
            if (overFlowOption) {
              e.stopPropagation();
            }
          }}
          asChild
        >
          <div
            ref={modalContentRef}
            className={"modal-content"}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            onMouseLeave={() => {
              if (!activeSubmenu) {
                setFocusedIndex(-1);
              }
            }}
            onMouseEnter={() => {
              if (focusedIndex === -1 && lastFocusedIndexRef.current >= 0) {
                setFocusedIndex(lastFocusedIndexRef.current);
              }
            }}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              onClose();
            }}
          >
            {children && (
              <div
                className="menu-container"
                style={{
                  paddingBottom: 0,
                }}
              >
                {children}
                <div
                  className="menu-separator"
                  style={{ marginBottom: 0, marginTop: "8px" }}
                />
              </div>
            )}
            <div
              className="menu-container"
              ref={menuContainerRef}
              style={{
                outline: "none",
                ...overflowStyle,
                ...(children ? { paddingTop: 0 } : {}),
              }}
            >
              {items.map((item, index) => (
                <MenuItem
                  key={index}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                    if (activeSubmenu?.index === index) {
                      activeMenuItemRef.current = node;
                    }
                  }}
                  {...item}
                  className={`${item.className || ""} ${focusedIndex === index && !activeSubmenu ? "focused" : activeSubmenu?.index === index ? "focused" : ""}`}
                  hasSubmenu={!!item.submenu}
                  onClick={(e: React.MouseEvent) => {
                    item.onClick?.(e);

                    if (activeSubmenu) {
                      setActiveSubmenu(null);
                    } else {
                      handleMenuItemMouseEnter(index, e);
                    }
                  }}
                  onMouseEnter={(e: React.MouseEvent) =>
                    handleMenuItemMouseEnter(index, e)
                  }
                  onMouseLeave={handleMenuItemMouseLeave}
                />
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>

      {activeSubmenu && items[activeSubmenu.index]?.submenu && (
        <SubMenu
          items={items[activeSubmenu.index].submenu!}
          position={activeSubmenu.position}
          isOpen={true}
          onClose={handleCloseSubmenu}
          submenuRef={submenuRef}
          focusedIndex={submenuFocusedIndex}
          onItemMouseEnter={(index) => setSubmenuFocusedIndex(index)}
        />
      )}
    </Popover.Root>
  );
}
