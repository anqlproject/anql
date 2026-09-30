import './MiniChartTableEditor.css';
import '../TableNode/TableMenu/TableMenu.css';

import * as Popover from '@radix-ui/react-popover';
import { Plus, Trash2 } from 'lucide-react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChartNodeConfig } from './ChartNode';

export function MiniChartTableEditor({
  config,
  onChange,
}: {
  config: ChartNodeConfig;
  onChange: (config: ChartNodeConfig) => void;
}) {
  const { t } = useTranslation();
  const columns = Object.keys(config.inlineTable || {});
  const rowCount = Math.max(0, ...columns.map(column => config.inlineTable?.[column].length || 0));
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | null>(null);

  const handleGridMouseOver = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.chart-inline-table-handle')) return;

    const rowCell = target.closest<HTMLElement>('[data-mini-row-index]');
    if (rowCell) {
      setHoveredRowIndex(Number(rowCell.dataset.miniRowIndex));
      setHoveredColumnIndex(null);
      return;
    }

    const headerCell = target.closest<HTMLElement>('[data-mini-column-index]');
    setHoveredRowIndex(null);
    setHoveredColumnIndex(headerCell ? Number(headerCell.dataset.miniColumnIndex) : null);
  };

  const updateCell = (column: string, rowIndex: number, value: string) => {
    const nextTable = Object.fromEntries(columns.map(name => [name, [...(config.inlineTable?.[name] || [])]]));
    nextTable[column][rowIndex] = value;
    onChange({ ...config, inlineTable: nextTable });
  };

  const renameColumn = (column: string, label: string) => {
    const nextName = label.trim();
    if (!nextName || (nextName !== column && columns.includes(nextName))) return;
    const nextTable = Object.fromEntries(columns.map(name => [name === column ? nextName : name, config.inlineTable?.[name] || []]));
    onChange({
      ...config,
      inlineTable: nextTable,
      xColumn: config.xColumn === column ? nextName : config.xColumn,
      yColumns: config.yColumns.map(name => name === column ? nextName : name),
      categoryColumn: config.categoryColumn === column ? nextName : config.categoryColumn,
      valueColumn: config.valueColumn === column ? nextName : config.valueColumn,
    });
  };

  const addRow = () => onChange({
    ...config,
    inlineTable: Object.fromEntries(columns.map(column => [column, [...(config.inlineTable?.[column] || []), '']])),
  });

  const insertRow = (rowIndex: number) => onChange({
    ...config,
    inlineTable: Object.fromEntries(columns.map(column => {
      const values = [...(config.inlineTable?.[column] || [])];
      values.splice(rowIndex, 0, '');
      return [column, values];
    })),
  });

  const deleteRow = (rowIndex: number) => onChange({
    ...config,
    inlineTable: Object.fromEntries(columns.map(column => [
      column,
      (config.inlineTable?.[column] || []).filter((_, index) => index !== rowIndex),
    ])),
  });

  const addColumn = () => {
    const baseName = `${t('CHART.column')} ${columns.length + 1}`;
    let columnName = baseName;
    let suffix = 2;
    while (columns.includes(columnName)) columnName = `${baseName} ${suffix++}`;
    onChange({
      ...config,
      inlineTable: { ...config.inlineTable, [columnName]: Array.from({ length: rowCount }, () => '') },
    });
  };

  const insertColumn = (columnIndex: number) => {
    const baseName = `${t('CHART.column')} ${columns.length + 1}`;
    let columnName = baseName;
    let suffix = 2;
    while (columns.includes(columnName)) columnName = `${baseName} ${suffix++}`;
    const nextColumns = [...columns];
    nextColumns.splice(columnIndex, 0, columnName);
    const nextTable = Object.fromEntries(nextColumns.map(column => [
      column,
      column === columnName ? Array.from({ length: rowCount }, () => '') : config.inlineTable?.[column] || [],
    ]));
    onChange({ ...config, inlineTable: nextTable });
  };

  const deleteColumn = (column: string) => {
    const nextTable = Object.fromEntries(columns.filter(name => name !== column).map(name => [name, config.inlineTable?.[name] || []]));
    const nextColumns = Object.keys(nextTable);
    const replacement = nextColumns[0] || '';
    onChange({
      ...config,
      inlineTable: nextTable,
      xColumn: config.xColumn === column ? replacement : config.xColumn,
      yColumns: config.yColumns.filter(name => name !== column),
      categoryColumn: config.categoryColumn === column ? replacement : config.categoryColumn,
      valueColumn: config.valueColumn === column ? replacement : config.valueColumn,
    });
  };

  const columnTracks = columns.map(column => {
    const longestCell = Math.max(
      column.length,
      ...(config.inlineTable?.[column] || []).map(value => String(value ?? '').length),
    );
    return `minmax(80px, ${Math.max(10, longestCell + 2)}ch)`;
  });
  const gridColumns = ['0px', ...columnTracks];

  return (
    <div className="chart-inline-table-editor">
      <div className="chart-inline-table-layout">
        <div className="chart-inline-table-scroll">
          <div className="chart-inline-table-content">
            <div
              className="chart-inline-table-grid chart-inline-table-grid--with-gutters"
              onMouseOver={handleGridMouseOver}
              onMouseLeave={() => {
                setHoveredRowIndex(null);
                setHoveredColumnIndex(null);
              }}
              style={{
                gridTemplateColumns: gridColumns.join(' '),
                gridTemplateRows: `0px 34px repeat(${rowCount}, minmax(32px, auto))`,
              }}
            >
              {columns.map((column, index) => (
                <MiniTableActionMenu
                  key={`column-menu-${column}`}
                  axis="column"
                  label={t('CHART.columnOptions', { column }) as string}
                  isVisible={hoveredColumnIndex === index}
                  style={{ gridColumn: index + 2, gridRow: 1 }}
                  onAddBefore={() => insertColumn(index)}
                  onAddAfter={() => insertColumn(index + 1)}
                  onDelete={() => deleteColumn(column)}
                />
              ))}
              {columns.map((column, index) => (
                <input
                  key={`header-${index}`}
                  className="chart-inline-table-header"
                  style={{ gridColumn: index + 2, gridRow: 2 }}
                  data-mini-column-index={index}
                  aria-label={t('CHART.columnName', { column }) as string}
                  value={column}
                  onChange={event => renameColumn(column, event.target.value)}
                />
              ))}
              {Array.from({ length: rowCount }, (_, rowIndex) => (
                <Fragment key={`row-${rowIndex}`}>
                  <MiniTableActionMenu
                    axis="row"
                    label={t('CHART.rowOptions', { row: rowIndex + 1 }) as string}
                    isVisible={hoveredRowIndex === rowIndex}
                    style={{ gridColumn: 1, gridRow: rowIndex + 3 }}
                    onAddBefore={() => insertRow(rowIndex)}
                    onAddAfter={() => insertRow(rowIndex + 1)}
                    onDelete={() => deleteRow(rowIndex)}
                  />
                  {columns.map((column, columnIndex) => (
                    <input
                      key={`${column}-${rowIndex}`}
                      style={{ gridColumn: columnIndex + 2, gridRow: rowIndex + 3 }}
                      data-mini-row-index={rowIndex}
                      aria-label={t('CHART.cell', { row: rowIndex + 1, column }) as string}
                      value={String(config.inlineTable?.[column][rowIndex] ?? '')}
                      onChange={event => updateCell(column, rowIndex, event.target.value)}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
            <button
              className="chart-inline-table-add-column"
              type="button"
              onClick={addColumn}
              title={t('CHART.addColumn') as string}
              aria-label={t('CHART.addColumn') as string}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="chart-inline-table-actions">
          <button
            type="button"
            onClick={addRow}
            title={t('CHART.addRow') as string}
            aria-label={t('CHART.addRow') as string}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniTableActionMenu({
  axis,
  label,
  style,
  isVisible,
  onAddBefore,
  onAddAfter,
  onDelete,
}: {
  axis: 'row' | 'column';
  label: string;
  style: CSSProperties;
  isVisible: boolean;
  onAddBefore: () => void;
  onAddAfter: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const beforeLabel = axis === 'column' ? 'TABLE.addColumnLeft' : 'TABLE.addRowAbove';
  const afterLabel = axis === 'column' ? 'TABLE.addColumnRight' : 'TABLE.addRowBelow';

  const runAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`chart-inline-table-handle chart-inline-table-handle--${axis}${isVisible ? ' is-visible' : ''}`}
          style={style}
          title={label}
          aria-label={label}
          aria-expanded={open}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="table-th-popover-content chart-mini-table-popover"
          side={axis === 'column' ? 'top' : 'left'}
          align="center"
          sideOffset={4}
          onOpenAutoFocus={event => event.preventDefault()}
          onCloseAutoFocus={event => event.preventDefault()}
        >
          <button type="button" className="table-menu-item" onClick={() => runAction(onAddBefore)}>
            <Plus size={16} /> {t(beforeLabel)}
          </button>
          <button type="button" className="table-menu-item" onClick={() => runAction(onAddAfter)}>
            <Plus size={16} /> {t(afterLabel)}
          </button>
          <div className="table-menu-divider" />
          <button type="button" className="table-menu-item-danger" onClick={() => runAction(onDelete)}>
            <Trash2 size={16} /> {t('TABLE.delete')}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}