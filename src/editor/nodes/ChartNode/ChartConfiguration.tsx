import './ChartConfiguration.css';

import type { TFunction } from 'i18next';
import { ChevronDown, Palette, Settings2, SlidersHorizontal } from 'lucide-react';
import type { RefObject } from 'react';
import { useState } from 'react';

import { ComponentDialog } from '@/components/custom/ComponentDialog/ComponentDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DIMENSIONS } from '@/core/global/defaultValues';
import { ChartTableValue } from '@/editor/context/MathVariablesContext';

import { ChartAggregation, ChartNodeConfig, ChartType } from './ChartNode';
import { ChartSelect, ChartSelectOptionItem } from './ChartSelect';

export const COLOR_PALETTES: Record<string, string[]> = {
  default: ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed'],
  pastel: ['#93c5fd', '#fca5a5', '#86efac', '#fcd34d', '#c4b5fd'],
  vibrant: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
};

export const COLORS = COLOR_PALETTES.default;

export type ChartTable = Record<string, ChartTableValue[]>;
export type TableEntry = [string, ChartTable];

export interface AutoChartProposal {
  tableName: string;
  config: ChartNodeConfig;
}

export function isNumericColumn(values: ChartTableValue[]): boolean {
  const populatedValues = values.filter(value => String(value).trim() !== '');
  return populatedValues.length > 0 && populatedValues.every(value => Number.isFinite(Number(value)));
}

export function getDefaultConfig(tables: TableEntry[], chartType: ChartType = 'line'): ChartNodeConfig {
  const [tableName, columns] = tables[0] || ['', {}];
  const columnNames = Object.keys(columns);
  const numericColumns = columnNames.filter(column => isNumericColumn(columns[column]));

  return {
    chartType,
    tableName,
    xColumn: columnNames[0] || '',
    yColumns: numericColumns.filter(column => column !== columnNames[0]),
    yAggregation: 'value',
    categoryColumn: columnNames.find(column => !isNumericColumn(columns[column])) || columnNames[0] || '',
    valueColumn: numericColumns[0] || '',
    colorPalette: 'default',
    yBeginAtZero: true,
  };
}

export function getAutoChartProposal([tableName, columns]: TableEntry): AutoChartProposal | null {
  const columnNames = Object.keys(columns).filter(column => !column.startsWith('_'));
  if (columnNames.length < 2) return null;

  const numericColumns = columnNames.filter(column => isNumericColumn(columns[column]));
  const categoryColumn = columnNames.find(column => !isNumericColumn(columns[column]));
  const xColumn = categoryColumn || columnNames[0];
  const yColumns = numericColumns.filter(column => column !== xColumn);

  if (yColumns.length === 0) return null;

  const xValues = columns[xColumn].filter(value => String(value).trim() !== '');
  const distinctXValues = new Set(xValues.map(String)).size;
  const xIsNumeric = isNumericColumn(columns[xColumn]);
  const chartType: ChartType = xIsNumeric
    ? 'scatter'
    : yColumns.length === 1 && distinctXValues <= 12
      ? 'bar'
      : 'line';

  return {
    tableName,
    config: {
      ...getDefaultConfig([[tableName, columns]], chartType),
      tableName,
      xColumn,
      yColumns,
      chartType,
      categoryColumn: categoryColumn || xColumn,
      valueColumn: yColumns[0],
    },
  };
}

export function getAutoChartProposals(tables: TableEntry[]): AutoChartProposal[] {
  return tables
    .map(getAutoChartProposal)
    .filter((proposal): proposal is AutoChartProposal => proposal !== null);
}

export function getYAggregation(columns: ChartTable, yColumns: string[]): ChartAggregation {
  if (yColumns.some(column => !isNumericColumn(columns[column] || []))) return 'category';
  return 'value';
}

export function isPolarChart(chartType: ChartType): boolean {
  return chartType === 'pie' || chartType === 'doughnut';
}

export const CHART_TYPES: ChartType[] = ['line', 'bar', 'scatter', 'radar', 'pie', 'doughnut'];
export const CONFIG_CHART_TYPES: Array<ChartType | null> = [null, ...CHART_TYPES];

interface ChartConfigurationProps {
  chartData: { datasets: unknown[] } | null;
  config: ChartNodeConfig;
  tables: TableEntry[];
  onChange: (config: ChartNodeConfig) => void;
  onCancel: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  t: TFunction;
}

type ConfigSection = 'axesSeries' | 'options' | 'colors';

export function ChartConfiguration({
  chartData,
  config,
  tables,
  onChange,
  onCancel,
  canvasRef,
  t,
}: ChartConfigurationProps) {
  const [activeSection, setActiveSection] = useState<ConfigSection>('axesSeries');

  const handleTableChange = (tableName: string) => {
    onChange({
      ...getDefaultConfig(tables.filter(([name]) => name === tableName), config.chartType),
      tableName,
    });
  };

  return (
    <ComponentDialog
      title={(
        <label className="chart-dialog-title-control">
          <span>{t('CHART.table')}</span>
          <ChartSelect
            value={config.tableName}
            onChange={handleTableChange}
            options={tables.map(([name]) => ({ value: name, label: name }))}
            ariaLabel={t('CHART.table') as string}
          />
        </label>
      )}
      onClose={onCancel}
      containerStyle={{
        width: DIMENSIONS.panelWidth,
        height: DIMENSIONS.panelHeight,
        maxWidth: '92vw',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
    >
      <div className="chart-dialog-preview">
        {chartData && chartData.datasets.length > 0
          ? <div className="chart-canvas-wrapper"><canvas ref={canvasRef} /></div>
          : <div className="chart-dialog-empty">{t('CHART.previewEmpty')}</div>}
      </div>
      <div className="chart-settings-layout">
        <nav className="chart-settings-sidebar" aria-label={t('CHART.settingsNavigation') as string}>
          <button type="button" className={activeSection === 'axesSeries' ? 'is-active' : ''} onClick={() => setActiveSection('axesSeries')}>
            <SlidersHorizontal size={15} />
            <span>{t('CHART.sections.axesSeries')}</span>
          </button>
          <button type="button" className={activeSection === 'colors' ? 'is-active' : ''} onClick={() => setActiveSection('colors')}>
            <Palette size={15} />
            <span>{t('CHART.sections.colors')}</span>
          </button>
          <button type="button" className={activeSection === 'options' ? 'is-active' : ''} onClick={() => setActiveSection('options')}>
            <Settings2 size={15} />
            <span>{t('CHART.sections.options')}</span>
          </button>
        </nav>
        <div className="chart-settings-content">
          <ChartConfigPanel config={config} tables={tables} onChange={onChange} t={t} section={activeSection} />
        </div>
      </div>
    </ComponentDialog>
  );
}

function ChartConfigPanel({
  config,
  tables,
  onChange,
  t,
  section,
}: {
  config: ChartNodeConfig;
  tables: TableEntry[];
  onChange: (config: ChartNodeConfig) => void;
  t: TFunction;
  section: ConfigSection;
}) {
  const columns = tables.find(([name]) => name === config.tableName)?.[1] || {};
  const columnNames = Object.keys(columns);
  const numericColumns = columnNames.filter(column => isNumericColumn(columns[column]));
  const xIsNumeric = isNumericColumn(columns[config.xColumn] || []);
  const availableYColumns = xIsNumeric ? columnNames : numericColumns;
  const selectedYColumns = config.yColumns.filter(column => availableYColumns.includes(column));
  const selectedTextColumn = selectedYColumns.some(column => !isNumericColumn(columns[column] || []));
  const selectedNumericColumn = selectedYColumns.some(column => isNumericColumn(columns[column] || []));
  const setField = (field: keyof ChartNodeConfig, value: string) => onChange({ ...config, [field]: value });
  const currentColors = COLOR_PALETTES[config.colorPalette] || COLOR_PALETTES.default;

  return (
    <div className="chart-config-panel" onClick={event => event.stopPropagation()}>
      {section === 'axesSeries' && (isPolarChart(config.chartType) ? (
        <>
          <label>{t('CHART.category')}
            <ChartSelect
              value={config.categoryColumn}
              onChange={val => setField('categoryColumn', val)}
              options={columnNames.map(column => ({ value: column, label: column }))}
            />
          </label>
          <label>{t('CHART.value')}
            <ChartSelect
              value={config.valueColumn}
              onChange={val => setField('valueColumn', val)}
              options={numericColumns.map(column => ({ value: column, label: column }))}
            />
          </label>
        </>
      ) : (
        <>
          <label>{t('CHART.xAxis')}
            <ChartSelect
              value={config.xColumn}
              onChange={val => {
                const xColumn = val;
                const nextXIsNumeric = isNumericColumn(columns[xColumn] || []);
                const yColumns = nextXIsNumeric
                  ? selectedYColumns.filter(column => column !== xColumn)
                  : selectedYColumns.filter(column => isNumericColumn(columns[column] || []));
                onChange({ ...config, xColumn, yColumns, yAggregation: getYAggregation(columns, yColumns) });
              }}
              options={columnNames.map(column => {
                const seriesIndex = selectedYColumns.indexOf(column);
                return {
                  value: column,
                  label: column,
                  color: seriesIndex >= 0 ? currentColors[seriesIndex % currentColors.length] : '#d1d5db',
                  disabled: selectedYColumns.includes(column),
                };
              })}
            />
          </label>
          <label>{t('CHART.ySeries')}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="chart-custom-select" tabIndex={0} role="button">
                  <span className="chart-custom-select-label">
                    {selectedYColumns.length === 0 ? '--' : selectedYColumns.join(', ')}
                  </span>
                  <ChevronDown size={14} className="chart-custom-select-icon" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="chart-custom-select-content" onCloseAutoFocus={(e) => e.preventDefault()}>
                {columnNames.map((column) => {
                  const isDisabled = column === config.xColumn || (!xIsNumeric && !isNumericColumn(columns[column] || []));
                  const isSelected = selectedYColumns.includes(column);
                  const colorIndex = selectedYColumns.indexOf(column);
                  const color = isSelected ? currentColors[colorIndex % currentColors.length] : '#d1d5db';
                  return (
                    <ChartSelectOptionItem
                      key={column}
                      option={{ value: column, label: column, color, disabled: isDisabled }}
                      selected={isSelected}
                      keepOpen
                      onSelect={() => {
                        const yColumns = isSelected
                          ? selectedYColumns.filter(selectedColumn => selectedColumn !== column)
                          : [...selectedYColumns, column];
                        onChange({ ...config, yColumns, yAggregation: getYAggregation(columns, yColumns) });
                      }}
                    />
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </label>
        </>
      ))}
      {section === 'options' && !isPolarChart(config.chartType) && (
        <>
          <div className="chart-checkbox-label">
            <span>{t('CHART.yBeginAtZero')}</span>
            <input
              type="checkbox"
              checked={config.yBeginAtZero}
              onChange={e => onChange({ ...config, yBeginAtZero: e.target.checked })}
            />
          </div>
          <label>{t('CHART.yCalculation')}
            <ChartSelect
              value={config.yAggregation}
              onChange={val => onChange({ ...config, yAggregation: val as ChartAggregation })}
              options={[
                { value: 'value', label: t('CHART.aggregations.value') as string, disabled: selectedTextColumn },
                { value: 'category', label: t('CHART.aggregations.category') as string, disabled: !selectedTextColumn || selectedNumericColumn },
                { value: 'count', label: t('CHART.aggregations.count') as string },
              ]}
            />
          </label>
          {!xIsNumeric && <small className="chart-config-hint">{t('CHART.textXHint')}</small>}
        </>
      )}
      {section === 'colors' && (
        <fieldset className="chart-color-fieldset">
          <legend>{t('CHART.colorPalette')}</legend>
          <div className="chart-palette-grid">
            {Object.entries(COLOR_PALETTES).map(([paletteName, colors]) => (
              <button
                key={paletteName}
                type="button"
                className={`chart-palette-option${config.colorPalette === paletteName ? ' is-selected' : ''}`}
                aria-pressed={config.colorPalette === paletteName}
                onClick={() => onChange({ ...config, colorPalette: paletteName })}
              >
                <div className="chart-palette-preview">
                  {colors.map((color, index) => (
                    <span key={index} className="chart-palette-swatch" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <span>{t(`CHART.palettes.${paletteName}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function ChartTypePreview({ type }: { type: ChartType | null }) {
  if (type === null) {
    return <span className="chart-type-preview chart-type-preview--none" />;
  }
  if (type === 'bar') {
    return <span className="chart-type-preview chart-type-preview--bar"><i /><i /><i /><i /></span>;
  }
  if (type === 'scatter') {
    return <span className="chart-type-preview chart-type-preview--scatter"><i /><i /><i /><i /><i /></span>;
  }
  if (type === 'radar') {
    return <span className="chart-type-preview chart-type-preview--radar"><i /></span>;
  }
  if (type === 'pie' || type === 'doughnut') {
    return <span className={`chart-type-preview chart-type-preview--${type}`}><i /></span>;
  }
  return <span className="chart-type-preview chart-type-preview--line"><i /></span>;
}
