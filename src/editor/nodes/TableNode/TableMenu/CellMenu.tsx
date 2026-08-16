import './TableMenu.css';

import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import * as Popover from '@radix-ui/react-popover';
import { ClipboardCopy, ClipboardPaste, ClipboardX } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";

async function safeReadText(): Promise<string> {
  try {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
    const text = await readText();
    return text || '';
  } catch {
    return await navigator.clipboard.readText();
  }
}

interface CellMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  activeInput: HTMLInputElement | HTMLTextAreaElement | null;
}

export function CellMenu({ isOpen, onClose, position, activeInput }: CellMenuProps) {
  const { t } = useTranslation();
  const isEditable = useLexicalEditable();
  const { isMac } = useGlobalStore(useShallow((state) => ({ isMac: state.isMac, dynamicState: state.dynamicState })));

  const handleCopy = () => {
    if (activeInput) {
      activeInput.focus();
      document.execCommand("copy");
    }
    onClose();
  };

  const handleCut = () => {
    if (activeInput) {
      activeInput.focus();
      document.execCommand("cut");
    }
    onClose();
  };

  const handlePaste = async () => {
    if (activeInput) {
      activeInput.focus();
      await new Promise(resolve => setTimeout(resolve, 10));
      try {
        const text = await safeReadText();

        // Create a DataTransfer object with the clipboard data
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);

        // Create and dispatch a paste event with the clipboard data
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        });

        // Dispatch the paste event on the input
        const cancelled = !activeInput.dispatchEvent(pasteEvent);

        // If the event wasn't cancelled (no handler prevented default), fallback to manual insertion
        if (!cancelled) {
          // Try using execCommand for native undo history (Cmd+Z / Ctrl+Z support)
          const success = document.execCommand('insertText', false, text);

          if (!success) {
            const start = activeInput.selectionStart || 0;
            const end = activeInput.selectionEnd || 0;
            const currentValue = activeInput.value;
            const newValue =
              currentValue.substring(0, start) +
              text +
              currentValue.substring(end);

            // Use native setter to bypass React's controlled input
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value"
            )?.set;
            nativeInputValueSetter?.call(activeInput, newValue);

            // Trigger React's change detection
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            activeInput.dispatchEvent(inputEvent);
            activeInput.dispatchEvent(changeEvent);

            activeInput.setSelectionRange(start + text.length, start + text.length);
          }
        }
      } catch (err) {
        console.error("Failed to paste:", err);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Popover.Root open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      <Popover.Anchor asChild>
        <div
          style={{
            position: "fixed",
            left: position.x,
            top: position.y,
            width: 0,
            height: 0,
            pointerEvents: "none",
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="table-row-popover-content"
          align="start"
          sideOffset={5}
          onInteractOutside={() => {
            onClose();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          style={{ minWidth: '200px' }}
        >
          <button 
            onPointerDown={(e) => e.preventDefault()}
            onClick={handleCopy} 
            className="table-menu-item" 
            disabled={!activeInput || activeInput.selectionStart === activeInput.selectionEnd}
            style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardCopy className="w-4 h-4" />
              <span>{t('CONTEXT_MENU.copy')}</span>
            </div>
            <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>{isMac ? "⌘C" : "Ctrl+C"}</span>
          </button>
          
          {isEditable && (
            <>
              <button 
                onPointerDown={(e) => e.preventDefault()}
                onClick={handleCut} 
                className="table-menu-item" 
                disabled={!activeInput || activeInput.selectionStart === activeInput.selectionEnd}
                style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardX className="w-4 h-4" />
                  <span>{t('CONTEXT_MENU.cut')}</span>
                </div>
                <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>{isMac ? "⌘X" : "Ctrl+X"}</span>
              </button>

              <button
                onPointerDown={(e) => e.preventDefault()}
                onClick={handlePaste}
                className="table-menu-item"
                style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardPaste className="w-4 h-4" />
                  <span>{t('CONTEXT_MENU.paste')}</span>
                </div>
                <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>{isMac ? "⌘V" : "Ctrl+V"}</span>
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
