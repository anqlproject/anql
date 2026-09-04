import './TableCell.css';

import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { debounce } from 'lodash-es';
import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
    original: { _rowId: string };
}

interface TableMeta {
    updateData: (rowId: string, columnId: string, value: unknown) => void;
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
    onExitEdit?: () => void,
) {
    // Allow undo (Ctrl/Cmd+Z), redo (Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z), Escape,
    // and Select All (Ctrl/Cmd+A) to bubble up to Lexical.
    const isUndoRedo =
        (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y') &&
        (e.ctrlKey || e.metaKey);
    const isSelectAll = (e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey);

    if (isUndoRedo || isSelectAll) {
        return; // let the event bubble
    }

    if (e.key === 'Escape') {
        onExitEdit?.();
        return;
    }

    e.stopPropagation();

    if (rowIndex < 0) return;

    const columnIndex = getColumnIndex(table, columnId);
    if (columnIndex < 0) return;

    if (e.key === "Tab") {
        e.preventDefault();
        onExitEdit?.();
        if (e.shiftKey) {
            table.options.meta?.goToPreviousCell?.(rowIndex, columnIndex);
        } else {
            table.options.meta?.goToNextCell?.(rowIndex, columnIndex);
        }
        return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onExitEdit?.();
        table.options.meta?.goToCellBelow?.(rowIndex, columnIndex);
        return;
    }

    if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        onExitEdit?.();
        table.options.meta?.goToCellAbove?.(rowIndex, columnIndex);
    }
}

// ── Display cell (div shown when not editing) ──────────────────────────────

interface DisplayCellProps {
    value: unknown;
    type: 'text' | 'number';
    searchQuery: string;
    isActiveMatch: boolean;
    isEditable: boolean;
    onStartEdit: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
}

function DisplayCell({ value, searchQuery, isActiveMatch, isEditable, onStartEdit, onKeyDown }: DisplayCellProps) {
    const displayText = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    const segments = useMemo(() => getHighlightedSegments(value, searchQuery), [value, searchQuery]);
    const hasMatch = segments.some(s => s.isMatch);

    const handleClick = () => {
        if (isEditable) onStartEdit();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.key === 'Enter' || e.key === ' ') && isEditable) {
            e.preventDefault();
            onStartEdit();
            return;
        }
        onKeyDown(e);
    };

    return (
        <div
            className="table-cell-display"
            role="gridcell"
            tabIndex={isEditable ? 0 : -1}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            title={displayText}
        >
            {searchQuery && hasMatch
                ? segments.map((segment, i) => (
                    <span
                        key={i}
                        className={segment.isMatch ? (isActiveMatch ? 'table-search-match-active' : 'table-search-match') : undefined}
                    >
                        {segment.text}
                    </span>
                ))
                : displayText
            }
        </div>
    );
}

// ── Main EditableCell ──────────────────────────────────────────────────────

export default function EditableCell({ getValue, row, column: { id, columnDef }, table }: EditableCellProps) {
    const index = row.index;
    const rowId = (row.original as any)?._rowId as string || '';
    const { t } = useTranslation();
    const isEditable = useLexicalEditable();
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isActiveMatch, setIsActiveMatch] = useState(false);
    const type = columnDef.meta?.type || 'text';

    const tableRef = useRef(table);
    useEffect(() => {
        tableRef.current = table;
    }, [table]);

    const handleBlur = (currentValue: string | number | boolean | null | undefined) => {
        setIsEditing(false);
        setTimeout(() => {
            tableRef.current.options.meta?.updateData(rowId, id, currentValue);
        }, 10);
    };

    const debouncedSave = useMemo(
        () =>
            debounce((newValue: string | number | boolean | null | undefined) => {
                tableRef.current.options.meta?.updateData(rowId, id, newValue);
            }, 1000),
        [rowId, id]
    );

    useEffect(() => {
        return () => debouncedSave.cancel();
    }, [debouncedSave]);

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

    const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();

        if (e.button !== 2 || !(e.currentTarget instanceof HTMLInputElement)) {
            return;
        }

        const input = e.currentTarget;

        // If there is an active text selection, preserve it instead of moving the caret
        if (input.selectionStart !== null && input.selectionEnd !== null && input.selectionStart !== input.selectionEnd) {
            return;
        }

        e.preventDefault();

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

    const exitEdit = () => setIsEditing(false);

    // ── Checkbox ────────────────────────────────────────────────────────────
    if (type === 'checkbox') {
        return (
            <div className="table-checkbox-wrapper">
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => {
                        const checked = e.target.checked;
                        setValue(checked);
                        tableRef.current.options.meta?.updateData(rowId, id, checked);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => handleCellKeyDown(e, table, index, id)}
                    className="table-checkbox"
                    disabled={!isEditable}
                />
            </div>
        );
    }

    // ── Date ────────────────────────────────────────────────────────────────
    if (type === 'date') {
        return (
            <div className="table-date-wrapper">
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <button
                            type="button"
                            className="table-date-btn"
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={!isEditable}
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
                                    tableRef.current.options.meta?.updateData(rowId, id, dateStr);
                                }}
                            />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>
        );
    }

    // ── Number ──────────────────────────────────────────────────────────────
    if (type === 'number') {
        if (!isEditing) {
            return (
                <DisplayCell
                    value={value}
                    type="number"
                    searchQuery={searchQuery}
                    isActiveMatch={isActiveMatch}
                    isEditable={isEditable}
                    onStartEdit={() => setIsEditing(true)}
                    onKeyDown={(e) => handleCellKeyDown(e, table, index, id, exitEdit)}
                />
            );
        }

        return (
            <div className="table-input-wrapper">
                <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    type="number"
                    value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                    onChange={e => {
                        setValue(e.target.value);
                        debouncedSave(e.target.value);
                    }}
                    onBlur={(e) => handleBlur(e.target.value)}
                    onMouseDown={handleMouseDown}
                    onKeyDown={(e) => handleCellKeyDown(e, table, index, id, exitEdit)}
                    className="table-input"
                    placeholder={String(t('TABLE.placeholderNumber'))}
                    disabled={!isEditable}
                />
            </div>
        );
    }

    // ── Text (default) ──────────────────────────────────────────────────────
    if (!isEditing) {
        return (
            <DisplayCell
                value={value}
                type="text"
                searchQuery={searchQuery}
                isActiveMatch={isActiveMatch}
                isEditable={isEditable}
                onStartEdit={() => setIsEditing(true)}
                onKeyDown={(e) => handleCellKeyDown(e, table, index, id, exitEdit)}
            />
        );
    }

    return (
        <div className="table-input-wrapper">
            <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={typeof value === 'string' ? value : ''}
                onChange={e => {
                    setValue(e.target.value);
                    debouncedSave(e.target.value);
                }}
                onBlur={(e) => handleBlur(e.target.value)}
                onMouseDown={handleMouseDown}
                onKeyDown={(e) => handleCellKeyDown(e, table, index, id, exitEdit)}
                className="table-input"
                placeholder={String(t('TABLE.placeholderText'))}
                disabled={!isEditable}
            />
        </div>
    );
}
