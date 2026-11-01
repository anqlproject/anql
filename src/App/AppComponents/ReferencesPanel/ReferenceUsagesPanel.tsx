import './ReferenceUsagesPanel.css';

import { FileSearch, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useFile } from '@/App/hooks/FileHooks';
import { getReferenceUsages, ReferenceUsageJson } from '@/core/database/useDocumentDatabase';
import { ReferenceJson } from '@/core/database/useReferenceDatabase';
import { searchNodesByType } from '@/core/database/useSearchDatabase';
import { DIMENSIONS } from '@/core/global/defaultValues';
import { logger } from '@/core/logger';

export async function loadReferenceUsages(reference: ReferenceJson): Promise<ReferenceUsageJson[]> {
  const [linkedUsages, mathUsages] = await Promise.all([
    reference.id ? getReferenceUsages(reference.id) : Promise.resolve([]),
    reference.ref_type === 'text'
      ? searchNodesByType(reference.name, 'mathexp')
      : Promise.resolve([]),
  ]);
  const uniqueUsages = new Map<string, ReferenceUsageJson>();
  [...linkedUsages, ...mathUsages].forEach((usage) => {
    uniqueUsages.set(`${usage.id}:${usage.node_id}`, usage);
  });
  return [...uniqueUsages.values()].sort((a, b) =>
    a.title.localeCompare(b.title) || a.path.localeCompare(b.path),
  );
}

interface ReferenceUsagesPanelProps {
  reference: ReferenceJson;
  onClose: () => void;
  onUsageOpened: () => void;
}

export default function ReferenceUsagesPanel({
  reference,
  onClose,
  onUsageOpened,
}: ReferenceUsagesPanelProps) {
  const { t } = useTranslation();
  const { openEditorWUFocusOnNode } = useFile();
  const [usages, setUsages] = useState<ReferenceUsageJson[]>([]);
  const [isLoadingUsages, setIsLoadingUsages] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [openingUsageId, setOpeningUsageId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setUsages([]);
    setIsLoadingUsages(true);
    setUsageError('');
    loadReferenceUsages(reference)
      .then((loadedUsages) => {
        if (isMounted) setUsages(loadedUsages);
      })
      .catch((error: unknown) => {
        logger.error('Failed to load reference usages', error as Error, {
          referenceId: reference.id,
        });
        if (isMounted) setUsageError(t('REFERENCE_PANEL.usagesFailed') as string);
      })
      .finally(() => {
        if (isMounted) setIsLoadingUsages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reference, t]);

  const openUsage = async (usage: ReferenceUsageJson) => {
    setOpeningUsageId(usage.node_id);
    setUsageError('');
    try {
      await openEditorWUFocusOnNode(usage, usage.node_id);
      onClose();
      onUsageOpened();
    } catch (error) {
      logger.error('Failed to open reference usage', error as Error, {
        documentId: usage.id,
        nodeId: usage.node_id,
      });
      setUsageError(t('REFERENCE_PANEL.openUsageFailed') as string);
    } finally {
      setOpeningUsageId(null);
    }
  };

  return createPortal(
    <div
      className="ref-usages-overlay"
      style={{ paddingTop: DIMENSIONS.overlayTopOffset }}
      onClick={onClose}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="ref-usages-backdrop" />
      <section
        className="ref-usages-panel"
        style={{
          width: DIMENSIONS.panelWidth_medium,
          height: DIMENSIONS.panelHeight_medium,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ref-usages-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ref-usages-header">
          <h2 id="ref-usages-title">
            {t('REFERENCE_PANEL.usagesTitle', { name: reference.name })}
            {!isLoadingUsages && !usageError && (
              <>
                {' '}
                <span className="ref-usage-count">{usages.length}</span>
              </>
            )}
          </h2>
          <button
            type="button"
            className="ref-panel__close"
            onClick={onClose}
            aria-label={t('REFERENCE_PANEL.close') as string}
          >
            <X size={14} />
          </button>
        </header>
        <div className="ref-usages-list">
          {isLoadingUsages ? (
            <p className="ref-usages-message">{t('REFERENCE_PANEL.loadingUsages')}</p>
          ) : usageError ? (
            <p className="ref-usages-message ref-usages-message--error" role="alert">{usageError}</p>
          ) : usages.length === 0 ? (
            <p className="ref-usages-message">{t('REFERENCE_PANEL.noUsages')}</p>
          ) : usages.map((usage, index) => {
            const blockNumber = usages
              .slice(0, index + 1)
              .filter((item) => item.id === usage.id).length;
            return (
              <button
                key={`${usage.id}-${usage.node_id}`}
                type="button"
                className="ref-usages-item"
                onClick={() => openUsage(usage)}
                disabled={openingUsageId !== null}
              >
                <FileSearch size={15} />
                <span className="ref-usages-item__text">
                  <strong>{usage.title || t('SIDEBAR.untitled')}</strong>
                  <small>
                    {usage.path}
                    {usage.path ? ' · ' : ''}
                    {t('REFERENCE_PANEL.usageBlock', { number: blockNumber })}
                  </small>
                </span>
                {openingUsageId === usage.node_id && <span>{t('REFERENCE_PANEL.openingUsage')}</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
