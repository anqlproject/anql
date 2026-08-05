import React,{ useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';


interface DropDownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DropDown({ trigger, children, className = '', contentClassName = '' }: DropDownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  const toggleDropdown = useCallback(() => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setIsOpen(!isOpen);
  }, [isOpen]);

  return (
    <div ref={triggerRef} className={`dropdown-container ${className}`} style={{ position: 'relative' }}>
      <div
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleDropdown}
        style={{ cursor: 'pointer' }}
      >
        {trigger}
      </div>
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`dropdown-content ${contentClassName}`}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

interface DropDownItemProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function DropDownItem({ onClick, children, className = '', style }: DropDownItemProps) {
  return (
    <div
      onClick={onClick}
      className={`dropdown-item ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
