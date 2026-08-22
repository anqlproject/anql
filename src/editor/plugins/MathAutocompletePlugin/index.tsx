import "./MathAutocompletePlugin.css";

import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
  TextNode,
} from "lexical";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { MATH_CATEGORIES, MathItem } from "@/App/AppComponents/MathPanel/MathPanel";
import { useMathVariables } from "@/editor/context/MathVariablesContext";
import { $isMathExpNode } from "@/editor/nodes/MathNode/MathExpNode";

class MathAutocompleteOption extends MenuOption {
  title: string;
  insertText: string;
  isVariable: boolean;

  constructor(title: string, insertText: string, isVariable: boolean = false) {
    super(title);
    this.title = title;
    this.insertText = insertText;
    this.isVariable = isVariable;
  }
}

// Regex to match math variables (e.g., Tab, Table1, sin, Table1.Col[1])
const MATCH_MATH_VARIABLE_REGEX = /(?:^|[\s(+\-*/,])([a-zA-Z_][a-zA-Z0-9_.[\]]*)$/;

function checkForMatch(text: string) {
  const match = MATCH_MATH_VARIABLE_REGEX.exec(text);
  if (match !== null) {
    const matchingString = match[1];
    if (matchingString.length >= 1) {
      return {
        leadOffset: match.index + (match[0].length - matchingString.length),
        matchingString,
        replaceableString: matchingString,
      };
    }
  }
  return null;
}

function MathAutocompleteMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: MathAutocompleteOption;
}) {
  let className = 'item';
  if (isSelected) {
    className += ' selected';
  }
  if (option.isVariable) {
    className += ' variable';
  }
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}>
      <span className="text">{option.title}</span>
    </li>
  );
}



export default function MathAutocompletePlugin(): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const { variables, tableVariables } = useMathVariables();
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const closePopover = useCallback(() => {
    setTimeout(() => setQueryString(null), 0);
    setIsTyping(false);
  }, []);

  // Track typing state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only track typing if it's a character key (not special keys)
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        setIsTyping(true);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 500);
      }
    };

    const handleSelectionChange = () => {
      setIsTyping(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    editor.registerUpdateListener(() => {
      handleSelectionChange();
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);

  // Close popover when clicking outside
  React.useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [closePopover]);

  // Update anchor reference when anchor element changes
  React.useEffect(() => {
    return () => {
      anchorRef.current = null;
    };
  }, []);

  const checkForMathMatch = useCallback(
    (text: string, editor: LexicalEditor) => {
      // Only show autocomplete when typing, not when clicking
      if (!isTyping) return null;

      let isMathNode = false;
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          const element = anchorNode.getType() === 'mathexp' ? anchorNode : anchorNode.getParent();
          if ($isMathExpNode(element)) {
            isMathNode = true;
          }
        }
      });

      if (!isMathNode) return null;

      return checkForMatch(text);
    },
    [isTyping]
  );

  const options = useMemo(() => {
    if (queryString == null) return [];

    const query = queryString.toLowerCase();
    const variableItems: MathItem[] = [];

    // Add regular variables, but filter out table names
    Object.entries(variables).forEach(([name, value]) => {
      // Filter out table names (they are objects in tableVariables)
      const isTableName = tableVariables[name] !== undefined;
      if (!isTableName) {
        variableItems.push({ label: `${name} (${value})`, insert: name });
      }
    });

    Object.entries(tableVariables).forEach(([tableName, columns]) => {
      Object.entries(columns).forEach(([columnName, values]) => {
        // Add column reference as a variable
        const columnRef = `${tableName}.${columnName}`;
        variableItems.push({
          label: `${columnRef} (column)`,
          insert: columnRef,
        });

        // Add individual cell references
        values.forEach((value, index) => {
          const cellRef = `${tableName}.${columnName}[${index + 1}]`;
          variableItems.push({
            label: `${cellRef} (${value})`,
            insert: cellRef,
          });
        });
      });
    });

    let allItems = variableItems.map(item => ({ ...item, isVariable: true }));
    MATH_CATEGORIES.forEach(category => {
      if (!category.isDynamic) {
        allItems = allItems.concat(category.items.map(item => ({ ...item, isVariable: false })));
      }
    });

    const seen = new Set();
    const filteredOptions = allItems.filter(item => {
      const match = item.label.toLowerCase().includes(query) || item.insert.toLowerCase().includes(query);
      if (match && !seen.has(item.label)) {
        seen.add(item.label);
        return true;
      }
      return false;
    });

    return filteredOptions.slice(0, 15).map(item => new MathAutocompleteOption(item.label, item.insert, item.isVariable));
  }, [queryString, variables, tableVariables]);

  const onSelectOption = useCallback(
    (
      selectedOption: MathAutocompleteOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || nodeToReplace == null) {
          return;
        }

        const text = selectedOption.insertText;
        nodeToReplace.replace(new TextNode(text));

        // Place caret at the end of the inserted text, or inside parentheses if present
        const updatedSelection = $getSelection();
        if ($isRangeSelection(updatedSelection)) {
          const anchor = updatedSelection.anchor;
          const focus = updatedSelection.focus;

          if (text.endsWith('()')) {
            const openParenIndex = text.lastIndexOf('(');
            const cursorPos = openParenIndex + 1;
            anchor.set(anchor.key, cursorPos, anchor.type);
            focus.set(focus.key, cursorPos, focus.type);
          } else {
            anchor.set(anchor.key, text.length, anchor.type);
            focus.set(focus.key, text.length, focus.type);
          }
        }
      });
      closeMenu();
      closePopover();
    },
    [editor, closePopover],
  );

  // Scroll selected item into view
  const scrollSelectedIntoView = useCallback((selectedIndex: number | null) => {
    if (selectedIndex == null) return;
    const popover = popoverRef.current;
    if (!popover) return;

    const items = popover.querySelectorAll('li');
    const selectedItem = items[selectedIndex];
    if (!selectedItem) return;

    selectedItem.scrollIntoView({
      block: 'nearest',
      behavior: 'auto'
    });
  }, []);

  return (
    <LexicalTypeaheadMenuPlugin<MathAutocompleteOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForMathMatch}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (anchorElementRef.current == null || options.length === 0) {
          return null;
        }

        // Scroll selected item into view when selection changes
        scrollSelectedIntoView(selectedIndex);

        // Update anchor reference for floating-ui
        if (anchorRef.current !== anchorElementRef.current) {
          anchorRef.current = anchorElementRef.current;
          refs.setReference(anchorElementRef.current);
        }

        return (
          <div
            ref={(node) => {
              refs.setFloating(node);
              if (popoverRef.current !== node) {
                popoverRef.current = node;
              }
            }}
            className="math-typeahead-popover"
            style={floatingStyles}
          >
            <ul>
              {options.map((option, i) => (
                <MathAutocompleteMenuItem
                  key={option.key}
                  index={i}
                  isSelected={selectedIndex === i}
                  onClick={() => {
                    selectOptionAndCleanUp(option);
                    closePopover();
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  option={option}
                />
              ))}
            </ul>
          </div>
        );
      }}
    />
  );
}
