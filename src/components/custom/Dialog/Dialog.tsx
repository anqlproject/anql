import "./dialog.css";

import { XIcon } from "lucide-react";
import React , { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";


export type DialogMode = "urgent" | "request" | "info";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: React.ReactNode;
  showCloseButton?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  position?: "center" | "top" | "bottom";
  className?: string;
  mode?: DialogMode;
  leftButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
  };
  rightButton?: {
    text: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: "primary" | "danger";
  };
  okButton?: {
    text: string;
    onClick: () => void;
  };
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  showCloseButton = true,
  size = "sm",
  position = "center",
  className,
  mode = "request",
  leftButton,
  rightButton,
  okButton,
}: DialogProps) {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [modalContentDimensions, setModalContentDimensions] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (modalContentRef.current) {
        const rect = modalContentRef.current.getBoundingClientRect();
        setModalContentDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();

    let resizeObserver: ResizeObserver;
    if (modalContentRef.current) {
      resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(modalContentRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (modalContentRef.current) {
      modalContentRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="overlay-dialog" onClick={onClose}>
      <div
        ref={modalContentRef}
        tabIndex={0} // Ajout de tabindex pour la gestion du focus
        className={`modal-overlay-dialog ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={modalContentRef}
          className={`modal-content-dialog modal-${size} modal-${position}`}
          style={{
            opacity: modalContentDimensions.width > 0 ? 1 : 0,
            transition: "opacity 0.3s ease-in-out", // Add animation for opacity
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || showCloseButton) && (
            <div className="dialog-header">
              {title && <DialogTitle>{title}</DialogTitle>}
              {showCloseButton && (
                <button
                  className="dialog-close"
                  onClick={onClose}
                  aria-label="Close dialog"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          )}
          
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}

          <DialogFooter>
            {mode === "info" ? (
              <button
                className="dialog-button primary"
                onClick={okButton?.onClick || onClose}
              >
                {okButton?.text || "OK"}
              </button>
            ) : (
              <>
                {leftButton && (
                  <button
                    className="dialog-button cancel"
                    onClick={leftButton.onClick}
                    disabled={leftButton.disabled}
                  >
                    {leftButton.text}
                  </button>
                )}
                {rightButton && (
                  <button
                    className={`dialog-button ${rightButton.variant === "danger" ? "danger" : "primary"}`}
                    onClick={rightButton.onClick}
                    disabled={rightButton.disabled}
                  >
                    {rightButton.text}
                  </button>
                )}
              </>
            )}
          </DialogFooter>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`dialog-header ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`dialog-title ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export function DialogDescription({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`dialog-description ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export function DialogContent({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`dialog-content ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={`dialog-footer ${className || ""}`} {...props}>
      {children}
    </div>
  );
}