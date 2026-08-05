import { create } from 'zustand';

import { DocumentsJson } from "@/core/database/useDocumentDatabase";

type Page =
  'content'
  | 'home'
  | 'editor'
  | 'history'
  | 'trash'
  | 'schedule'
  | 'todolist'
  | 'reorderablelist'
  | 'kanban'
  | 'search';

interface NavigationStore {
  currentPage: Page;
  navigateTo: (page: Page, document?: DocumentsJson | null) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  currentPage: 'home',
  navigateTo: (page) => set({ currentPage: page }),
}));
