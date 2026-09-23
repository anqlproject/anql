import './ChartRulesTooltip.css';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChartRulesTooltipProps {
  id: string;
}

export function ChartRulesTooltip({ id }: ChartRulesTooltipProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="chart-rules-help">
      <button
        type="button"
        className="chart-no-data-trigger"
        onClick={() => setIsOpen(open => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        aria-expanded={isOpen}
        aria-controls={id}
      >
        {t('CHART.noData')}
      </button>
      {isOpen && (
        <div id={id} className="chart-rules-tooltip" role="tooltip">
          <strong>{t('CHART.chartableDataTitle')}</strong>
          <p>{t('CHART.chartableDataIntro')}</p>
          <p>{t('CHART.chartableDataRuleSummary')}</p>
        </div>
      )}
    </div>
  );
}
