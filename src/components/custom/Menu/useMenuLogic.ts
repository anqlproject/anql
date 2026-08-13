import { useEffect, useRef, useState } from "react";

import { MenuItemProps } from "./MenuItem";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface UseMenuLogicProps {
  items: (MenuItemProps & { submenu?: MenuItemProps[] })[];
  isOpen: boolean;
  onClose: () => void;
  position?: MenuPosition;
  menuRef?: React.RefObject<HTMLElement | null> | null;
  editorRef?: React.RefObject<HTMLElement | null> | null;
  getAnchorPos: () => { x: number; y: number };
}

export function useMenuLogic({
  items,
  isOpen,
  onClose,
  position,
  menuRef,
  editorRef,
  getAnchorPos,
}: UseMenuLogicProps) {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const activeMenuItemRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<{
    index: number;
    position: { x: number; y: number };
  } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [submenuFocusedIndex, setSubmenuFocusedIndex] = useState<number>(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastFocusedIndexRef = useRef<number>(0);

  const [anchorPos, setAnchorPos] = useState(getAnchorPos());

  // deactive the scroll - scoped to editor container if available
  useEffect(() => {
    const preventScroll = (e: Event) => {
      if (isOpen) {
        e.preventDefault();
      }
    };

    const scrollContainer = editorRef?.current || document;

    if (isOpen) {
      scrollContainer.addEventListener("wheel", preventScroll, { passive: false });
      scrollContainer.addEventListener("touchmove", preventScroll, { passive: false });
      scrollContainer.addEventListener("keydown", (e: Event) => {
        const keyboardEvent = e as KeyboardEvent;
        if (
          isOpen &&
          (keyboardEvent.key === "ArrowUp" ||
            keyboardEvent.key === "ArrowDown" ||
            keyboardEvent.key === "PageUp" ||
            keyboardEvent.key === "PageDown" ||
            keyboardEvent.key === "Space")
        ) {
          e.preventDefault();
        }
      });
    }

    return () => {
      scrollContainer.removeEventListener("wheel", preventScroll);
      scrollContainer.removeEventListener("touchmove", preventScroll);
    };
  }, [isOpen, editorRef]);

  useEffect(() => {
    if (focusedIndex !== -1) {
      lastFocusedIndexRef.current = focusedIndex;
    }
  }, [focusedIndex]);

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [focusedIndex]);

  // Deselect focused item when mouse leaves the menu
  useEffect(() => {
    if (!isOpen) return;

    function handleGlobalMouseMove(e: MouseEvent) {
      if (activeSubmenu) return;

      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target as Node)
      ) {
        setFocusedIndex((prev) => {
          if (prev !== -1) return -1;
          return prev;
        });
      }
    }

    document.addEventListener("mousemove", handleGlobalMouseMove);
    return () =>
      document.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [isOpen, activeSubmenu]);

  // Update menu position on window resize and scroll
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const newPos = getAnchorPos();
      setAnchorPos((prev) => {
        if (prev.x === newPos.x && prev.y === newPos.y) return prev;
        return newPos;
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, position, menuRef, getAnchorPos]);

  // Update submenu position on window resize
  useEffect(() => {
    function handleResize() {
      if (activeSubmenu && activeMenuItemRef.current) {
        const rect = activeMenuItemRef.current.getBoundingClientRect();
        const newPosition = {
          x: rect.right + 5,
          y: rect.top,
        };
        setActiveSubmenu((prev) =>
          prev ? { ...prev, position: newPosition } : null,
        );
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeSubmenu]);

  const handleMenuItemMouseEnter = (itemIndex: number, e: React.MouseEvent) => {
    const item = items[itemIndex];
    if (item.disabled) return;
    setFocusedIndex(itemIndex);
    if (item.submenu && !item.isSeparator) {
      activeMenuItemRef.current = e.currentTarget as HTMLDivElement;
      const rect = e.currentTarget.getBoundingClientRect();
      const newPosition = {
        x: rect.right + 5,
        y: rect.top,
      };
      setActiveSubmenu({ index: itemIndex, position: newPosition });
      setSubmenuFocusedIndex(-1);
    } else {
      setActiveSubmenu(null);
      activeMenuItemRef.current = null;
    }
  };

  const handleMenuItemMouseLeave = () => { };

  const handleCloseSubmenu = () => {
    setActiveSubmenu(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submenu navigation
    if (activeSubmenu !== null && submenuFocusedIndex !== -1) {
      const subItems = items[activeSubmenu.index].submenu!;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSubmenuFocusedIndex((prev) => {
          let next = prev + 1;
          while (
            next < subItems.length &&
            (subItems[next].isSeparator || subItems[next].disabled)
          )
            next++;
          if (next >= subItems.length) {
            next = 0;
            while (
              next < subItems.length &&
              (subItems[next].isSeparator || subItems[next].disabled)
            )
              next++;
          }
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSubmenuFocusedIndex((prev) => {
          let next = prev - 1;
          while (
            next >= 0 &&
            (subItems[next].isSeparator || subItems[next].disabled)
          )
            next--;
          if (next < 0) {
            next = subItems.length - 1;
            while (
              next >= 0 &&
              (subItems[next].isSeparator || subItems[next].disabled)
            )
              next--;
          }
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveSubmenu(null);
        setSubmenuFocusedIndex(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (submenuFocusedIndex >= 0 && submenuFocusedIndex < subItems.length) {
          const item = subItems[submenuFocusedIndex];
          if (!item.isSeparator && item.onClick) {

            item.onClick(e as any);
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveSubmenu(null);
        setSubmenuFocusedIndex(-1);
      }
      return;
    }

    // Main menu navigation
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSubmenu(null);
      setFocusedIndex((prev) => {
        let next = prev + 1;
        while (
          next < items.length &&
          (items[next].isSeparator || items[next].disabled)
        )
          next++;
        if (next >= items.length) {
          next = 0;
          while (
            next < items.length &&
            (items[next].isSeparator || items[next].disabled)
          )
            next++;
        }
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSubmenu(null);
      setFocusedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && (items[next].isSeparator || items[next].disabled))
          next--;
        if (next < 0) {
          next = items.length - 1;
          while (next >= 0 && (items[next].isSeparator || items[next].disabled))
            next--;
        }
        return next;
      });
    } else if (e.key === "ArrowRight") {
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        const item = items[focusedIndex];
        if (item.submenu) {
          e.preventDefault();
          const itemDOM = itemRefs.current[focusedIndex];
          if (itemDOM) {
            const rect = itemDOM.getBoundingClientRect();
            setActiveSubmenu({
              index: focusedIndex,
              position: { x: rect.right + 5, y: rect.top },
            });
            setSubmenuFocusedIndex(0);
          }
        }
      }
    } else if (e.key === "Enter") {
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        e.preventDefault();
        const item = items[focusedIndex];
        if (!item.isSeparator) {
          if (item.submenu) {
            const itemDOM = itemRefs.current[focusedIndex];
            if (itemDOM) {
              const rect = itemDOM.getBoundingClientRect();
              setActiveSubmenu({
                index: focusedIndex,
                position: { x: rect.right + 5, y: rect.top },
              });
              setSubmenuFocusedIndex(0);
            }
          } else if (item.onClick) {

            item.onClick(e as any);
          }
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return {
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
  };
}
