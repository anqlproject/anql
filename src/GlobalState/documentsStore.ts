import { create } from 'zustand';

export interface DocumentsJson {
  id: string;
  path: string;
  workspace_id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface DocumentsStore {
  shouldRefresh: boolean;
  refreshDocuments: () => void;
}

export const useDocumentsStore = create<DocumentsStore>((set) => ({
  shouldRefresh: false,
  refreshDocuments: () => set((state) => ({ shouldRefresh: !state.shouldRefresh })),
}));
