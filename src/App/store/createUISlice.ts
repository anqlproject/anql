import { StateCreator } from 'zustand';

export interface UISlice {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  windowHeight: number;
  setWindowHeight: (height: number) => void;

  isMac: boolean;
  isWindows: boolean;

  isContextMenuOpen: boolean;
  setIsContextMenuOpen: (open: boolean) => void;

  focusHighlight: { element: HTMLElement; elementRect: DOMRect; editorRect: { x: number; y: number; width: number; height: number } } | null;
  setFocusHighlight: (highlight: { element: HTMLElement; elementRect: DOMRect; editorRect: { x: number; y: number; width: number; height: number } } | null) => void;
}

const isMac = typeof window !== "undefined" && window.navigator.userAgent.includes("Mac");
const isWindows = typeof window !== "undefined" && window.navigator.userAgent.includes("Windows");

export const createUISlice: StateCreator<UISlice> = (set) => ({
  sidebarWidth: 250,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  windowHeight: typeof window !== "undefined" ? window.innerHeight : 1000,
  setWindowHeight: (height) => set({ windowHeight: height }),

  isMac,
  isWindows,

  isContextMenuOpen: false,
  setIsContextMenuOpen: (open) => set({ isContextMenuOpen: open }),

  focusHighlight: null,
  setFocusHighlight: (highlight) => set({ focusHighlight: highlight }),
});

