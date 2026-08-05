import { IS_APPLE } from '@lexical/utils';
import { create } from 'zustand';

import { useNavigationStore } from './navigationStore';

type ShortcutContext = 'editor' | 'global' | 'both';

interface ShortcutDefinition {
  key: string;
  modifiers: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  };
  context: ShortcutContext;
  description: string;
}

interface ShortcutCallback {
  (event?: KeyboardEvent): void;
}

interface ShortcutStore {
  // Registered shortcuts
  shortcuts: Map<string, ShortcutDefinition>;
  // Callbacks for each shortcut
  callbacks: Map<string, ShortcutCallback>;
  
  // Actions
  registerShortcut: (id: string, definition: ShortcutDefinition) => void;
  registerCallback: (id: string, callback: ShortcutCallback) => void;
  unregisterCallback: (id: string) => void;
  handleKeyDown: (event: KeyboardEvent) => boolean;
}

export const useShortcutStore = create<ShortcutStore>((set, get) => ({
  shortcuts: new Map(),
  callbacks: new Map(),
  
  registerShortcut: (id, definition) => {
    set((state) => {
      const newShortcuts = new Map(state.shortcuts);
      newShortcuts.set(id, definition);
      return { shortcuts: newShortcuts };
    });
  },
  
  registerCallback: (id, callback) => {
    set((state) => {
      const newCallbacks = new Map(state.callbacks);
      newCallbacks.set(id, callback);
      return { callbacks: newCallbacks };
    });
  },
  
  unregisterCallback: (id) => {
    set((state) => {
      const newCallbacks = new Map(state.callbacks);
      newCallbacks.delete(id);
      return { callbacks: newCallbacks };
    });
  },
  
  handleKeyDown: (event) => {
    const { shortcuts, callbacks } = get();
    
    // Calculate context on the fly from navigation store
    const currentPage = useNavigationStore.getState().currentPage;
    const currentContext = currentPage === 'editor' ? 'editor' : 'global';
    
    // Find matching shortcut
    for (const [id, definition] of shortcuts.entries()) {
      if (matchesShortcut(event, definition)) {
        // Check if shortcut is valid for current context
        if (definition.context === 'both' || definition.context === currentContext) {
          const callback = callbacks.get(id);
          if (callback) {
            event.preventDefault();
            callback(event);
            return true;
          }
        }
      }
    }
    
    return false;
  },
}));

// Helper function to check if event matches shortcut definition
export function matchesShortcut(event: KeyboardEvent, definition: ShortcutDefinition): boolean {
  const { key, modifiers } = definition;

  // Check key - support both DigitX and NumpadX for number keys
  if (event.code !== key) {
    // For number keys, also accept NumpadX if DigitX is defined
    if (key.startsWith('Digit') && event.code === key.replace('Digit', 'Numpad')) {
      // Accept NumpadX as equivalent to DigitX
    } else {
      return false;
    }
  }

  // Check modifiers - undefined means the modifier must NOT be pressed
  if (modifiers.ctrlKey !== undefined) {
    if (event.ctrlKey !== modifiers.ctrlKey) return false;
  } else if (event.ctrlKey) {
    return false;
  }

  if (modifiers.metaKey !== undefined) {
    if (event.metaKey !== modifiers.metaKey) return false;
  } else if (event.metaKey) {
    return false;
  }

  if (modifiers.altKey !== undefined) {
    if (event.altKey !== modifiers.altKey) return false;
  } else if (event.altKey) {
    return false;
  }

  if (modifiers.shiftKey !== undefined) {
    if (event.shiftKey !== modifiers.shiftKey) return false;
  } else if (event.shiftKey) {
    return false;
  }

  return true;
}

// Platform-specific helper
const CONTROL_OR_META = { ctrlKey: !IS_APPLE, metaKey: IS_APPLE };

// Editor shortcut definitions
export const EDITOR_SHORTCUTS = {
  FORMAT_PARAGRAPH: {
    key: 'Digit0',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Format as paragraph',
  },
  HEADING1: {
    key: 'Digit1',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Heading 1',
  },
  HEADING2: {
    key: 'Digit2',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Heading 2',
  },
  HEADING3: {
    key: 'Digit3',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Heading 3',
  },
  FORMAT_CODE: {
    key: 'KeyC',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Format as code',
  },
  FORMAT_QUOTE: {
    key: 'KeyQ',
    modifiers: { ctrlKey: true, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Format as quote',
  },
  STRIKETHROUGH: {
    key: 'KeyX',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Strikethrough',
  },
  LOWERCASE: {
    key: 'Digit1',
    modifiers: { ctrlKey: true, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Lowercase',
  },
  UPPERCASE: {
    key: 'Digit2',
    modifiers: { ctrlKey: true, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Uppercase',
  },
  CAPITALIZE: {
    key: 'Digit3',
    modifiers: { ctrlKey: true, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Capitalize',
  },
  CENTER_ALIGN: {
    key: 'KeyE',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Center align',
  },
  JUSTIFY_ALIGN: {
    key: 'KeyJ',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Justify align',
  },
  LEFT_ALIGN: {
    key: 'KeyL',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Left align',
  },
  RIGHT_ALIGN: {
    key: 'KeyR',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Right align',
  },
  SUBSCRIPT: {
    key: 'Comma',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Subscript',
  },
  SUPERSCRIPT: {
    key: 'Period',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Superscript',
  },
  INDENT: {
    key: 'BracketRight',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Indent',
  },
  OUTDENT: {
    key: 'BracketLeft',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Outdent',
  },
  CLEAR_FORMATTING: {
    key: 'Backslash',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Clear formatting',
  },
  INSERT_LINK: {
    key: 'KeyK',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Insert link',
  },
  SELECT_ALL: {
    key: 'KeyA',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Select all',
  },
  SAVE: {
    key: 'KeyS',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Save',
  },
  INCREASE_FONT_SIZE: {
    key: 'Period',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Increase font size',
  },
  DECREASE_FONT_SIZE: {
    key: 'Comma',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Decrease font size',
  },
  INSERT_CODE_BLOCK: {
    key: 'KeyC',
    modifiers: { ...CONTROL_OR_META, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Insert code block',
  },
  NUMBERED_LIST: {
    key: 'Digit4',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Numbered list',
  },
  BULLET_LIST: {
    key: 'Digit5',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Bullet list',
  },
  CHECK_LIST: {
    key: 'Digit6',
    modifiers: { ...CONTROL_OR_META, altKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Check list',
  },
  ADD_ABOVE: {
    key: 'ArrowUp',
    modifiers: { altKey: true, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Add node above',
  },
  ADD_BELOW: {
    key: 'ArrowDown',
    modifiers: { altKey: true, shiftKey: true },
    context: 'editor' as ShortcutContext,
    description: 'Add node below',
  },
};

// Global shortcut definitions
export const GLOBAL_SHORTCUTS = {
  LOCAL_SEARCH: {
    key: 'KeyF',
    modifiers: CONTROL_OR_META,
    context: 'editor' as ShortcutContext,
    description: 'Local search',
  },
  GLOBAL_SEARCH: {
    key: 'KeyG',
    modifiers: CONTROL_OR_META,
    context: 'both' as ShortcutContext,
    description: 'Global search',
  },
  NEW_DOCUMENT: {
    key: 'KeyN',
    modifiers: CONTROL_OR_META,
    context: 'both' as ShortcutContext,
    description: 'Create new document',
  },
  EXIT_APP: {
    key: 'KeyQ',
    modifiers: CONTROL_OR_META,
    context: 'both' as ShortcutContext,
    description: 'Exit application',
  },
};
