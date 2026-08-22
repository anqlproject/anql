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

import { $isTableNode } from './TableNode';

interface TableTitleProps {
  nodeKey: NodeKey;
  editor: LexicalEditor;
  /** Current persisted name coming from the Lexical node. */
  tableName: string;
}

export function TableTitle({ nodeKey, editor, tableName }: TableTitleProps) {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    commitToLexical(localName);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="table-title-container">
      <input
        className="table-title-input"
        value={localName}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Table name..."
        spellCheck={false}
      />
    </div>
  );
}
