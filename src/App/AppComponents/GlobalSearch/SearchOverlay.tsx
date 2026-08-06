import "./SearchOverlay.css";

import { ArrowDown, ArrowUp, FileText, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { globalSearch } from "@/App/AppComponents/GlobalSearch/GlobalSearch";
import { useGlobalShortcut } from "@/App/GlobalShortcut/GlobalShortcutContext";
import { useFile } from "@/App/hooks/FileHooks";
import { useGlobalStore } from "@/App/store/useGlobalStore";
import { getDocumentById } from "@/core/database/useDocumentDatabase";
import {
  fuzzySearchNodesWithSnippets,
  SearchResult,
} from "@/core/database/useSearchDatabase";
import { DIMENSIONS } from "@/core/global/defaultValues";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocumentTitle = ({ documentId }: { documentId: string }) => {
  const [title, setTitle] = useState<string>("Loading...");
  const { t } = useTranslation();

  useEffect(() => {
    getDocumentById(documentId)
      .then((doc) => setTitle(doc?.title || (t("SIDEBAR.untitled") as string)))
      .catch(() => setTitle(t("SIDEBAR.untitled") as string));
  }, [documentId, t]);

  return <span>{title}</span>;
};

/**
 * Utility function to render snippet text with all occurrences of the query highlighted.
 * This highlights the search query within the snippet for better visibility.
 */
function renderHighlightedSnippet(snippet: string, query: string) {
  if (!query) return snippet;
  const escapedQuery = query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"); // escape regex special chars
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = snippet.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="search-highlight">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<[SearchResult, string, number][]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { openEditorWUFocusOnNode } = useFile();
  const { clearHighlights } = globalSearch();
  const setGlobalSearchCount = useGlobalShortcut(
    (state) => state.setGlobalSearchCount,
  );
  const { t } = useTranslation();
  const { isMac } = useGlobalStore(
    useShallow((state) => ({ isMac: state.isMac })),
  );

  const shortcutText = isMac ? "⌘G" : "Ctrl+G";

  useEffect(() => {
    setGlobalSearchCount(results.length);
  }, [results, setGlobalSearchCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;

    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        const searchResults = await fuzzySearchNodesWithSnippets(query.trim());
        if (active) {
          setResults(searchResults);
        }
      } catch (error) {
        console.error(t("SEARCH_OVERLAY.searchError"), error);
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleCardClick = useCallback(
    async (result: SearchResult) => {
      const document = await getDocumentById(result.document_id);
      if (document) {
        // Open editor and focus on the node directly.
        // Scroll and highlighting are handled on the FileHooks side.
        await openEditorWUFocusOnNode(document, result.node_id);
      }
      onClose();
    },
    [onClose],
  );

  const handleClearQuery = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearched(false);
  }, []);

  const handleExplicitClose = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearched(false);
    clearHighlights();
    onClose();
  }, [clearHighlights, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="search-overlay"
      style={{ paddingTop: DIMENSIONS.overlayTopOffset }}
    >
      <style>{`
        /* Highlight style for search query matches in snippets */
        .search-highlight {
          background: rgba(255, 200, 0, 0.2);
          border-radius: 2px;
          padding: 0 2px;
        }
      `}</style>
      <div className="search-overlay-backdrop" onClick={handleExplicitClose} />
      <div
        className="search-overlay-content"
        style={{
          width: DIMENSIONS.panelWidth_medium,
          height: DIMENSIONS.panelHeight_medium,
        }}
      >
        <div className="search-input-container">
          <Search className="search-icon-input" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("SEARCH_OVERLAY.placeholder") as string}
            className="search-input"
            autoFocus
          />
          {query && (
            <button
              className="search-clear-button"
              onClick={handleClearQuery}
              type="button"
            >
              <X size={14} />
            </button>
          )}
          <span className="search-shortcut">{shortcutText}</span>
        </div>

        <div className="search-results">
          {loading && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="search-empty">
              <p>{t("SEARCH_OVERLAY.noResults")}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="results-list">
              {results.map(([result, snippet], index) => (
                <div
                  key={`${result.node_id}-${index}`}
                  className="result-item"
                  onClick={() => handleCardClick(result)}
                >
                  <div className="result-item-header">
                    <FileText className="result-icon" />
                    <span className="result-title-text">
                      <DocumentTitle documentId={result.document_id} />
                    </span>
                  </div>
                  <div className="result-snippet">
                    {renderHighlightedSnippet(snippet, query)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="search-footer">
          <div className="search-shortcuts">
            <div className="shortcut-item">
              <ArrowUp size={12} />
              <ArrowDown size={12} />
              <span>{t("SEARCH_OVERLAY.navigate")}</span>
            </div>
            <div className="shortcut-item">
              <kbd>esc</kbd>
              <span>{t("SEARCH_OVERLAY.close")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
