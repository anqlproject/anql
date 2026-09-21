import { DecoratorBlockNode, SerializedDecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode';
import type { EditorConfig } from 'lexical';
import { DOMConversionMap, DOMConversionOutput, DOMExportOutput, LexicalEditor, LexicalNode, NodeKey, Spread } from 'lexical';
import React from 'react';

import { ChartComponent } from './ChartComponent.tsx';

export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
export type ChartAggregation = 'value' | 'category' | 'count';

export interface ChartNodeConfig {
  chartType: ChartType;
  tableName: string;
  xColumn: string;
  yColumns: string[];
  yAggregation: ChartAggregation;
  categoryColumn: string;
  valueColumn: string;
  colorPalette: string;
  yBeginAtZero: boolean;
}

export type SerializedChartNode = Spread<ChartNodeConfig, SerializedDecoratorBlockNode>;

function convertChartElement(): DOMConversionOutput {
  return { node: $createChartNode() };
}

export class ChartNode extends DecoratorBlockNode {
  __chartType: ChartType;
  __tableName: string;
  __xColumn: string;
  __yColumns: string[];
  __yAggregation: ChartAggregation;
  __categoryColumn: string;
  __valueColumn: string;
  __colorPalette: string;
  __yBeginAtZero: boolean;

  static getType(): string {
    return 'chart';
  }

  static clone(node: ChartNode): ChartNode {
    return new ChartNode(node.getConfig(), node.__format, node.__key);
  }

  constructor(config: Partial<ChartNodeConfig> = {}, format?: any, key?: NodeKey) {
    super(format, key);
    const legacyConfig = config as Partial<ChartNodeConfig> & { labelColumn?: string; dataColumns?: string[] };
    this.__chartType = config.chartType || 'line';
    this.__tableName = config.tableName || '';
    this.__xColumn = config.xColumn || legacyConfig.labelColumn || '';
    this.__yColumns = config.yColumns || legacyConfig.dataColumns || [];
    this.__yAggregation = config.yAggregation || 'value';
    this.__categoryColumn = config.categoryColumn || '';
    this.__valueColumn = config.valueColumn || '';
    this.__colorPalette = config.colorPalette || 'default';
    this.__yBeginAtZero = config.yBeginAtZero ?? true;
  }

  getConfig(): ChartNodeConfig {
    return {
      chartType: this.__chartType,
      tableName: this.__tableName,
      xColumn: this.__xColumn,
      yColumns: [...this.__yColumns],
      yAggregation: this.__yAggregation,
      categoryColumn: this.__categoryColumn,
      valueColumn: this.__valueColumn,
      colorPalette: this.__colorPalette,
      yBeginAtZero: this.__yBeginAtZero,
    };
  }

  updateConfig(config: ChartNodeConfig): void {
    const writable = this.getWritable();
    writable.__chartType = config.chartType;
    writable.__tableName = config.tableName;
    writable.__xColumn = config.xColumn;
    writable.__yColumns = [...config.yColumns];
    writable.__yAggregation = config.yAggregation;
    writable.__categoryColumn = config.categoryColumn;
    writable.__valueColumn = config.valueColumn;
    writable.__colorPalette = config.colorPalette;
    writable.__yBeginAtZero = config.yBeginAtZero;
  }

  exportJSON(): SerializedChartNode {
    return { ...super.exportJSON(), ...this.getConfig() };
  }

  static importJSON(serializedNode: unknown): ChartNode {
    const chartData = serializedNode as SerializedChartNode;
    return $createChartNode(chartData).updateFromJSON(chartData);
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'chart-node';
    return dom;
  }

  updateDOM(): false {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return { div: () => ({ conversion: convertChartElement, priority: 1 }) };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const { element } = super.exportDOM(editor);
    if (element instanceof HTMLElement) element.classList.add('chart-node');
    return { element };
  }

  decorate(editor: LexicalEditor, _config: EditorConfig): React.JSX.Element {
    return <ChartComponent editor={editor} nodeKey={this.getKey()} />;
  }
}

export function $createChartNode(config: Partial<ChartNodeConfig> = {}): ChartNode {
  return new ChartNode(config);
}

export function $isChartNode(node: LexicalNode | null | undefined): node is ChartNode {
  return node instanceof ChartNode;
}
