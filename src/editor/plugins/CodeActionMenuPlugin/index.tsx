import './index.css';

import { autoUpdate, FloatingPortal, offset, useFloating } from '@floating-ui/react';
import {
  $isCodeNode,
  getLanguageFriendlyName
} from '@lexical/code';
import { getCodeThemeOptions } from '@lexical/code-shiki';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, $getNodeByKey, $getState, $nodesOfType, $setState } from 'lexical';
import { ChevronDown } from 'lucide-react';
import { JSX, useCallback, useEffect, useState } from 'react';

import { useScrollLock } from '@/App/hooks/useScrollLock';
import { Button } from '@/components/ui/button';
import { logger } from '@/core/logger';
import { useReferenceStore } from '@/core/references/useReferenceStore';
import { codeReferenceIdState } from '@/editor/plugins/ReferencePlugin/referenceState';

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
  onChange,
  onOpenChange
}: {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-end',
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, { animationFrame: true }),
    middleware: [offset(4)],
  });

  useScrollLock({ enabled: isOpen, allowedRef: refs.floating as any });

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

  const activeOption = options.find(o => o.value === value);
  const displayLabel = activeOption ? activeOption.label : value;

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
          setIsOpen((prev) => !prev);
        }}
      >
        <span>{displayLabel}</span>
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
                className={`code-action-menu-item ${value === opt.value ? 'active' : ''}`}
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
  const references = useReferenceStore((state) => state.references);
  const referencesLoaded = useReferenceStore((state) => state.isLoaded);
  const loadReferences = useReferenceStore((state) => state.loadReferences);

  const [lang, setLang] = useState('');
  const [theme, setTheme] = useState('github-light');
  const [referenceId, setReferenceId] = useState<string>();
  const [showReferenceName, setShowReferenceName] = useState(false);

  const [codeElement, setCodeElement] = useState<HTMLElement | null>(null);

  const [isHoveringCode, setIsHoveringCode] = useState(false);
  const [isHoveringMenu, setIsHoveringMenu] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
        const elem = editor.getElementByKey(codeNodeKey);
        if (elem) {
          setCodeElement(elem);
          refs.setReference(elem);
          setLang(codeNode.getLanguage() || '');
          setTheme(codeNode.getTheme() || 'github-light');
          setReferenceId($getState(codeNode, codeReferenceIdState));
        }
      } else {
        setCodeElement(null);
        refs.setReference(null);
        setReferenceId(undefined);
      }
    });
  }, [editor, codeNodeKey, refs]);

  useEffect(() => {
    if (!referencesLoaded) {
      loadReferences().catch((error: unknown) => {
        logger.error('Failed to load reference for code action menu', error as Error);
      });
    }
  }, [loadReferences, referencesLoaded]);

  useEffect(() => {
    if (!referencesLoaded || !referenceId) return;
    if (references.some((reference) => reference.id === referenceId)) return;

    editor.update(() => {
      const codeNode = $getNodeByKey(codeNodeKey);
      if (
        $isCodeNode(codeNode) &&
        $getState(codeNode, codeReferenceIdState) === referenceId
      ) {
        $setState(codeNode, codeReferenceIdState, undefined);
      }
    });
    setShowReferenceName(false);
  }, [codeNodeKey, editor, referenceId, references, referencesLoaded]);

  useEffect(() => {
    updateMenu();
    return editor.registerUpdateListener(() => {
      updateMenu();
    });
  }, [editor, updateMenu]);

  useEffect(() => {
    if (!codeElement) return;

    const handleMouseEnter = () => setIsHoveringCode(true);
    const handleMouseLeave = () => setIsHoveringCode(false);

    codeElement.addEventListener('mouseenter', handleMouseEnter);
    codeElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      codeElement.removeEventListener('mouseenter', handleMouseEnter);
      codeElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [codeElement]);

  const handleLanguageChange = (newLang: string) => {
    editor.update(() => {
      if (codeElement) {
        const maybeCodeNode = $getNearestNodeFromDOMNode(codeElement);
        if ($isCodeNode(maybeCodeNode)) {
          maybeCodeNode.setLanguage(newLang);
        }
      }
    });
    setLang(newLang);
  };

  const handleThemeChange = (newTheme: string) => {
    editor.update(() => {
      if (codeElement) {
        const maybeCodeNode = $getNearestNodeFromDOMNode(codeElement);
        if ($isCodeNode(maybeCodeNode)) {
          maybeCodeNode.setTheme(newTheme);
        }
      }
    });
    setTheme(newTheme);
  };

  const showMenu = isHoveringCode || isHoveringMenu || isDropdownOpen;
  const referenceName = referenceId
    ? references.find((reference) => reference.id === referenceId)?.name
    : undefined;
  const hasLinkedReference = Boolean(referenceId && referenceName);

  if (!codeElement) return null;

  return (
    <div
      ref={refs.setFloating}
      className="code-action-menu-container"
      style={{
        position: 'absolute',
        top: y ?? 0,
        left: x ?? 0,
        opacity: showMenu ? 1 : 0,
        pointerEvents: showMenu ? 'auto' : 'none',
        transition: 'opacity 0.15s ease',
      }}
      onMouseEnter={() => setIsHoveringMenu(true)}
      onMouseLeave={() => setIsHoveringMenu(false)}
    >
      <CodeMenuDropdown
        value={lang}
        options={CODE_LANGUAGES.map((language) => ({
          value: language,
          label: language ? getLanguageFriendlyName(language) : 'Plain Text',
        }))}
        onChange={handleLanguageChange}
        onOpenChange={setIsDropdownOpen}
      />
      <CodeMenuDropdown
        value={theme}
        options={CODE_THEME_OPTIONS.map(([value, name]) => ({
          value,
          label: name,
        }))}
        onChange={handleThemeChange}
        onOpenChange={setIsDropdownOpen}
      />
      {hasLinkedReference && (
        <button
          type="button"
          className={`code-action-reference-button${showReferenceName ? ' is-active' : ''}`}
          aria-label={referenceName || ''}
          aria-expanded={showReferenceName}
          title={referenceName}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            setShowReferenceName((visible) => !visible);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="7" r="4" />
            <circle cx="4" cy="19" r="2" />
            <circle cx="12" cy="19" r="2" />
            <circle cx="20" cy="19" r="2" />
            <path d="M8 7a4 4 0 0 0-4 4v6" />
            <path d="M12 11v6" />
            <path d="M16 7a4 4 0 0 1 4 4v6" />
          </svg>
          {showReferenceName && (
            <span className="code-action-reference-name">
              {referenceName}
            </span>
          )}
        </button>
      )}
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
