// src/components/ui/menu/MenuItem.tsx
import { forwardRef,ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface MenuItemProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  onClick?: (e: React.MouseEvent) => void;
  variant?: "default" | "danger";
  hasSubmenu?: boolean;
  disabled?: boolean;
  className?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  isSeparator?: boolean;
  shortcut?: string;
}

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
  (
    {
      icon,
      title,
      description,
      onClick,
      variant = "default",
      hasSubmenu = false,
      disabled = false,
      className,
      onMouseEnter,
      onMouseLeave,
      isSeparator = false,
      shortcut,
      ...props
    }: MenuItemProps & { submenu?: unknown; style?: React.CSSProperties },
    ref
  ) => {
    if (isSeparator) {
      return <div className="menu-separator" ref={ref} {...props} />;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "menu-item",
          variant === "danger" && "danger",
          disabled && "disabled",
          className
        )}
        style={props.style}
        onPointerDown={(e) => {
          if (!disabled) {
            // e.preventDefault(); // Sometimes prevents focus loss
            onClick?.(e as unknown as React.MouseEvent);
          }
        }}
        onClick={(e) => {
          // Keep onClick for keyboard interactions if needed, or prevent default
          if (!disabled) {
            e.preventDefault();
          }
        }}
        onMouseMove={(e) => {
          if (Math.abs(e.nativeEvent.movementX) > 0 || Math.abs(e.nativeEvent.movementY) > 0) {
            onMouseEnter?.(e);
          }
        }}
        onMouseLeave={onMouseLeave}
        {...props}
      >
        {icon && <div className="menu-item-icon">{icon}</div>}
        <div className="menu-item-content">
          <div className="menu-item-title">{title}</div>
          {description && (
            <div className="menu-item-description">{description}</div>
          )}
        </div>
        {shortcut && <div className="menu-item-shortcut">{shortcut}</div>}
        {hasSubmenu && <div className="submenu-arrow">›</div>}
      </div>
    );
  }
);

MenuItem.displayName = "MenuItem";