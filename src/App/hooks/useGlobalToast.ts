import { ReactNode } from 'react';
import { useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: ReactNode;
  type: ToastType;
  duration?: number;
  persistent?: boolean; // If true, toast won't auto-dismiss
}

let globalToasts: Toast[] = [];
let updateTrigger: (() => void) | null = null;

export function useGlobalToast() {
  const showToast = (message: ReactNode, type: ToastType = 'success', duration: number = 3000, persistent: boolean = false): string => {
    const id = Date.now().toString();
    const newToast: Toast = { id, message, type, duration, persistent };
    globalToasts = [...globalToasts, newToast];
    updateTrigger?.();

    if (!persistent) {
      setTimeout(() => {
        globalToasts = globalToasts.filter(t => t.id !== id);
        updateTrigger?.();
      }, duration);
    }

    return id;
  };

  const updateToast = (id: string, message: ReactNode, options?: { persistent?: boolean; duration?: number }) => {
    const toastIndex = globalToasts.findIndex(t => t.id === id);
    if (toastIndex !== -1) {
      globalToasts = [...globalToasts];
      const updatedToast = { ...globalToasts[toastIndex], message };
      if (options?.persistent !== undefined) updatedToast.persistent = options.persistent;
      if (options?.duration !== undefined) updatedToast.duration = options.duration;
      globalToasts[toastIndex] = updatedToast;
      updateTrigger?.();

      // If toast is no longer persistent and has a duration, schedule auto-dismiss
      if (!updatedToast.persistent && updatedToast.duration && updatedToast.duration > 0) {
        setTimeout(() => {
          globalToasts = globalToasts.filter(t => t.id !== id);
          updateTrigger?.();
        }, updatedToast.duration);
      }
    }
  };

  const dismissToast = (id: string) => {
    globalToasts = globalToasts.filter(t => t.id !== id);
    updateTrigger?.();
  };

  return { showToast, updateToast, dismissToast };
}

export function useToastContainer() {
  const [, setTick] = useState(0);

  useState(() => {
    updateTrigger = () => setTick(t => t + 1);
    return () => {
      updateTrigger = null;
    };
  });

  return globalToasts;
}

