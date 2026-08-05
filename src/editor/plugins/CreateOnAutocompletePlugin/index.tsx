/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  setDOMUnmanaged,
  TextNode,
} from "lexical";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CreateOnAutocompleteManager from "./CreateOnAutocompleteManager.tsx";

const AUTOCOMPLETE_GHOST_ATTR = 'data-autocomplete-ghost';

function formatSuggestionText(suggestion: string): string {
  return `${suggestion} (press TAB ↵)`;
}

function clearAllGhosts(): void {
  // Search the entire document to catch orphaned ghosts after Lexical DOM remounts
  for (const el of document.querySelectorAll(`[${AUTOCOMPLETE_GHOST_ATTR}]`)) {
    el.remove();
  }
}

function syncGhost(
  editor: LexicalEditor,
  textNodeKey: NodeKey | null,
  ghostText: string | null,
): void {
  // Always clear document-wide to handle orphaned ghosts after Lexical remounts
  clearAllGhosts();

  if (textNodeKey === null || ghostText === null) {
    return;
  }
  const dom = editor.getElementByKey(textNodeKey);
  if (!dom) {
    return;
  }
  const ghost = document.createElement('span');
  ghost.setAttribute(AUTOCOMPLETE_GHOST_ATTR, 'true');
  ghost.setAttribute('contenteditable', 'false');
  ghost.style.color = '#999';
  ghost.style.pointerEvents = 'none';
  ghost.textContent = formatSuggestionText(ghostText);

  setDOMUnmanaged(ghost);
  dom.appendChild(ghost);
}

const SUGGESTION_LIST_LENGTH_LIMIT = 5;

const AutocompleteOptionsCache = new Map();


export type OptionName = "Code" | "Line" | "Image" | "Table" | "Heading 1"
  | "Heading 2" | "Heading 3" | "Number List" | "Bullet List" | "Check List" | "Quote" | "null" | "Math" | "Help";

export interface OptionData {
  name: OptionName;
  keywords: string[];
}

export const AutocompleteOptions: OptionData[] = [
  { name: "Code", keywords: ["code", "script"] },
  { name: "Line", keywords: ["line", "separator"] },
  { name: "Image", keywords: ["image", "photo", "picture", "img"] },
  { name: "Table", keywords: ["table"] },
  { name: "Heading 1", keywords: ["heading 1", "h1"] },
  { name: "Heading 2", keywords: ["heading 2", "h2"] },
  { name: "Heading 3", keywords: ["heading 3", "h3"] },
  { name: "Number List", keywords: ["number list", "ordered list"] },
  { name: "Bullet List", keywords: ["bullet list", "list", "unordered list"] },
  { name: "Check List", keywords: ["check list", "todo", "task"] },
  { name: "Quote", keywords: ["quote"] },
  { name: "Math", keywords: ["math", "conversion", "calculator"] },
  { name: "Help", keywords: ["help", "documentation", "doc"] }
];


const dummyLookupService = {
  search(
    string: string,
    callback: (results: Array<{ displayName: string, actualName: OptionName }>) => void,
    signal?: AbortSignal,
  ): void {
    const timeout = setTimeout(() => {
      if (signal?.aborted) {
        return;
      }
      const searchLower = string.toLowerCase();
      const results: Array<{ displayName: string, actualName: OptionName }> = [];

      AutocompleteOptions.forEach((item) => {
        if (item.name.toLowerCase().startsWith(searchLower)) {
          results.push({ displayName: item.name, actualName: item.name });
        } else {
          const matchedKeyword = item.keywords.find((k) => k.toLowerCase().startsWith(searchLower));
          if (matchedKeyword) {
            const display = matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1);
            results.push({ displayName: display, actualName: item.name });
          }
        }
      });


      if (!signal?.aborted) {
        callback(results);
      }
    }, 250);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
    });
  },
};

function useAutocompleteLookupService(queryString: string | null) {
  const [results, setResults] = useState<Array<{ displayName: string, actualName: OptionName }>>([]);

  useEffect(() => {
    const cachedResults = AutocompleteOptionsCache.get(queryString);

    if (queryString == null) {
      setResults([]);
      return;
    }

    if (cachedResults === null) {
      return;
    } else if (cachedResults !== undefined) {
      setResults(cachedResults);
      return;
    }

    AutocompleteOptionsCache.set(queryString, null);
    const controller = new AbortController();

    dummyLookupService.search(queryString, (newResults) => {
      if (!controller.signal.aborted) {
        AutocompleteOptionsCache.set(queryString, newResults);
        setResults(newResults);
      }
    }, controller.signal);

    return () => {
      controller.abort();
    };
  }, [queryString]);

  return results;
}

function hasContentBeforeCurrentNode(
  node: LexicalNode,
  topLevelElement: LexicalNode,
): boolean {
  let current: LexicalNode | null = node;

  while (current !== null && current !== topLevelElement) {
    const previous: LexicalNode | null = current.getPreviousSibling();
    if (previous !== null) {
      if (previous.getTextContent().trim().length > 0) {
        return true;
      }
      current = previous;
      continue;
    }
    current = current.getParent();
  }

  return false;
}

function hasContentAfterCursor(
  node: LexicalNode,
  cursorOffset: number,
  topLevelElement: LexicalNode,
): boolean {
  if (node.getTextContent().slice(cursorOffset).trim().length > 0) {
    return true;
  }

  let current: LexicalNode | null = node;

  while (current !== null && current !== topLevelElement) {
    const next: LexicalNode | null = current.getNextSibling();
    if (next !== null) {
      if (next.getTextContent().trim().length > 0) {
        return true;
      }
      current = next;
      continue;
    }
    current = current.getParent();
  }

  return false;
}

function isBlockStartForEmptyAutocomplete(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return false;
  }

  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return false;
  }

  const anchorNode = anchor.getNode();
  const topLevelElement = anchorNode.getTopLevelElement();
  if (topLevelElement === null) {
    return false;
  }

  // Only trigger autocomplete inside an empty ParagraphNode.
  // This prevents activation in any other block type (MathExpNode, CodeNode,
  // HeadingNode, ListItemNode, QuoteNode, etc.).
  if (!$isParagraphNode(topLevelElement)) {
    return false;
  }

  if (hasContentBeforeCurrentNode(anchorNode, topLevelElement)) {
    return false;
  }

  if (hasContentAfterCursor(anchorNode, anchor.offset, topLevelElement)) {
    return false;
  }

  return true;
}

function getPossibleQueryMatch(text: string): MenuTextMatch | null {
  if (!isBlockStartForEmptyAutocomplete()) {
    return null;
  }

  if (text.length === 0) {
    return null;
  }

  return {
    leadOffset: 0,
    matchingString: text,
    replaceableString: text,
  };
}

class AutocompleteOption extends MenuOption {
  displayName: string;
  actualName: OptionName;
  picture: JSX.Element;

  constructor(displayName: string, actualName: OptionName, picture: JSX.Element) {
    super(displayName);
    this.displayName = displayName;
    this.actualName = actualName;
    this.picture = picture;
  }
}

export default function CreateOnAutocompletePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  const [queryString, setQueryString] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useAutocompleteLookupService(queryString);

  const options = useMemo(
    () =>
      results
        .map(
          (result) =>
            new AutocompleteOption(result.displayName, result.actualName, <i className="icon plus" />),
        )
        .slice(0, SUGGESTION_LIST_LENGTH_LIMIT),
    [results],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [queryString]);

  const [selectedOption, setSelectedOption] = useState<OptionName>("null");

  // Use refs to avoid re-registering commands on every change
  const queryStringRef = useRef<string | null>(null);
  const optionsRef = useRef<AutocompleteOption[]>([]);
  const selectedIndexRef = useRef(0);

  queryStringRef.current = queryString;
  optionsRef.current = options;
  selectedIndexRef.current = selectedIndex;

  const onSelectOption = useCallback(
    (
      _selectedOption: AutocompleteOption,
      _nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      // Do nothing - Tab command handles node creation
      closeMenu();
    },
    [],
  );

  const checkForMatch = useCallback(
    (text: string) => getPossibleQueryMatch(text),
    [],
  );

  // Clear ghost and reset query when window regains focus (app switch back)
  useEffect(() => {
    const handleFocus = () => {
      // When the user comes back to the app, clear any stale ghosts and reset
      clearAllGhosts();
      setQueryString(null);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        clearAllGhosts();
        setQueryString(null);
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Separate effect for managing autocomplete node state
  useEffect(() => {
    const clearAutocompleteNodes = () => {
      syncGhost(editor, null, null);
    };

    if (queryString === null || !options.length) {
      clearAutocompleteNodes();
      return;
    }

    if (selectedIndex >= options.length) {
      setSelectedIndex(0);
      return;
    }

    const selectedOption = options[selectedIndex];

    let newSuggestionText: string | null = null;

    if (selectedOption.displayName.toLowerCase().startsWith(queryString.toLowerCase())) {
      newSuggestionText = selectedOption.displayName.slice(queryString.length);
    } else {
      // Check if it matches a keyword exactly or partially to still show (TAB)
      const optionData = AutocompleteOptions.find(item => item.name === selectedOption.actualName);
      const matchesKeyword = optionData?.keywords?.some(k => k.toLowerCase().startsWith(queryString.toLowerCase()));
      if (matchesKeyword) {
        newSuggestionText = ""; // We just show (TAB)
      }
    }

    if (newSuggestionText === null) {
      clearAutocompleteNodes();
      return;
    }

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && selection.isCollapsed()) {
        const anchorNode = selection.anchor.getNode();
        syncGhost(editor, anchorNode.getKey(), newSuggestionText);
      }
    });
  }, [queryString, options, selectedIndex, editor]);

  // Register commands once on mount
  useEffect(() => {

    const tabCommand = editor.registerCommand(
      KEY_TAB_COMMAND,
      (event: KeyboardEvent) => {
        const currentQueryString = queryStringRef.current;
        const currentOptions = optionsRef.current;
        const currentSelectedIndex = selectedIndexRef.current;

        // Handle autocomplete creation with TAB
        if (currentQueryString && currentOptions[currentSelectedIndex]) {
          const selectedOption = currentOptions[currentSelectedIndex];
          let newSuggestionText = "";
          if (selectedOption.displayName.toLowerCase().startsWith(currentQueryString.toLowerCase())) {
            newSuggestionText = selectedOption.displayName.slice(currentQueryString.length);
          }

          // Also accept if query matches a keyword or is the full display name
          const optionData = AutocompleteOptions.find(item => item.name === selectedOption.actualName);
          const matchesKeyword = optionData?.keywords?.some(k => k.toLowerCase() === currentQueryString.toLowerCase());
          const isFullName = selectedOption.displayName.toLowerCase() === currentQueryString.toLowerCase();

          if (newSuggestionText || matchesKeyword || isFullName) {
            event.preventDefault();

            setQueryString(null);
            // Uniform path for all options.
            // Ghost cleanup happens in onUpdate (after topLevel.clear() is
            // committed) to avoid MutationObserver conflict with editor.update().
            editor.update(
              () => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                  const topLevel = selection.anchor.getNode().getTopLevelElement();
                  if (topLevel) {
                    topLevel.clear();
                  }
                }
              },
              {
                onUpdate: () => {
                  clearAllGhosts();
                },
              },
            );

            // Defer React state so TypeaheadPlugin has time to clean up its references.
            // By the time the Manager's useEffect fires, topLevel.clear() is
            // fully committed and the selection is valid.
            setTimeout(() => {
              setSelectedOption(selectedOption.actualName);
            }, 10);

            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const enterCommand = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        if (queryStringRef.current !== null) {
          setQueryString(null);
          // Don't call clearAutocompleteNodes() before editor.update():
          // same MutationObserver conflict as in the TAB handler.
          editor.update(
            () => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertParagraph();
              }
            },
            {
              onUpdate: () => {
                clearAllGhosts();
              },
            },
          );

          if (event) event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const escapeCommand = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (queryStringRef.current !== null) {
          setQueryString(null);
          // Defer DOM cleanup to avoid MutationObserver conflict during command dispatch
          queueMicrotask(() => clearAllGhosts());
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );

    const arrowDownCommand = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        if (queryStringRef.current !== null) {
          setQueryString(null);
          queueMicrotask(() => clearAllGhosts());
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    const arrowUpCommand = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      () => {
        if (queryStringRef.current !== null) {
          setQueryString(null);
          queueMicrotask(() => clearAllGhosts());
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    return () => {
      tabCommand();
      enterCommand();
      escapeCommand();
      arrowDownCommand();
      arrowUpCommand();
    };
  }, [editor, onSelectOption]);


  return (
    <div>
      <CreateOnAutocompleteManager
        editor={editor}
        optionName={selectedOption}
        clearOption={() => setSelectedOption("null")}
      />
      <LexicalTypeaheadMenuPlugin<AutocompleteOption>
        onQueryChange={setQueryString}
        onSelectOption={onSelectOption}
        triggerFn={checkForMatch}
        options={options}
        menuRenderFn={() => null}
      />
    </div>
  );
}
