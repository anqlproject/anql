import * as Popover from "@radix-ui/react-popover";

import { MenuItem, MenuItemProps } from "./MenuItem";

export interface SubMenuProps {
  items: MenuItemProps[];
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  submenuRef?: React.RefObject<HTMLDivElement | null>;
  focusedIndex?: number;
  onItemMouseEnter?: (index: number) => void;
}

export function SubMenu({
  items,
  position,
  isOpen,
  onClose,
  submenuRef,
  focusedIndex,
  onItemMouseEnter,
}: SubMenuProps) {
  const handleMouseEnter = () => { };

  const handleMouseLeave = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Popover.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Popover.Anchor asChild>
        <div style={{ position: 'fixed', left: position.x, top: position.y, width: 0, height: 0, pointerEvents: 'none' }} />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}
          asChild
        >
          <div
            ref={(node) => {
              if (submenuRef && node) {
                (submenuRef as React.RefObject<HTMLDivElement>).current = node;
              }
            }}
            className={"submenu"}
            style={{
              zIndex: 1001
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menu-container">
              {items.map((item, index) => (
                <MenuItem
                  key={index}
                  {...item}
                  className={`${item.className || ""} ${focusedIndex === index ? "focused" : ""}`}
                  onClick={(e) => {
                    item.onClick?.(e);
                  }}
                  onMouseEnter={(e) => {
                    if (item.disabled) return;
                    if (onItemMouseEnter) onItemMouseEnter(index);
                    item.onMouseEnter?.(e);
                  }}
                  onMouseLeave={item.onMouseLeave}
                />
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
