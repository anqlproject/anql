import './MathVariableTooltip.css';

import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { isReferenceInTrash } from '@/core/database/useReferenceDatabase';
import { useReferenceStore } from '@/core/references/useReferenceStore';
import { useMathVariables } from '@/editor/context/MathVariablesContext';

function formatMathValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return String(val);
    const rounded = Number(val.toPrecision(8));
    return String(rounded);
  }
  if (typeof val === 'function') {
    return 'function';
  }
  if (typeof val === 'object') {
    if (val.isUnit) {
      return val.toString();
    }
    if (Array.isArray(val)) {
      return `[${val.slice(0, 4).join(', ')}${val.length > 4 ? ', ...' : ''}]`;
    }
    if (typeof val.toString === 'function') {
      const s = val.toString();
      if (s !== '[object Object]') return s;
    }
  }
  return String(val);
}

function getRangeFromPoint(x: number, y: number): Range | null {
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(x, y);
  }
  const anyDoc = document as any;
  if (typeof anyDoc.caretPositionFromPoint === 'function') {
    const pos = anyDoc.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
}

function getIdentifierAtPoint(
  clientX: number,
  clientY: number
): { word: string; range: Range } | null {
  const pointRange = getRangeFromPoint(clientX, clientY);
  if (!pointRange) return null;

  const node = pointRange.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.nodeValue || '';
  const offset = pointRange.startOffset;

  const isWordChar = (char: string) => /[a-zA-Z0-9_]/.test(char);

  let pos = offset;
  if (pos >= text.length || !isWordChar(text[pos])) {
    if (pos > 0 && isWordChar(text[pos - 1])) {
      pos = pos - 1;
    } else {
      return null;
    }
  }

  let start = pos;
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  let end = pos;
  while (end < text.length && isWordChar(text[end])) {
    end++;
  }

  const word = text.slice(start, end);
  if (!word || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word)) {
    return null;
  }

  let fullIdentifier = word;
  let rangeStart = start;
  let rangeEnd = end;

  if (start > 0 && text[start - 1] === '@') {
    rangeStart = start - 1;
    fullIdentifier = `@${word}`;
  } else {
    const before = text.slice(0, start);
    const dotBefore = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.$/);
    if (dotBefore) {
      fullIdentifier = `${dotBefore[1]}.${word}`;
      rangeStart = start - dotBefore[0].length;
    } else {
      const after = text.slice(end);
      const dotAfter = after.match(/^\.([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (dotAfter) {
        fullIdentifier = `${word}.${dotAfter[1]}`;
        rangeEnd = end + dotAfter[0].length;
      }
    }
  }

  try {
    const wordRange = document.createRange();
    wordRange.setStart(node, rangeStart);
    wordRange.setEnd(node, rangeEnd);
    return {
      word: fullIdentifier,
      range: wordRange,
    };
  } catch {
    return null;
  }
}

function lookupVariable(
  word: string,
  nodeKey: string,
  scopes: Record<string, Record<string, any>>,
  variables: Record<string, any>,
  tableVariables: Record<string, Record<string, number[]>>,
  references: any[]
): { name: string; value: string } | null {
  const cleanWord = word.startsWith('@') ? word.slice(1) : word;

  if (cleanWord.includes('.')) {
    const [tableName, colName] = cleanWord.split('.');
    const colData = tableVariables[tableName]?.[colName];
    if (colData) {
      return {
        name: `${tableName}.${colName}`,
        value: `[${colData.slice(0, 4).join(', ')}${colData.length > 4 ? ', ...' : ''}]`,
      };
    }
  }

  if (tableVariables[cleanWord]) {
    const cols = Object.keys(tableVariables[cleanWord]);
    return {
      name: cleanWord,
      value: `Table (${cols.join(', ')})`,
    };
  }

  const ref = references.find((r) => r.name === cleanWord);
  const isReference = Boolean(ref || word.startsWith('@'));
  const displayName = isReference ? `@${ref ? ref.name : cleanWord}` : cleanWord;

  const nodeScope = scopes[nodeKey];
  if (nodeScope && Object.prototype.hasOwnProperty.call(nodeScope, cleanWord)) {
    return {
      name: displayName,
      value: formatMathValue(nodeScope[cleanWord]),
    };
  }

  if (Object.prototype.hasOwnProperty.call(variables, cleanWord)) {
    return {
      name: displayName,
      value: formatMathValue(variables[cleanWord]),
    };
  }

  if (ref) {
    return {
      name: `@${ref.name}`,
      value: ref.value || '',
    };
  }

  return null;
}

export interface MathVariableTooltipProps {
  nodes: { key: string; dom: HTMLElement }[];
}

export function MathVariableTooltip({ nodes }: MathVariableTooltipProps) {
  const { scopes, variables, tableVariables } = useMathVariables();
  const allReferences = useReferenceStore((state) => state.references);
  const references = useMemo(
    () => allReferences.filter((reference) => !isReferenceInTrash(reference)),
    [allReferences],
  );

  const [tooltipData, setTooltipData] = useState<{ name: string; value: string } | null>(null);
  const [mountedData, setMountedData] = useState<{ name: string; value: string } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const { refs, floatingStyles, placement, x, y } = useFloating({
    placement: 'top',
    strategy: 'fixed',
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['bottom', 'top-start', 'bottom-start'] }),
      shift({ padding: 6 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const activeWordRef = useRef<string | null>(null);
  const activeNodeKeyRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible && tooltipData) {
      setMountedData(tooltipData);
    } else if (!isVisible) {
      const timeout = setTimeout(() => {
        setMountedData(null);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [isVisible, tooltipData]);

  useEffect(() => {
    const hide = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsVisible(false);
      activeWordRef.current = null;
      activeNodeKeyRef.current = null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const mathNodeEl = target.closest<HTMLElement>('.math-exp-node');
      if (!mathNodeEl) {
        hide();
        return;
      }

      const nodeItem = nodes.find((n) => n.dom === mathNodeEl || n.dom.contains(mathNodeEl));
      if (!nodeItem) {
        hide();
        return;
      }

      const match = getIdentifierAtPoint(e.clientX, e.clientY);
      if (!match) {
        hide();
        return;
      }

      const varInfo = lookupVariable(
        match.word,
        nodeItem.key,
        scopes,
        variables,
        tableVariables,
        references,
      );

      if (!varInfo) {
        hide();
        return;
      }

      if (activeWordRef.current === match.word && activeNodeKeyRef.current === nodeItem.key) {
        return;
      }

      activeWordRef.current = match.word;
      activeNodeKeyRef.current = nodeItem.key;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setIsVisible(false);

      const virtualEl = {
        getBoundingClientRect: () => {
          try {
            return match.range.getBoundingClientRect();
          } catch {
            return new DOMRect();
          }
        },
      };
      refs.setReference(virtualEl);
      setTooltipData(varInfo);

      timerRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 500);
    };

    const handlePointerLeave = () => {
      hide();
    };

    const handleScrollOrKey = () => {
      hide();
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('pointerdown', handleScrollOrKey);
    document.addEventListener('keydown', handleScrollOrKey);
    window.addEventListener('scroll', handleScrollOrKey, true);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('pointerdown', handleScrollOrKey);
      document.removeEventListener('keydown', handleScrollOrKey);
      window.removeEventListener('scroll', handleScrollOrKey, true);
    };
  }, [nodes, scopes, variables, tableVariables, references, refs]);

  if (!mountedData || x === null || y === null) {
    return null;
  }

  return createPortal(
    <div
      ref={refs.setFloating}
      style={floatingStyles}
      data-placement={placement}
      className={`math-var-tooltip ${isVisible ? 'math-var-tooltip--visible' : ''}`}
    >
      <span className="math-var-tooltip__name">{mountedData.name}</span>
      <span className="math-var-tooltip__eq">=</span>
      <span className="math-var-tooltip__value">{mountedData.value}</span>
    </div>,
    document.body,
  );
}
