import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { useTranslation } from 'react-i18next';

interface ColumnMeta {
    type?: 'text' | 'number' | 'checkbox' | 'date';
}

interface ColumnDef {
    meta?: ColumnMeta;
}

interface Column {
    id: string;
    columnDef: ColumnDef;
}

interface Row {
    index: number;
}

interface TableMeta {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    goToNextCell?: (rowIndex: number, columnIndex: number) => void;
    goToPreviousCell?: (rowIndex: number, columnIndex: number) => void;
    goToCellBelow?: (rowIndex: number, columnIndex: number) => void;
    goToCellAbove?: (rowIndex: number, columnIndex: number) => void;
    getColumnIndex?: (columnId: string) => number;
}

interface TableOptions {
    meta?: TableMeta;
}

interface Table {
    options: TableOptions;
}

interface EditableCellProps {
    getValue: () => unknown;
    row: Row;
    column: Column;
    table: Table;
}

export function getHighlightedSegments(value: unknown, query: string) {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    if (!query || !text) {
        return [{ text, isMatch: false }];
    }

    const lowerQuery = query.toLowerCase();
    const lowerText = text.toLowerCase();
    const segments: Array<{ text: string; isMatch: boolean }> = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerQuery);

    while (index !== -1) {
        if (index > lastIndex) {
            segments.push({ text: text.slice(lastIndex, index), isMatch: false });
        }
        segments.push({ text: text.slice(index, index + query.length), isMatch: true });
        lastIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
    }

    if (lastIndex < text.length) {
        segments.push({ text: text.slice(lastIndex), isMatch: false });
    }

    return segments.length > 0 ? segments : [{ text, isMatch: false }];
}

function getColumnIndex(table: Table, columnId: string): number {
    return table.options.meta?.getColumnIndex?.(columnId) ?? -1;
}

function handleCellKeyDown(
    e: React.KeyboardEvent,
    table: Table,
    rowIndex: number,
    columnId: string,
) {
    // Allow undo (Ctrl/Cmd+Z), redo (Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z) and Escape
    // to bubble up to Lexical so the editor can handle them.
    const isUndoRedo =
        (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y') &&
        (e.ctrlKey || e.metaKey);
    if (isUndoRedo || e.key === 'Escape') {
        return; // let the event bubble
    }

    e.stopPropagation();

    if (rowIndex < 0) return;

    const columnIndex = getColumnIndex(table, columnId);
    if (columnIndex < 0) return;

    if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
            table.options.meta?.goToPreviousCell?.(rowIndex, columnIndex);
        } else {
            table.options.meta?.goToNextCell?.(rowIndex, columnIndex);
        }
        return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        table.options.meta?.goToCellBelow?.(rowIndex, columnIndex);
        return;
    }

    if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        table.options.meta?.goToCellAbove?.(rowIndex, columnIndex);
    }
}

export default function EditableCell({ getValue, row: { index }, column: { id, columnDef }, table }: EditableCellProps) {
    const { t } = useTranslation();
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isActiveMatch, setIsActiveMatch] = useState(false);
    const type = columnDef.meta?.type || 'text';

    const onBlur = () => {
        setTimeout(() => {
            table.options.meta?.updateData(index, id, value);
        }, 0);
    };

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    useEffect(() => {
        const updateQuery = () => {
            setSearchQuery(document.body.dataset.searchQuery || '');
        };

        updateQuery();
        const observer = new MutationObserver(updateQuery);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-search-query'] });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const updateActiveMatch = () => {
            const activeNodeKey = document.body.dataset.searchActiveNodeKey;
            const activeRowIndex = document.body.dataset.searchActiveRowIndex;
            const activeColumnId = document.body.dataset.searchActiveColumnId;

            // Get the node key from the closest table container
            const tableContainer = document.querySelector('.table-container');
            const nodeKey = tableContainer?.getAttribute('data-node-key');

            const isActive = Boolean(
                searchQuery &&
                nodeKey === activeNodeKey &&
                String(index) === activeRowIndex &&
                id === activeColumnId
            );

            setIsActiveMatch(isActive);
        };

        updateActiveMatch();
        const observer = new MutationObserver(updateActiveMatch);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-search-active-node-key', 'data-search-active-row-index', 'data-search-active-column-id'] });

        return () => observer.disconnect();
    }, [searchQuery, index, id]);

    const highlightedSegments = useMemo(() => getHighlightedSegments(value, searchQuery), [value, searchQuery]);
    const shouldShowHighlightOverlay = Boolean(searchQuery) && !isFocused && (type === 'text' || type === 'number') && highlightedSegments.some(segment => segment.isMatch);

    const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();

        // Force focus on left click
        if (e.button === 0 && e.currentTarget instanceof HTMLInputElement) {
            e.currentTarget.focus();
        }

        if (e.button !== 2 || !(e.currentTarget instanceof HTMLInputElement)) {
            return;
        }
        
        e.preventDefault();

        const input = e.currentTarget;
        let offset: number | undefined;

        const doc = document as Document & {
            caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null;
        };
        if (doc.caretPositionFromPoint) {
            const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
            offset = pos?.offset ?? input.value.length;
        } else if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            offset = range?.startOffset ?? input.value.length;
        }

        if (offset !== undefined) {
            setTimeout(() => {
                input.setSelectionRange(offset, offset);
            }, 0);
        }
    };

    if (type === 'checkbox') {
        return (
            <div className="table-checkbox-wrapper">
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => {
                        const checked = e.target.checked;
                        setValue(checked);
                        table.options.meta?.updateData(index, id, checked);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => handleCellKeyDown(e, table, index, id)}
                    className="table-checkbox"
                />
            </div>
        );
    }

    if (type === 'date') {
        return (
            <div className="table-date-wrapper">
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <button
                            type="button"
                            className="table-date-btn"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <CalendarIcon className="table-date-icon" />
                            <span className="truncate">{value && typeof value === 'string' ? format(new Date(value), 'PP') : <span className="table-date-text-empty">{t('TABLE.chooseDate')}</span>}</span>
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content className="table-popover-content">
                            <DayPicker
                                mode="single"
                                selected={value && typeof value === 'string' ? new Date(value) : undefined}
                                onSelect={(date) => {
                                    const dateStr = date ? date.toISOString() : '';
                                    setValue(dateStr);
                                    table.options.meta?.updateData(index, id, dateStr);
                                }}
                            />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>
        );
    }

    if (type === 'number') {
        return (
            <div className="table-input-wrapper">
                {shouldShowHighlightOverlay && (
                    <div className="table-search-highlight-overlay" aria-hidden="true">
                        {highlightedSegments.map((segment, segmentIndex) => (
                            <span key={`${segment.text}-${segmentIndex}`} className={segment.isMatch ? (isActiveMatch ? 'table-search-match-active' : 'table-search-match') : undefined}>
                                {segment.text}
                            </span>
                        ))}
                    </div>
                )}
                <input
                    type="number"
                    value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                    onChange={e => setValue(e.target.value)}
                    onBlur={() => {
                        setIsFocused(false);
                        onBlur();
                    }}
                    onFocus={() => setIsFocused(true)}
                    onMouseDown={handleMouseDown}
                    onKeyDown={(e) => handleCellKeyDown(e, table, index, id)}
                    className="table-input"
                    placeholder={isFocused ? String(t('TABLE.placeholderNumber')) : ''}
                    style={shouldShowHighlightOverlay ? { color: 'transparent', caretColor: 'var(--text-primary)' } : undefined}
                />
            </div>
        );
    }


    return (
        <div className="table-input-wrapper">
            {shouldShowHighlightOverlay && (
                <div className="table-search-highlight-overlay" aria-hidden="true">
                    {highlightedSegments.map((segment, segmentIndex) => (
                        <span key={`${segment.text}-${segmentIndex}`} className={segment.isMatch ? (isActiveMatch ? 'table-search-match-active' : 'table-search-match') : undefined}>
                            {segment.text}
                        </span>
                    ))}
                </div>
            )}
            <input
                value={typeof value === 'string' ? value : ''}
                onChange={e => setValue(e.target.value)}
                onBlur={() => {
                    setIsFocused(false);
                    onBlur();
                }}
                onFocus={() => setIsFocused(true)}
                onMouseDown={handleMouseDown}
                onKeyDown={(e) => handleCellKeyDown(e, table, index, id)}
                className="table-input"
                placeholder={isFocused ? String(t('TABLE.placeholderText')) : ''}
                style={shouldShowHighlightOverlay ? { color: 'transparent', caretColor: 'var(--text-primary)' } : undefined}
            />
        </div>
    );
}
