import './index.css';

import { autoUpdate, FloatingPortal, offset, useFloating } from '@floating-ui/react';
import {
  $isCodeNode,
  getLanguageFriendlyName
} from '@lexical/code';
import { getCodeThemeOptions } from '@lexical/code-shiki';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, $getNodeByKey, $nodesOfType } from 'lexical';
import { ChevronDown } from 'lucide-react';
import { JSX, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { CODE_LANGUAGES, CODE_THEMES } from '../CodeHighlightShikiPlugin';

const CODE_THEME_OPTIONS = getCodeThemeOptions().filter(option =>
  CODE_THEMES.includes(option[0]),
);

interface DropdownOption {
  value: string;
  label: string;
}

function CodeMenuDropdown({
  value,
  options,
  onChange
}: {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-end',
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [offset(4)],
  });

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        refs.floating.current &&
        !refs.floating.current.contains(e.target as Node) &&
        refs.domReference.current &&
        !refs.domReference.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, refs]);

  return (
    <>
      <Button
        ref={refs.setReference}
        variant="ghost"
        size="sm"
        className="code-action-menu-button"
        onMouseDown={(e) => {
          // IMPORTANT: Prevent default to stop Lexical from losing focus
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
      >
        <span>{value}</span>
        <ChevronDown size={12} className="opacity-70" />
      </Button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 999999 }}
            className="code-action-menu-dropdown"
            onMouseDown={(e) => {
              // Prevent losing focus when clicking inside the menu
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`code-action-menu-item ${value === opt.label ? 'active' : ''}`}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

// code style in PlaygroundEditorTheme.css : .anql_code {
function CodeActionMenuContainer({ codeNodeKey }: { codeNodeKey: string }): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [lang, setLang] = useState('');
  const [theme, setTheme] = useState('github-light');

  const codeDOMNodeRef = useRef<HTMLElement | null>(null);

  // Floating instance for the container relative to the code block
  const { refs, x, y } = useFloating({
    placement: 'top-end',
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [
      offset(({ rects }) => ({
        mainAxis: -rects.floating.height - 8,
        crossAxis: -8,
      })),
    ],
  });

  const updateMenu = useCallback(() => {
    editor.getEditorState().read(() => {
      const codeNode = $getNodeByKey(codeNodeKey);

      if ($isCodeNode(codeNode)) {
        const codeElement = editor.getElementByKey(codeNodeKey);
        if (codeElement) {
          codeDOMNodeRef.current = codeElement;
          refs.setReference(codeElement);
          setLang(codeNode.getLanguage() || '');
          setTheme(codeNode.getTheme() || 'github-light');
        }
      } else {
        codeDOMNodeRef.current = null;
        refs.setReference(null);
      }
    });
  }, [editor, codeNodeKey, refs]);

  useEffect(() => {
    updateMenu();
    return editor.registerUpdateListener(() => {
      updateMenu();
    });
  }, [editor, updateMenu]);

  const handleLanguageChange = (newLang: string) => {
    editor.update(() => {
      if (codeDOMNodeRef.current) {
        const maybeCodeNode = $getNearestNodeFromDOMNode(codeDOMNodeRef.current);
        if ($isCodeNode(maybeCodeNode)) {
          maybeCodeNode.setLanguage(newLang);
        }
      }
    });
    setLang(newLang);
  };

  const handleThemeChange = (newTheme: string) => {
    editor.update(() => {
      if (codeDOMNodeRef.current) {
        const maybeCodeNode = $getNearestNodeFromDOMNode(codeDOMNodeRef.current);
        if ($isCodeNode(maybeCodeNode)) {
          maybeCodeNode.setTheme(newTheme);
        }
      }
    });
    setTheme(newTheme);
  };

  if (!codeDOMNodeRef.current) return null;

  const codeFriendlyName = getLanguageFriendlyName(lang);

  return (
    <div
      ref={refs.setFloating}
      className="code-action-menu-container"
      style={{
        position: 'absolute',
        top: y ?? 0,
        left: x ?? 0,
      }}
    >
      <CodeMenuDropdown
        value={codeFriendlyName || 'Plain Text'}
        options={CODE_LANGUAGES.map((language) => ({
          value: language,
          label: language ? getLanguageFriendlyName(language) : 'Plain Text',
        }))}
        onChange={handleLanguageChange}
      />
      <CodeMenuDropdown
        value={theme}
        options={CODE_THEME_OPTIONS.map(([value, name]) => ({
          value,
          label: name,
        }))}
        onChange={handleThemeChange}
      />
    </div>
  );
}

import { CodeNode } from '@lexical/code';

export default function CodeActionMenuPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [codeNodeKeys, setCodeNodeKeys] = useState<string[]>([]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      const nodes = $nodesOfType(CodeNode);
      setCodeNodeKeys(nodes.map(n => n.getKey()));
    });

    return editor.registerMutationListener(CodeNode, (mutations) => {
      setCodeNodeKeys((prev) => {
        const next = new Set(prev);
        let hasChanges = false;
        for (const [key, mutation] of mutations) {
          if (mutation === 'created') {
            next.add(key);
            hasChanges = true;
          } else if (mutation === 'destroyed') {
            next.delete(key);
            hasChanges = true;
          }
        }
        return hasChanges ? Array.from(next) : prev;
      });
    });
  }, [editor]);

  return (
    <>
      {codeNodeKeys.map(key => (
        <CodeActionMenuContainer key={key} codeNodeKey={key} />
      ))}
    </>
  );
}
