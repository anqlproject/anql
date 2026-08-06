import './PdfComponent.css';

import type {JSX} from 'react';
import {useCallback, useState} from 'react';

import { PdfViewer } from './PdfViewer';

type PdfComponentProps = {
  url: string;
  name: string;
  nodeKey: string;
};

export default function PdfComponent({
  url,
  name,
}: PdfComponentProps): JSX.Element {
  const [showViewer, setShowViewer] = useState(false);

  const handleClick = useCallback(() => {
    // Show PDF viewer dialog
    setShowViewer(true);
  }, []);

  return (
    <>
      <span
        className="pdf-inline-node"
        onClick={handleClick}
        title={`Open PDF: ${name || url}`}
      >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15l2 2 4-4" />
      </svg>
      <span>{name || 'PDF Document'}</span>
      </span>
      {showViewer && (
        <PdfViewer
          url={url}
          name={name}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  );
}
