import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isTextNode, ElementNode, LexicalNode } from 'lexical';
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGlobalStore } from "@/App/store/useGlobalStore";
import { $isTableNode } from '@/editor/nodes/TableNode/TableNode';

interface SearchMatch {
  nodeKey: string;
  startOffset: number;
  endOffset: number;
  range?: Range;
  isTable?: boolean;
  tableMatch?: {
    rowIndex: number;
    columnId: string;
  };
}

interface CustomHighlightRegistry {
  get(name: string): Highlight | undefined;
  set(name: string, highlight: Highlight): void;
  delete(name: string): void;
}

declare global {
  interface CSS {
    highlights?: CustomHighlightRegistry;
  }

  interface Window {
    Highlight?: new () => Highlight;
  }
}

export function useSearch() {
  const [editor] = useLexicalComposerContext();
  const { editorContainerRef, editorRef } = useGlobalStore(useShallow((state) => ({ editorContainerRef: state.editorContainerRef, editorRef: state.editorRef })));

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [editorVersion, setEditorVersion] = useState(0);

  useEffect(() => {
    return editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      // Only trigger search when content actually changes, not on selection changes
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
        setEditorVersion(v => v + 1);
      }
    });
  }, [editor]);

  // Effect to perform the search when query changes or editor updates
  useEffect(() => {
    const isHighlightSupported = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof window.Highlight !== 'undefined';

    let searchHighlight: Highlight | null | undefined = null;
    let activeHighlight: Highlight | null | undefined = null;

    if (isHighlightSupported) {
      searchHighlight = CSS.highlights?.get('search-results');
      if (!searchHighlight) {
        searchHighlight = new window.Highlight();
        CSS.highlights?.set('search-results', searchHighlight);
      }
      searchHighlight.clear();

      activeHighlight = CSS.highlights?.get('search-active');
      if (!activeHighlight) {
        activeHighlight = new window.Highlight();
        CSS.highlights?.set('search-active', activeHighlight);
      }
      activeHighlight.clear();
    }

    // Set search query on document.body for table cell highlighting
    if (query) {
      document.body.dataset.searchQuery = query;
    } else {
      delete document.body.dataset.searchQuery;
      delete document.body.dataset.searchActiveIndex;
    }

    if (!query) {
      setResults([]);
      setCurrentIndex(-1);
      return;
    }

    const matches: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const dfs = (node: LexicalNode) => {
        if ($isTableNode(node)) {
          // Search in table data
          const tableMatches = node.getSearchMatches(query);
          tableMatches.forEach((tableMatch) => {
            matches.push({
              nodeKey: node.getKey(),
              startOffset: tableMatch.startOffset,
              endOffset: tableMatch.endOffset,
              isTable: true,
              tableMatch: {
                rowIndex: tableMatch.rowIndex,
                columnId: tableMatch.columnId,
              },
            });
          });
        } else if ($isTextNode(node)) {
          const text = node.getTextContent();
          let startIndex = 0;
          let index = text.toLowerCase().indexOf(lowerQuery, startIndex);
          while (index !== -1) {
            matches.push({
              nodeKey: node.getKey(),
              startOffset: index,
              endOffset: index + query.length,
            });
            startIndex = index + query.length;
            index = text.toLowerCase().indexOf(lowerQuery, startIndex);
          }
        } else if (node instanceof ElementNode) {
          node.getChildren().forEach(dfs);
        }
      };

      dfs(root);
    });

    // Resolve Ranges after render cycle if needed, but since we just read state, DOM should be in sync
    const validMatches: SearchMatch[] = [];

    for (const match of matches) {
      if (match.isTable) {
        // For table matches, we don't create ranges (handled by cell highlighting)
        validMatches.push(match);
        continue;
      }

      const element = editor.getElementByKey(match.nodeKey);
      if (element) {
        let textNode: Node | null = null;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        while (walker.nextNode()) {
          textNode = walker.currentNode;
          break;
        }

        if (textNode) {
          try {
            const range = document.createRange();
            const len = textNode.textContent?.length || 0;
            const start = Math.min(match.startOffset, len);
            const end = Math.min(match.endOffset, len);

            if (start !== end) {
              range.setStart(textNode, start);
              range.setEnd(textNode, end);
              match.range = range;
              validMatches.push(match);
              if (searchHighlight) {
                searchHighlight.add(range);
              }
            }
          } catch (e) {
            console.warn("Failed to create range for match", e);
          }
        }
      }
    }

    setResults(validMatches);
    setCurrentIndex(validMatches.length > 0 ? 0 : -1);

  }, [query, editor, editorVersion]);

  // Effect to update active highlight and scroll when currentIndex changes
  useEffect(() => {
    const isHighlightSupported = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof window.Highlight !== 'undefined';

    if (isHighlightSupported) {
      const activeHighlight = CSS.highlights?.get('search-active');
      if (activeHighlight) {
        activeHighlight.clear();
        if (currentIndex >= 0 && currentIndex < results.length) {
          const match = results[currentIndex];
          if (match.range) {
            activeHighlight.add(match.range);
          }
        }
      }
    }

    if (currentIndex >= 0 && currentIndex < results.length) {
      const match = results[currentIndex];

      // Set active match info for table highlighting
      if (match.isTable && match.tableMatch) {
        document.body.dataset.searchActiveNodeKey = match.nodeKey;
        document.body.dataset.searchActiveRowIndex = String(match.tableMatch.rowIndex);
        document.body.dataset.searchActiveColumnId = match.tableMatch.columnId;
      } else {
        delete document.body.dataset.searchActiveNodeKey;
        delete document.body.dataset.searchActiveRowIndex;
        delete document.body.dataset.searchActiveColumnId;
      }

      // Dispatch custom event for table search navigation
      if (match.isTable && match.tableMatch) {
        const event = new CustomEvent('tableSearchNavigate', {
          detail: {
            nodeKey: match.nodeKey,
            rowIndex: match.tableMatch.rowIndex,
            columnId: match.tableMatch.columnId,
          },
        });
        document.dispatchEvent(event);
      }

      // Scroll into view logic
      const element = editor.getElementByKey(match.nodeKey);
      if (element) {
        requestAnimationFrame(() => {
          const scrollContainer = editorContainerRef?.current;
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const rangeRects = match.range ? match.range.getClientRects() : [];
            const elementRect = rangeRects.length > 0 ? rangeRects[0] : element.getBoundingClientRect();

            const scrollTop = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);
            scrollContainer.scrollTo({
              top: scrollContainer.scrollTop + scrollTop,
              behavior: 'smooth'
            });
          }
        });
      }
    } else {
      // Clear active match info
      delete document.body.dataset.searchActiveNodeKey;
      delete document.body.dataset.searchActiveRowIndex;
      delete document.body.dataset.searchActiveColumnId;
    }
  }, [currentIndex, results, editor, editorContainerRef, editorRef]);

  const nextResult = useCallback(() => {
    setCurrentIndex(prev => {
      if (results.length === 0) return -1;
      return prev + 1 >= results.length ? 0 : prev + 1;
    });
  }, [results.length]);

  const prevResult = useCallback(() => {
    setCurrentIndex(prev => {
      if (results.length === 0) return -1;
      return prev - 1 < 0 ? results.length - 1 : prev - 1;
    });
  }, [results.length]);

  const goToResult = useCallback((index: number) => {
    setCurrentIndex(prev => {
      if (results.length === 0) return -1;
      if (index >= 0 && index < results.length) return index;
      return prev;
    });
  }, [results.length]);

  const closeSearch = useCallback(() => {
    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
      const searchHighlight = CSS.highlights?.get('search-results');
      if (searchHighlight) {
        searchHighlight.clear();
        CSS.highlights?.delete('search-results');
      }

      const activeHighlight = CSS.highlights?.get('search-active');
      if (activeHighlight) {
        activeHighlight.clear();
        CSS.highlights?.delete('search-active');
      }
    }
    setQuery('');
    setResults([]);
    setCurrentIndex(-1);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
        const searchHighlight = CSS.highlights?.get('search-results');
        if (searchHighlight) {
          searchHighlight.clear();
          CSS.highlights?.delete('search-results');
        }

        const activeHighlight = CSS.highlights?.get('search-active');
        if (activeHighlight) {
          activeHighlight.clear();
          CSS.highlights?.delete('search-active');
        }
      }
    };
  }, []);

  return {
    query,
    setQuery,
    resultsCount: results.length,
    currentIndex,
    nextResult,
    prevResult,
    goToResult,
    closeSearch
  };
}
