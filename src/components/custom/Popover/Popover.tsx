import './Popover.css';

import {
  autoUpdate,
  FloatingPortal,
  offset as floatingOffset,
  Placement,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  VirtualElement,
} from '@floating-ui/react';
import { ReactNode, useEffect } from 'react';


export interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  placement?: Placement;
  offsetDistance?: number;
  width?: string | number;
  disableClickOutside?: boolean;
  virtualReference?: VirtualElement | null;
  anchorElem?: HTMLElement | null;
}

export function Popover({
  isOpen,
  onClose,
  children,
  placement = 'bottom',
  offsetDistance = 10,
  width = 'auto',
  disableClickOutside = false,
  virtualReference,
  anchorElem,
}: PopoverProps) {
  const { refs, floatingStyles, context, update } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    placement,
    whileElementsMounted: virtualReference ? undefined : autoUpdate, // Disable autoUpdate for virtual elements
    middleware: [
      floatingOffset(offsetDistance),
      shift({ padding: 8 }),
    ],
  });

  useEffect(() => {
    if (virtualReference) {
      refs.setReference(virtualReference);
    } else if (anchorElem) {
      refs.setReference(anchorElem);
    }
  }, [virtualReference, anchorElem, refs]);

  // Manually trigger update on scroll for virtual elements
  useEffect(() => {
    if (!virtualReference || !isOpen) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        update();
        rafId = null;
      });
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [virtualReference, isOpen, update]);

  const dismiss = useDismiss(context, {
    enabled: !disableClickOutside,
    outsidePressEvent: 'pointerdown',
  });

  const role = useRole(context);

  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!isOpen) return null;

  return (
    <FloatingPortal>
      <div
        className="custom-popover-container"
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          width,
        }}
        {...getFloatingProps()}
      >
        {children}
      </div>
    </FloatingPortal>
  );
}
