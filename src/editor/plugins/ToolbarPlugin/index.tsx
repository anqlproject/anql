import './index.css';

import { autoUpdate, flip, FloatingPortal,offset, shift, useFloating, VirtualElement } from '@floating-ui/react';
import { $isCodeNode } from '@lexical/code';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { $getSelection, $isRangeSelection, $setSelection, BaseSelection, FORMAT_TEXT_COMMAND, TextFormatType } from 'lexical';
import { Bold, CaseLower, CaseSensitive, CaseUpper, ChevronDown, Eraser, Highlighter, Italic, PaintBucket, Palette, Strikethrough, Subscript, Superscript, Underline } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Popover } from '@/components/custom/Popover/Popover';
import { Button } from '@/components/ui/button';
import { clearFormatting as clearFormattingUtil } from '@/editor/LexicalUtils/formatUtils';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon, label, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent text selection loss
      }}
      onClick={onClick}
      className={`popup-item spaced ${isActive ? 'active' : ''}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function NativeColorPicker({
  color,
  onChange,
  icon: Icon,
  title
}: {
  color: string;
  onChange: (color: string) => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button className="popup-item spaced" title={title} style={{ position: 'relative', overflow: 'hidden' }} type="button">
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {Icon}
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '2px',
            backgroundColor: color,
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: color === '#ffffff' ? '0 0 0 1px rgba(0,0,0,0.1)' : 'none'
          }}
        />
      </div>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          opacity: 0,
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer'
        }}
        onMouseDown={(e) => {
          // Prevent editor focus loss when clicking on color picker
          e.stopPropagation();
        }}
      />
    </button>
  );
}

function ToolbarDropdown({
  value,
  options,
  onSelect,
  isOpen,
  onToggle,
  isFontFamily
}: {
  value: string;
  options: string[];
  onSelect: (val: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  isFontFamily?: boolean;
}) {
  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    onOpenChange: () => {},
    middleware: [offset(4), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    onToggle();
  };

  return (
    <div className="toolbar-dropdown-container" ref={refs.setReference}>
      <Button
        variant="ghost"
        size="sm"
        className="popup-item spaced"
        style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'auto', padding: '0 8px' }}
        onMouseDown={handleToggle}
      >
        <span className="text">{value}</span>
        <ChevronDown size={14} />
      </Button>
      {isOpen && (
        <FloatingPortal>
          <div 
            ref={refs.setFloating}
            style={{ 
              ...floatingStyles, 
              zIndex: 999999,
              maxHeight: '250px', 
              overflowY: 'auto' 
            }}
            className="toolbar-dropdown-content z-50"
          >
            {options.map((opt) => (
              <div
                key={opt}
                role="menuitem"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent focus loss
                  e.stopPropagation();
                  onSelect(opt);
                }}
                className="relative flex select-none items-center text-sm outline-none"
                style={{ fontFamily: isFontFamily ? opt : 'inherit' }}
              >
                {opt}
              </div>
            ))}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

const FONT_FAMILY_OPTIONS = [
  'Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana'
];

const FONT_SIZE_OPTIONS = Array.from({ length: 23 }, (_, i) => `${i + 8}px`);

interface ToolbarPluginProps {
  anchorElem?: HTMLElement;
}

export default function ToolbarPlugin({ anchorElem = document.body }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);
  const [virtualRef, setVirtualRef] = useState<VirtualElement | null>(null);
  const isPointerDownRef = useRef(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isUppercase, setIsUppercase] = useState(false);
  const [isLowercase, setIsLowercase] = useState(false);
  const [isCapitalize, setIsCapitalize] = useState(false);
  const [isHighlight, setIsHighlight] = useState(false);

  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState<string>('15px');
  const [fontColor, setFontColor] = useState<string>('#000000');
  const [bgColor, setBgColor] = useState<string>('#ffffff');

  const [activeDropdown, setActiveDropdown] = useState<'fontFamily' | 'fontSize' | null>(null);
  const isDropdownOpenRef = useRef(false);
  const lastSelectionRef = useRef<BaseSelection | null>(null);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      if (isPointerDownRef.current) return;
      if (!editor.isEditable()) {
        setIsOpen(false);
        return;
      }

      const selection = $getSelection();

      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        lastSelectionRef.current = selection.clone();
      }

      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        if (isDropdownOpenRef.current) {
          return;
        }
        setIsOpen(false);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const isInsideCode = $isCodeNode(anchorNode) || anchorNode.getParents().some($isCodeNode);

      if (isInsideCode) {
        if (isDropdownOpenRef.current) return;
        setIsOpen(false);
        return;
      }

      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      setIsUppercase(selection.hasFormat('uppercase'));
      setIsLowercase(selection.hasFormat('lowercase'));
      setIsCapitalize(selection.hasFormat('capitalize'));
      setIsHighlight(selection.hasFormat('highlight'));

      setFontFamily(
        $getSelectionStyleValueForProperty(selection, 'font-family', 'Arial'),
      );
      setFontSize(
        $getSelectionStyleValueForProperty(selection, 'font-size', '15px'),
      );

      const rgbToHex = (rgb: string) => {
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (match) {
          return "#" + (1 << 24 | parseInt(match[1]) << 16 | parseInt(match[2]) << 8 | parseInt(match[3])).toString(16).slice(1);
        }
        return rgb;
      };

      const color = $getSelectionStyleValueForProperty(selection, 'color', '#000000');
      const background = $getSelectionStyleValueForProperty(selection, 'background-color', '#ffffff');

      setFontColor(rgbToHex(color));
      setBgColor(rgbToHex(background));

      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection &&
        !nativeSelection.isCollapsed &&
        rootElement &&
        rootElement.contains(nativeSelection.anchorNode)
      ) {
        setVirtualRef({
          getBoundingClientRect() {
            const currentSelection = window.getSelection();
            if (currentSelection && !currentSelection.isCollapsed) {
              return currentSelection.getRangeAt(0).getBoundingClientRect();
            }
            return {
              x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0,
            } as DOMRect;
          },
          contextElement: rootElement,
        });
        setIsOpen(true);
      } else {
        if (!isDropdownOpenRef.current) {
          setIsOpen(false);
        }
      }
    });
  }, [editor]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      isPointerDownRef.current = true;
      const target = e.target as HTMLElement;
      
      const isInsideToolbar = toolbarRef.current && toolbarRef.current.contains(target);
      const isInsideDropdown = target.closest('.toolbar-dropdown-container');

      if (!isInsideToolbar) {
        if (!isDropdownOpenRef.current) {
          setIsOpen(false);
        } else {
          setActiveDropdown(null);
          isDropdownOpenRef.current = false;
        }
      } else {
        // Click inside the toolbar
        if (!isInsideDropdown && isDropdownOpenRef.current) {
          // Si le dropdown est ouvert et on clique sur un bouton de la toolbar
          // On ferme le dropdown, mais pas la toolbar
          setActiveDropdown(null);
          isDropdownOpenRef.current = false;
        }
      }
    };
    
    const handlePointerUp = () => {
      isPointerDownRef.current = false;
      updateToolbar();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [updateToolbar]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateToolbar);
    return () => {
      document.removeEventListener('selectionchange', updateToolbar);
    };
  }, [updateToolbar]);

  const toggleFormat = (format: TextFormatType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ((!selection || selection.isCollapsed()) && lastSelectionRef.current) {
        $setSelection(lastSelectionRef.current.clone());
      }
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    });
  };

  const applyStyleText = useCallback(
    (styles: Record<string, string>) => {
      editor.update(() => {
        let selection = $getSelection();

        if ((!selection || selection.isCollapsed()) && lastSelectionRef.current) {
          $setSelection(lastSelectionRef.current.clone());
          selection = $getSelection();
        }

        if (selection !== null) {
          $patchStyleText(selection, styles);
          lastSelectionRef.current = selection.clone();
        }
      });
    },
    [editor],
  );

  const clearFormatting = useCallback(() => {
    clearFormattingUtil(editor);
  }, [editor]);

  const handleDropdownSelect = (type: 'fontFamily' | 'fontSize', val: string) => {
    applyStyleText({ [type === 'fontFamily' ? 'font-family' : 'font-size']: val });
    setActiveDropdown(null);
    isDropdownOpenRef.current = false;
  };

  const handleDropdownToggle = (type: 'fontFamily' | 'fontSize') => {
    const isOpening = activeDropdown !== type;
    setActiveDropdown(isOpening ? type : null);
    isDropdownOpenRef.current = isOpening;
  };

  return createPortal(
    <>
      <Popover
        virtualReference={virtualRef}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        placement="top"
        offsetDistance={10}
        width="auto"
        disableClickOutside={true}
      >
        <div ref={toolbarRef} className="floating-text-format-popup" style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '4px' }}>
          
          <ToolbarDropdown
            value={fontFamily}
            options={FONT_FAMILY_OPTIONS}
            isOpen={activeDropdown === 'fontFamily'}
            onToggle={() => handleDropdownToggle('fontFamily')}
            onSelect={(val) => handleDropdownSelect('fontFamily', val)}
            isFontFamily={true}
          />

          <ToolbarDropdown
            value={fontSize}
            options={FONT_SIZE_OPTIONS}
            isOpen={activeDropdown === 'fontSize'}
            onToggle={() => handleDropdownToggle('fontSize')}
            onSelect={(val) => handleDropdownSelect('fontSize', val)}
          />

          <div className="divider" />

          <ToolbarButton icon={<Bold size={16} />} label="Bold" isActive={isBold} onClick={() => toggleFormat('bold')} />
          <ToolbarButton icon={<Italic size={16} />} label="Italic" isActive={isItalic} onClick={() => toggleFormat('italic')} />
          <ToolbarButton icon={<Underline size={16} />} label="Underline" isActive={isUnderline} onClick={() => toggleFormat('underline')} />
          <ToolbarButton icon={<Strikethrough size={16} />} label="Strikethrough" isActive={isStrikethrough} onClick={() => toggleFormat('strikethrough')} />

          <div className="divider" />

          <ToolbarButton icon={<Subscript size={16} />} label="Subscript" isActive={isSubscript} onClick={() => toggleFormat('subscript')} />
          <ToolbarButton icon={<Superscript size={16} />} label="Superscript" isActive={isSuperscript} onClick={() => toggleFormat('superscript')} />

          <div className="divider" />

          <ToolbarButton icon={<CaseLower size={20} />} label="Lowercase" isActive={isLowercase} onClick={() => toggleFormat('lowercase')} />
          <ToolbarButton icon={<CaseUpper size={20} />} label="Uppercase" isActive={isUppercase} onClick={() => toggleFormat('uppercase')} />
          <ToolbarButton icon={<CaseSensitive size={20} />} label="Capitalize" isActive={isCapitalize} onClick={() => toggleFormat('capitalize')} />

          <div className="divider" />

          <ToolbarButton icon={<Highlighter size={16} />} label="Highlight" isActive={isHighlight} onClick={() => toggleFormat('highlight')} />

          <NativeColorPicker
            icon={<Palette size={16} />}
            title="Text Color"
            color={fontColor}
            onChange={(color) => applyStyleText({ 'color': color })}
          />
          <NativeColorPicker
            icon={<PaintBucket size={16} />}
            title="Background Color"
            color={bgColor}
            onChange={(color) => applyStyleText({ 'background-color': color })}
          />

          <div className="divider" />

          <ToolbarButton icon={<Eraser size={16} />} label="Clear Formatting" onClick={clearFormatting} />
        </div>
      </Popover>
    </>,
    anchorElem,
  );
}