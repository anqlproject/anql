import { create } from 'zustand';

interface GlobalShortcutStore {
  isLocalSearchOpen: boolean;
  openLocalSearch: () => void;
  closeLocalSearch: () => void;
  isGlobalSearchOpen: boolean;
  openGlobalSearch: () => void;
  closeGlobalSearch: () => void;
  globalSearchCount: number;
  setGlobalSearchCount: (count: number) => void;
  createNewDocument: () => void;
  setCreateNewDocument: (fn: () => void) => void;
  exitApp: () => void;
  setExitApp: (fn: () => void) => void;
}

export const useGlobalShortcut = create<GlobalShortcutStore>((set) => ({
  isLocalSearchOpen: false,
  isGlobalSearchOpen: false,
  openLocalSearch: () => set({ isLocalSearchOpen: true }),
  closeLocalSearch: () => set({ isLocalSearchOpen: false }),
  openGlobalSearch: () => set({ isGlobalSearchOpen: true }),
  closeGlobalSearch: () => set({ isGlobalSearchOpen: false }),
  globalSearchCount: 0,
  setGlobalSearchCount: (count) => set({ globalSearchCount: count }),
  createNewDocument: () => {},
  setCreateNewDocument: (fn) => set({ createNewDocument: fn }),
  exitApp: () => {},
  setExitApp: (fn) => set({ exitApp: fn }),
}));
