/**
 * TableTitle.tsx
 *
 * Isolated component for the table name input field.
 *
 * KEY DESIGN DECISION — why we use a local state:
 * The `tableName` prop comes from the Lexical node (__tableName).
 * If we called editor.update() on every keystroke, Lexical would
 * re-decorate the component mid-typing, resetting the cursor position
 * and causing character-drop bugs (the "incoherence" issue).
 *
 * Solution: keep local state for the visual input value, and only
 * commit to Lexical on blur or Enter. The prop is used only to
 * initialize / sync from external changes (e.g., undo/redo).
 */
import { $getNodeByKey, LexicalEditor, NodeKey } from 'lexical';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { $isTableNode } from './TableNode';

interface TableTitleProps {
  nodeKey: NodeKey;
  editor: LexicalEditor;
  /** Current persisted name coming from the Lexical node. */
  tableName: string;
}

export function TableTitle({ nodeKey, editor, tableName }: TableTitleProps) {
  const { t } = useTranslation();
  // Local state: tracks the input value without triggering Lexical updates on every keystroke.
  const [localName, setLocalName] = useState(tableName);

  // Keep localName in sync when external changes occur (undo/redo, paste from elsewhere).
  // We use a ref to avoid resetting localName while the user is actively typing.
  const isFocusedRef = useRef(false);
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalName(tableName);
    }
  }, [tableName]);

  /** Commit local value to Lexical only when editing is finished. */
  const commitToLexical = (name: string) => {
    if (name === tableName) return; // No change — skip the update
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isTableNode(node)) {
        node.updateTableName(name);
      }
    });
  };

  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    setIsFocused(false);
    commitToLexical(localName);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    setIsFocused(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const isEmpty = localName.trim() === '';

  return (
    <div className={`table-title-container ${isEmpty && !isFocused ? 'is-empty' : ''}`}>
      <input
        ref={inputRef}
        className="table-title-input"
        value={localName}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={t('TABLE.titlePlaceholder') as string}
        spellCheck={false}
      />
      {isEmpty && !isFocused && (
        <div
          className="table-title-marker"
          onClick={() => {
            setIsFocused(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          title={t('TABLE.addTitle') as string}
        />
      )}
    </div>
  );
}
