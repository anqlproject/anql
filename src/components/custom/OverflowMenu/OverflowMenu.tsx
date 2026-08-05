import "./OverflowMenu.css";

import { useEffect, useMemo, useRef, useState } from "react";

import { ContextMenu } from "@/components/custom/Menu/ContextMenu";
import { MenuPosition } from "@/components/custom/Menu/Menu";
import { MenuItemProps } from "@/components/custom/Menu/MenuItem";


export interface OverflowMenuProps {
  items: (MenuItemProps & { submenu?: MenuItemProps[] })[];
  isOpen: boolean;
  onClose: () => void;
  position?: MenuPosition;
  direction: "left" | "top" | "right" | "bottom";
  menuRef: React.RefObject<HTMLElement | null> | null;
  editorRef?: React.RefObject<HTMLElement | null> | null;
}

export function OverflowMenu({
  items,
  isOpen,
  onClose,
  position,
  direction,
  menuRef,
  editorRef,
}: OverflowMenuProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setFilterQuery("");
    } else {
      // 150 ms because menu focus in 100ms so we need focus after
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!filterQuery) return items;
    return items.filter(item =>
      item.title?.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(filterQuery.toLowerCase())
    );
  }, [items, filterQuery]);

  const emptyItem: MenuItemProps = {
    title: "" as unknown as string,
    disabled: true,
  };

  const menuItems = filteredItems.length === 0 ? [emptyItem] : filteredItems;

  return (
    <div>
      <ContextMenu
        items={menuItems as MenuItemProps[]}
        isOpen={isOpen}
        onClose={onClose}
        position={position}
        direction={direction}
        menuRef={menuRef}
        editorRef={editorRef}
        overFlowOption={{ height: "37.5vh", minHeight: 200, overflow: "scroll" }}
      >
        <div style={{ padding: "0 4px" }}>
          <input
            className="overflow-menu-search-input"
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Filtrer..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.stopPropagation();
              }
            }}
          />
        </div>
      </ContextMenu>
    </div>
  );
}