// Import react-pdf styles
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import './PdfViewer.css';

import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronDown, ChevronUp, Loader2, Search, X } from 'lucide-react';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker using local web worker for full offline support
pdfjs.GlobalWorkerOptions.workerPort = new pdfjsWorker();

interface PdfViewerProps {
  url: string;
  name: string;
  onClose: () => void;
}

interface Match {
  pageNumber: number;
  itemIndex: number;
  matchIndexInItem: number;
}

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export function PdfViewer({ url, name, onClose }: PdfViewerProps): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1.2);

  const containerRef = useRef<HTMLDivElement>(null);

  // Convert base64 to direct Uint8Array, and local files to Tauri asset source
  const getPdfFile = useCallback((pdfUrl: string) => {
    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = pdfUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return { data: bytes };
      } catch (err) {
        console.error('Failed to convert base64 to array:', err);
        return pdfUrl;
      }
    }

    if (pdfUrl.startsWith('/') || pdfUrl.startsWith('file://')) {
      try {
        const cleanPath = pdfUrl.replace('file://', '');
        return convertFileSrc(cleanPath);
      } catch (err) {
        console.error('Failed to convert local path via convertFileSrc:', err);
      }
    }

    return pdfUrl;
  }, []);

  const [pdfFile, setPdfFile] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    if (url.startsWith('asset://')) {
      import('@/core/database/useAssetDatabase').then(({ resolveAssetUrl }) => {
        resolveAssetUrl(url)
          .then((resolvedUrl) => {
            if (isMounted) {
              if (resolvedUrl) {
                setPdfFile(resolvedUrl);
              } else {
                setError('Failed to resolve PDF asset: file not found on disk');
              }
            }
          })
          .catch((err: unknown) => {
            console.error('Failed to load PDF asset:', err);
            if (isMounted) {
              setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
            }
          });
      });
    } else {
      setPdfFile(getPdfFile(url));
    }

    return () => {
      isMounted = false;
    };
  }, [url, getPdfFile]);

  const onDocumentLoadSuccess = (pdf: any) => {
    setPdfDoc(pdf);
    setNumPages(pdf.numPages);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('Failed to load PDF:', err);
    setError(`Failed to load PDF: ${err.message || String(err)}`);
  };

  // Perform search text extraction & matching
  useEffect(() => {
    if (!pdfDoc || !searchQuery.trim()) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const tempMatches: Match[] = [];
        const queryLower = searchQuery.toLowerCase();

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();

          textContent.items.forEach((item: any, itemIndex: number) => {
            if (!item.str) return;
            const strLower = item.str.toLowerCase();

            let idx = strLower.indexOf(queryLower);
            let matchCount = 0;
            while (idx !== -1) {
              tempMatches.push({ pageNumber: pageNum, itemIndex, matchIndexInItem: matchCount });
              matchCount++;
              idx = strLower.indexOf(queryLower, idx + queryLower.length);
            }
          });
        }

        setMatches(tempMatches);
        setCurrentMatchIndex(tempMatches.length > 0 ? 0 : -1);
      } catch (err) {
        console.error('Error during PDF search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [pdfDoc, searchQuery]);

  // Highlight active match and scroll
  useEffect(() => {
    const activeElements = document.querySelectorAll('.pdf-search-match.active');
    activeElements.forEach((el: any) => {
      el.classList.remove('active');
      el.style.backgroundColor = '#fef08a';
      el.style.color = 'black';
      el.style.fontWeight = 'normal';
    });

    if (currentMatchIndex < 0 || currentMatchIndex >= matches.length) return;

    const activeMatch = matches[currentMatchIndex];

    const performScroll = () => {
      const selector = `.pdf-search-match[data-global-idx="${currentMatchIndex}"]`;
      const activeElement = document.querySelector(selector) as HTMLElement;

      if (activeElement) {
        activeElement.classList.add('active');
        activeElement.style.backgroundColor = '#f97316';
        activeElement.style.color = 'white';
        activeElement.style.fontWeight = 'bold';
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else {
        const pageElement = document.getElementById(`pdf-page-${activeMatch.pageNumber}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };

    const rafId = requestAnimationFrame(() => {
      const timer = setTimeout(performScroll, 50);
      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentMatchIndex, matches]);

  const customTextRenderer = useCallback(({ pageNumber, itemIndex, str }: any) => {
    if (!searchQuery.trim()) return str;

    const queryLower = searchQuery.toLowerCase();
    const strLower = str.toLowerCase();
    if (!strLower.includes(queryLower)) return str;

    let lastIndex = 0;
    let idx = strLower.indexOf(queryLower);
    let html = '';
    let matchCount = 0;

    while (idx !== -1) {
      if (idx > lastIndex) html += escapeHtml(str.substring(lastIndex, idx));

      const matchText = str.substring(idx, idx + searchQuery.length);
      const globalIdx = matches.findIndex(
        (m) => m.pageNumber === pageNumber && m.itemIndex === itemIndex && m.matchIndexInItem === matchCount
      );
      const style = 'background-color: #fef08a; color: black; border-radius: 2px; padding: 0 1px; transition: background-color 0.2s;';
      html += `<mark class="pdf-search-match" style="${style}" data-page="${pageNumber}" data-item="${itemIndex}" data-match-idx="${matchCount}" data-global-idx="${globalIdx}">${escapeHtml(matchText)}</mark>`;

      matchCount++;
      lastIndex = idx + searchQuery.length;
      idx = strLower.indexOf(queryLower, lastIndex);
    }

    if (lastIndex < str.length) html += escapeHtml(str.substring(lastIndex));
    return html;
  }, [searchQuery, matches]);

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  };

  return createPortal(
    <>
      {/* Backdrop transparent — click pour fermer */}
      <div className="pdf-panel-backdrop" onClick={onClose} />

      {/* Panel latéral */}
      <div className="pdf-panel">
        {/* Header compact */}
        <div className="pdf-panel-header">
          <h2 className="pdf-panel-title">{name || 'PDF Viewer'}</h2>
          <button className="pdf-panel-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar recherche + zoom */}
        <div className="pdf-viewer-toolbar">
          <div className="pdf-viewer-search-box">
            <Search size={15} className="pdf-viewer-search-icon" />
            <input
              type="text"
              placeholder="Search in PDF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pdf-viewer-search-input"
            />
            {isSearching && <Loader2 size={14} className="animate-spin pdf-viewer-search-icon" />}
          </div>

          <div className="pdf-viewer-controls">
            {matches.length > 0 && (
              <span className="pdf-viewer-match-count">
                {currentMatchIndex + 1}/{matches.length}
              </span>
            )}
            <button onClick={handlePrevMatch} disabled={matches.length === 0} className="pdf-viewer-nav-btn">
              <ChevronUp size={14} />
            </button>
            <button onClick={handleNextMatch} disabled={matches.length === 0} className="pdf-viewer-nav-btn">
              <ChevronDown size={14} />
            </button>

            <div className="pdf-viewer-divider" />

            <div className="pdf-viewer-zoom-group">
              <button onClick={() => setScale((s) => Math.max(0.6, s - 0.2))} className="pdf-viewer-zoom-btn">−</button>
              <span className="pdf-viewer-zoom-label">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale((s) => Math.min(2.0, s + 0.2))} className="pdf-viewer-zoom-btn">+</button>
            </div>
          </div>
        </div>

        {/* Contenu PDF */}
        {error ? (
          <div className="pdf-viewer-error">{error}</div>
        ) : (
          <div ref={containerRef} className="pdf-viewer-canvas">
            {pdfFile ? (
              <Document
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="pdf-viewer-loading">
                    <Loader2 className="animate-spin" /> Loading document...
                  </div>
                }
              >
                {numPages && Array.from(new Array(numPages), (_, index) => (
                  <div key={index + 1} id={`pdf-page-${index + 1}`} className="pdf-viewer-page-wrapper">
                    <Page pageNumber={index + 1} scale={scale} customTextRenderer={customTextRenderer} />
                  </div>
                ))}
              </Document>
            ) : (
              <div className="pdf-viewer-loading">
                <Loader2 className="animate-spin" /> Resolving PDF asset...
              </div>
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
