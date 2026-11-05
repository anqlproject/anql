import './PdfComponent.css';

import type {JSX} from 'react';
import {useCallback, useEffect, useState} from 'react';

import { logger } from '@/core/logger';
import { useReferenceStore } from '@/core/references/useReferenceStore';

import { PdfViewer } from './PdfViewer';

type PdfComponentProps = {
  url: string;
  name: string;
  referenceId?: string;
  nodeKey: string;
};

export default function PdfComponent({
  url,
  name,
  referenceId,
}: PdfComponentProps): JSX.Element {
  const linkedReference = useReferenceStore((state) =>
    referenceId
      ? state.references.find((reference) => reference.id === referenceId)
      : undefined,
  );
  const referencesLoaded = useReferenceStore((state) => state.isLoaded);
  const loadReferences = useReferenceStore((state) => state.loadReferences);
  const currentUrl = linkedReference?.ref_type === 'pdf' ? linkedReference.value : url;
  const currentName = linkedReference?.ref_type === 'pdf' ? linkedReference.name : name;
  const [showViewer, setShowViewer] = useState(false);

  useEffect(() => {
    if (!referenceId || referencesLoaded) return;
    loadReferences().catch((error: unknown) => {
      logger.error('Failed to load linked PDF reference', error as Error, { referenceId });
    });
  }, [loadReferences, referenceId, referencesLoaded]);

  const handleClick = useCallback(() => {
    // Show PDF viewer dialog
    setShowViewer(true);
  }, []);

  return (
    <>
      <span
        className="pdf-inline-node"
        onClick={handleClick}
        title={`Open PDF: ${currentName || currentUrl}`}
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
      <span>{currentName || 'PDF Document'}</span>
      </span>
      {showViewer && (
        <PdfViewer
          url={currentUrl}
          name={currentName}
          onClose={() => setShowViewer(false)}
        />
      )}
    </>
  );
}
