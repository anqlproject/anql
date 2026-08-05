import './Toast.css';

import { Check, Info, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';


type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: ReactNode;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  persistent?: boolean;
}

export default function Toast({ message, type = 'success', duration = 3000, onClose, persistent = false }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    if (!persistent) {
      const fadeOutTimer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setIsVisible(false);
          onClose?.();
        }, 300);
      }, duration - 300);

      return () => clearTimeout(fadeOutTimer);
    }
  }, [duration, onClose, persistent]);

  const handleClose = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  const icons = {
    success: <Check className="w-4 h-4 mr-2" />,
    error: <X className="w-4 h-4 mr-2" />,
    info: <Info className="w-4 h-4 mr-2" />
  };

  return (
    <div className={`toast toast-${type} ${isFadingOut ? 'fade-out' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        {icons[type]}
        <span className="toast-message">{message}</span>
      </div>
      <button 
        onClick={handleClose}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          cursor: 'pointer', 
          padding: 0, 
          marginLeft: '12px', 
          display: 'flex', 
          alignItems: 'center',
          color: 'inherit', 
          opacity: 0.7 
        }}
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
