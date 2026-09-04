import './LocalSearch.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from '@/App/store/useGlobalStore';

import { useSearch } from './useSearch';

interface SearchPluginProps {
  onClose: () => void;
}

export default function LocalSearch({ onClose }: SearchPluginProps) {
  const { t } = useTranslation();
  const { isMac } = useGlobalStore(useShallow((state) => ({ isMac: state.isMac })));

  const shortcutText = isMac ? '⌘F' : 'Ctrl+F';

  const {
    query,
    setQuery,
    resultsCount,
    currentIndex,
    nextResult,
    prevResult,
    closeSearch
  } = useSearch();

  const inputRef = useRef<HTMLInputElement>(null);
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.blur();
    const rafId = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(rafId);
      closeSearch();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        prevResult();
      } else {
        nextResult();
      }
    }
  };

  return createPortal(
    <div
      className="search-plugin-container"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder={t('LOCAL_SEARCH.placeholder') as string}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="search-plugin-input"
      />
      <span className="search-plugin-shortcut">{shortcutText}</span>

      {query.length > 0 && (
        <span className="search-plugin-counter">
          {resultsCount > 0 ? currentIndex + 1 : 0} / {resultsCount}
        </span>
      )}

      <div className="search-plugin-actions">
        <button onClick={prevResult} title={t('LOCAL_SEARCH.previous') as string}>
          <ChevronUp size={16} />
        </button>
        <button onClick={nextResult} title={t('LOCAL_SEARCH.next') as string}>
          <ChevronDown size={16} />
        </button>
        <div className="search-plugin-divider"></div>
        <button onClick={() => {
          onClose();
          editor.focus();
        }} title={t('LOCAL_SEARCH.close') as string}>
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
}
