import './ChartComponent.css';

import { Chart, registerables } from 'chart.js';
import { $getNodeByKey, LexicalEditor } from 'lexical';
import { Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChartTableValue, useMathVariables } from '@/editor/context/MathVariablesContext';
import { useThemeStore } from '@/GlobalState/themeStore';

import { ChartConfiguration, COLOR_PALETTES, getDefaultConfig, isNumericColumn, isPolarChart, TableEntry } from './ChartConfiguration';
import { $isChartNode, ChartNodeConfig } from './ChartNode';

Chart.register(...registerables);

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeConfig(config: ChartNodeConfig, table: Record<string, ChartTableValue[]>): ChartNodeConfig {
  const columns = Object.keys(table);
  const xColumn = columns.includes(config.xColumn) ? config.xColumn : columns[0] || '';
  const xIsNumeric = isNumericColumn(table[xColumn] || []);
  const yColumns = config.yColumns.filter(column => {
    if (!columns.includes(column)) return false;
    return xIsNumeric || isNumericColumn(table[column] || []);
  });

  return {
    ...config,
    xColumn,
    yColumns,
    yAggregation: yColumns.some(column => !isNumericColumn(table[column] || []))
      ? 'category'
      : config.yAggregation,
  };
}

export function ChartComponent({ editor, nodeKey }: { editor: LexicalEditor; nodeKey: string }) {
  const { t } = useTranslation();
  const { chartTableVariables } = useMathVariables();
  const { resolvedTheme } = useThemeStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const autoConfiguredRef = useRef(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ChartNodeConfig | null>(null);

  const tables = Object.entries(chartTableVariables) as TableEntry[];
  const [nodeConfig, setNodeConfig] = useState<ChartNodeConfig | null>(() => {
    let initialConfig: ChartNodeConfig | null = null;
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isChartNode(node)) {
        initialConfig = node.getConfig();
      }
    });
    return initialConfig;
  });

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isChartNode(node)) {
          const newConfig = node.getConfig();
          setNodeConfig(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(newConfig)) {
              return newConfig;
            }
            return prev;
          });
        }
      });
    });
  }, [editor, nodeKey]);

  const table = nodeConfig ? chartTableVariables[nodeConfig.tableName] : undefined;
  const safeConfig = nodeConfig && table ? normalizeConfig(nodeConfig, table) : nodeConfig;
  const previewConfig = isConfiguring ? draftConfig : safeConfig;
  const previewTable = previewConfig ? chartTableVariables[previewConfig.tableName] : undefined;
  const renderConfig = previewConfig && previewTable ? normalizeConfig(previewConfig, previewTable) : previewConfig;

  const updateConfig = (config: ChartNodeConfig, close = true) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isChartNode(node)) node.updateConfig(config);
    });
    if (close) setIsConfiguring(false);
  };

  const openConfiguration = () => {
    setDraftConfig(safeConfig || getDefaultConfig(tables));
    setIsConfiguring(true);
  };

  const confirmConfiguration = () => {
    if (draftConfig) updateConfig(draftConfig);
  };

  useEffect(() => {
    if (autoConfiguredRef.current || nodeConfig?.tableName || tables.length === 0) return;

    const defaultConfig = getDefaultConfig(tables);
    if (!defaultConfig.tableName || defaultConfig.yColumns.length === 0) return;

    autoConfiguredRef.current = true;
    updateConfig(defaultConfig);
  }, [nodeConfig?.tableName, tables]);

  const chartData = useMemo(() => {
    if (!renderConfig || !previewTable) return null;

    const effectiveAggregation = renderConfig.yAggregation === 'value' &&
      renderConfig.yColumns.some(column => !isNumericColumn(previewTable[column] || []))
      ? 'category'
      : renderConfig.yAggregation;

    const colors = COLOR_PALETTES[renderConfig.colorPalette] || COLOR_PALETTES.default;

    if (isPolarChart(renderConfig.chartType)) {
      const categories = previewTable[renderConfig.categoryColumn] || [];
      const values = previewTable[renderConfig.valueColumn] || [];
      return {
        labels: categories.map(String),
        datasets: [{
          label: renderConfig.valueColumn,
          data: values.map(value => Number(value) || 0),
          backgroundColor: categories.map((_, index) => colors[index % colors.length]),
          borderWidth: 1,
        }],
      };
    }

    const xValues = previewTable[renderConfig.xColumn] || [];
    const xIsNumeric = effectiveAggregation !== 'count' && isNumericColumn(xValues);
    const xPoints = xValues.map(value => xIsNumeric ? Number(value) : String(value));
    const labels = effectiveAggregation === 'count'
      ? Array.from(new Set(xValues.map(String)))
      : xValues.map(String);
    const yCategoryLabels = effectiveAggregation === 'category'
      ? Array.from(new Set(renderConfig.yColumns.flatMap(column => (previewTable[column] || []).map(String))))
      : undefined;

    const isRadar = renderConfig.chartType === 'radar';
    const isScatter = renderConfig.chartType === 'scatter';

    return {
      labels: labels.map(String),
      xIsNumeric,
      yLabels: yCategoryLabels,
      datasets: renderConfig.yColumns.map((columnName, index) => ({
        label: columnName,
        data: isRadar
          ? (previewTable[columnName] || []).map(value => Number(value) || 0)
          : isScatter
            ? effectiveAggregation === 'count'
              ? labels.map(label => ({
                x: label,
                y: xValues.reduce<number>((count, xValue, rowIndex) => (
                  String(xValue) === label && String(previewTable[columnName]?.[rowIndex] ?? '').trim() !== ''
                    ? count + 1
                    : count
                ), 0),
              }))
              : (previewTable[columnName] || []).map((value, rowIndex) => ({
                x: xPoints[rowIndex],
                y: effectiveAggregation === 'category'
                  ? yCategoryLabels?.indexOf(String(value)) ?? -1
                  : Number(value) || 0,
              }))
            : effectiveAggregation === 'count'
              ? labels.map(label => ({
                x: label,
                y: xValues.reduce<number>((count, xValue, rowIndex) => (
                  String(xValue) === label && String(previewTable[columnName]?.[rowIndex] ?? '').trim() !== ''
                    ? count + 1
                    : count
                ), 0),
              }))
              : effectiveAggregation === 'category'
                ? (previewTable[columnName] || []).map((value, rowIndex) => ({
                  x: xPoints[rowIndex],
                  y: yCategoryLabels?.indexOf(String(value)) ?? -1,
                }))
                : (previewTable[columnName] || []).map((value, rowIndex) => ({
                  x: xPoints[rowIndex],
                  y: Number(value) || 0,
                })),
        borderColor: colors[index % colors.length],
        borderWidth: 2,
        tension: 0.25,
        fill: isRadar,
        backgroundColor: isRadar
          ? withAlpha(colors[index % colors.length], 0.3)
          : colors[index % colors.length],
        pointBackgroundColor: colors[index % colors.length],
        pointBorderColor: '#ffffff',
        pointBorderWidth: isRadar ? 1 : 0,
        pointRadius: renderConfig.chartType === 'line' || isScatter || isRadar ? 3 : 0,
        pointHoverRadius: renderConfig.chartType === 'line' || isScatter || isRadar ? 5 : 0,
      })),
    };
  }, [renderConfig, previewTable]);

  useEffect(() => {
    if (!canvasRef.current || !chartData || chartData.datasets.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    const yIsCategory = renderConfig?.yAggregation === 'category' ||
      (renderConfig?.yAggregation === 'value' && renderConfig.yColumns.some(column => !isNumericColumn(previewTable?.[column] || [])));
    const { yLabels, xIsNumeric, ...chartJsData } = chartData;
    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#d4d4d4' : '#4b5563';
    const gridColor = isDark ? 'rgba(212, 212, 212, 0.18)' : 'rgba(75, 85, 99, 0.18)';
    chartRef.current = new Chart(canvasRef.current, {
      type: renderConfig?.chartType || 'line',
      data: chartJsData as never,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: textColor, usePointStyle: true, padding: 18 } },
        },
        scales: renderConfig?.chartType && isPolarChart(renderConfig.chartType)
          ? undefined
          : renderConfig?.chartType === 'radar'
            ? {
              r: {
                beginAtZero: true,
                grid: { color: gridColor },
                angleLines: { color: gridColor },
                pointLabels: { color: textColor, font: { size: 11 } },
                ticks: { color: textColor, backdropColor: 'transparent' },
              },
            }
            : {
              x: { type: xIsNumeric ? 'linear' : 'category', grid: { color: gridColor }, ticks: { color: textColor } },
              y: { type: yIsCategory ? 'category' : 'linear', labels: yLabels, grid: { color: gridColor }, ticks: { color: textColor } },
            },
      },
    }) as unknown as Chart;

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartData, renderConfig?.chartType, renderConfig?.yAggregation, previewTable, resolvedTheme]);

  if (isConfiguring) {
    return (
      <>
        <div className="chart-empty-state">{t('CHART.configuring')}</div>
        {renderConfig && (
          <ChartConfiguration
            chartData={chartData}
            config={renderConfig}
            tables={tables}
            onChange={config => setDraftConfig(config)}
            onConfirm={confirmConfiguration}
            onCancel={() => setIsConfiguring(false)}
            canvasRef={canvasRef}
            t={t}
          />
        )}
      </>
    );
  }

  if (!nodeConfig?.tableName || !chartData || chartData.datasets.length === 0) {
    const defaultConfig = getDefaultConfig(tables);
    const canConfigure = !!defaultConfig.tableName;

    return (
      <div className="chart-empty-state">
        <span>{t('CHART.empty')}</span>
        {canConfigure ? (
          <button type="button" className="chart-configure-button" onClick={openConfiguration} title={t('CHART.configure') as string} aria-label={t('CHART.configure') as string}>
            <Settings2 size={14} />
            {t('CHART.configure')}
          </button>
        ) : <small>{t('CHART.noData')}</small>}
      </div>
    );
  }

  return (
    <div className="chart-content">
      <div className="chart-toolbar">
        <button type="button" className="chart-configure-button" onClick={openConfiguration} title={t('CHART.configure') as string} aria-label={t('CHART.configure') as string}>
          <Settings2 size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="chart-canvas-wrapper"><canvas ref={canvasRef} /></div>
    </div>
  );
}
