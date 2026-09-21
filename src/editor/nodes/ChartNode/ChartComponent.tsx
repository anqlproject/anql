import './ChartComponent.css';

import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { Chart, registerables } from 'chart.js';
import { $getNodeByKey, LexicalEditor } from 'lexical';
import { BarChart3, Settings2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChartTableValue, useMathVariables } from '@/editor/context/MathVariablesContext';
import { useThemeStore } from '@/GlobalState/themeStore';

import { CHART_TYPES, ChartConfiguration, ChartTypePreview, COLOR_PALETTES, getDefaultConfig, isNumericColumn, isPolarChart, TableEntry } from './ChartConfiguration';
import { $isChartNode, ChartNodeConfig, ChartType } from './ChartNode';

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
  const isEditable = useLexicalEditable();
  const [isNodeSelected] = useLexicalNodeSelection(nodeKey);
  const { chartTableVariables } = useMathVariables();
  const { resolvedTheme } = useThemeStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [draftConfig, setDraftConfig] = useState<ChartNodeConfig | null>(null);
  const [hasSelectedConfigType, setHasSelectedConfigType] = useState(false);
  const [activeSeriesTab, setActiveSeriesTab] = useState<string | null>(null);

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
  const previewConfig = isConfiguring && !hasSelectedConfigType ? null : isConfiguring ? draftConfig : safeConfig;
  const previewTable = previewConfig ? chartTableVariables[previewConfig.tableName] : undefined;
  const renderConfig = previewConfig && previewTable ? normalizeConfig(previewConfig, previewTable) : previewConfig;
  const polarValueColumns = safeConfig && isPolarChart(safeConfig.chartType)
    ? Object.keys(table || {}).filter(column => isNumericColumn(table?.[column] || []))
    : [];
  const seriesTabColumns = safeConfig && !isPolarChart(safeConfig.chartType) ? safeConfig.yColumns : [];
  const chartConfigForDisplay = renderConfig && activeSeriesTab && seriesTabColumns.includes(activeSeriesTab)
    ? { ...renderConfig, yColumns: [activeSeriesTab] }
    : renderConfig;

  const updateConfig = (config: ChartNodeConfig, close = true) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isChartNode(node)) node.updateConfig(config);
    });
    if (close) setIsConfiguring(false);
  };

  const openConfiguration = () => {
    const initialConfig = safeConfig?.tableName && safeConfig.yColumns.length > 0
      ? safeConfig
      : getDefaultConfig(tables);
    setDraftConfig(initialConfig);
    setHasSelectedConfigType(Boolean(safeConfig?.tableName && safeConfig.yColumns.length > 0));
    setIsConfiguring(true);
  };

  const createChartWithType = (chartType: ChartType) => {
    const defaultConfig = getDefaultConfig(tables, chartType);
    if (defaultConfig.tableName && defaultConfig.yColumns.length > 0) updateConfig(defaultConfig);
  };

  const changeChartType = (chartType: ChartType) => {
    const nextConfig = safeConfig?.tableName && safeConfig.yColumns.length > 0
      ? { ...safeConfig, chartType }
      : getDefaultConfig(tables, chartType);
    if (nextConfig.tableName && nextConfig.yColumns.length > 0) updateConfig(nextConfig, false);
  };

  const chartData = useMemo(() => {
    const renderConfig = chartConfigForDisplay;
    const fullRenderConfig = renderConfig && activeSeriesTab ? safeConfig : renderConfig;
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
      datasets: renderConfig.yColumns.map((columnName, index) => {
        const colorIndex = fullRenderConfig?.yColumns.indexOf(columnName) ?? index;
        return {
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
        borderColor: colors[colorIndex % colors.length],
        borderWidth: 2,
        tension: 0.25,
        fill: isRadar,
        backgroundColor: isRadar
          ? withAlpha(colors[colorIndex % colors.length], 0.3)
          : colors[colorIndex % colors.length],
        pointBackgroundColor: colors[colorIndex % colors.length],
        pointBorderColor: '#ffffff',
        pointBorderWidth: isRadar ? 1 : 0,
        pointRadius: renderConfig.chartType === 'line' || isScatter || isRadar ? 3 : 0,
        pointHoverRadius: renderConfig.chartType === 'line' || isScatter || isRadar ? 5 : 0,
        };
      }),
    };
  }, [chartConfigForDisplay, previewTable]);

  const isFocused = isNodeSelected && isEditable;

  useEffect(() => {
    if (!canvasRef.current || !chartData || chartData.datasets.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    const yIsCategory = chartConfigForDisplay?.yAggregation === 'category' ||
      (chartConfigForDisplay?.yAggregation === 'value' && chartConfigForDisplay.yColumns.some(column => !isNumericColumn(previewTable?.[column] || [])));
    const { yLabels, xIsNumeric, ...chartJsData } = chartData;
    const isDark = resolvedTheme === 'dark';
    const textColor = isDark ? '#d4d4d4' : '#4b5563';
    const gridColor = isDark ? 'rgba(212, 212, 212, 0.18)' : 'rgba(75, 85, 99, 0.18)';
    chartRef.current = new Chart(canvasRef.current, {
      type: chartConfigForDisplay?.chartType || 'line',
      data: chartJsData as never,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: textColor, usePointStyle: true, padding: 18 } },
        },
        scales: chartConfigForDisplay?.chartType && isPolarChart(chartConfigForDisplay.chartType)
          ? undefined
          : chartConfigForDisplay?.chartType === 'radar'
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
              y: { type: yIsCategory ? 'category' : 'linear', labels: yLabels, grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: chartConfigForDisplay?.yBeginAtZero ?? true },
            },
      },
    }) as unknown as Chart;

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [chartData, chartConfigForDisplay?.chartType, chartConfigForDisplay?.yAggregation, previewTable, resolvedTheme]);

  if (isConfiguring) {
    return (
      <>
        <div className="chart-empty-state">{t('CHART.configuring')}</div>
        {draftConfig && (
          <ChartConfiguration
            chartData={chartData}
            config={draftConfig}
            tables={tables}
            onChange={config => {
              setDraftConfig(config);
              updateConfig(config, false);
            }}
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
          <>
            <div className="chart-auto-hint">
              <span className="chart-auto-hint-badge">
                <Sparkles size={13} aria-hidden="true" />
                {t('CHART.dataDetected')}
              </span>
              <span className="chart-auto-hint-text">{t('CHART.chooseTypeToCreate')}</span>
            </div>
            <div className="chart-type-picker" role="group" aria-label={t('CHART.chooseType') as string}>
              {CHART_TYPES.map(chartType => (
                <button
                  key={chartType}
                  type="button"
                  className="chart-type-picker-button"
                  onClick={() => createChartWithType(chartType)}
                  title={t(`CHART.types.${chartType}`) as string}
                  aria-label={t(`CHART.types.${chartType}`) as string}
                >
                  <ChartTypePreview type={chartType} />
                </button>
              ))}
            </div>
            <button type="button" className="chart-configure-button" onClick={openConfiguration} title={t('CHART.configure') as string} aria-label={t('CHART.configure') as string}>
              <Settings2 size={14} aria-hidden="true" />
            </button>
          </>
        ) : <small>{t('CHART.noData')}</small>}
      </div>
    );
  }

  return (
    <div className={`chart-content${isFocused ? ' focused' : ''}`}>
      {isEditable && <div className="chart-toolbar">
        {seriesTabColumns.length > 1 && (
          <div className="chart-axis-tabs" role="tablist" aria-label={t('CHART.ySeries') as string}>
            <button
              type="button"
              role="tab"
              aria-selected={activeSeriesTab === null}
              className={`chart-axis-tab${activeSeriesTab === null ? ' is-active' : ''}`}
              onClick={() => setActiveSeriesTab(null)}
            >
              {t('CHART.allSeries')}
            </button>
            {seriesTabColumns.map(column => (
              <button
                key={column}
                type="button"
                role="tab"
                aria-selected={activeSeriesTab === column}
                className={`chart-axis-tab${activeSeriesTab === column ? ' is-active' : ''}`}
                onClick={() => setActiveSeriesTab(column)}
              >
                {column}
              </button>
            ))}
          </div>
        )}
        {polarValueColumns.length > 1 && (
          <div className="chart-axis-tabs" role="tablist" aria-label={t('CHART.value') as string}>
            {polarValueColumns.map(column => (
              <button
                key={column}
                type="button"
                role="tab"
                aria-selected={safeConfig?.valueColumn === column}
                className={`chart-axis-tab${safeConfig?.valueColumn === column ? ' is-active' : ''}`}
                onClick={() => safeConfig && updateConfig({ ...safeConfig, valueColumn: column }, false)}
              >
                {column}
              </button>
            ))}
          </div>
        )}
        <div className="chart-toolbar-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="chart-type-menu-button" title={t('CHART.chooseType') as string} aria-label={t('CHART.chooseType') as string}>
                <BarChart3 size={15} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="chart-type-menu-content">
              {CHART_TYPES.map(chartType => (
                <DropdownMenuItem key={chartType} onSelect={() => changeChartType(chartType)}>
                  <ChartTypePreview type={chartType} />
                  <span>{t(`CHART.types.${chartType}`)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className="chart-configure-button" onClick={openConfiguration} title={t('CHART.configure') as string} aria-label={t('CHART.configure') as string}>
            <Settings2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>}
      <div className="chart-canvas-wrapper"><canvas ref={canvasRef} /></div>
    </div>
  );
}
